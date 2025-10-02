// modules/counting/counting.ts

import { Events, EmbedBuilder, type Interaction, GuildMember, Message, MessageFlags } from 'discord.js';
import { DataTypes } from 'sequelize';

// Define the structure of our counting table.
const countingTable = {
    definition: {
        channelId: {
            type: DataTypes.STRING(191),
            allowNull: false,
            primaryKey: true
        },
        currentNumber: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0
        },
        lastUserIdValidCount: {
            type: DataTypes.STRING(191),
            allowNull: true
        },
        highScore: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0
        },
        lastBreakerUserId: { // NEW: Tracks the last user who broke the count for streak logic
            type: DataTypes.STRING(191),
            allowNull: true
        }
    },
    options: {
        tableName: 'countingTable',
        timestamps: false
    }
};

// Define the structure for tracking individual user stats.
const countingUserStatsTable = {
    definition: {
        id: { 
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        userId: { 
            type: DataTypes.STRING(191),
            allowNull: false
        },
        channelId: { 
            type: DataTypes.STRING(191),
            allowNull: false
        },
        count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        breaksCount: { // Tracks how many times a user has broken the chain
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    },
    options: {
        tableName: 'countingUserStatsTable',
        timestamps: false,
        indexes: [{ unique: true, fields: ['userId', 'channelId'] }]
    }
};

/**
 * The globally accessible module for the Counting Game.
 */
export const counting = {

    moduleColor: "#fdda0d",
    lastUserIdCount: null as string | null, // In-memory tracker for the last user who tried to count

    /**
     * Main Entry Point for the Counting module.
     */
    async countingInit(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[counting/countingInit]', this.moduleColor)} Initializing Counting Module...`);

        if (Hexley.databaseLoaded) {
            await Hexley.frameworks.database.initTable(countingTable);
            await Hexley.frameworks.database.initTable(countingUserStatsTable);
        }

        if (Hexley.discordLoaded) {
            Hexley.frameworks.discord.client.on(Events.MessageCreate, (message: Message) => {
                this.handleMessage(Hexley, message);
            });

            Hexley.frameworks.discord.client.on(Events.InteractionCreate, (interaction: Interaction) => {
                if (!interaction.isChatInputCommand()) return;
                
                if (interaction.commandName === 'counting') {
                    this.handleCountingStats(Hexley, interaction);
                } else if (interaction.commandName === 'setcount') {
                    this.handleSetCount(Hexley, interaction);
                } else if (interaction.commandName === 'sethighscore') {
                    this.handleSetHighScore(Hexley, interaction);
                } else if (interaction.commandName === 'resetcounting') {
                    this.handleResetCounting(Hexley, interaction);
                }
            });
        }
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[counting/countingInit]', this.moduleColor)} Initialized Counting Module successfully!`);
    },

    /**
     * Resets the 'breaksCount' for all users in the specified channel.
     * This is necessary to break a streak when a new user makes a mistake.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} channelId - The ID of the counting channel.
     */
    async _resetAllBreaks(Hexley: any, channelId: string) {
        if (!Hexley.databaseLoaded) return;
        
        // Fetch all users and filter by channelId
        const allUsers = await Hexley.frameworks.database.getAll(countingUserStatsTable);
        
        for (const user of allUsers) {
            if (user.channelId === channelId && user.breaksCount > 0) {
                // Upsert with breaksCount: 0 to clear the streak
                await Hexley.frameworks.database.upsert(
                    countingUserStatsTable, 
                    { userId: user.userId, channelId: user.channelId, count: user.count, breaksCount: 0 }
                );
            }
        }
    },

    /**
     * Checks if a member has the internal/admin role.
     */
    _isAdmin(member: GuildMember): boolean {
        const adminRoleId = process.env.INTERNAL_ROLE_ID;
        if (!adminRoleId) return false;
        return member.roles.cache.has(adminRoleId);
    },

    /**
     * Calculates the XP to gain based on the current number.
     * @param {number} currentNumber - The number that was just counted.
     * @returns {number} The amount of XP to award.
     */
    _calculateXpGain(currentNumber: number): number {
        const baseGain = 1;
        const bonusGain = Math.floor(currentNumber / 50);
        return baseGain + bonusGain;
    },

    /**
     * Calculates the XP to lose based on the number the chain was broken at.
     * @param {number} lastValidNumber - The last successful number in the chain.
     * @returns {number} The amount of XP to remove.
     */
    _calculateXpLoss(lastValidNumber: number): number {
        const baseLoss = 5;
        const bonusLoss = Math.floor(lastValidNumber / 10);
        return baseLoss + bonusLoss;
    },

    /**
     * A simple delay helper.
     * @param {number} ms - The number of milliseconds to wait.
     */
    _delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Retrieves the number of times a user has successfully counted.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The ID of the user to look up.
     * @returns {Promise<number>} The user's total successful count.
     */
    async getUserCount(Hexley: any, userId: string): Promise<number> {
        if (!Hexley.databaseLoaded) return 0;

        const channelId = process.env.COUNTING_CHANNEL_ID;
        const userStats = await Hexley.frameworks.database.get(countingUserStatsTable, { userId: userId, channelId: channelId });

        return userStats?.count ?? 0;
    },

    /**
     * Handles incoming messages to check for counts.
     */
    async handleMessage(Hexley: any, message: Message) {
        if (message.author.bot || message.channel.id !== process.env.COUNTING_CHANNEL_ID || !message.channel.isTextBased()) {
            return;
        }

        const content = message.content.trim();
        if (!/^\d+$/.test(content)) return;

        // Check for 8-hour participation cooldown first and ignore if active
        const isParticipationCooledDown = await Hexley.frameworks.cooldown.checkCooldown(Hexley, message.author.id, 'counting_cannot_particip');
        if (isParticipationCooledDown) {
            return;
        }
        
        const currentNumber = parseInt(content, 10);
        const channelId = message.channel.id;
        let countState = await Hexley.frameworks.database.get(countingTable, { channelId: channelId });

        if (!countState) {
            countState = { currentNumber: 0, lastUserIdValidCount: null, highScore: 0 };
            await Hexley.frameworks.database.upsert(countingTable, { channelId, ...countState });
        }
        
        const { currentNumber: lastValidNumber, lastUserIdValidCount, highScore, lastBreakerUserId } = countState;
        const nextValidNumber = lastValidNumber + 1;

        if (lastUserIdValidCount === message.author.id || currentNumber !== nextValidNumber) {
            // SOmeone broke the chain, handle it.
            await this._delay(300);
            await message.react('❌');

            const xpToLose = this._calculateXpLoss(lastValidNumber);

            // Fetch user stats
            let userStats = await Hexley.frameworks.database.get(countingUserStatsTable, { userId: message.author.id, channelId: channelId });
            let currentBreaksCount = userStats?.breaksCount ?? 0;
            const currentCount = userStats?.count ?? 0;

            let newBreaksCount = currentBreaksCount;
            
            // 1. Check for consecutive breaks logic
            // The check for isNewBreaker must be based on the last breaker ID from the countingTable,
            // which now persists across successful counts.
            const isNewBreaker = message.author.id !== lastBreakerUserId;
            const BREAK_LIMIT = 3; 
            
            if (isNewBreaker) {
                // Reset ALL users' break counts to 0, then set current user's break count to 1
                Hexley.log(`[counting/handleMessage] New breaker detected. Resetting all breaks.`);
                await this._resetAllBreaks(Hexley, channelId); // Reset everyone
                newBreaksCount = 1; // Start the new breaker's streak at 1
            } else {
                // Same breaker, continue streak
                newBreaksCount++;
            }
            
            // 2. Cooldown check (using 3 as the limit)
            let cooldownMessage = `**${message.member?.displayName}** broke the chain at **${lastValidNumber}**! The next number was **${nextValidNumber}**. Count resets to **0**. They lose **${xpToLose}** XP.`;

            if (newBreaksCount >= BREAK_LIMIT) {
                const COOLDOWN_DURATION_SECONDS = 8 * 60 * 60; // 8 hours
                await Hexley.frameworks.cooldown.setCooldown(Hexley, message.author.id, 'counting_cannot_particip', COOLDOWN_DURATION_SECONDS);
                newBreaksCount = 0; // Reset breaks count after applying cooldown
                
                cooldownMessage += `\n**🛑 WARNING!** This is break **#${BREAK_LIMIT}** (limit ${BREAK_LIMIT}). They are now on an **8-hour participation cooldown**!`;
            } else {
                cooldownMessage += `\nThey have broken the count **${newBreaksCount}/${BREAK_LIMIT}** times.`;
            }
            
            // Send message and set timeout to delete it
            const sentCooldownMsg = await Hexley.frameworks.discord.sendMessageToChannel(channelId, cooldownMessage);
            if (sentCooldownMsg) {
                setTimeout(() => sentCooldownMsg.delete(), 5000); // Auto-delete after 5 seconds
            }

            // Update user stats with the final breaks count, preserving currentCount
            await Hexley.frameworks.database.upsert(countingUserStatsTable, { userId: message.author.id, channelId, count: currentCount, breaksCount: newBreaksCount });
            
            // Update the main counting table, storing the ID of the user who just broke the count
            await Hexley.frameworks.database.upsert(countingTable, { 
                channelId, 
                currentNumber: 0, 
                lastUserIdValidCount: null, 
                highScore,
                lastBreakerUserId: message.author.id // Store the current breaker's ID
            });
            await Hexley.frameworks.experience.removeXP(Hexley, message.author.id, xpToLose);
            return;
        }

        // SUCCESS LOGIC
        await this._delay(300);
        await message.react('✅');
        const newHighScore = Math.max(highScore, currentNumber);
        
        await Hexley.frameworks.database.upsert(countingTable, { 
            channelId, 
            currentNumber, 
            lastUserIdValidCount: message.author.id, 
            highScore: newHighScore 
        });

        // Retrieve userStats (needed for both cooldown and count update)
        let userStats = await Hexley.frameworks.database.get(countingUserStatsTable, { userId: message.author.id, channelId: channelId });
        const currentBreaksCount = userStats?.breaksCount ?? 0;
        
        // Handle expired XP cooldown
        const expiredCooldown = await Hexley.frameworks.cooldown.findExpiredCooldown(Hexley, message.author.id, 'counting_xp_gain');
        if (expiredCooldown) {
            await Hexley.frameworks.cooldown.clearCooldown(Hexley, message.author.id, 'counting_xp_gain');
            // Reset participation count, but preserve breaksCount.
            await Hexley.frameworks.database.upsert(countingUserStatsTable, { userId: message.author.id, channelId, count: 0, breaksCount: currentBreaksCount });
            if (userStats) {
                userStats.count = 0;
            }
            
            const resetMessage = `Counting cooldown for **${message.member?.displayName}** has ended, their participation count has been reset!`;

            const sentResetMsg = await Hexley.frameworks.discord.sendMessageToChannel(channelId, resetMessage);
            if (sentResetMsg) {
                setTimeout(() => sentResetMsg.delete(), 5000); // Auto-delete after 5 seconds
            }
        }

        const isCooledDown = await Hexley.frameworks.cooldown.checkCooldown(Hexley, message.author.id, 'counting_xp_gain');
        
        // Only handle XP gain and participation tracking if the user is NOT on XP cooldown.
        if (!isCooledDown) {
            // Award XP
            const xpToGain = this._calculateXpGain(currentNumber);
            await Hexley.frameworks.experience.addXP(Hexley, message.author.id, xpToGain);

            // Update the user's personal count, preserving breaksCount
            const newCount = (userStats?.count ?? 0) + 1;
            
            // The count should not exceed 10 if the cooldown is being activated now or is already active
            const finalCount = newCount > 10 ? 10 : newCount;

            await Hexley.frameworks.database.upsert(countingUserStatsTable, { userId: message.author.id, channelId, count: finalCount, breaksCount: currentBreaksCount });

            if (finalCount === 10) {
                // await Hexley.frameworks.cooldown.setCooldown(Hexley, message.author.id, 'counting_xp_gain', 3600); // 1 hour cooldown
                await Hexley.frameworks.cooldown.setCooldown(Hexley, message.author.id, 'counting_xp_gain', 60); // 1 min cooldown
                const cooldownMessage = `**${message.member?.displayName}** has counted ${finalCount} times and is now on an hour XP gain cooldown!`;
                
                const sentCooldownMsg = await Hexley.frameworks.discord.sendMessageToChannel(channelId, cooldownMessage);
                if (sentCooldownMsg) {
                    setTimeout(() => sentCooldownMsg.delete(), 5000); // Auto-delete after 5 seconds
                }
            }
        }

    },

    /**
     * Handles the /counting command to display game stats.
     */
    async handleCountingStats(Hexley: any, interaction: any) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const channelId = process.env.COUNTING_CHANNEL_ID;
        const userId = interaction.user.id;
        const memberDisplayName = interaction.member.displayName;

        // Fetch Global State
        let countState = await Hexley.frameworks.database.get(countingTable, { channelId: channelId });
        if (!countState) {
            await Hexley.frameworks.database.upsert(countingTable, { channelId, currentNumber: 0, lastUserIdValidCount: null, highScore: 0 });
            countState = { currentNumber: 0, lastUserIdValidCount: null, highScore: 0, lastBreakerUserId: null };
        }
        const { currentNumber, lastUserIdValidCount, lastBreakerUserId, highScore } = countState;
        
        // 2. Fetch Names
        let lastCounterName = 'N/A';
        if (lastUserIdValidCount) {
            const member = await Hexley.frameworks.discord.getGuildMember(lastUserIdValidCount);
            if (member) {
                lastCounterName = member.displayName;
            }
        }
        
        let lastBreakerName = 'N/A';
        if (lastBreakerUserId) {
            const member = await Hexley.frameworks.discord.getGuildMember(lastBreakerUserId);
            if (member) {
                lastBreakerName = member.displayName;
            }
        }

        // Fetch User Stats and Cooldowns
        const userStats = await Hexley.frameworks.database.get(countingUserStatsTable, { userId: userId, channelId: channelId });
        const userCount = userStats?.count ?? 0;
        const userBreaks = userStats?.breaksCount ?? 0;
        const isParticipationCooledDown = await Hexley.frameworks.cooldown.checkCooldown(Hexley, userId, 'counting_cannot_particip');
        const isXpCooledDown = await Hexley.frameworks.cooldown.checkCooldown(Hexley, userId, 'counting_xp_gain');
        const canParticipateText = isParticipationCooledDown ? 'NO' : 'YES';
        const xpCooldownText = isXpCooledDown ? 'YES' : 'NO';
        const currentGain = this._calculateXpGain(currentNumber + 1);
        const currentLoss = this._calculateXpLoss(currentNumber);

        const embed = new EmbedBuilder()
            .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
            .setTitle('🔢 Counting Mini-game Stats')
            .setDescription("Take turns counting up! The goal is to reach the highest number as a server without mistakes.")
            .addFields(
                { name: 'Last Successful Counter', value: lastCounterName, inline: true },
                { name: 'Last Count Breaker', value: lastBreakerName, inline: true },
                { name: 'Next Number', value: `${(currentNumber + 1).toLocaleString()}`, inline: true },
                { name: 'High Score', value: `${highScore.toLocaleString()}`, inline: true },
                
                { name: 'Current Reward', value: `${currentGain} XP`, inline: true },
                { name: 'Current Penalty', value: `${currentLoss} XP`, inline: true },

                { name: `**User Stats for ${memberDisplayName}**`, value: '\u200B', inline: false },

                { name: 'Can Participate?', value: canParticipateText, inline: true },
                { name: 'XP Cooldown Active?', value: xpCooldownText, inline: true },
                { name: '\u200B', value: '\u200B', inline: true }, // Spacer (for alignment)

                { name: 'XP Cooldown Progress', value: `Counts: ${userCount}/10`, inline: true },
                { name: 'Break Cooldown Progress', value: `Breaks: ${userBreaks}/3`, inline: true },
                { name: '\u200B', value: '\u200B', inline: true } // Spacer (for alignment)
            )

            .setTimestamp()
            .setFooter({ text: `Current number is ${currentNumber.toLocaleString()}` });

        await interaction.editReply({ embeds: [embed] });
    },

    /**
     * Handles the /setcount admin command.
     */
    async handleSetCount(Hexley: any, interaction: any) {
        if (!this._isAdmin(interaction.member)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const number = interaction.options.getInteger('number');
        const channelId = process.env.COUNTING_CHANNEL_ID;

        if (channelId) {
            let countState = await Hexley.frameworks.database.get(countingTable, { channelId: channelId });
            await Hexley.frameworks.database.upsert(countingTable, { channelId, currentNumber: number, lastUserIdValidCount: null, highScore: countState?.highScore ?? 0 });
            
            await interaction.editReply(`Successfully set the count to **${number}**. The next number is **${number + 1}**.`);
            const adminMessage = `**An admin has reset the count.** The next number is **${number + 1}**.`;
            await Hexley.frameworks.discord.sendMessageToChannel(channelId, adminMessage);
        } else {
            await interaction.editReply('Counting channel ID is not configured.');
        }
    },

    /**
     * Handles the /sethighscore admin command.
     */
    async handleSetHighScore(Hexley: any, interaction: any) {
        if (!this._isAdmin(interaction.member)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const number = interaction.options.getInteger('number');
        const channelId = process.env.COUNTING_CHANNEL_ID;

        if (channelId) {
            let countState = await Hexley.frameworks.database.get(countingTable, { channelId: channelId });
            await Hexley.frameworks.database.upsert(countingTable, { ...countState, channelId, highScore: number });
            
            await interaction.editReply(`Successfully set the high score to **${number}**.`);
        } else {
            await interaction.editReply('Counting channel ID is not configured.');
        }
    },

    /**
     * Handles the /resetcounting admin command.
     */
    async handleResetCounting(Hexley: any, interaction: any) {
        if (!this._isAdmin(interaction.member)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[counting/reset]', this.moduleColor)} Admin request to reset counting tables...`);
            await Hexley.frameworks.database.dropTable(countingTable);
            await Hexley.frameworks.database.dropTable(countingUserStatsTable);
            await Hexley.frameworks.database.initTable(countingTable);
            await Hexley.frameworks.database.initTable(countingUserStatsTable);
            await interaction.editReply('Successfully reset the counting game. All tables have been recreated with the latest schema.');
        } catch (error: any) {
            await interaction.editReply(`An error occurred while resetting the counting game: ${error.message}`);
        }
    },

};
