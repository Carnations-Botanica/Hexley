import { Sequelize, DataTypes, Model } from 'sequelize';
import path from 'path';
import fs from 'fs';

/**
 * The globally accessible framework for managing Hexley's database connection via Sequelize.
 */
export const databaseFramework = {

    // Framework Logging Color
    frameworkColor: "#5600db",

    // Database Property
    _localDB: {} as { [tableName: string]: any[] },
    
    /**
     * Initializes the Database framework based on the mode specified in the global Hexley object.
     * @param {any} Hexley - The main Hexley global object.
     */
    async initializeDatabaseConnection(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText(`[databaseFramework/initializeDatabaseConnection]`, this.frameworkColor)} Initializing in ${Hexley.databaseMode} mode...`);

        // Dispatch to the correct initializer based on the mode
        if (Hexley.databaseMode === 'Sequelizer') {
            await this._initializeSequelizer(Hexley);
        } else {
            await this._initializeLocal(Hexley); 
        }

        Hexley.core.once('registryFramework.ready', () => {
            const plistPath = path.join(Hexley.privateFrameworksRootPath, 'databaseFramework', 'info.plist');
            Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
        });

        Hexley.core.once('versionFramework.ready', () => {
            Hexley.frameworks.version.addVersionEntry(Hexley, 'databaseFramework', 'Framework', '1.0.0');
        });

        Hexley.log(`${Hexley.frameworks.aurora.colorText('[databaseFramework/initializeDatabaseConnection]', this.frameworkColor)} Initialized! Database Framework is now loaded into memory.`);
    },

    /**
     * Initializes the framework in Sequelizer mode.
     * @param {any} Hexley - The main Hexley global object.
     */
    async _initializeSequelizer(Hexley: any) {
        const { DB_USER, DB_NAME, DB_PASSWORD, DB_HOST, DB_PORT } = process.env;

        if (!DB_USER || !DB_NAME || !DB_PASSWORD || !DB_HOST || !DB_PORT) {
            console.error(Hexley.frameworks.aurora.colorText('[databaseFramework/_initializeSequelizer] Fatal: One or more database environment variables are missing.', Hexley.frameworks.aurora.tintRedBright));
            process.exit(1);
        }

        await this._connectToDatabase(Hexley, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, parseInt(DB_PORT, 10));

        Hexley.databaseLoaded = true;
    },

    /**
     * Initializes the framework in Local mode by creating or loading a db.json file.
     * @param {any} Hexley - The main Hexley global object.
     */
    async _initializeLocal(Hexley: any) {
        try {
            // Check if the db.json file already exists.
            if (fs.existsSync(Hexley.databaseLocalDir)) {
                const fileContent = fs.readFileSync(Hexley.databaseLocalDir, 'utf8');
                
                // If the file is empty or just whitespace, start with an empty object.
                // Otherwise, parse its JSON content.
                this._localDB = fileContent.trim() ? JSON.parse(fileContent) : {};
                
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[databaseFramework/_initializeLocal]', this.frameworkColor)} Loaded local database from ${Hexley.databaseLocalDir}`);
            } else {
                // If the file doesn't exist, create it with an empty object.
                this._localDB = {};
                fs.writeFileSync(Hexley.databaseLocalDir, JSON.stringify(this._localDB, null, 2));
                
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[databaseFramework/_initializeLocal]', this.frameworkColor)} Created new local database at ${Hexley.databaseLocalDir}`);
            }

            Hexley.databaseLoaded = true;

        } catch (error: any) {
            console.error(Hexley.frameworks.aurora.colorText(`[databaseFramework/_initializeLocal] Fatal: Could not read or create local database file: ${error.message}`, Hexley.frameworks.aurora.tintRedBright));
            process.exit(1);
        }
    },

    /**
     * Establishes a connection to a database, creating it if it doesn't exist.
     * Stores the connection instance in the global Hexley object.
     * @param {any} Hexley - The main Hexley global object.
     */
    async _connectToDatabase(Hexley: any, dbName: string, dbUser: string, dbPassword: string, dbHost: string, dbPort: number) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[databaseFramework/_connectToDatabase]', this.frameworkColor)} Initializing connection to database: ${dbName}...`);
        
        let sequelize: Sequelize;

        try {
            sequelize = new Sequelize(dbName, dbUser, dbPassword, {
                host: dbHost,
                port: dbPort,
                dialect: 'mysql',
                logging: false,
            });
            await sequelize.authenticate();
        } catch (error: any) {
            if (error.original && error.original.code === 'ER_BAD_DB_ERROR') {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[databaseFramework/_connectToDatabase]', this.frameworkColor)} Database "${dbName}" not found. Attempting to create...`);
                const sequelizeWithoutDb = new Sequelize('', dbUser, dbPassword, { host: dbHost, port: dbPort, dialect: 'mysql', logging: false });
                await sequelizeWithoutDb.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
                sequelize = new Sequelize(dbName, dbUser, dbPassword, { host: dbHost, port: dbPort, dialect: 'mysql', logging: false });
                await sequelize.authenticate();
            } else {
                console.error(Hexley.frameworks.aurora.colorText(`[databaseFramework/_connectToDatabase] Fatal: Unable to connect to database "${dbName}": ${error.message}`, Hexley.frameworks.aurora.tintRedBright));
                process.exit(1);
            }
        }
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[databaseFramework/_connectToDatabase]', this.frameworkColor)} Connection to MariaDB database "${dbName}" has been established successfully.`);
        
        if (!Hexley.database) Hexley.database = {};
        Hexley.database[dbName] = sequelize;
    },

    // Abstraction Layer for operands
    async getDatabaseTables(Hexley: any, databaseName: string): Promise<string[]> {
        if (Hexley.databaseMode === 'Local') {
            return Object.keys(this._localDB);
        }
        
        // --- Sequelizer Mode ---
        const sequelizeInstance = Hexley.database[databaseName];
        if (!sequelizeInstance) return [];

        try {
            const tables = await sequelizeInstance.getQueryInterface().showAllTables();
            return tables;
        } catch (error) {
            return [];
        }
    },

    async initTableDefinition(Hexley: any, databaseName: string, tableModel: any): Promise<any> {
        if (Hexley.databaseMode === 'Local') {
            return this._handleLocalInitTable(Hexley, tableModel);
        }
        // --- Sequelizer Mode ---
        const sequelizeInstance = Hexley.database[databaseName];
        const parsedModel = this._parseDefinition(Hexley, tableModel);
        if (!sequelizeInstance || !parsedModel) return null;
        const { tableName, definition, options } = parsedModel;
        const model = sequelizeInstance.define(tableName, definition, options);
        await model.sync();
        return model;
    },

    async getTableDefinitionEntries(Hexley: any, databaseName: string, tableModel: { options: any }): Promise<any[]> {
        if (Hexley.databaseMode === 'Local') {
            return this._handleLocalGetEntries(Hexley, tableModel);
        }
        // --- Sequelizer Mode ---
        const sequelizeInstance = Hexley.database[databaseName];
        if (!sequelizeInstance) return [];
        
        const model = sequelizeInstance.models[tableModel.options.tableName];
        if (!model) return [];

        const entries = await model.findAll();

        // NOTE: We convert Sequelize objects to plain JSON before returning
        return entries.map((entry: any) => entry.toJSON()); 
    },

    async getTableDefinitionEntry(Hexley: any, databaseName: string, tableModel: { options: any }, query: any): Promise<any> {
        if (Hexley.databaseMode === 'Local') {
            return this._handleLocalGetEntry(Hexley, tableModel, query);
        }
        // --- Sequelizer Mode ---
        const sequelizeInstance = Hexley.database[databaseName];
        if (!sequelizeInstance) return null;
        const model = sequelizeInstance.models[tableModel.options.tableName];
        if (!model) return null;
        return await model.findOne(query);
    },

    async addTableDefinitionEntry(Hexley: any, databaseName: string, tableModel: { options: any }, entryObject: any, query: any): Promise<any> {
        if (Hexley.databaseMode === 'Local') {
            return this._handleLocalAddEntry(Hexley, tableModel, entryObject, query);
        }
        // --- Sequelizer Mode ---
        const sequelizeInstance = Hexley.database[databaseName];
        if (!sequelizeInstance) return null;
        const model = sequelizeInstance.models[tableModel.options.tableName];
        if (!model) return null;
        const existingEntry = await model.findOne({ where: query });
        if (existingEntry) return null;
        return await model.create(entryObject);
    },

    async deleteTableDefinitionEntry(Hexley: any, databaseName: string, tableModel: { options: any }, query: any): Promise<boolean> {
        if (Hexley.databaseMode === 'Local') {
            return this._handleLocalDeleteEntry(Hexley, tableModel, query);
        }
        // --- Sequelizer Mode ---
        const sequelizeInstance = Hexley.database[databaseName];
        if (!sequelizeInstance) return false;
        const model = sequelizeInstance.models[tableModel.options.tableName];
        if (!model) return false;
        const result = await model.destroy({ where: query });
        return result > 0;
    },

    async resetTableDefinition(Hexley: any, databaseName: string, tableModel: { options: any }): Promise<void> {
        if (Hexley.databaseMode === 'Local') {
            return this._handleLocalResetTable(Hexley, tableModel);
        }
        // --- Sequelizer Mode ---
        const sequelizeInstance = Hexley.database[databaseName];
        if (!sequelizeInstance) return;
        const model = sequelizeInstance.models[tableModel.options.tableName];
        if (model) await model.truncate();
    },

    // Local Mode - Handler Functions for operands
    async _handleLocalInitTable(Hexley: any, tableModel: any): Promise<any[]> {
        const tableName = tableModel.options.tableName;
        if (!this._localDB[tableName]) {
            this._localDB[tableName] = [];
            this._saveLocalDB(Hexley);
        }
        return this._localDB[tableName] as any[];
    },

    async _handleLocalGetEntries(Hexley: any, tableModel: any): Promise<any[]> {
        const tableName = tableModel.options.tableName;
        return this._localDB[tableName] || [];
    },
    
    async _handleLocalGetEntry(Hexley: any, tableModel: any, query: any): Promise<any> {
        const tableName = tableModel.options.tableName;
        const table = this._localDB[tableName] || [];
        if (!query || !query.where) return null;

        return table.find(entry => 
            Object.keys(query.where).every(key => entry[key] === query.where[key])
        ) || null;
    },

    async _handleLocalAddEntry(Hexley: any, tableModel: any, entryObject: any, query: any): Promise<any> {
        const table = await this._handleLocalInitTable(Hexley, tableModel);
        const existingEntry = await this._handleLocalGetEntry(Hexley, tableModel, { where: query });
        if (existingEntry) return null;

        table.push(entryObject);
        this._saveLocalDB(Hexley);
        return entryObject;
    },

    async _handleLocalDeleteEntry(Hexley: any, tableModel: any, query: any): Promise<boolean> {
        const tableName = tableModel.options.tableName;
        const table = this._localDB[tableName];
        if (!table || !query) return false;

        const indexToDelete = table.findIndex(entry => 
            Object.keys(query).every(key => entry[key] === query[key])
        );

        if (indexToDelete > -1) {
            table.splice(indexToDelete, 1);
            this._saveLocalDB(Hexley);
            return true;
        }
        return false;
    },

    async _handleLocalResetTable(Hexley: any, tableModel: any): Promise<void> {
        const tableName = tableModel.options.tableName;
        if (this._localDB[tableName]) {
            this._localDB[tableName] = [];
            this._saveLocalDB(Hexley);
        }
    },

    // Utility Funcs
    /**
     * Internal helper to parse and validate a table model definition.
     * @param {any} Hexley - The main Hexley global object.
     * @param {object} tableModel - The object containing the table's definition and options.
     */
    _parseDefinition(Hexley: any, tableModel: any) {
        if (!tableModel || !tableModel.definition || !tableModel.options) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[databaseFramework/_parseDefinition]', this.frameworkColor)} Error: Invalid table model. Missing 'definition' or 'options'.`);
            return null;
        }

        const tableName = tableModel.options.tableName;
        if (!tableName) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[databaseFramework/_parseDefinition]', this.frameworkColor)} Error: Table name not specified in model options.`);
            return null;
        }
        
        tableModel.options.freezeTableName = true;

        return {
            tableName: tableName,
            definition: tableModel.definition,
            options: tableModel.options
        };
    },

    _saveLocalDB(Hexley: any) {
        try {
            fs.writeFileSync(Hexley.databaseLocalDir, JSON.stringify(this._localDB, null, 2));
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[databaseFramework/_saveLocalDB]', this.frameworkColor)} Error saving local database: ${error.message}`);
        }
    },

};
