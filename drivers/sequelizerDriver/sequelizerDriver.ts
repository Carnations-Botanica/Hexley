import path from 'path';
import { Sequelize } from 'sequelize';
import type { DatabaseDriver } from '../databaseDriver/databaseDriver';

// This will hold the active Sequelize instance and the Hexley global object.
let _sequelize: Sequelize | null = null;
let _Hexley: any = null;

/**
 * Internal helper to parse and validate a table model definition.
 * @param {any} tableModel - The object containing the table's definition and options.
 */
function _parseDefinition(tableModel: any) {
    if (!tableModel || !tableModel.definition || !tableModel.options || !tableModel.options.tableName) {
        throw new Error("Invalid table model provided to sequelizerDriver.");
    }
    tableModel.options.freezeTableName = true;
    return {
        tableName: tableModel.options.tableName,
        definition: tableModel.definition,
        options: tableModel.options
    };
}

/**
 * The sequelizerDriver provides a robust, ORM-based connection to a
 * MariaDB or MySQL database. It leverages the Sequelize library to manage
 * connections, models, and queries. It implements the DatabaseDriver interface,
 * ensuring it can be used interchangeably with other database drivers in Hexley.
 */
export const sequelizerDriver: DatabaseDriver = {
    /**
     * Initializes the Sequelizer connection to the database.
     * @param {any} Hexley - The main Hexley global object.
     * @returns {Promise<boolean>} A promise that resolves to true on success.
     */
    async initialize(Hexley: any): Promise<boolean> {
        _Hexley = Hexley;
        const { DB_USER, DB_NAME, DB_PASS, DB_HOST, DB_PORT } = process.env;

        if (!DB_USER || !DB_NAME || !DB_PASS || !DB_HOST || !DB_PORT) {
            if (_Hexley?.driverDebug) _Hexley.log('[sequelizerDriver] Fatal: One or more database environment variables are missing.');
            return false;
        }

        const enableSqlLogging = _Hexley?.driverDebug;

        try {
            if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver] Initializing connection to ${DB_NAME}...`);
            _sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
                host: DB_HOST,
                port: parseInt(DB_PORT, 10),
                dialect: 'mysql',
                logging: enableSqlLogging ? (msg) => _Hexley.log(`[sequelizerDriver/SQL] ${msg}`) : false,
            });
            await _sequelize.authenticate();
            if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver] Connection successful.`);
            Hexley.resources.driver.database.isLoaded = true;
            Hexley.resources.driver.sequelizer.isLoaded = true;

            return true;
        } catch (error: any) {
            if (error.original && error.original.code === 'ER_BAD_DB_ERROR') {

                _Hexley.log(`[sequelizerDriver] Database "${DB_NAME}" not found. Attempting to create...`);
                const tempSequelize = new Sequelize('', DB_USER, DB_PASS, { host: DB_HOST, port: parseInt(DB_PORT, 10), dialect: 'mysql', logging: false });
                await tempSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
                _sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, { host: DB_HOST, port: parseInt(DB_PORT, 10), dialect: 'mysql', logging: false });
                await _sequelize.authenticate();
                if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver] Database created and connection successful.`);
                return true;

            } else {
                if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver] Fatal: Unable to connect to database "${DB_NAME}": ${error.message}`);
                return false;
            }
        }

    },

    /**
     * Retrieves all table names from the database.
     * @returns {Promise<string[]>} A promise that resolves to an array of table names.
     */
    async getTables(): Promise<string[]> {
        if (!_sequelize) return [];
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/getTables] Fetching all table names...`);
        const tables = await _sequelize.getQueryInterface().showAllTables();
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/getTables] -> Found ${tables.length} tables.`);
        return tables;
    },

    /**
     * Initializes a table definition using Sequelize.
     * @param {any} tableModel - The model of the table to initialize.
     * @returns {Promise<any>} A promise that resolves to the Sequelize model.
     */
    async initTable(tableModel: any): Promise<any> {
        if (!_sequelize) return null;
        const { tableName, definition, options } = _parseDefinition(tableModel);
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/initTable] Initializing table: ${tableName}`);
        const model = _sequelize.define(tableName, definition, options);
        await model.sync();
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/initTable] -> Table '${tableName}' synced successfully.`);
        return model;
    },
    
    /**
     * Retrieves all entries from a given table.
     * @param {any} tableIdentifier - The model of the table to query.
     * @returns {Promise<any[]>} A promise that resolves to an array of entries.
     */
    async getAll(tableIdentifier: any): Promise<any[]> {
        if (!_sequelize) return [];
        const tableName = typeof tableIdentifier === 'string' 
            ? tableIdentifier 
            : tableIdentifier.options.tableName;
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/getAll] Request for table: '${tableName}'`);
        const model = _sequelize.models[tableName];
        if (!model) return [];
        const entries = await model.findAll();
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/getAll] -> Found ${entries.length} entries.`);
        return entries.map((entry: any) => entry.toJSON());
    },

    /**
     * Retrieves a single entry from a table based on a query.
     * @param {any} tableModel - The model of the table to query.
     * @param {any} query - The query to use for finding the entry.
     * @returns {Promise<any | null>} A promise that resolves to the found entry, or null if not found.
     */
    async get(tableModel: any, query: any): Promise<any | null> {
        if (!_sequelize) return null;
        const tableName = tableModel.options.tableName;
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/get] Request for table: '${tableName}' with query:`, query);
        const model = _sequelize.models[tableName];
        if (!model) return null;
        const result = await model.findOne({ where: query });
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/get] -> ${result ? 'Found entry.' : 'Entry not found.'}`);
        return result;
    },

    /**
     * Adds a new entry to a table.
     * @param {any} tableModel - The model of the table.
     * @param {any} entryObject - The object to add to the table.
     * @param {any} query - A query to check if the entry already exists.
     * @returns {Promise<any | null>} A promise that resolves to the new entry, or null if it already exists.
     */
    async add(tableModel: any, entryObject: any, query: any): Promise<any | null> {
        if (!_sequelize) return null;
        const tableName = tableModel.options.tableName;
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/add] Request for table: '${tableName}'`);
        const model = _sequelize.models[tableName];
        if (!model) return null;
        if (query && Object.keys(query).length > 0) {
            const existingEntry = await model.findOne({ where: query });
            if (existingEntry) {
                if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/add] -> Entry already exists. Aborting.`);
                return null;
            }
        }
        const newEntry = await model.create(entryObject);
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/add] -> Successfully created new entry.`);
        return newEntry;
    },

    /**
     * Updates an existing entry in a table.
     * @param {any} tableModel - The model of the table.
     * @param {any} entryObject - The new data for the entry.
     * @param {any} query - The query to find the entry to update.
     * @returns {Promise<any | null>} A promise that resolves to the updated entry, or null if not found.
     */
    async update(tableModel: any, entryObject: any, query: any): Promise<any | null> {
        if (!_sequelize) return null;
        const tableName = tableModel.options.tableName;
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/update] Request for table: '${tableName}' with query:`, query);
        const model = _sequelize.models[tableName];
        if (!model) return null;
        const [affectedRows] = await model.update(entryObject, { where: query });
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/update] -> Affected rows: ${affectedRows}`);
        return affectedRows > 0 ? entryObject : null;
    },

    /**
     * Creates a new entry if it doesn't exist, or updates it if it does.
     * @param {any} tableModel - The model of the table.
     * @param {any} entryObject - The entry to upsert.
     * @returns {Promise<any>} A promise that resolves to the created or updated entry.
     */
    async upsert(tableModel: any, entryObject: any): Promise<any> {
        if (!_sequelize) return null;
        const tableName = tableModel.options.tableName;
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/upsert] Request for table: '${tableName}'`);
        const model = _sequelize.models[tableName];
        if (!model) return null;
        const [instance, created] = await model.upsert(entryObject);
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/upsert] -> ${created ? 'Created new entry.' : 'Updated existing entry.'}`);
        return instance;
    },

    /**
     * Deletes an entry from a table.
     * @param {any} tableModel - The model of the table.
     * @param {any} query - The query to find the entry to delete.
     * @returns {Promise<boolean>} A promise that resolves to true if the deletion was successful.
     */
    async delete(tableModel: any, query: any): Promise<boolean> {
        if (!_sequelize) return false;
        const tableName = tableModel.options.tableName;
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/delete] Request for table: '${tableName}' with query:`, query);
        const model = _sequelize.models[tableName];
        if (!model) return false;
        const result = await model.destroy({ where: query });
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/delete] -> Deleted ${result} row(s).`);
        return result > 0;
    },

    /**
     * Deletes all entries from a table.
     * @param {any} tableModel - The model of the table to reset.
     * @returns {Promise<void>} A promise that resolves when the table has been reset.
     */
    async reset(tableModel: any): Promise<void> {
        if (!_sequelize) return;
        const tableName = tableModel.options.tableName;
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/reset] Request to reset table: '${tableName}'`);
        const model = _sequelize.models[tableName];
        if (model) await model.truncate();
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/reset] -> Table '${tableName}' truncated.`);
    },

    /**
     * Drops a table from the database.
     * @param {any} tableModel - The model of the table to drop.
     * @returns {Promise<void>} A promise that resolves when the table is dropped.
     */
    async dropTable(tableModel: any): Promise<void> {
        if (!_sequelize) return;
        const tableName = tableModel.options.tableName;
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/dropTable] Request to drop table: '${tableName}'`);
        const model = _sequelize.models[tableName];
        if (model) await model.drop();
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/dropTable] -> Table '${tableName}' dropped.`);
    },

    /**
     * Sequentially inserts multiple records into a table using Sequelize's bulkCreate.
     * @param {string} tableName - The name of the table/model.
     * @param {any[]} data - The array of objects to insert.
     * @returns {Promise<any[]>}
     */
    async bulkCreate(tableName: string, data: any[]): Promise<any[]> {
        if (!_sequelize) return [];
        if (_Hexley?.driverDebug) _Hexley.log(`[sequelizerDriver/bulkCreate] Request to bulk create in table: '${tableName}' with ${data.length} entries.`);
        const model = _sequelize.models[tableName]; 
        if (!model) {
            throw new Error(`Sequelizer model not found for table: ${tableName}`);
        }
        return model.bulkCreate(data, { validate: true, ignoreDuplicates: true });
    },

};
