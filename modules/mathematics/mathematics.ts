import { Events, EmbedBuilder, type Interaction, GuildMember, Message, MessageFlags } from 'discord.js';
import { DataTypes } from 'sequelize';

// Configuration, these need to be moved into info.plist
const MAX_DIGITS_EASY_HARD = 2; // Max operand value is 99
const MAX_DIGITS_CHALLENGING = 4; // Max operand value is 9999
const MAX_DIGITS_ANNOYING = 6; // Max operand value is 999999
const BREAK_LIMIT = 5; // The consecutive break limit for personal stats
const XP_PROGRESS_LIMIT = 15; // Number of solves required for XP cooldown
const XP_COOLDOWN_DURATION_SECONDS = 3600; // 1 hour

// Define the type for a difficulty tier to help the static compiler in vsc
interface DifficultyTier {
    name: string;
    minStreak: number;
    maxStreak: number;
    operators: string[];
    operands: number;
    digits: number;
    parentheses: boolean;
}

// Database Table Definitions
const mathematicsTable = {
    definition: {
        channelId: {
            type: DataTypes.STRING(191),
            allowNull: false,
            primaryKey: true
        },
        currentStreak: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        highStreak: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        lastSolverUserId: {
            type: DataTypes.STRING(191),
            allowNull: true
        },
        lastBreakerUserId: {
            type: DataTypes.STRING(191),
            allowNull: true
        },
        currentProblem: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: '0'
        },
        correctAnswer: {
            type: DataTypes.BIGINT, // Using BIGINT for large answers
            allowNull: false,
            defaultValue: 0
        }
    },
    options: {
        tableName: 'mathematicsTable',
        timestamps: false
    }
};

const mathematicsUserStatsTable = {
    definition: {
        userId: {
            type: DataTypes.STRING(191),
            allowNull: false,
            primaryKey: true
        },
        channelId: {
            type: DataTypes.STRING(191),
            allowNull: false
        },
        problemsSolved: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        breaksCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        xpProgressCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    },
    options: {
        tableName: 'mathematicsUserStatsTable',
        timestamps: false
    }
};

/**
 * The globally accessible module for the Mathematics Mini-game.
 */
export const mathematics = {

    moduleColor: "#347aeb",

    /**
     * Tiers define the complexity of problems based on the current streak.
     */
    difficultyTiers: [
        { name: 'Easy', minStreak: 1, maxStreak: 25, operators: ['+', '-'], operands: 2, digits: MAX_DIGITS_EASY_HARD, parentheses: false },
        { name: 'Medium', minStreak: 26, maxStreak: 50, operators: ['+', '-', '*', '/'], operands: 2, digits: MAX_DIGITS_EASY_HARD, parentheses: false },
        { name: 'Hard', minStreak: 51, maxStreak: 60, operators: ['+', '-', '*', '/'], operands: 3, digits: MAX_DIGITS_EASY_HARD, parentheses: true },
        { name: 'Challenging', minStreak: 61, maxStreak: 100, operators: ['+', '-', '*', '/'], operands: 4, digits: MAX_DIGITS_CHALLENGING, parentheses: true },
        { name: 'Annoying', minStreak: 101, maxStreak: Infinity, operators: ['+', '-', '*', '/'], operands: 4, digits: MAX_DIGITS_ANNOYING, parentheses: true },
    ] as DifficultyTier[],

    /**
     * Main Entry Point for the Mathematics module.
     * @param {any} Hexley - The main Hexley global object.
     */
    async mathematicsInit(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[mathematics/mathematicsInit]', this.moduleColor)} Initializing Mathematics Module...`);

        if (!Hexley.databaseLoaded) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[mathematics]', Hexley.frameworks.aurora.tintRed)} Database not loaded. Math module disabled.`);
            return;
        }

        await Hexley.frameworks.database.initTable(mathematicsTable);
        await Hexley.frameworks.database.initTable(mathematicsUserStatsTable);

        const channelId = Hexley.modules.mathematics.config.MATH_CHANNEL_ID;
        if (!channelId) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[mathematics]', Hexley.frameworks.aurora.tintRed)} MATH_CHANNEL_ID not set in info.plist.`);
            return;
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[mathematics/mathematicsInit]', this.moduleColor)} Mathematics channel ID is set to: ${channelId}`);
        };

        // Start the game by posting the first problem if the table is empty
        const initialState = await Hexley.frameworks.database.get(mathematicsTable, { channelId });
        if (!initialState || initialState.currentProblem === '0') {
            await this._postNewProblem(Hexley, channelId, 0);
        }

        if (Hexley.discordLoaded) {
            Hexley.frameworks.discord.client.on(Events.MessageCreate, (message: Message) => {
                this.handleMessage(Hexley, message);
            });

            Hexley.frameworks.discord.client.on(Events.InteractionCreate, (interaction: Interaction) => {
                if (!interaction.isChatInputCommand()) return;
                
                if (interaction.commandName === 'mathematics') {
                    this.handleMathematicsStats(Hexley, interaction);
                }
            });
        }
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[mathematics/mathematicsInit]', this.moduleColor)} Initialized Mathematics Module successfully!`);
    },

    /**
     * Gets the difficulty tier based on the current streak.
     * @param {number} streak - The current correct answer streak.
     * @returns {DifficultyTier} The tier object. Guaranteed to return the first tier as fallback.
     */
    _getTier(streak: number): DifficultyTier {
        return this.difficultyTiers.find(tier => streak >= tier.minStreak && streak <= tier.maxStreak) || this.difficultyTiers[0]!;
    },
    
    /**
     * Generates a random integer within a min/max range.
     */
    _rand(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Generates a valid math problem that always resolves to an integer.
     * @param {number} streak - The current correct answer streak.
     * @returns {{ problem: string, answer: number }} The problem string and the correct integer answer.
     */
    _generateProblem(streak: number): { problem: string, answer: number } {
        const tier = this._getTier(streak);
        const maxOpValue = Math.pow(10, tier.digits) - 1;
        const operators = tier.operators;
        const numOperands = tier.operands;
        
        let expression = '';
        let result = 0;
        let operands: number[] = [];

        // Generate the first operand
        operands.push(this._rand(1, maxOpValue));

        // Generate subsequent operands and build a simple expression for a single operation per step
        for (let i = 1; i < numOperands; i++) {
            const op = operators[this._rand(0, operators.length - 1)];
            if (!op) return this._generateProblem(streak);

            let nextOperand = this._rand(1, maxOpValue);

            // Special handling for division to ensure integer result
            if (op === '/') {
                const dividend = operands[i-1];
                if (dividend === undefined || typeof dividend !== 'number' || dividend === 0) return this._generateProblem(streak); 

                let divisors: number[] = [];
                for (let j = 1; j <= Math.sqrt(dividend); j++) {
                    if (dividend % j === 0) {
                        divisors.push(j);
                        if (dividend / j !== j) divisors.push(dividend / j);
                    }
                }
                
                divisors = divisors.filter(d => d <= maxOpValue && d !== 0);
                if (divisors.length === 0) { 
                    return this._generateProblem(streak); 
                }
                
                const selectedDivisor = divisors[this._rand(0, divisors.length - 1)];
                if (selectedDivisor === undefined) {
                    return this._generateProblem(streak); 
                }
                nextOperand = selectedDivisor;
            }
            
            operands.push(nextOperand);
        }

        // Build the expression and calculate the result based on tier complexity
        if (tier.operands === 2 && !tier.parentheses) {
            const op = operators[this._rand(0, operators.length - 1)];
            if (!op || operands[0] === undefined || operands[1] === undefined) return this._generateProblem(streak); 
            expression = `${operands[0]} ${op} ${operands[1]}`;
            result = eval(expression);

        } else if (tier.operands === 3 && tier.parentheses) {
            const op1 = operators[this._rand(0, operators.length - 1)];
            const op2 = operators[this._rand(0, operators.length - 1)];
            if (!op1 || !op2 || operands[0] === undefined || operands[1] === undefined || operands[2] === undefined) return this._generateProblem(streak);
            expression = `(${operands[0]} ${op1} ${operands[1]}) ${op2} ${operands[2]}`;
            result = eval(expression);
            
        } else if (tier.operands === 4 && tier.parentheses) {
            const op1 = operators[this._rand(0, operators.length - 1)];
            const op2 = operators[this._rand(0, operators.length - 1)];
            const op3 = operators[this._rand(0, operators.length - 1)];
            if (!op1 || !op2 || !op3 || operands[0] === undefined || operands[1] === undefined || operands[2] === undefined || operands[3] === undefined) return this._generateProblem(streak);
            expression = `(${operands[0]} ${op1} ${operands[1]}) ${op2} (${operands[2]} ${op3} ${operands[3]})`;
            result = eval(expression);
        } else {
            const op = operators[this._rand(0, operators.length - 1)];
            if (!op || operands[0] === undefined || operands[1] === undefined) return this._generateProblem(streak);
            expression = `${operands[0]} ${op} ${operands[1]}`;
            result = eval(expression);
        }

        if (result < 0 || !Number.isInteger(result)) {
             return this._generateProblem(streak);
        }

        return { problem: expression.replace(/\//g, '÷').replace(/\*/g, '×'), answer: result };
    },

    /**
     * Posts a new problem to the math channel.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} channelId - The ID of the channel to post to.
     * @param {number} currentStreak - The current successful streak.
     */
    async _postNewProblem(Hexley: any, channelId: string, currentStreak: number) {
        const { problem, answer } = this._generateProblem(currentStreak);
        let existingState = await Hexley.frameworks.database.get(mathematicsTable, { channelId });
        let embedColor: any = this.moduleColor; // Default fallback color is the module's color
        const lastSolverId = existingState?.lastSolverUserId;

        // But udate the color if someone successfully has a solve streak
        if (lastSolverId) {
            const member = await Hexley.frameworks.discord.getGuildMember(lastSolverId);
            if (member) {
                embedColor = Hexley.frameworks.discord.getUserRoleColor(member);
            }
        }
        
        // Update the database
        await Hexley.frameworks.database.upsert(mathematicsTable, {
            channelId,
            currentStreak,
            lastSolverUserId: existingState?.lastSolverUserId || null,
            lastBreakerUserId: existingState?.lastBreakerUserId || null,
            currentProblem: problem,
            correctAnswer: answer,
        });

        // Create the embed, then send it
        const problemEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`Current Streak: ${currentStreak}`)
            .setDescription(`\n# ${problem}`);
            
        await Hexley.frameworks.discord.sendMessageToChannel(channelId, { embeds: [problemEmbed] });
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[mathematics/newProblem]', this.moduleColor)} New problem posted: ${problem} = ${answer}.`);
        // Yes we log it to console, for now anyways. moduleDebug is a feature soon
    },

    /**
     * Resets the 'breaksCount' for all users in the specified channel.
     */
    async _resetAllBreaks(Hexley: any, channelId: string) {
        if (!Hexley.databaseLoaded) return;
        
        const allUsers = await Hexley.frameworks.database.getAll(mathematicsUserStatsTable);
        
        for (const user of allUsers) {
            if (user.channelId === channelId && user.breaksCount > 0) {
                await Hexley.frameworks.database.upsert(
                    mathematicsUserStatsTable, 
                    { userId: user.userId, channelId: user.channelId, problemsSolved: user.problemsSolved, xpProgressCount: user.xpProgressCount, breaksCount: 0 }
                );
            }
        }
    },
    
    /**
     * Calculates the XP to gain based on the current streak level.
     * Mirrored from Counting logic but applied to math tiers.
     */
    _calculateXpGain(streak: number): number {
        const baseGain = 1;
        const bonusGain = Math.floor(streak / 25); 
        return baseGain + bonusGain;
    },

    /**
     * Calculates the XP to lose based on the current streak level.
     */
    _calculateXpLoss(streak: number): number {
        const baseLoss = 5;
        const bonusLoss = Math.floor(streak / 10);
        return baseLoss + bonusLoss;
    },
    
    /**
     * Handles incoming messages to check for math answers.
     */
    async handleMessage(Hexley: any, message: Message) {
        const channelId = Hexley.modules.mathematics.config.MATH_CHANNEL_ID;
        if (message.author.bot || message.channel.id !== channelId || !message.channel.isTextBased()) {
            return;
        }

        const content = message.content.trim();
        if (!/^\d+$/.test(content)) return;

        // Remove expired particip cooldowns
        const expiredParticipateCooldown = await Hexley.frameworks.cooldown.findExpiredCooldown(Hexley, message.author.id, 'math_cannot_particip');
        if (expiredParticipateCooldown) {
            await Hexley.frameworks.cooldown.clearCooldown(Hexley, message.author.id, 'math_cannot_particip');
            
            const resetMessage = `Participation cooldown for **${message.member?.displayName}** has ended. You can participate again!`;
            const sentResetMsg = await Hexley.frameworks.discord.sendMessageToChannel(message.channel.id, resetMessage);
            if (sentResetMsg) {
                setTimeout(() => sentResetMsg.delete(), 5000); 
            }
        }

        const submittedAnswer = parseInt(content, 10);
        let gameState = await Hexley.frameworks.database.get(mathematicsTable, { channelId });

        if (!gameState || gameState.currentProblem === '0') return;

        const isParticipationCooledDown = await Hexley.frameworks.cooldown.checkCooldown(Hexley, message.author.id, 'math_cannot_particip');
        if (isParticipationCooledDown) {
            return; 
        }

        const correct = submittedAnswer === gameState.correctAnswer;
        
        if (correct) {
            await message.react('✅');
            
            // Get user stats before updating
            let userStats = await Hexley.frameworks.database.get(mathematicsUserStatsTable, { userId: message.author.id, channelId: channelId });
            const solvedCount = userStats?.problemsSolved ?? 0;
            const breakCount = userStats?.breaksCount ?? 0;
            let xpProgressToSave = userStats?.xpProgressCount ?? 0;

            // XP Cooldown Check and Logic
            const expiredCooldown = await Hexley.frameworks.cooldown.findExpiredCooldown(Hexley, message.author.id, 'math_xp_gain');
            if (expiredCooldown) {
                await Hexley.frameworks.cooldown.clearCooldown(Hexley, message.author.id, 'math_xp_gain');
                xpProgressToSave = 0;
                
                const resetMessage = `Mathematics XP cooldown for **${message.member?.displayName}** has ended, their streak progress has been reset!`;
                const sentResetMsg = await Hexley.frameworks.discord.sendMessageToChannel(channelId, resetMessage);
                if (sentResetMsg) {
                    setTimeout(() => sentResetMsg.delete(), 5000);
                }
            }

            const isXpCooledDown = await Hexley.frameworks.cooldown.checkCooldown(Hexley, message.author.id, 'math_xp_gain');
            
            if (!isXpCooledDown) {
                // Gain XP
                const xpToGain = this._calculateXpGain(gameState.currentStreak);
                await Hexley.frameworks.experience.addXP(Hexley, message.author.id, xpToGain);

                // Update XP Progress
                const newXpProgress = Math.min(xpProgressToSave + 1, XP_PROGRESS_LIMIT);
                xpProgressToSave = newXpProgress;

                // Apply Cooldown if progress limit is met
                if (newXpProgress === XP_PROGRESS_LIMIT) {
                    await Hexley.frameworks.cooldown.setCooldown(Hexley, message.author.id, 'math_xp_gain', XP_COOLDOWN_DURATION_SECONDS);
                    
                    const cooldownMessage = `**${message.member?.displayName}** has solved ${XP_PROGRESS_LIMIT} problems and is now on an hour XP gain cooldown!`;
                    const sentCooldownMsg = await Hexley.frameworks.discord.sendMessageToChannel(channelId, cooldownMessage);
                    
                    if (sentCooldownMsg) {
                        setTimeout(() => sentCooldownMsg.delete(), 10000);
                    }
                }
            }
            
            // Update global game state
            const newStreak = gameState.currentStreak + 1;
            const newHighStreak = Math.max(gameState.highStreak, newStreak);
            
            await Hexley.frameworks.database.upsert(mathematicsTable, {
                channelId,
                currentStreak: newStreak,
                highStreak: newHighStreak,
                lastSolverUserId: message.author.id,
                correctAnswer: 0
            });
            
            // Update user stats
            await Hexley.frameworks.database.upsert(mathematicsUserStatsTable, { 
                userId: message.author.id, 
                channelId, 
                problemsSolved: solvedCount + 1,
                breaksCount: breakCount,
                xpProgressCount: xpProgressToSave
            });
            
            // Post the next problem
            await this._postNewProblem(Hexley, channelId, newStreak);
            return;

        } else {
            await message.react('❌');
            
            const xpToLose = this._calculateXpLoss(gameState.currentStreak);
            await Hexley.frameworks.experience.removeXP(Hexley, message.author.id, xpToLose);
            
            // Handle personal break streak and penalty
            let userStats = await Hexley.frameworks.database.get(mathematicsUserStatsTable, { userId: message.author.id, channelId: channelId });
            let currentBreaksCount = userStats?.breaksCount ?? 0;
            const solvedCount = userStats?.problemsSolved ?? 0;
            const xpProgressCount = userStats?.xpProgressCount ?? 0; // Preserve XP progress on break
            const isNewBreaker = message.author.id !== gameState.lastBreakerUserId;
            
            if (isNewBreaker) {
                await this._resetAllBreaks(Hexley, channelId); // Reset everyone else's streak
                currentBreaksCount = 1; // Start this user's streak
            } else {
                currentBreaksCount++; // Same person, increment their break count
            }
            
            let announcement = `**Game Over!** ${message.member?.displayName} submitted the wrong answer. The correct answer was **${gameState.correctAnswer}**.\n`;
            announcement += `Streak reset from **${gameState.currentStreak}** to **0**. They lost **${xpToLose}** XP.`;

            if (currentBreaksCount >= BREAK_LIMIT) {
                const COOLDOWN_DURATION_SECONDS = 8 * 60 * 60; // 8 hours
                await Hexley.frameworks.cooldown.setCooldown(Hexley, message.author.id, 'math_cannot_particip', COOLDOWN_DURATION_SECONDS);
                currentBreaksCount = 0;
                announcement += `\n${message.member?.displayName} is now on an **8-hour participation cooldown! They have broken the streak ${BREAK_LIMIT} times in a row.**`;
            } else {
                announcement += `\n${message.member?.displayName}'s Break Streak: **${currentBreaksCount}/${BREAK_LIMIT}**.`;
            }
            
            const sentMsg = await Hexley.frameworks.discord.sendMessageToChannel(channelId, announcement);
            if (sentMsg) {
                 setTimeout(() => sentMsg.delete(), 10000);
            }

            // Update user stats with the new break count (preserving XP progress)
            await Hexley.frameworks.database.upsert(mathematicsUserStatsTable, { 
                userId: message.author.id, 
                channelId, 
                problemsSolved: solvedCount, 
                breaksCount: currentBreaksCount,
                xpProgressCount: xpProgressCount // Preserve the progress
            });

            // Reset global game state
            await Hexley.frameworks.database.upsert(mathematicsTable, {
                channelId,
                currentStreak: 0,
                lastSolverUserId: null,
                lastBreakerUserId: message.author.id,
                currentProblem: '0',
                correctAnswer: 0
            });
            
            // Start the next game
            await this._postNewProblem(Hexley, channelId, 0);
            return;
        }
    },
    
    /**
     * Handles the /mathematics command to display game stats.
     */
    async handleMathematicsStats(Hexley: any, interaction: any) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const channelId = Hexley.modules.mathematics.config.MATH_CHANNEL_ID;
        const userId = interaction.user.id;
        const memberDisplayName = interaction.member.displayName;

        let gameState = await Hexley.frameworks.database.get(mathematicsTable, { channelId });
        if (!gameState) {
            gameState = { currentStreak: 0, highStreak: 0, lastSolverUserId: null, lastBreakerUserId: null, currentProblem: 'N/A', correctAnswer: 'N/A' };
        }
        
        const { currentStreak, highStreak, lastSolverUserId, lastBreakerUserId, currentProblem } = gameState;
        const tier = this._getTier(currentStreak);
        
        // Fetch Names
        let lastSolverName = 'N/A';
        if (lastSolverUserId) {
            const member = await Hexley.frameworks.discord.getGuildMember(lastSolverUserId);
            if (member) {
                lastSolverName = member.displayName;
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
        const userStats = await Hexley.frameworks.database.get(mathematicsUserStatsTable, { userId: userId, channelId: channelId });
        const userSolved = userStats?.problemsSolved ?? 0;
        const userBreaks = userStats?.breaksCount ?? 0;
        const userXpProgress = userStats?.xpProgressCount ?? 0;
        const isParticipationCooledDown = await Hexley.frameworks.cooldown.checkCooldown(Hexley, userId, 'math_cannot_particip');
        const isXpCooledDown = await Hexley.frameworks.cooldown.checkCooldown(Hexley, userId, 'math_xp_gain');
        const canParticipateText = isParticipationCooledDown ? 'NO' : 'YES';
        const xpCooldownText = isXpCooledDown ? 'YES' : 'NO';
        const xpGain = this._calculateXpGain(currentStreak);
        const xpLoss = this._calculateXpLoss(currentStreak);
        
        const embed = new EmbedBuilder()
            .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
            .setTitle('Mathematics Mini-game Stats')
            .setDescription(`Solve math problems to earn XP! The current streak determines problem difficulty.`)
            .addFields(
                { name: 'Highest Solved Streak', value: `${highStreak}`, inline: true },
                { name: 'Difficulty', value: `${tier.name}`, inline: true },
                { name: '\u200B', value: '\u200B', inline: true }, // Spacer

                { name: 'Next Reward', value: `${xpGain} XP`, inline: true },
                { name: 'Penalty on Failure', value: `${xpLoss} XP`, inline: true },
                { name: '\u200B', value: '\u200B', inline: true }, // Spacer

                { name: 'Last Solver', value: lastSolverName, inline: true },
                { name: 'Last Breaker', value: lastBreakerName, inline: true },

                { name: `**User Stats for ${memberDisplayName}**`, value: '', inline: false },
                { name: 'Can Participate?', value: canParticipateText, inline: true },
                { name: 'XP Cooldown Active?', value: xpCooldownText, inline: true }, // NEW
                { name: 'Total Solved', value: userSolved.toLocaleString(), inline: true },

                { name: 'XP Cooldown Progress', value: `Progress: ${userXpProgress}/${XP_PROGRESS_LIMIT}`, inline: true },
                { name: 'Break Cooldown Progress', value: `Breaks: ${userBreaks}/${BREAK_LIMIT}`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Current Streak: ${currentStreak}` });

        await interaction.editReply({ embeds: [embed] });
    },

};
