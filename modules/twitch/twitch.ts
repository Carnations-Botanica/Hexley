import { Events, EmbedBuilder, type Interaction, TextChannel, PermissionsBitField } from 'discord.js';

/**
 * The globally accessible module object.
 */
export const twitch = {

    // Module Logging Color
    moduleColor: "#9343FF",

    // Define the config and activeSubscriptions objects
    config: {} as { [key: string]: any },
    activeSubscriptions: [] as string[],
    streamStartedAt: null as Date | null, // To store the stream's start time

    /**
     * Main Entry Point for the Twitch module.
     */
    async twitchInit(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/twitchInit]', this.moduleColor)} Initializing Twitch Module...`);

        const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_USER_LOGIN } = this.config;
        if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_USER_LOGIN) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/twitchInit]', Hexley.frameworks.aurora.tintRed)} Fatal: Missing Twitch environment variables.`);
            return;
        }

        // Initialize EventSub webhooks if the callback URL is provided
        if (this.config.TWITCH_CALLBACK_URL) {
            await this._initializeEventSub(Hexley);
        }

        // Slash Command Handler
        if (Hexley.resources.framework.discord.isLoaded) {
            Hexley.frameworks.discord.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
                if (!interaction.isChatInputCommand() || interaction.commandName !== 'twitch') return;

                await interaction.deferReply();

                try {
                    const accessToken = await this._getAccessToken(Hexley, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
                    if (!accessToken) {
                        await interaction.editReply('Could not connect to Twitch API.');
                        return;
                    }

                    const broadcasterId = await this._getUserId(Hexley, TWITCH_CLIENT_ID, accessToken, TWITCH_USER_LOGIN);
                    if (!broadcasterId) {
                        await interaction.editReply(`Twitch user "${TWITCH_USER_LOGIN}" not found.`);
                        return;
                    }

                    const [channelInfo, streamInfo, userInfo, followerCount, chatColor] = await Promise.all([
                        this._getChannelInfo(Hexley, TWITCH_CLIENT_ID, accessToken, broadcasterId),
                        this._getStreamInfo(Hexley, TWITCH_CLIENT_ID, accessToken, broadcasterId),
                        this._getUserInfo(Hexley, TWITCH_CLIENT_ID, accessToken, broadcasterId),
                        this._getFollowerCount(Hexley, TWITCH_CLIENT_ID, accessToken, broadcasterId),
                        this._getUserChatColor(Hexley, TWITCH_CLIENT_ID, accessToken, broadcasterId)
                    ]);

                    if (!userInfo) {
                        await interaction.editReply('Could not fetch user information from Twitch.');
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setColor(chatColor)
                        .setAuthor({ name: userInfo.display_name, iconURL: userInfo.profile_image_url, url: `https://twitch.tv/${userInfo.login}` })
                        .setThumbnail(userInfo.profile_image_url)
                        .setTimestamp();

                    if (streamInfo) { // Stream is LIVE
                        embed.setTitle(streamInfo.title)
                             .setURL(`https://twitch.tv/${userInfo.login}`)
                             .addFields(
                                 { name: 'Game', value: streamInfo.game_name, inline: true },
                                 { name: 'Viewers', value: streamInfo.viewer_count.toString(), inline: true },
                                 { name: 'Followers', value: followerCount.toLocaleString(), inline: true }
                             )
                             .setImage(`${streamInfo.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?t=${Date.now()}`)
                             .setFooter({ text: `Live since ${new Date(streamInfo.started_at).toLocaleString()}` });
                    } else { // Stream is OFFLINE
                        embed.setTitle('Currently Offline')
                             .setDescription(userInfo.description || 'No description set.')
                             .addFields(
                                { name: 'Last Seen Game', value: channelInfo?.game_name || 'N/A', inline: true },
                                { name: 'Followers', value: followerCount.toLocaleString(), inline: true }
                             );
                    }

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/interaction]', Hexley.frameworks.aurora.tintRed)} Error executing /twitch command: ${error}`);
                    await interaction.editReply('An error occurred while fetching Twitch data.');
                }
            });
        }
    },

    /**
     * Handles the setup of EventSub webhooks for live/offline notifications.
     */
    async _initializeEventSub(Hexley: any) {
        const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_USER_LOGIN, TWITCH_CALLBACK_URL, TWITCH_WEBSOCKET_SECRET } = this.config;
        
        if (!await this._performCallbackSelfCheck(Hexley, TWITCH_CALLBACK_URL)) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/eventsub]', Hexley.frameworks.aurora.tintRed)} Endpoint is unreachable. Skipping EventSub initialization.`);
            return;
        }

        const accessToken = await this._getAccessToken(Hexley, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
        if (!accessToken) return;

        const broadcasterId = await this._getUserId(Hexley, TWITCH_CLIENT_ID, accessToken, TWITCH_USER_LOGIN);
        if (!broadcasterId) return;
        
        const existingEventTypes = await this._syncExistingSubscriptions(Hexley, TWITCH_CLIENT_ID, accessToken);

        if (!existingEventTypes.includes('stream.online')) {
            const onlineId = await this._createEventSubSubscription(Hexley, TWITCH_CLIENT_ID, accessToken, broadcasterId, TWITCH_CALLBACK_URL, TWITCH_WEBSOCKET_SECRET, 'stream.online');
            if (onlineId) this.activeSubscriptions.push(onlineId);
        }

        if (!existingEventTypes.includes('stream.offline')) {
            const offlineId = await this._createEventSubSubscription(Hexley, TWITCH_CLIENT_ID, accessToken, broadcasterId, TWITCH_CALLBACK_URL, TWITCH_WEBSOCKET_SECRET, 'stream.offline');
            if (offlineId) this.activeSubscriptions.push(offlineId);
        }
    },

    /**
     * Formats a duration in milliseconds into a human-readable string.
     * @param {number} durationMs - The duration in milliseconds.
     * @returns {string} The formatted duration string.
     */
    _formatDuration(durationMs: number): string {
        if (durationMs < 0) return "0 seconds";

        let seconds = Math.floor(durationMs / 1000);
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);

        seconds %= 60;
        minutes %= 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

        return parts.join(', ');
    },

    // API HELPER FUNCTIONS

    async _getAccessToken(Hexley: any, clientId: string, clientSecret: string): Promise<string | null> {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/token]', this.moduleColor)} Getting App Access Token...`);
        try {
            const response = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
                method: 'POST',
            });
            if (!response.ok) {
                const errorData = await response.text();
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/token]', Hexley.frameworks.aurora.tintRed)} Error fetching access token: ${response.status} ${response.statusText} - ${errorData}`);
                return null;
            }
            const data: any = await response.json();
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/token]', this.moduleColor)} Successfully received App Access Token.`);
            return data.access_token;
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/token]', Hexley.frameworks.aurora.tintRed)} An error occurred while fetching access token: ${error}`);
            return null;
        }
    },

    async _getUserId(Hexley: any, clientId: string, accessToken: string, userLogin: string): Promise<string | null> {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/userid]', this.moduleColor)} Getting User ID for login: ${userLogin}...`);
        try {
            const response = await fetch(`https://api.twitch.tv/helix/users?login=${userLogin}`, {
                headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${accessToken}` },
            });
            if (!response.ok) {
                const errorData = await response.text();
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/userid]', Hexley.frameworks.aurora.tintRed)} Error fetching user ID: ${response.status} ${response.statusText} - ${errorData}`);
                return null;
            }
            const data: any = await response.json();
            if (data.data && data.data.length > 0) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/userid]', this.moduleColor)} Found user ID: ${data.data[0].id}`);
                return data.data[0].id;
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/userid]', Hexley.frameworks.aurora.tintRed)} User "${userLogin}" not found.`);
                return null;
            }
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/userid]', Hexley.frameworks.aurora.tintRed)} An error occurred while fetching user ID: ${error}`);
            return null;
        }
    },
    
    async _getUserInfo(Hexley: any, clientId: string, accessToken: string, broadcasterId: string): Promise<any | null> {
        try {
            const response = await fetch(`https://api.twitch.tv/helix/users?id=${broadcasterId}`, {
                headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${accessToken}` },
            });
            if (!response.ok) return null;
            const data: any = await response.json();
            return data.data?.[0] || null;
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/getUserInfo]', Hexley.frameworks.aurora.tintRed)} Error: ${error}`);
            return null;
        }
    },
    
    async _getChannelInfo(Hexley: any, clientId: string, accessToken: string, broadcasterId: string): Promise<any | null> {
        try {
            const response = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`, {
                headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${accessToken}` },
            });
            if (!response.ok) return null;
            const data: any = await response.json();
            return data.data?.[0] || null;
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/getChannelInfo]', Hexley.frameworks.aurora.tintRed)} Error: ${error}`);
            return null;
        }
    },

    async _getStreamInfo(Hexley: any, clientId: string, accessToken: string, broadcasterId: string): Promise<any | null> {
        try {
            const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`, {
                headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${accessToken}` },
            });
            if (!response.ok) return null;
            const data: any = await response.json();
            return data.data?.[0] || null;
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/getStreamInfo]', Hexley.frameworks.aurora.tintRed)} Error: ${error}`);
            return null;
        }
    },

    async _getFollowerCount(Hexley: any, clientId: string, accessToken: string, broadcasterId: string): Promise<number> {
        try {
            const response = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}`, {
                headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${accessToken}` },
            });
            if (!response.ok) return 0;
            const data: any = await response.json();
            return data.total || 0;
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/getFollowerCount]', Hexley.frameworks.aurora.tintRed)} Error: ${error}`);
            return 0;
        }
    },

    async _getLatestVod(Hexley: any, clientId: string, accessToken: string, broadcasterId: string): Promise<any | null> {
        try {
            const response = await fetch(`https://api.twitch.tv/helix/videos?user_id=${broadcasterId}&type=archive&sort=time&first=1`, {
                headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${accessToken}` },
            });
            if (!response.ok) return null;
            const data: any = await response.json();
            return data.data?.[0] || null;
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/getLatestVod]', Hexley.frameworks.aurora.tintRed)} Error: ${error}`);
            return null;
        }
    },
    
    async _getUserChatColor(Hexley: any, clientId: string, accessToken: string, broadcasterId: string): Promise<number> {
        try {
            const response = await fetch(`https://api.twitch.tv/helix/chat/color?user_id=${broadcasterId}`, {
                headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${accessToken}` },
            });
            if (!response.ok) return 0x6441A5; // Default to Twitch Purple on failure
            const data: any = await response.json();
            const hexColor = data.data?.[0]?.color;
            if (hexColor) {
                return parseInt(hexColor.slice(1), 16); // Convert #RRGGBB to a number
            }
            return 0x6441A5; // Default if color is empty
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/getUserChatColor]', Hexley.frameworks.aurora.tintRed)} Error: ${error}`);
            return 0x6441A5; // Default on error
        }
    },

    // WEBHOOK FUNCTIONS
    
    async _performCallbackSelfCheck(Hexley: any, callbackUrl: string): Promise<boolean> {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/diagnostic]', this.moduleColor)} Performing self-check on callback URL: ${callbackUrl}`);
        try {
            const response = await fetch(callbackUrl);
            if (response.ok) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/diagnostic]', Hexley.frameworks.aurora.tintGreen)} Self-check successful. Callback URL is reachable.`);
                return true;
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/diagnostic]', Hexley.frameworks.aurora.tintRed)} Self-check failed. Callback URL returned status: ${response.status}`);
                return false;
            }
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/diagnostic]', Hexley.frameworks.aurora.tintRed)} Self-check failed with an error: ${error.message}.`);
            return false;
        }
    },

    async _createEventSubSubscription(Hexley: any, clientId: string, accessToken: string, broadcasterId: string, callbackUrl: string, secret: string, eventType: string): Promise<string | null> {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/subscribe]', this.moduleColor)} Creating EventSub subscription for event: ${eventType}...`);
        const body = {
            type: eventType,
            version: "1",
            condition: { broadcaster_user_id: broadcasterId },
            transport: { method: "webhook", callback: callbackUrl, secret: secret },
        };
        try {
            const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                method: 'POST',
                headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data: any = await response.json();
            if (response.status === 202) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/subscribe]', Hexley.frameworks.aurora.tintGreen)} Subscription created successfully for ${eventType}.`);
                return data.data[0].id;
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/subscribe]', Hexley.frameworks.aurora.tintRed)} Subscription failed for ${eventType} with status ${response.status}: ${data.message}`);
                return null;
            }
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/subscribe]', Hexley.frameworks.aurora.tintRed)} An error occurred during subscription for ${eventType}: ${error}`);
            return null;
        }
    },
    
    async _deleteEventSubSubscription(Hexley: any, clientId: string, accessToken: string, subscriptionId: string): Promise<boolean> {
        try {
            const response = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`, {
                method: 'DELETE',
                headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${accessToken}` },
            });
            return response.status === 204;
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/delete]', Hexley.frameworks.aurora.tintRed)} Failed to delete subscription ${subscriptionId}: ${error}`);
            return false;
        }
    },

    async _syncExistingSubscriptions(Hexley: any, clientId: string, accessToken: string): Promise<string[]> {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/sync]', this.moduleColor)} Checking for existing subscriptions...`);
        const foundEventTypes: string[] = [];
        try {
            const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${accessToken}` },
            });
            const data: any = await response.json();
            if (data.data && data.data.length > 0) {
                for (const sub of data.data) {
                    if (sub.transport.callback === this.config.TWITCH_CALLBACK_URL) {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/sync]', Hexley.frameworks.aurora.tintGreen)} Found and adopted existing subscription for "${sub.type}" (ID: ${sub.id})`);
                        this.activeSubscriptions.push(sub.id);
                        foundEventTypes.push(sub.type);
                    }
                }
            }
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/sync]', Hexley.frameworks.aurora.tintRed)} Error syncing subscriptions: ${error}`);
        }
        return foundEventTypes;
    },

    async handleWebhook(Hexley: any, data: any) {
        const { event, subscription } = data;
        if (!event || !subscription) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', this.moduleColor)} Received a webhook with no event data.`);
            return;
        }

        const channelId = this.config.TWITCH_ANNOUNCEMENT_CHANNELID;
        if (!channelId) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', Hexley.frameworks.aurora.tintRed)} TWITCH_ANNOUNCEMENT_CHANNELID is not set.`);
            return;
        }

        const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = this.config;
        const accessToken = await this._getAccessToken(Hexley, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
        if (!accessToken) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', Hexley.frameworks.aurora.tintRed)} Could not get Access Token for webhook processing.`);
            return;
        }

        const userInfo = await this._getUserInfo(Hexley, TWITCH_CLIENT_ID, accessToken, event.broadcaster_user_id);
        if (!userInfo) {
             Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', Hexley.frameworks.aurora.tintRed)} Failed to get user info for broadcaster ID: ${event.broadcaster_user_id}`);
            return;
        }

        let channel: TextChannel | null = null;
        try {
            const fetchedChannel = await Hexley.frameworks.discord.client.channels.fetch(channelId);
            if (fetchedChannel && fetchedChannel instanceof TextChannel) {
                channel = fetchedChannel;
            } else {
                 Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', Hexley.frameworks.aurora.tintRed)} Channel ID ${channelId} is not a valid text channel.`);
                 return;
            }
        } catch (error) {
             Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', Hexley.frameworks.aurora.tintRed)} Could not fetch Discord channel with ID ${channelId}. Error: ${error}`);
             return;
        }

        // Verify Bot Permissions
        const permissions = channel.permissionsFor(Hexley.frameworks.discord.client.user);
        if (!permissions || !permissions.has(PermissionsBitField.Flags.SendMessages) || !permissions.has(PermissionsBitField.Flags.EmbedLinks)) {
             Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', Hexley.frameworks.aurora.tintRed)} Missing 'Send Messages' or 'Embed Links' permission in channel #${channel.name}.`);
             return;
        }

        switch (subscription.type) {
            case 'stream.online': {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', this.moduleColor)} Stream for ${event.broadcaster_user_name} is now online!`);
                
                this.streamStartedAt = new Date(event.started_at);

                const streamInfo = await this._getStreamInfo(Hexley, TWITCH_CLIENT_ID, accessToken, event.broadcaster_user_id);
                if (!streamInfo) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', Hexley.frameworks.aurora.tintRed)} Failed to get stream info even though stream.online event was received.`);
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x6441A5)
                    .setAuthor({ name: `${userInfo.display_name} is now LIVE!`, iconURL: userInfo.profile_image_url, url: `https://twitch.tv/${userInfo.login}` })
                    .setTitle(streamInfo.title)
                    .setURL(`https://twitch.tv/${userInfo.login}`)
                    .addFields({ name: 'Playing', value: streamInfo.game_name, inline: true })
                    .setImage(`${streamInfo.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?t=${Date.now()}`)
                    .setTimestamp();

                const enjoyerRoleId = this.config.TWITCH_ENJOYER_ROLEID;
                const mention = enjoyerRoleId ? `<@&${enjoyerRoleId}>` : '@everyone';

                try {
                    await channel.send({ content: `${mention} ${userInfo.display_name} is now live!`, embeds: [embed] });
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', Hexley.frameworks.aurora.tintGreen)} Sent live announcement to Discord.`);
                } catch (error) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', Hexley.frameworks.aurora.tintRed)} FAILED to send live announcement to Discord. Error: ${error}`);
                }
                break;
            }

            case 'stream.offline': {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', this.moduleColor)} Stream for ${event.broadcaster_user_name} is now offline!`);
                
                const streamDuration = this.streamStartedAt ? Date.now() - this.streamStartedAt.getTime() : 0;
                this.streamStartedAt = null;

                const latestVod = await this._getLatestVod(Hexley, TWITCH_CLIENT_ID, accessToken, event.broadcaster_user_id);

                const embed = new EmbedBuilder()
                    .setColor(0x808080)
                    .setAuthor({ name: `${userInfo.display_name} is now offline`, iconURL: userInfo.profile_image_url, url: `https://twitch.tv/${userInfo.login}` })
                    .setThumbnail(userInfo.profile_image_url) // Added this line
                    .setTitle('Stream Ended')
                    .setTimestamp();

                if (streamDuration > 0) {
                    embed.addFields({ name: 'Stream Duration', value: this._formatDuration(streamDuration), inline: false });
                }
                if (latestVod) {
                    embed.setDescription(`Thanks for watching! You can find the VOD here:\n**[${latestVod.title}](${latestVod.url})**`);
                } else {
                    embed.setDescription('Thanks for watching!');
                }
                
                try {
                    await channel.send({ embeds: [embed] });
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', Hexley.frameworks.aurora.tintGreen)} Sent offline notification to Discord.`);
                } catch (error) {
                     Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', Hexley.frameworks.aurora.tintRed)} FAILED to send offline notification to Discord. Error: ${error}`);
                }
                break;
            }
                
            default:
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/webhook]', this.moduleColor)} Received unhandled event type: ${subscription.type}`);
                break;
        }
    },

    async shutdown(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/shutdown]', this.moduleColor)} Unsubscribing from Twitch events...`);
        if (this.activeSubscriptions.length === 0) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/shutdown]', this.moduleColor)} No active subscriptions to remove.`);
            return;
        }
        const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = this.config;
        const accessToken = await this._getAccessToken(Hexley, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
        if (!accessToken) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/shutdown]', Hexley.frameworks.aurora.tintRed)} Could not get access token to unsubscribe.`);
            return;
        }
        for (const subId of this.activeSubscriptions) {
            const success = await this._deleteEventSubSubscription(Hexley, TWITCH_CLIENT_ID, accessToken, subId);
            if (success) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/shutdown]', this.moduleColor)} Successfully unsubscribed: ${subId}`);
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[twitch/shutdown]', Hexley.frameworks.aurora.tintRed)} Failed to unsubscribe: ${subId}`);
            }
        }
        this.activeSubscriptions = [];
    }

};
