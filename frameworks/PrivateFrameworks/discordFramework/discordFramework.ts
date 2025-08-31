import { Client, GatewayIntentBits, Guild, Events, SlashCommandBuilder, ApplicationCommandOptionType, GuildMember } from 'discord.js';
import path from 'path';

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
     * @param {typeof Hexley} Hexley - The main Hexley global object.
     */
    async initializeDiscordClient(Hexley: any) {
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

        client.once(Events.ClientReady, async (loggedInClient) => {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initializeDiscordClient]', Hexley.frameworks.aurora.tintBlurple)} Logged in as ${loggedInClient.user.tag}`);
            
            const guildId = process.env.GUILD_ID;
            if (!guildId) {
                console.error("[discordFramework/initializeDiscordClient] Fatal: GUILD_ID is not defined in .env but is required for client initialization.");
                process.exit(1);
            }

            try {
                const guild = await loggedInClient.guilds.fetch(guildId);
                this.client = loggedInClient;
                this.guild = guild;
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[discordFramework/initializeDiscordClient]', Hexley.frameworks.aurora.tintBlurple)} Successfully fetched and set guild: "${guild.name}"`);

            } catch (error) {
                console.error(`[discordFramework/initializeDiscordClient] Fatal: Could not fetch guild with ID: ${Hexley.guildId}. Please check if the ID is correct and the bot is in the server.`);
                process.exit(1);
            }

            // Register the module to registry
            const plistPath = path.join(Hexley.privateFrameworksRootPath, 'discordFramework', 'info.plist');
            await Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
            
            // Add to Versions object + sequelizer
            await Hexley.frameworks.version.addVersionEntry(Hexley, 'discordFramework', 'Framework', '1.0.0');

            // Emit the ready signal on the core event emitter
            Hexley.core.emit('discordClient.ready', loggedInClient);
        });

        try {
            await client.login(Hexley.token);
        } catch (error: any) {
            console.error(`[discordFramework/initializeDiscordClient] Fatal: Failed to login to Discord. Please check your DISCORD_TOKEN.`);
            console.error(error.message);
            process.exit(1);
        }
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