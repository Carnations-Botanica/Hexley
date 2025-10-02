// modules/xp/xp.ts

import { Events, MessageFlags, EmbedBuilder, type Interaction, GuildMember } from 'discord.js';

/**
 * The globally accessible module object for the XP command suite.
 */
export const xp = {

    // Module Logging Color
    moduleColor: "#f4b393",

    /**
     * Main Entry Point for the XP module.
     * @param {any} Hexley - The main Hexley global object.
     */
    xpInit(Hexley: any) {
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[xp/xpInit]', this.moduleColor)} Initializing XP Module...`);

        if (Hexley.discordLoaded) {
            Hexley.frameworks.discord.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
                if (!interaction.isChatInputCommand()) return;

                const commandHandlers: { [key: string]: Function } = {
                    'xp': this.handleXp,
                    'giftxp': this.handleGiftXp,
                    'setxp': this.handleSetXp,
                    'addxp': this.handleAddXp,
                    'removexp': this.handleRemoveXp,
                    'leaderboard': this.handleLeaderboard,
                    'ranks': this.handleRanks
                };

                const handler = commandHandlers[interaction.commandName];
                if (handler) {
                    await handler.call(this, Hexley, interaction);
                }
            });
        }
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[xp/xpInit]', this.moduleColor)} Initialized XP Module successfully!`);
    },

    /**
     * Checks if a member has the internal/admin role.
     * @param {GuildMember} member - The member to check.
     * @returns {boolean} True if the member has the admin role.
     */
    _isAdmin(member: GuildMember): boolean {
        const adminRoleId = process.env.INTERNAL_ROLE_ID;
        if (!adminRoleId) return false;
        return member.roles.cache.has(adminRoleId);
    },

    /**
    * Handles the /xp command.
    */
    async handleXp(Hexley: any, interaction: any) {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('user') ?? interaction.user;
        
        const xp = await Hexley.frameworks.experience.getXP(Hexley, targetUser.id);
        const rank = Hexley.frameworks.experience.getRank(xp);
        
        // Fetch all active cooldowns for the target user
        const activeCooldowns = await Hexley.frameworks.cooldown.getAllCooldownsForUser(Hexley, targetUser.id);
        const activeCooldownCount = activeCooldowns.length;

        const embed = new EmbedBuilder()
            .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
            .setAuthor({ name: `${targetUser.username}'s Experience`, iconURL: targetUser.displayAvatarURL() })
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: 'Current XP', value: xp.toLocaleString(), inline: false },
                { name: 'Rank', value: rank, inline: false },
                { name: 'Active Cooldowns', value: activeCooldownCount.toString(), inline: false },
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    /**
     * Handles the /giftxp command.
     */
    async handleGiftXp(Hexley: any, interaction: any) {
        await interaction.deferReply();
        const giver = interaction.user;
        const receiver = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        const result = await Hexley.frameworks.experience.giftXP(Hexley, giver.id, receiver.id, amount);

        const embed = new EmbedBuilder()
            .setTitle('Hexley says...')
            .setTimestamp();

        if (result.success) {
            embed.setColor(0x00FF00)
                 .setDescription(`Successfully gifted **${amount.toLocaleString()}** XP from **${giver.username}** to **${receiver.username}**.`)
                 .addFields(
                     { name: `${giver.username}'s New Balance`, value: `${result.giverNewXp?.toLocaleString()} XP`, inline: true },
                     { name: `${receiver.username}'s New Balance`, value: `${result.receiverNewXp?.toLocaleString()} XP`, inline: true }
                 );
        } else {
            embed.setColor(0xFF0000)
                 .setDescription(`**Transaction Failed:**\n${result.message}`);
        }

        await interaction.editReply({ embeds: [embed] });
    },

    /**
     * Handles the /setxp command.
     */
    async handleSetXp(Hexley: any, interaction: any) {
        if (!this._isAdmin(interaction.member)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        await Hexley.frameworks.experience.setXP(Hexley, targetUser.id, amount);

        const embed = new EmbedBuilder()
            .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
            .setTitle('Hexley says...')
            .setDescription(`Successfully set **${targetUser.username}**'s XP to **${amount.toLocaleString()}**.`)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },

    /**
     * Handles the /addxp command.
     */
    async handleAddXp(Hexley: any, interaction: any) {
        if (!this._isAdmin(interaction.member)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        const newTotal = await Hexley.frameworks.experience.addXP(Hexley, targetUser.id, amount);

        const embed = new EmbedBuilder()
            .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
            .setTitle('Hexley says...')
            .setDescription(`Successfully added **${amount.toLocaleString()}** XP to **${targetUser.username}**.\nTheir new total is **${newTotal.toLocaleString()}** XP.`)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },

    /**
     * Handles the /removexp command.
     */
    async handleRemoveXp(Hexley: any, interaction: any) {
        if (!this._isAdmin(interaction.member)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        const newTotal = await Hexley.frameworks.experience.removeXP(Hexley, targetUser.id, amount);

        const embed = new EmbedBuilder()
            .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member)) // Updated Color
            .setTitle('Hexley says...')
            .setDescription(`Successfully removed **${amount.toLocaleString()}** XP from **${targetUser.username}**.\nTheir new total is **${newTotal.toLocaleString()}** XP.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    /**
     * Handles the /leaderboard command.
     */
    async handleLeaderboard(Hexley: any, interaction: any) {
        await interaction.deferReply();
        const allUsersXp = await Hexley.frameworks.experience.getAllXp(Hexley);

        // List of user IDs to exclude from the leaderboard, add Bots to this list to remove them regardless of their XP amount
        const excludedUserIds = ['1263096648440086630', '764489204192509973', '1139789919292755979']; // Hexley, Pooter, Hexley-Core

        // Filter, sort, and slice the user data
        const sortedUsers = allUsersXp
            .filter((user: any) => !excludedUserIds.includes(user.userId))
            .sort((a: any, b: any) => b.xp - a.xp)
            .slice(0, 25);

        const embed = new EmbedBuilder()
            .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
            .setTitle('XP Leaderboard (Top 25)')
            .setTimestamp();

        if (sortedUsers.length === 0) {
            embed.setDescription("There's no one on the leaderboard yet!");
        } else {
            const medals = ['🥇.', '🥈.', '🥉.'];
            const leaderboardEntries = await Promise.all(sortedUsers.map(async (user: any, index: number) => {
                const member = await Hexley.frameworks.discord.getGuildMember(user.userId);
                const rank = Hexley.frameworks.experience.getRank(user.xp);
                const prefix = index < 3 ? medals[index] : `${index + 1}.`;
                const displayName = member ? member.displayName : 'Unknown User';
                
                return `${prefix} **${displayName}** | ${user.xp.toLocaleString()} XP (${rank})`;
            }));
            embed.setDescription(leaderboardEntries.join('\n'));
        }

        await interaction.editReply({ embeds: [embed] });
    },

    /**
     * Handles the /ranks command.
     */
    async handleRanks(Hexley: any, interaction: any) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const ranks = Hexley.frameworks.experience._ranks; 
        const userRank = await Hexley.frameworks.experience.getRankForUser(Hexley, interaction.user.id);

        const embed = new EmbedBuilder()
            .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
            .setTitle(`The Botánica has over ${ranks.length} ranks to climb!`)
            .setFooter({ text: `Your current rank is: ${userRank}` })
            .setTimestamp();

        if (ranks && ranks.length > 0) {
            const sortedRanks = [...ranks].sort((a: any, b: any) => b.threshold - a.threshold);

            // Format the ranks with specific styling based on their XP threshold
            const rankList = sortedRanks.map((rank: any) => {
                const rankText = `${rank.name} - ${rank.threshold.toLocaleString()} XP`;

                if (rank.threshold >= 10000) {
                    return `__${rankText}__`; // Underlined
                } else if (rank.threshold >= 5000) {
                    return `_**${rankText}**_`; // Bold and Italic
                } else if (rank.threshold >= 2500) {
                    return `**${rankText}**`; // Bold
                } else {
                    return rankText; // Normal
                }
            }).join('\n');
            
            embed.setDescription(rankList);
        } else {
            embed.setDescription('No ranks have been configured for this server.');
        }

        await interaction.editReply({ embeds: [embed] });
    },

};
