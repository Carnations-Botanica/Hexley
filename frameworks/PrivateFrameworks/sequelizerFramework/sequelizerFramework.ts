import { Sequelize, DataTypes, Model } from 'sequelize';
import path from 'path';

/**
 * The globally accessible framework for managing Hexley's database connection via Sequelize.
 */
export const sequelizerFramework = {

    // Framework Logging Color
    frameworkColor: "#5600db",
    
    /**
     * Internal helper function to establish a database connection and add it to the global Hexley object.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} dbName - The name of the database.
     * @param {string} dbUser - The database user.
     * @param {string} dbPassword - The database password.
     * @param {string} dbHost - The database host.
     * @param {number} dbPort - The database port.
     */
    async _connectToDatabase(Hexley: any, dbName: string, dbUser: string, dbPassword: string, dbHost: string, dbPort: number) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/_connectToDatabase]', this.frameworkColor)} Initializing connection to database: ${dbName}...`);
        
        let sequelize: Sequelize;

        try {
            // First, try to connect directly to the specified database.
            sequelize = new Sequelize(dbName, dbUser, dbPassword, {
                host: dbHost,
                port: dbPort,
                dialect: 'mysql',
                logging: false, // Set to true for detailed SQL query logging
                dialectOptions: {
                    connectTimeout: 30000 // 30 seconds
                }
            });
            await sequelize.authenticate();
        } catch (error: any) {
            // If the database does not exist (error code 1049), try to create it.
            if (error.original && error.original.code === 'ER_BAD_DB_ERROR') {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/_connectToDatabase]', this.frameworkColor)} Database "${dbName}" not found. Attempting to create...`);

                // Connect without a database to create the new one
                const sequelizeWithoutDb = new Sequelize('', dbUser, dbPassword, {
                    host: dbHost,
                    port: dbPort,
                    dialect: 'mysql',
                    logging: false,
                    dialectOptions: {
                        connectTimeout: 30000
                    }
                });

                try {
                    await sequelizeWithoutDb.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/_connectToDatabase]', this.frameworkColor)} Database "${dbName}" created successfully. Reconnecting...`);
                    
                    // Now, re-initialize the Sequelize instance with the newly created database
                    sequelize = new Sequelize(dbName, dbUser, dbPassword, {
                        host: dbHost,
                        port: dbPort,
                        dialect: 'mysql',
                        logging: false,
                        dialectOptions: {
                            connectTimeout: 30000
                        }
                    });
                    await sequelize.authenticate();
                } catch (createError: any) {
                    console.error(Hexley.frameworks.aurora.colorText(`[sequelizerFramework/_connectToDatabase] Fatal: Unable to create and connect to database "${dbName}": ${createError.message}`, Hexley.frameworks.aurora.tintRedBright));
                    process.exit(1);
                }
            } else {
                // If it's any other error, exit the process.
                console.error(Hexley.frameworks.aurora.colorText(`[sequelizerFramework/_connectToDatabase] Fatal: Unable to connect to database "${dbName}": ${error.message}`, Hexley.frameworks.aurora.tintRedBright));
                process.exit(1);
            }
        }
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/_connectToDatabase]', this.frameworkColor)} Connection to MariaDB database "${dbName}" has been established successfully.`);
        
        // Listen for versionFramework.ready and add the version then.
        Hexley.core.once('versionFramework.ready', () => {
            Hexley.frameworks.version.addVersionEntry(Hexley, 'sequelizerFramework', 'Framework', '1.0.0');
        });

        // Listen for registryFramework.ready and add the version to the database.
        Hexley.core.once('registryFramework.ready', () => {
            const plistPath = path.join(Hexley.privateFrameworksRootPath, 'sequelizerFramework', 'info.plist');
            Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
        });

        // Store the sequelize instance on the Hexley global object under the "database" namespace
        if (!Hexley.database) {
            Hexley.database = {};
        }
        Hexley.database[dbName] = sequelize;
    },

    /**
     * Internal helper to parse and validate a table model definition.
     * @param {any} Hexley - The main Hexley global object.
     * @param {object} tableModel - The object containing the table's definition and options.
     * @returns {{tableName: string, definition: any, options: any} | null} The parsed model, or null if invalid.
     */
    _parseDefinition(Hexley: any, tableModel: any) {
        if (!tableModel || !tableModel.definition || !tableModel.options) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/_parseDefinition]', this.frameworkColor)} Error: Invalid table model object provided. Missing 'definition' or 'options'.`);
            return null;
        }

        const tableName = tableModel.options.tableName;
        if (!tableName) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/_parseDefinition]', this.frameworkColor)} Error: Table name not specified in model options.`);
            return null;
        }
        
        // Add freezeTableName option to prevent Sequelize pluralizing table names
        tableModel.options.freezeTableName = true;

        return {
            tableName: tableName,
            definition: tableModel.definition,
            options: tableModel.options
        };
    },

    /**
     * Initializes the Sequelizer framework by establishing a connection to the primary database using environment variables.
     * @param {any} Hexley - The main Hexley global object.
     */
    async initializeSequelizerConnection(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/initializeSequelizerConnection]', this.frameworkColor)} Initializing...`);

        // Check for required environment variables
        const dbUser = process.env.DB_USER;
        const dbName = process.env.DB_NAME;
        const dbPassword = process.env.DB_PASSWORD;
        const dbHost = process.env.DB_HOST;
        const dbPort = process.env.DB_PORT;

        if (!dbUser || !dbName || !dbPassword || !dbHost || !dbPort) {
            console.error(Hexley.frameworks.aurora.colorText('[sequelizerFramework/initializeSequelizerConnection] Fatal: One or more database environment variables are missing.', Hexley.frameworks.aurora.tintRedBright));
            process.exit(1);
        }

        // Call the internal connection function to establish the primary database connection
        await this._connectToDatabase(Hexley, dbName, dbUser, dbPassword, dbHost, parseInt(dbPort, 10));

        Hexley.sequelizeLoaded = true;

        Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/initializeSequelizerConnection]', this.frameworkColor)} Initialized! Sequelizer is now loaded into memory.`);
    },

    /**
     * Establishes a connection to an additional database.
     * @param {any} Hexley - The main Hexley global object.
     * @param {{ dbName: string, dbUser: string, dbPassword: string, dbHost: string, dbPort: number }} dbConfig - An object containing the database connection details.
     */
    async connectTo(Hexley: any, dbConfig: { dbName: string, dbUser: string, dbPassword: string, dbHost: string, dbPort: number }) {
        await this._connectToDatabase(Hexley, dbConfig.dbName, dbConfig.dbUser, dbConfig.dbPassword, dbConfig.dbHost, dbConfig.dbPort);
    },

    /**
     * Retrieves all table names from a specified database.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} databaseName - The name of the database to query.
     * @returns {Promise<string[]>} A promise that resolves to an array of table names.
     */
    async getDatabaseTables(Hexley: any, databaseName: string): Promise<string[]> {
        const sequelizeInstance = Hexley.database[databaseName];

        if (!sequelizeInstance) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/getDatabaseTables]', this.frameworkColor)} Error: Database "${databaseName}" not found in the global Hexley object.`);
            return [];
        }

        try {
            const tables = await sequelizeInstance.getQueryInterface().showAllTables();
            return tables;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/getDatabaseTables]', this.frameworkColor)} Error retrieving tables from database "${databaseName}": ${error.message}`);
            return [];
        }
    },

    /**
     * Initializes a new table with a given definition in a specified database.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} databaseName - The name of the database where the table will be created.
     * @param {object} tableModel - An object containing the table's definition and options.
     * @returns {Promise<any>} A promise that resolves to the created model.
     */
    async initTableDefinition(Hexley: any, databaseName: string, tableModel: { definition: any, options: any }): Promise<any> {
        const sequelizeInstance = Hexley.database[databaseName];
        const parsedModel = this._parseDefinition(Hexley, tableModel);
        if (!parsedModel) {
            return null;
        }
        const { tableName, definition, options } = parsedModel;

        if (!sequelizeInstance) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/initTableDefinition]', this.frameworkColor)} Error: Database "${databaseName}" not found in the global Hexley object.`);
            return null;
        }

        try {
            const model = sequelizeInstance.define(tableName, definition, options);
            await model.sync();
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/initTableDefinition]', this.frameworkColor)} Table model "${tableName}" defined and synchronized successfully for database "${databaseName}".`);
            return model;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/initTableDefinition]', this.frameworkColor)} Error defining table model "${tableName}" for database "${databaseName}": ${error.message}`);
            return null;
        }
    },

    /**
     * Truncates a table, effectively resetting its data.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} databaseName - The name of the database containing the table.
     * @param {object} tableModel - An object containing the table's definition and options.
     * @returns {Promise<void>}
     */
    async resetTableDefinition(Hexley: any, databaseName: string, tableModel: { options: any }): Promise<void> {
        const sequelizeInstance = Hexley.database[databaseName];
        const tableName = tableModel.options.tableName;
    
        if (!sequelizeInstance) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/resetTableDefinition]', this.frameworkColor)} Error: Database "${databaseName}" not found in the global Hexley object.`);
            return;
        }
    
        try {
            const model = sequelizeInstance.models[tableName];
            if (!model) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/resetTableDefinition]', this.frameworkColor)} Error: Model for table "${tableName}" not found in database "${databaseName}".`);
                return;
            }
    
            await model.truncate();
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/resetTableDefinition]', this.frameworkColor)} Table "${tableName}" in database "${databaseName}" has been successfully truncated.`);
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/resetTableDefinition]', this.frameworkColor)} Error truncating table "${tableName}" in database "${databaseName}": ${error.message}`);
        }
    },

    /**
     * Retrieves all entries from a defined table.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} databaseName - The name of the database.
     * @param {object} tableModel - An object containing the table's definition and options.
     * @returns {Promise<any[]>} A promise that resolves to an array of table entries.
     */
    async getTableDefinitionEntries(Hexley: any, databaseName: string, tableModel: { options: any }): Promise<any[]> {
        const sequelizeInstance = Hexley.database[databaseName];
        const tableName = tableModel.options.tableName;

        if (!sequelizeInstance) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/getTableDefinitionEntries]', this.frameworkColor)} Error: Database "${databaseName}" not found in the global Hexley object.`);
            return [];
        }

        try {
            const model = sequelizeInstance.models[tableName];
            if (!model) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/getTableDefinitionEntries]', this.frameworkColor)} Error: Model for table "${tableName}" not found in database "${databaseName}".`);
                return [];
            }
            
            const entries = await model.findAll();
            return entries;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/getTableDefinitionEntries]', this.frameworkColor)} Error retrieving entries from table "${tableName}" in database "${databaseName}": ${error.message}`);
            return [];
        }
    },

    /**
     * Finds a single entry in a table based on a query.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} databaseName - The name of the database.
     * @param {object} tableModel - An object containing the table's definition and options.
     * @param {object} query - The query object for finding a specific entry.
     * @returns {Promise<any>} A promise that resolves to the found entry or null.
     */
    async getTableDefinitionEntry(Hexley: any, databaseName: string, tableModel: { options: any }, query: any): Promise<any> {
        const sequelizeInstance = Hexley.database[databaseName];
        const tableName = tableModel.options.tableName;

        if (!sequelizeInstance) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/getTableDefinitionEntry]', this.frameworkColor)} Error: Database "${databaseName}" not found in the global Hexley object.`);
            return null;
        }

        try {
            const model = sequelizeInstance.models[tableName];
            if (!model) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/getTableDefinitionEntry]', this.frameworkColor)} Error: Model for table "${tableName}" not found in database "${databaseName}".`);
                return null;
            }

            const entry = await model.findOne(query);
            return entry;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/getTableDefinitionEntry]', this.frameworkColor)} Error retrieving entry from table "${tableName}" in database "${databaseName}": ${error.message}`);
            return null;
        }
    },

    /**
     * Updates a single entry in a table based on a query.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} databaseName - The name of the database.
     * @param {object} tableModel - An object containing the table's definition and options.
     * @param {object} entryObject - The object containing the new data for the entry.
     * @param {object} query - The query object to find the entry to update.
     * @returns {Promise<boolean>} A promise that resolves to true if the entry was updated, false otherwise.
     */
    async updateTableDefinitionEntry(Hexley: any, databaseName: string, tableModel: { options: any }, entryObject: any, query: any): Promise<boolean> {
        const sequelizeInstance = Hexley.database[databaseName];
        const tableName = tableModel.options.tableName;

        if (!sequelizeInstance) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/updateTableDefinitionEntry]', this.frameworkColor)} Error: Database "${databaseName}" not found in the global Hexley object.`);
            return false;
        }

        try {
            const model = sequelizeInstance.models[tableName];
            if (!model) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/updateTableDefinitionEntry]', this.frameworkColor)} Error: Model for table "${tableName}" not found in database "${databaseName}".`);
                return false;
            }

            const result = await model.update(entryObject, { where: query });
            const [affectedRows] = result;
            return affectedRows > 0;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/updateTableDefinitionEntry]', this.frameworkColor)} Error updating entry in table "${tableName}" in database "${databaseName}": ${error.message}`);
            return false;
        }
    },

    /**
     * Adds a new entry to a table after checking for a pre-existing entry that matches the query.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} databaseName - The name of the database.
     * @param {object} tableModel - An object containing the table's definition and options.
     * @param {object} entryObject - The object containing the data for the new entry.
     * @param {object} query - The query object to check for an existing entry.
     * @returns {Promise<any>} A promise that resolves to the created entry or null.
     */
    async addTableDefinitionEntry(Hexley: any, databaseName: string, tableModel: { options: any }, entryObject: any, query: any): Promise<any> {
        const sequelizeInstance = Hexley.database[databaseName];
        const tableName = tableModel.options.tableName;

        if (!sequelizeInstance) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/addTableDefinitionEntry]', this.frameworkColor)} Error: Database "${databaseName}" not found in the global Hexley object.`);
            return null;
        }

        try {
            const model = sequelizeInstance.models[tableName];
            if (!model) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/addTableDefinitionEntry]', this.frameworkColor)} Error: Model for table "${tableName}" not found in database "${databaseName}".`);
                return null;
            }
            
            const existingEntry = await model.findOne({ where: query });
            if (existingEntry) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/addTableDefinitionEntry]', this.frameworkColor)} An entry matching the query already exists. Skipping creation.`);
                return null;
            }
            
            const newEntry = await model.create(entryObject);
            return newEntry;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/addTableDefinitionEntry]', this.frameworkColor)} Error adding entry to table "${tableName}" in database "${databaseName}": ${error.message}`);
            return null;
        }
    },

    /**
     * Deletes a single entry from a table.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} databaseName - The name of the database.
     * @param {object} tableModel - An object containing the table's definition and options.
     * @param {object} query - The query object to find the entry to delete.
     * @returns {Promise<boolean>} A promise that resolves to true if the entry was deleted, false otherwise.
     */
    async deleteTableDefinitionEntry(Hexley: any, databaseName: string, tableModel: { options: any }, query: any): Promise<boolean> {
        const sequelizeInstance = Hexley.database[databaseName];
        const tableName = tableModel.options.tableName;

        if (!sequelizeInstance) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/deleteTableDefinitionEntry]', this.frameworkColor)} Error: Database "${databaseName}" not found in the global Hexley object.`);
            return false;
        }

        try {
            const model = sequelizeInstance.models[tableName];
            if (!model) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/deleteTableDefinitionEntry]', this.frameworkColor)} Error: Model for table "${tableName}" not found in database "${databaseName}".`);
                return false;
            }

            const result = await model.destroy({ where: query });
            return result > 0;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[sequelizerFramework/deleteTableDefinitionEntry]', this.frameworkColor)} Error deleting entry from table "${tableName}" in database "${databaseName}": ${error.message}`);
            return false;
        }
    },

};