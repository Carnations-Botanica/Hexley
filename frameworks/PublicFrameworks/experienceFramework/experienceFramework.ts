import { DataTypes } from 'sequelize';
import path from 'path';
import fs from 'fs';

// Define the structure of our xpTable model.
const xpTable = {
    definition: {
        userId: {
            type: DataTypes.STRING(191),
            allowNull: false,
            primaryKey: true
        },
        xp: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0
        }
    },
    options: {
        tableName: 'xpTable',
        timestamps: false
    }
};

/**
 * The globally accessible framework for managing user experience points (XP).
 */
export const experienceFramework = {

    // Framework Logging Color
    frameworkColor: "#a3d9a5",
    _ranks: [] as { threshold: number, name: string }[], // To store loaded ranks
    
    /**
     * Initializes the Experience Framework and its database table.
     * @param {any} Hexley - The main Hexley global object.
     */
    async initExperience(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[experienceFramework]', this.frameworkColor)} Initializing...`);

        // Load ranks from the JSON file
        try {
            const ranksPath = path.join(Hexley.workingDir, 'vfs', 'etc', 'ranks.json');
            const ranksFile = fs.readFileSync(ranksPath, 'utf8');
            this._ranks = JSON.parse(ranksFile);

            Hexley.log(`${Hexley.frameworks.aurora.colorText('[experienceFramework]', this.frameworkColor)} Loaded ${this._ranks.length} ranks.`);
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[experienceFramework]', Hexley.frameworks.aurora.tintRed)} Could not load ranks.json: ${error.message}`);
        }
        
        if (Hexley.resources.framework.database.isLoaded) {
            await Hexley.frameworks.database.initTable(xpTable);

            const hexleyId = process.env.HEXLEY_USER_ID;
            if (hexleyId) {
                const hexleyEntry = await Hexley.frameworks.database.get(xpTable, { userId: hexleyId });
                if (!hexleyEntry) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[experienceFramework]', this.frameworkColor)} Seeding table with Hexley's user ID...`);
                    await this.setXP(Hexley, hexleyId, 1);
                }
            }

            Hexley.resources.framework.experience.isLoaded = true;
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[experienceFramework]', this.frameworkColor)} Initialized!`);
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[experienceFramework]', Hexley.frameworks.aurora.tintYellow)} Database is not loaded. Experience system will be unavailable.`);
        }
    },

    /**
     * Retrieves the XP for a given user. If the user doesn't exist, they are created with 0 XP.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The Discord ID of the user.
     * @returns {Promise<number>} The user's current XP.
     */
    async getXP(Hexley: any, userId: string): Promise<number> {
        if (!Hexley.resources.framework.database.isLoaded) return 0;
        
        let userEntry = await Hexley.frameworks.database.get(xpTable, { userId: userId });

        if (!userEntry) {
            // If user does not exist, create them with 1 xp and return that.
            await this.setXP(Hexley, userId, 1);
            return 0;
        }

        return userEntry.xp;
    },

    /**
     * Retrieves all XP entries from the database.
     * @param {any} Hexley - The main Hexley global object.
     * @returns {Promise<any[]>} An array of all user XP objects.
     */
    async getAllXp(Hexley: any): Promise<any[]> {
        if (!Hexley.resources.framework.database.isLoaded) return [];
        return Hexley.frameworks.database.getAll(xpTable);
    },

    /**
     * Sets a user's XP to a specific value.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The Discord ID of the user.
     * @param {number} amount - The amount of XP to set.
     */
    async setXP(Hexley: any, userId: string, amount: number) {
        if (!Hexley.resources.framework.database.isLoaded) return;
        const entry = { userId, xp: Math.max(0, amount) }; // Ensure XP doesn't go below 0
        await Hexley.frameworks.database.upsert(xpTable, entry);
    },

    /**
     * Adds a specified amount of XP to a user.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The Discord ID of the user.
     * @param {number} amount - The amount of XP to add.
     * @returns {Promise<number>} The user's new total XP.
     */
    async addXP(Hexley: any, userId: string, amount: number): Promise<number> {
        const currentXP = await this.getXP(Hexley, userId);
        const newXP = currentXP + amount;
        await this.setXP(Hexley, userId, newXP);
        return newXP;
    },

    /**
     * Removes a specified amount of XP from a user.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The Discord ID of the user.
     * @param {number} amount - The amount of XP to remove.
     * @returns {Promise<number>} The user's new total XP.
     */
    async removeXP(Hexley: any, userId: string, amount: number): Promise<number> {
        return this.addXP(Hexley, userId, -amount); // Removing is just adding a negative amount
    },

    /**
     * Safely transfers XP from one user to another.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} giverId - The Discord ID of the user giving XP.
     * @param {string} receiverId - The Discord ID of the user receiving XP.
     * @param {number} amount - The amount of XP to transfer.
     * @returns {Promise<{success: boolean, message: string, giverNewXp?: number, receiverNewXp?: number}>} An object indicating the result of the transaction.
     */
    async giftXP(Hexley: any, giverId: string, receiverId: string, amount: number): Promise<{success: boolean, message: string, giverNewXp?: number, receiverNewXp?: number}> {
        if (!Hexley.resources.framework.database.isLoaded) {
            return { success: false, message: "The experience system is currently unavailable." };
        }

        // Ensure the amount is a positive number
        if (amount <= 0) {
            return { success: false, message: "You must gift a positive amount of XP." };
        }
        
        // Prevent users from gifting to themselves
        if (giverId === receiverId) {
            return { success: false, message: "You cannot gift XP to yourself." };
        }

        // Get current XP for both users (this also creates them if they don't exist)
        const giverCurrentXP = await this.getXP(Hexley, giverId);
        const receiverCurrentXP = await this.getXP(Hexley, receiverId);
        
        // Check if the giver has enough XP
        if (giverCurrentXP < amount) {
            return { success: false, message: `You do not have enough XP to gift. You only have ${giverCurrentXP} XP.` };
        }

        // Perform the transaction
        const giverNewXp = giverCurrentXP - amount;
        const receiverNewXp = receiverCurrentXP + amount;

        await this.setXP(Hexley, giverId, giverNewXp);
        await this.setXP(Hexley, receiverId, receiverNewXp);

        return {
            success: true,
            message: `Successfully gifted ${amount} XP.`,
            giverNewXp: giverNewXp,
            receiverNewXp: receiverNewXp
        };
    },

    /**
     * Gets the corresponding rank for a given amount of XP.
     * @param {number} xp - The amount of XP.
     * @returns {string} The name of the rank.
     */
    getRank(xp: number): string {
        for (const rank of this._ranks) {
            if (xp >= rank.threshold) {
                return rank.name;
            }
        }
        return 'Unranked';
    },

    /**
     * Gets the rank for a specific user.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The Discord ID of the user.
     * @returns {Promise<string>} The user's current rank name.
     */
    async getRankForUser(Hexley: any, userId: string): Promise<string> {
        const userXp = await this.getXP(Hexley, userId);
        return this.getRank(userXp);
    },

};
