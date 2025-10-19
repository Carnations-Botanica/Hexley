import { DataTypes } from 'sequelize';
import path from 'path';

const versionTable = {
    definition: {
        name: {
            type: DataTypes.STRING(191),
            allowNull: false,
            primaryKey: true
        },
        type: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        version: {
            type: DataTypes.STRING(255),
            allowNull: false,
        }
    },
    options: {
        tableName: 'versionTable',
        timestamps: false
    }
};

/**
 * The globally accessible framework for managing Hexley's versioning system.
 */
export const versionFramework = {
    frameworkColor: "#e9cc95",
    
    /**
     * Initializes the Version Framework and its database table.
     * @param {any} Hexley - The main Hexley global object.
     */
    async initializeVersionFramework(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework]', this.frameworkColor)} Initializing...`);
        
        // Ensure the in-memory object exists
        Hexley.versions = Hexley.versions || {};
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework]', this.frameworkColor)} The HGO has:`);
        Hexley.log(Hexley.versions);

        if (Hexley.resources.framework.database.isLoaded) {
            await Hexley.frameworks.database.initTable(versionTable);
            // Reset the table for a clean slate on every boot
            await Hexley.frameworks.database.reset(versionTable);
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework]', this.frameworkColor)} The versionTable has been reset!`);
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework]', Hexley.frameworks.aurora.tintYellow)} Database is not loaded. Versioning will be in-memory only.`);
        }
        
        Hexley.resources.framework.version.isLoaded = true;
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework]', this.frameworkColor)} Initialized!`);
    },

    /**
     * Adds a new version entry to the in-memory object and the database if available.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} name - The name of the framework or module.
     * @param {string} type - The type of the resource (e.g., 'Framework', 'Module').
     * @param {string} version - The version string.
     */
    async addVersionEntry(Hexley: any, name: string, type: string, version: string) {
        Hexley.versions[name] = { version, type };

        if (Hexley.resources.framework.database.isLoaded) {
            const entry = { name, type, version };
            await Hexley.frameworks.database.upsert(versionTable, entry);
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/addVersionEntry]', this.frameworkColor)} Added version entry for "${name}": ${version}`);
        }
    },

    /**
     * Removes a version entry from the in-memory object and the database if available.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} name - The name of the framework or module to remove.
     */
    async removeVersionEntry(Hexley: any, name: string) {
        if (Hexley.versions[name]) {
            delete Hexley.versions[name];
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/removeVersionEntry]', this.frameworkColor)} Removed version entry for "${name}".`);
        }

        if (Hexley.resources.framework.database.isLoaded) {
            await Hexley.frameworks.database.delete(versionTable, { name });
        }
    },

    /**
     * Retrieves a specific version entry, checking the in-memory object first, then the database.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} name - The name of the entry to find.
     * @returns {Promise<any | null>} The entry object, or null if not found.
     */
    async getVersionEntry(Hexley: any, name: string): Promise<any | null> {
        if (Hexley.versions[name]) {
            return Hexley.versions[name];
        }

        if (Hexley.resources.framework.database.isLoaded) {
            return Hexley.frameworks.database.get(versionTable, { name: name });
        }

        return null;
    },
    
    /**
     * Retrieves all version entries, sorted logically by type and then by name.
     * @param {any} Hexley - The main Hexley global object.
     * @returns {Promise<any[]>} A sorted array of all entry objects.
     */
    async getAllVersionEntries(Hexley: any): Promise<any[]> {
        let entries: any[] = [];

        if (Hexley.resources.framework.database.isLoaded) {
            entries = await Hexley.frameworks.database.getAll(versionTable);
        } else {
            entries = Object.entries(Hexley.versions).map(([name, data]) => {
                const typedData = data as { version: string, type: string };
                return {
                    name,
                    version: typedData.version,
                    type: typedData.type
                };
            });
        }

        // Define the desired sort order
        const sortOrder: { [key: string]: number } = {
            'Kernel': 1,
            'Framework': 2,
            'Module': 3,
            'Driver': 4
        };

        // Sort the entries
        entries.sort((a, b) => {
            const orderA = sortOrder[a.type] || 4;
            const orderB = sortOrder[b.type] || 4;

            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return a.name.localeCompare(b.name);
        });

        return entries;
    },

    /**
     * Shutdown routine to clear the version table in the database.
     * @param {any} Hexley - The main Hexley global object.
     */
    async shutdown(Hexley: any) {
        if (Hexley.resources.framework.database.isLoaded) {
            await Hexley.frameworks.database.reset(versionTable);
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework]', this.frameworkColor)} Version table cleared.`);
        }
    }

};
