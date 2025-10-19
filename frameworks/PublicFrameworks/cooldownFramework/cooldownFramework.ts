import { DataTypes, Op } from 'sequelize';

// Define the structure of our cooldownTable model.
const cooldownTable = {
    definition: {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.STRING(191),
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING(191),
            allowNull: false,
        },
        endTime: {
            type: DataTypes.DATE,
            allowNull: false,
        }
    },
    options: {
        tableName: 'cooldownTable',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['userId', 'type']
            }
        ]
    }
};

/**
 * The globally accessible framework for managing user and action-based cooldowns.
 */
export const cooldownFramework = {

    frameworkColor: "#e6a5ea",
    
    /**
     * Initializes the Cooldown Framework and its database table.
     * @param {any} Hexley - The main Hexley global object.
     */
    async initCooldownFramework(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[cooldownFramework]', this.frameworkColor)} Initializing...`);
        
        if (Hexley.resources.framework.database.isLoaded) {
            await Hexley.frameworks.database.initTable(cooldownTable);
            Hexley.resources.framework.cooldown.isLoaded = true;
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[cooldownFramework]', this.frameworkColor)} Initialized!`);
        } else {
            Hexley.resources.framework.cooldown.isLoaded = false; // ensure this value, even if its default in the HGO
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[cooldownFramework]', Hexley.frameworks.aurora.tintYellow)} Database is not loaded. Cooldown system will be unavailable.`);
        }
    },

    /**
     * Sets a cooldown for a specific user and type.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The ID of the user.
     * @param {string} type - A unique name for the cooldown (e.g., 'messageXP').
     * @param {number} durationInSeconds - The length of the cooldown in seconds.
     */
    async setCooldown(Hexley: any, userId: string, type: string, durationInSeconds: number) {
        if (!Hexley.resources.framework.database.isLoaded) return;

        const endTime = new Date(Date.now() + durationInSeconds * 1000);
        const entry = { userId, type, endTime };
        await Hexley.frameworks.database.upsert(cooldownTable, entry);
    },

    /**
     * Retrieves an active cooldown for a user and type.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The ID of the user.
     * @param {string} type - The unique name for the cooldown.
     * @returns {Promise<any | null>} The cooldown object if it's active, otherwise null.
     */
    async getCooldown(Hexley: any, userId: string, type: string): Promise<any | null> {
        if (!Hexley.resources.framework.database.isLoaded) return null;

        // The 'get' function in the driver expects the 'where' object directly.
        return await Hexley.frameworks.database.get(cooldownTable, {
            userId,
            type,
            endTime: {
                [Op.gt]: new Date()
            }
        });
    },

    /**
     * Retrieves all active cooldowns for a specific user.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<any[]>} A promise that resolves to an array of active cooldown objects.
     */
    async getAllCooldownsForUser(Hexley: any, userId: string): Promise<any[]> {
        if (!Hexley.resources.framework.database.isLoaded) return [];

        // Fetch all entries from the cooldownTable.
        const allCooldowns = await Hexley.frameworks.database.getAll(cooldownTable);

        // Filter the results in-code to find the ones we need.
        const userActiveCooldowns = allCooldowns.filter((cooldown: any) => {
            const isForThisUser = cooldown.userId === userId;
            const isStillActive = new Date(cooldown.endTime) > new Date();
            return isForThisUser && isStillActive;
        });

        return userActiveCooldowns;
    },

    /**
     * Finds an EXPIRED cooldown for a user and type.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The ID of the user.
     * @param {string} type - The unique name for the cooldown.
     * @returns {Promise<any | null>} The expired cooldown object if found, otherwise null.
     */
    async findExpiredCooldown(Hexley: any, userId: string, type: string): Promise<any | null> {
        if (!Hexley.resources.framework.database.isLoaded) return null;

        // Pass the 'where' object directly to the 'get' method.
        return await Hexley.frameworks.database.get(cooldownTable, {
            userId,
            type,
            endTime: {
                [Op.lte]: new Date()
            }
        });
    },

    /**
     * Checks if a user has an active cooldown for a specific type.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The ID of the user.
     * @param {string} type - The unique name for the cooldown.
     * @returns {Promise<boolean>} True if a cooldown is active, otherwise false.
     */
    async checkCooldown(Hexley: any, userId: string, type: string): Promise<boolean> {
        const cooldown = await this.getCooldown(Hexley, userId, type);
        return cooldown !== null;
    },

    /**
     * Manually clears a cooldown for a user and type.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} userId - The ID of the user.
     * @param {string} type - The unique name for the cooldown.
     */
    async clearCooldown(Hexley: any, userId: string, type: string) {
        if (!Hexley.resources.framework.database.isLoaded) return;
        
        // Pass the query object directly to the 'delete' method.
        await Hexley.frameworks.database.delete(cooldownTable, { userId, type });
    }

};
