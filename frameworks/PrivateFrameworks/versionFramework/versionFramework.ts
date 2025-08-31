import { Sequelize, DataTypes, Model } from 'sequelize';
import path from 'path';

/**
 * The globally accessible framework for managing Hexley's versioning object.
 */
export const versionFramework = {

    // Framework Logging Color
    frameworkColor: "#e9cc95",
    
    async initializeVersionFramework(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/initializeVersionFramework]', this.frameworkColor)} Initializing...`);
        
        Hexley.versions = Hexley.versions || {}; // Ensure the versions object exists
        Hexley.versionLoaded = true;

        // Define the table model in a self-contained object.
        const versionTable = {
            definition: {
                name: {
                    type: DataTypes.STRING(191), // Corrected length to fit within primary key limits
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
                timestamps: false,
                freezeTableName: true, // This is crucial to prevent Sequelize from pluralizing the table name
                engine: 'MyISAM' // InnoDB may cause issues for some people
            }
        };

        if (Hexley.sequelizerLoaded) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/initializeVersionFramework]', this.frameworkColor)} Sequelizer is loaded. Setting up database...`);
        
            await Hexley.frameworks.sequelizer.initTableDefinition(Hexley, process.env.DB_NAME, versionTable);

            await Hexley.frameworks.sequelizer.resetTableDefinition(Hexley, process.env.DB_NAME, versionTable);

            // Add the version entry for the hexleyCore itself
            await Hexley.frameworks.sequelizer.addTableDefinitionEntry(
                Hexley,
                process.env.DB_NAME,
                versionTable,
                { name: 'hexleyCore', type: 'Kernel', version: Hexley.versionNumber },
                { name: 'hexleyCore' }
            );

            // Add the version entry for the registryFramework itself
            await Hexley.frameworks.sequelizer.addTableDefinitionEntry(
                Hexley,
                process.env.DB_NAME,
                versionTable,
                { name: 'registryFramework', type: 'Framework', version: '1.0.0' },
                { name: 'registryFramework' }
            );

            // Add the version entry for the versionFramework itself
            await Hexley.frameworks.sequelizer.addTableDefinitionEntry(
                Hexley,
                process.env.DB_NAME,
                versionTable,
                { name: 'versionFramework', type: 'Framework', version: '1.0.0' },
                { name: 'versionFramework' }
            );
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/initializeVersionFramework]', this.frameworkColor)} Sequelizer is not loaded or enabled.`);
        }
        
        // Listen for registryFramework.ready and add the version to the database.
        Hexley.core.once('registryFramework.ready', () => {
            const plistPath = path.join(Hexley.privateFrameworksRootPath, 'versionFramework', 'info.plist');
            Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
        });
        
        // Add to the in-memory versions object on successful load
        Hexley.versions['versionFramework'] = { version: '1.0.0', type: 'Framework' };

        // Emit a ready event when initialization is complete
        Hexley.core.emit('versionFramework.ready');
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/initializeVersionFramework]', this.frameworkColor)} Initialized! Version Framework is now accepting requests.`);
    },

    /**
     * Adds a new version entry to the global Hexley versions object.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} name - The name of the framework or module.
     * @param {string} type - The type of the resource (e.g., 'Framework', 'Module').
     * @param {string} version - The version string.
     */
    async addVersionEntry(Hexley: any, name: string, type: string, version: string) {
        if (!Hexley.versions) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/addVersionEntry]', this.frameworkColor)} Error: Hexley.versions object is not initialized.`);
            return;
        }

        Hexley.versions[name] = { version: version, type: type };
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/addVersionEntry]', this.frameworkColor)} Added version entry for "${name}": ${version}`);

        if (Hexley.sequelizerLoaded) {
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
                    timestamps: false,
                    freezeTableName: true, 
                    engine: 'MyISAM'
                }
            };

            await Hexley.frameworks.sequelizer.addTableDefinitionEntry(
                Hexley,
                process.env.DB_NAME,
                versionTable,
                { name: name, type: type, version: version },
                { name: name }
            );
        }
    },

    /**
     * Removes a version entry from the global Hexley versions object and the database.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} name - The name of the framework or module to remove.
     */
    async removeVersionEntry(Hexley: any, name: string) {
        if (!Hexley.versions || !Hexley.versions[name]) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/removeVersionEntry]', this.frameworkColor)} Version for "${name}" not found in memory. Skipping removal.`);
        } else {
            delete Hexley.versions[name];
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/removeVersionEntry]', this.frameworkColor)} Removed version entry for "${name}" from memory.`);
        }

        if (Hexley.sequelizerLoaded) {
            const versionTable = {
                options: { tableName: 'versionTable' }
            };
            try {
                await Hexley.frameworks.sequelizer.deleteTableDefinitionEntry(
                    Hexley,
                    process.env.DB_NAME,
                    versionTable,
                    { name: name }
                );
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/removeVersionEntry]', this.frameworkColor)} Removed version entry for "${name}" from database.`);
            } catch (error) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/removeVersionEntry]', this.frameworkColor)} Error removing version entry from database for "${name}": ${error}`);
            }
        }
    },

    /**
     * Retrieves the version and type of a specific framework or module.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} name - The name of the framework or module to query.
     * @returns {{ name: string, type: string, version: string } | null} An object containing the name, type, and version, or null if not found.
     */
    async getVersionEntry(Hexley: any, name: string): Promise<{ name: string, type: string, version: string } | null> {
        if (!Hexley.versions || !Hexley.versions[name]) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/getVersionEntry]', this.frameworkColor)} Version for "${name}" not found in memory.`);
            // Fallback to database lookup if Sequelizer is loaded
            if (Hexley.sequelizerLoaded) {
                const versionTable = {
                    definition: {}, // Definition isn't needed for retrieval
                    options: { tableName: 'versionTable' }
                };
                try {
                    const entry = await Hexley.frameworks.sequelizer.getTableDefinitionEntry(Hexley, process.env.DB_NAME, versionTable, { where: { name: name } });
                    if (entry) {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/getVersionEntry]', this.frameworkColor)} Version for "${name}" retrieved from database.`);
                        return { name: entry.name, type: entry.type, version: entry.version };
                    }
                } catch (error) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/getVersionEntry]', this.frameworkColor)} Error retrieving version from database: ${error}`);
                }
            }
            return null;
        }

        // We can't get the type from the in-memory versions object, so let's check the database
        if (Hexley.sequelizerLoaded) {
            const versionTable = {
                definition: {},
                options: { tableName: 'versionTable' }
            };
            try {
                const entry = await Hexley.frameworks.sequelizer.getTableDefinitionEntry(Hexley, process.env.DB_NAME, versionTable, { where: { name: name } });
                if (entry) {
                    return { name: entry.name, type: entry.type, version: entry.version };
                }
            } catch (error) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[versionFramework/getVersionEntry]', this.frameworkColor)} Error retrieving version from database: ${error}`);
            }
        }
        
        return { name: name, type: 'Unknown', version: Hexley.versions[name] };
    },

};
