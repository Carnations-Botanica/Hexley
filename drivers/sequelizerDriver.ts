import { Sequelize } from 'sequelize';
import type { DatabaseDriver } from './databaseDriver';

// This will hold the active Sequelize instance for the driver to use.
let _sequelize: Sequelize | null = null;

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
        const { DB_USER, DB_NAME, DB_PASS, DB_HOST, DB_PORT } = process.env;

        if (!DB_USER || !DB_NAME || !DB_PASS || !DB_HOST || !DB_PORT) {
            Hexley.log('[sequelizerDriver] Fatal: One or more database environment variables are missing.');
            return false;
        }

        try {
            _sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
                host: DB_HOST,
                port: parseInt(DB_PORT, 10),
                dialect: 'mysql',
                logging: false,
            });
            await _sequelize.authenticate();

            // Listen for versionFramework.ready and add the version to the database.
            Hexley.core.once('versionFramework.ready', async () => {
                await Hexley.frameworks.version.addVersionEntry(Hexley, 'sequelizerDriver', 'Driver', '1.0.0');
            });

            return true;
        } catch (error: any) {
            if (error.original && error.original.code === 'ER_BAD_DB_ERROR') {

                Hexley.log(`[sequelizerDriver] Database "${DB_NAME}" not found. Attempting to create...`);
                const tempSequelize = new Sequelize('', DB_USER, DB_PASS, { host: DB_HOST, port: parseInt(DB_PORT, 10), dialect: 'mysql', logging: false });
                await tempSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
                _sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, { host: DB_HOST, port: parseInt(DB_PORT, 10), dialect: 'mysql', logging: false });
                await _sequelize.authenticate();

                return true;
            } else {
                Hexley.log(`[sequelizerDriver] Fatal: Unable to connect to database "${DB_NAME}": ${error.message}`);
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
        const tables = await _sequelize.getQueryInterface().showAllTables();
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
        const model = _sequelize.define(tableName, definition, options);
        await model.sync();
        return model;
    },
    
    /**
     * Retrieves all entries from a given table.
     * @param {any} tableModel - The model of the table to query.
     * @returns {Promise<any[]>} A promise that resolves to an array of entries.
     */
    async getAll(tableModel: any): Promise<any[]> {
        if (!_sequelize) return [];
        const model = _sequelize.models[tableModel.options.tableName];
        if (!model) return [];
        const entries = await model.findAll();
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
        const model = _sequelize.models[tableModel.options.tableName];
        if (!model) return null;
        return await model.findOne(query);
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
        const model = _sequelize.models[tableModel.options.tableName];
        if (!model) return null;
        const existingEntry = await model.findOne({ where: query });
        if (existingEntry) return null;
        return await model.create(entryObject);
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
        const model = _sequelize.models[tableModel.options.tableName];
        if (!model) return null;
        const [affectedRows] = await model.update(entryObject, { where: query });
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
        const model = _sequelize.models[tableModel.options.tableName];
        if (!model) return null;
        const [instance, created] = await model.upsert(entryObject);
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
        const model = _sequelize.models[tableModel.options.tableName];
        if (!model) return false;
        const result = await model.destroy({ where: query });
        return result > 0;
    },

    /**
     * Deletes all entries from a table.
     * @param {any} tableModel - The model of the table to reset.
     * @returns {Promise<void>} A promise that resolves when the table has been reset.
     */
    async reset(tableModel: any): Promise<void> {
        if (!_sequelize) return;
        const model = _sequelize.models[tableModel.options.tableName];
        if (model) await model.truncate();
    },

};
