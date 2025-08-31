import { Events, EmbedBuilder, type Message } from 'discord.js';

/**
 * The globally accessible module object.
 */
export const verbose = {

    // Module Logging Color
    moduleColor: "#688872",

    /**
     * Main Entry Point for the Verbose module.
     * @param {any} Hexley - The main Hexley global object.
     */
    verboseInit(Hexley: any) {
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[verbose/verboseInit]', this.moduleColor)} Initializing verbose Module...`);

        if (Hexley.discordLoaded) {
            const FOCUS_ENABLED =  true;

            Hexley.frameworks.discord.client.on(Events.MessageCreate, async (message: Message) => {
                if (!message.guild) return;

                if (!FOCUS_ENABLED || message.guild.id === process.env.GUILD_ID) {
                    const currentTime = new Date().toLocaleTimeString();
                    const guildName = message.guild.name;
                    const channelName = (message.channel as any).name || 'Unknown Channel';
                    const userName = message.author.tag;
                    const userId = message.author.id;
                    const attachments = message.attachments;
                    let content = message.content;

                    if (attachments.size > 0) {
                        const attachmentText = attachments.size === 1 
                            ? `[Attachment: ${attachments.first()?.name}]` 
                            : `[Multiple Attachments]`;
                        content = content ? `${content} ${attachmentText}` : attachmentText;
                    }

                    if (!content.trim() && message.embeds.length === 0) {
                        content = '[No Content]';
                    } else if (message.embeds.length > 0) {
                        content = content.trim() ? `${content} [Embed]` : '[Embed]';
                    }

                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[verbose]', this.moduleColor)} [#${channelName} | ${currentTime}] [${userId} (${userName})]: ${content}`);
                }
            });
        }
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[verbose/verboseInit]', this.moduleColor)} Initialized verbose Module successfully! You will now get Discord messages in Console!`);
    
    },

}