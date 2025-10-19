import { Client, GatewayIntentBits, Guild, Events, SlashCommandBuilder, ApplicationCommandOptionType, GuildMember, EmbedBuilder, Message, TextChannel } from 'discord.js';

// Define interfaces for our ID collections for strong typing
interface userIdCollection {
    [key: string]: string | undefined;
}

interface roleIdCollection {
    [key: string]: string | undefined;
}

interface channelIdCollection {
    [key: string]: string | undefined;
}

/**
 * Define the structure for a single slash command argument.
 */
export interface CommandArgument {
    name: string;
    description: string;
    type: ApplicationCommandOptionType; // Uses the discord.js enum for types
    required: boolean;
}

/**
 * The globally accessible framework object holding all Discord-related interfaces.
 */
export const discordFramework = {

    /**
     * Local Variables used for Initialization
     * These hold the actual client and guild *objects*
     */
    client: null as Client | null,
    guild: null as Guild | null,

    /**
     * The object holding all Discord-related ID types.
     */
    discordIds: {
        role: <roleIdCollection>{},
        channel: <channelIdCollection>{},
        user: <userIdCollection>{},
        specialUsers: <string[]>[]
    },

    /**
     * Populates the static ID collections by scanning environment variables.
     * @param {typeof Hexley} Hexley - The main Hexley global object.
     */
    initializeDiscordIds(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initializeDiscordIds]', Hexley.frameworks.aurora.tintBlurple)} Initializing Discord IDs from environment variables...`);

        // Handle the array of special user IDs first
        if (process.env.SPECIAL_USER_IDS) {
            this.discordIds.specialUsers = process.env.SPECIAL_USER_IDS.split(',').map(id => id.trim());
        }

        // Loop through all available environment variables
        for (const key in process.env) {
            const value = process.env[key];

            // Check for and parse ROLE_ID variables
            if (key.endsWith('_ROLE_ID')) {
                const roleName = key.replace('_ROLE_ID', '').toLowerCase();
                this.discordIds.role[roleName] = value;
            }
            // Check for and parse CHANNEL_ID variables
            else if (key.endsWith('_CHANNEL_ID')) {
                const channelName = key.replace('_CHANNEL_ID', '').toLowerCase();
                this.discordIds.channel[channelName] = value;
            }
            // Check for and parse USER_ID variables, excluding the special array
            else if (key.endsWith('_USER_ID') && key !== 'SPECIAL_USER_IDS') {
                const userName = key.replace('_USER_ID', '').toLowerCase();
                this.discordIds.user[userName] = value;
            }
        }

        // If in debug mode, dump all the found IDs for verification.
        if (Hexley.debugMode) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/Dbg]', Hexley.frameworks.aurora.tintBlurple)} Dumping all parsed IDs...`);

            Hexley.log(`${Hexley.frameworks.aurora.colorText('Special User IDs', Hexley.frameworks.aurora.tintBlurpleBright)}`);
            Hexley.log(`  [${this.discordIds.specialUsers.join(', ')}]`);

            Hexley.log(`${Hexley.frameworks.aurora.colorText('User IDs', Hexley.frameworks.aurora.tintBlurpleBright)}`);
            console.table(this.discordIds.user);

            Hexley.log(`${Hexley.frameworks.aurora.colorText('Role IDs', Hexley.frameworks.aurora.tintBlurpleBright)}`);
            console.table(this.discordIds.role);

            Hexley.log(`${Hexley.frameworks.aurora.colorText('Channel IDs', Hexley.frameworks.aurora.tintBlurpleBright)}`);
            console.table(this.discordIds.channel);
        }

        Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initializeDiscordIds]', Hexley.frameworks.aurora.tintBlurple)} Initialized Discord IDs Successfully.`);
    },


    /**
     * Creates, logs in, and prepares the Discord client and guild objects.
     * The function now returns a Promise that resolves upon successful connection (ClientReady + Guild Fetch)
     * or rejects upon failure.
     * @param {typeof Hexley} Hexley - The main Hexley global object.
     * @returns {Promise<boolean>} Resolves true on success, rejects on fatal error.
     */
    async initializeDiscordClient(Hexley: any): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initializeDiscordClient]', Hexley.frameworks.aurora.tintBlurple)} Initializing Discord Client Session.`);
            
            const client = new Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMembers,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.MessageContent,
                    GatewayIntentBits.GuildVoiceStates,
                    GatewayIntentBits.GuildPresences,
                ],
            });

            client.setMaxListeners(30);

            // 1. Attach the listener BEFORE login
            client.once(Events.ClientReady, async (loggedInClient: Client<true>) => {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initializeDiscordClient]', Hexley.frameworks.aurora.tintBlurple)} Logged in as ${loggedInClient.user.tag}`);
                
                const guildId = process.env.GUILD_ID;
                if (!guildId) {
                    // Fatal error detection should reject the promise
                    const errMsg = "[discordFramework/initializeDiscordClient] Fatal: GUILD_ID is not defined in .env but is required.";
                    console.error(errMsg);
                    // Use reject() instead of process.exit(1) to allow the calling code (Loader) to handle cleanup
                    reject(new Error(errMsg)); 
                    return;
                }

                try {
                    const guild = await loggedInClient.guilds.fetch(guildId);
                    this.client = loggedInClient;
                    this.guild = guild;
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initializeDiscordClient]', Hexley.frameworks.aurora.tintBlurple)} Successfully fetched and set guild: "${guild.name}"`);

                } catch (error: any) {
                    const errMsg = `[discordFramework/initializeDiscordClient] Fatal: Could not fetch guild with ID: ${guildId}. Error: ${error.message}`;
                    console.error(errMsg);
                    // Use reject() for failed guild fetch
                    reject(new Error(errMsg));
                    return;
                }

                Hexley.resources.framework.discord.isLoaded = true;
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initializeDiscordClient]', Hexley.frameworks.aurora.tintBlurple)} Discord Client initialization complete.`);
                
                // Resolve the promise, signaling success to the Loader
                resolve(true);
            });

            // Handle failed login before client.once(Events.ClientReady)
            try {
                await client.login(process.env.DISCORD_TOKEN);
            } catch (error: any) {
                const errMsg = `[discordFramework/initializeDiscordClient] Fatal: Failed to login to Discord. Check DISCORD_TOKEN. Error: ${error.message}`;
                console.error(errMsg);
                // Reject the promise immediately upon login failure
                reject(new Error(errMsg));
            }
        });
    },

    /**
     * Initializes and registers a basic slash command with Discord.
     * @param {any} Hexley - The main Hexley global object for logging.
     * @param {string} commandName - The name of the command (e.g., "ping").
     * @param {string} commandDescription - The description shown to the user.
     * @param {boolean} debugMode - If true, logs the command structure without registering it.
     */
    async initBasicSlashCommand(Hexley: any, commandName: string, commandDescription: string, debugMode: boolean) {
        if (!this.client || !this.guild) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initBasicSlashCommand]', Hexley.frameworks.aurora.tintBlurpleBright)} Error: Cannot process slash command "${commandName}" because the client or guild is not ready.`);
            return;
        }

        try {
            const command = new SlashCommandBuilder()
                .setName(commandName)
                .setDescription(commandDescription);

            // If debug mode is enabled, log the details and exit without registering
            if (debugMode) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initBasicSlashCommand]', Hexley.frameworks.aurora.tintBlurpleBright)} Simulating registration for basic slash command: /${commandName}`);
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initBasicSlashCommand]', Hexley.frameworks.aurora.tintBlurpleBright)} Description: ${commandDescription}`);
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initBasicSlashCommand]', Hexley.frameworks.aurora.tintBlurpleBright)} Constructed command JSON:`);
                console.log(JSON.stringify(command.toJSON(), null, 2));
                return; // Stop execution here
            }

            // If not in debug mode, proceed with registration
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initBasicSlashCommand]', Hexley.frameworks.aurora.tintBlurple)} Initializing slash command: /${commandName}`);
            await this.guild.commands.create(command);
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initBasicSlashCommand]', Hexley.frameworks.aurora.tintBlurple)} Successfully registered basic slash command: /${commandName}`);

        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initBasicSlashCommand]', Hexley.frameworks.aurora.tintBlurpleBright)} Error occurred while processing basic slash command: /${commandName}`);
            console.error(error);
        }
    },

    /**
     * Initializes and registers a slash command with arguments.
     * @param {any} Hexley - The main Hexley global object for logging.
     * @param {string} commandName - The name of the command.
     * @param {string} commandDescription - The description shown to the user.
     * @param {CommandArgument[]} args - An array of argument objects.
     * @param {boolean} debugMode - If true, logs the command structure without registering it.
     */
    async initArgdSlashCommand(Hexley: any, commandName: string, commandDescription: string, args: CommandArgument[], debugMode: boolean) {
        if (!this.client || !this.guild) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initArgdSlashCommand]', Hexley.frameworks.aurora.tintBlurpleBright)} Error: Cannot process slash command "${commandName}" because the client or guild is not ready.`);
            return;
        }

        try {
            const command = new SlashCommandBuilder()
                .setName(commandName)
                .setDescription(commandDescription);

            // Build command options from the arguments array
            args.forEach(arg => {
                switch (arg.type) {
                    case ApplicationCommandOptionType.String:
                        command.addStringOption(option => 
                            option.setName(arg.name)
                                .setDescription(arg.description)
                                .setRequired(arg.required));
                        break;
                    case ApplicationCommandOptionType.Integer:
                        command.addIntegerOption(option => 
                            option.setName(arg.name)
                                .setDescription(arg.description)
                                .setRequired(arg.required));
                        break;
                    case ApplicationCommandOptionType.Boolean:
                        command.addBooleanOption(option => 
                            option.setName(arg.name)
                                .setDescription(arg.description)
                                .setRequired(arg.required));
                        break;
                    case ApplicationCommandOptionType.User:
                        command.addUserOption(option => 
                            option.setName(arg.name)
                                .setDescription(arg.description)
                                .setRequired(arg.required));
                        break;
                    default:
                        command.addStringOption(option => 
                            option.setName(arg.name)
                                .setDescription(arg.description)
                                .setRequired(arg.required));
                        break;
                }
            });

            // If debug mode is enabled, log the details and exit without registering
            if (debugMode) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/Dbg]', Hexley.frameworks.aurora.tintBlurpleBright)} Simulating registration for slash command: /${commandName}`);
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/Dbg]', Hexley.frameworks.aurora.tintBlurpleBright)} Description: ${commandDescription}`);
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/Dbg]', Hexley.frameworks.aurora.tintBlurpleBright)} Arguments: ${JSON.stringify(args, null, 2)}`);
                Hexley.log(`[${Hexley.frameworks.aurora.colorText('[discordFramework/Dbg]', Hexley.frameworks.aurora.tintBlurpleBright)} Constructed command JSON:`);
                console.log(JSON.stringify(command.toJSON(), null, 2));
                return;
            }

            // If not in debug mode, proceed with registration
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initArgdSlashCommand]', Hexley.frameworks.aurora.tintBlurple)} Initializing argumented slash command: /${commandName}`);
            await this.guild.commands.create(command.toJSON());
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initArgdSlashCommand]', Hexley.frameworks.aurora.tintBlurple)} Successfully registered argumented slash command: /${commandName}`);

        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initArgdSlashCommand]', Hexley.frameworks.aurora.tintBlurpleBright)} Error occurred while processing argumented slash command: /${commandName}`);
            console.error(error);
        }
    },

    /**
     * Lists all slash commands for the guild.
     * @param {any} Hexley - The main Hexley global object for logging.
     */
    async listSlashCommands(Hexley: any) {
        if (!this.client || !this.guild) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/listSlashCommands]', Hexley.frameworks.aurora.tintBlurpleBright)} Error: Cannot list slash commands because the client or guild is not ready.`);
            return;
        }

        try {
            const commands = await this.guild.commands.fetch();
            if (commands.size === 0) {
                console.log("No slash commands found for this guild.");
                return;
            }

            console.log("Slash Commands:");
            commands.forEach(command => {
                console.log(`- ${command.name} (ID: ${command.id})`);
            });
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/listSlashCommands]', Hexley.frameworks.aurora.tintBlurpleBright)} Error occurred while listing slash commands:`);
            console.error(error);
        }
    },

    /**
     * Removes a slash command from the guild.
     * @param {any} Hexley - The main Hexley global object for logging.
     * @param {string} commandId - The ID of the command to remove.
     * @returns {Promise<boolean>} A promise that resolves to true if the command was removed, and false otherwise.
     */
    async removeSlashCommand(Hexley: any, commandId: string): Promise<boolean> {
        if (!this.client || !this.guild) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/removeSlashCommand]', Hexley.frameworks.aurora.tintBlurpleBright)} Error: Cannot remove slash command because the client or guild is not ready.`);
            return false;
        }

        try {
            await this.guild.commands.delete(commandId);
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/removeSlashCommand]', Hexley.frameworks.aurora.tintBlurple)} Successfully removed slash command with ID: ${commandId}`);
            return true;
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/removeSlashCommand]', Hexley.frameworks.aurora.tintBlurpleBright)} Error occurred while removing slash command with ID ${commandId}:`);
            console.error(error);
            return false;
        }
    },

    /**
     * Removes all registered slash commands from the guild.
     * @param {any} Hexley - The main Hexley global object for logging.
     * @returns {Promise<number|null>} A promise that resolves to the number of commands deregistered, or null on error.
     */
    async deregisterAllSlashCommands(Hexley: any): Promise<number | null> {
        if (!this.client || !this.guild) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/deregisterAllSlashCommands]', Hexley.frameworks.aurora.tintRedBright)} Error: Cannot deregister commands because the client or guild is not ready.`);
            return null;
        }

        try {
            const commands = await this.guild.commands.fetch();
            if (commands.size === 0) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/deregisterAllSlashCommands]', Hexley.frameworks.aurora.tintBlurple)} No slash commands found to deregister.`);
                return 0;
            }

            let deletedCount = 0;
            for (const command of commands.values()) {
                await this.guild.commands.delete(command.id);
                deletedCount++;
            }

            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/deregisterAllSlashCommands]', Hexley.frameworks.aurora.tintBlurple)} Successfully removed ${deletedCount} slash command(s).`);
            return deletedCount;
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/deregisterAllSlashCommands]', Hexley.frameworks.aurora.tintRedBright)} Error occurred while removing all slash commands:`);
            console.error(error);
            return null;
        }
    },

    /**
     * Fetches a structured list of all channels in the guild.
     * @param {any} Hexley - The main Hexley global object.
     * @returns {Promise<object|null>} A promise that resolves to an object with structured channel data, or null if an error occurs.
     */
    async listChannels(Hexley: any): Promise<object | null> {
        if (!this.guild) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/listChannels]', Hexley.frameworks.aurora.tintBlurpleBright)} Error: Guild not available.`);
            return null;
        }

        const guildChannels = this.guild.channels.cache;

        const channelData: any = {
            guild: { name: this.guild.name, id: this.guild.id },
            categories: [],
            ungrouped: {
                textChannels: [],
                voiceChannels: []
            }
        };

        // Process categories and their children
        guildChannels.filter(c => c.type === 4).sort((a, b) => (a as any).position - (b as any).position).forEach(category => {
            const textChannels = guildChannels.filter(c => c.parentId === category.id && c.type === 0).sort((a, b) => (a as any).position - (b as any).position);
            const voiceChannels = guildChannels.filter(c => c.parentId === category.id && c.type === 2).sort((a, b) => (a as any).position - (b as any).position);
            
            channelData.categories.push({
                name: category.name,
                id: category.id,
                textChannels: textChannels.map((c: any) => ({ name: c.name, id: c.id })),
                voiceChannels: voiceChannels.map((c: any) => ({ name: c.name, id: c.id }))
            });
        });
        
        // Process ungrouped channels
        guildChannels.filter(c => c.type === 0 && !c.parent).sort((a, b) => (a as any).position - (b as any).position)
            .forEach((c: any) => channelData.ungrouped.textChannels.push({ name: c.name, id: c.id }));
            
        guildChannels.filter(c => c.type === 2 && !c.parent).sort((a, b) => (a as any).position - (b as any).position)
            .forEach((c: any) => channelData.ungrouped.voiceChannels.push({ name: c.name, id: c.id }));

        return channelData;
    },

    /**
     * Fetches a guild member by their ID.
     * @param {string} userId - The ID of the user to fetch.
     * @returns {Promise<GuildMember | null>} A promise that resolves to the GuildMember object or null if not found.
     */
    async getGuildMember(userId: string): Promise<GuildMember | null> {
        if (!this.guild) {
            return null;
        }
        try {
            return await this.guild.members.fetch(userId);
        } catch (error) {
            return null;
        }
    },

    /**
     * Safely fetches a channel and sends a message to it, ensuring it's a text-based channel.
     * @param {string} channelId - The ID of the channel to send a message to.
     * @param {string | { embeds: EmbedBuilder[] }} content - The content to send.
     * @returns {Promise<Message | null>} The sent message object, or null on failure.
     */
    async sendMessageToChannel(channelId: string, content: string | { embeds: [EmbedBuilder] }): Promise<Message | null> {

        if (!this.client) {
            console.error(`[discordFramework] Attempted to send a message before the client was ready.`);
            return null;
        }

        try {
            let channel = await this.client.channels.fetch(channelId);
            
            if (channel?.partial) {
                channel = await channel.fetch();
            }
            
            if (channel && channel.isTextBased()) {
                return await (channel as TextChannel).send(content);
            } else {
                console.error(`[discordFramework] Channel ${channelId} not found or is not a text-based channel.`);
            }
        } catch (error: any) {
            console.error(`[discordFramework] Failed to send message to channel ${channelId}: ${error.message}`);
        }
        
        return null;
    },

    /**
     * Gets the highest role color of a guild member.
     * @param {GuildMember} member - The guild member to get the role color for.
     * @returns {string} The hex color of the highest role, or a default color.
     */
    getUserRoleColor(member: GuildMember): string {
        // Find the role with the highest position that has a color
        const highestRoleWithColor = member.roles.color;
      
        // Return the color or default to a fallback color
        return highestRoleWithColor ? highestRoleWithColor.hexColor : '#8f8f8f';
    },

};