import { Events, EmbedBuilder, type Interaction, MessageFlags } from 'discord.js';

export const cooldown = {

    moduleColor: "#a5b0e6",

    /**
     * A map of internal cooldown types to user-friendly "pretty" names.
     */
    prettyNames: {
        'counting_xp_gain': 'Counting Mini-game XP Gain',
        'counting_cannot_particip': 'Counting Participation Penalty',
        'math_xp_gain': 'Mathematics XP Gain',
        'math_cannot_particip': 'Mathematics Participation Penalty'
    } as { [key: string]: string },

    /**
     * Main Entry Point for the Cooldown module.
     * @param {any} Hexley - The main Hexley global object.
     */
    cooldownInit(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[cooldown/cooldownInit]', this.moduleColor)} Initializing Cooldown Module...`);

        if (Hexley.discordLoaded) {
            Hexley.frameworks.discord.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
                if (!interaction.isChatInputCommand() || interaction.commandName !== 'cooldowns') return;
                await this.handleCooldowns(Hexley, interaction);
            });
        }
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[cooldown/cooldownInit]', this.moduleColor)} Initialized Cooldown Module successfully!`);
    },

    /**
     * Formats a duration in milliseconds into a Hh Mm Ss string.
     * @param {number} ms - The duration in milliseconds.
     * @returns {string} The formatted time string.
     */
    _formatDuration(ms: number): string {
        if (ms < 0) ms = 0;
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        
        let parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
        
        return parts.join(' ');
    },

    /**
     * Handles the /cooldowns command.
     */
    async handleCooldowns(Hexley: any, interaction: any) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const userId = interaction.user.id;
        const activeCooldowns = await Hexley.frameworks.cooldown.getAllCooldownsForUser(Hexley, userId);
        const embed = new EmbedBuilder()
            .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
            .setTitle('Hexley says...')
            .setTimestamp();
        
        if (activeCooldowns.length === 0) {
            embed.setDescription("You have no active cooldowns!");
        } else {
            activeCooldowns.forEach((cd: any) => {
                // Look up the pretty name, or fall back to the internal name if not found.
                const prettyName = this.prettyNames[cd.type] || cd.type;
                const remainingMs = new Date(cd.endTime).getTime() - Date.now();
                const remainingTime = this._formatDuration(remainingMs);

                embed.addFields({
                    name: `**${prettyName}**`,
                    value: `Ends in: ${remainingTime}`,
                    inline: false
                });
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },
    
};
