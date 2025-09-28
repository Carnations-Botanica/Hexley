// drivers/localDriver.ts

import fs from 'fs';
import type { DatabaseDriver } from './databaseDriver';

// This will hold the in-memory representation of our JSON database.
let _localDB: { [tableName: string]: any[] } = {};
let _dbPath: string = '';

/**
 * Saves the current in-memory database to the db.json file.
 */
function _save() {
    try {
        fs.writeFileSync(_dbPath, JSON.stringify(_localDB, null, 2));
    } catch (error: any) {
        console.error(`[localDriver] Error saving local database: ${error.message}`);
    }
}

/**
 * The localDriver provides a simple, file-based database using a single JSON file.
 * It's designed to be a lightweight alternative for environments where a full-fledged
 * database server isn't necessary. It implements the DatabaseDriver interface,
 * ensuring it can be used interchangeably with other database drivers in Hexley.
 */
export const localDriver: DatabaseDriver = {
    /**
     * Initializes the local database by loading the db.json file from the VFS.
     * If the file doesn't exist, it will be created.
     * @param {any} Hexley - The main Hexley global object.
     * @returns {Promise<boolean>} A promise that resolves to true on success.
     */
    async initialize(Hexley: any): Promise<boolean> {
        _dbPath = Hexley.databaseLocalDir;
        try {

            if (fs.existsSync(_dbPath)) {
                const fileContent = fs.readFileSync(_dbPath, 'utf8');
                _localDB = fileContent.trim() ? JSON.parse(fileContent) : {};
            } else {
                _localDB = {};
                _save();
            }

            // Listen for versionFramework.ready and add the version to the database.
            Hexley.core.once('versionFramework.ready', async () => {
                await Hexley.frameworks.version.addVersionEntry(Hexley, 'localDriver', 'Driver', '1.0.0');
            });

            return true;
        } catch (error: any) {
            console.error(`[localDriver] Fatal: Could not read or create local database file: ${error.message}`);
            return false;
        }
    },

    /**
     * Retrieves all table names from the database.
     * @returns {Promise<string[]>} A promise that resolves to an array of table names.
     */
    async getTables(): Promise<string[]> {
        return Object.keys(_localDB);
    },

    /**
     * Ensures a table exists in the database.
     * @param {any} tableModel - The model of the table to initialize.
     * @returns {Promise<any>} A promise that resolves when the table is ready.
     */
    async initTable(tableModel: any): Promise<any> {
        const tableName = tableModel.options.tableName;
        if (!_localDB[tableName]) {
            _localDB[tableName] = [];
            _save();
        }
        return _localDB[tableName];
    },

    /**
     * Retrieves all entries from a given table.
     * @param {any} tableModel - The model of the table to query.
     * @returns {Promise<any[]>} A promise that resolves to an array of entries.
     */
    async getAll(tableModel: any): Promise<any[]> {
        const tableName = tableModel.options.tableName;
        return _localDB[tableName] || [];
    },

    /**
     * Retrieves a single entry from a table based on a query.
     * @param {any} tableModel - The model of the table to query.
     * @param {any} query - The query to use for finding the entry.
     * @returns {Promise<any | null>} A promise that resolves to the found entry, or null if not found.
     */
    async get(tableModel: any, query: any): Promise<any | null> {
        const tableName = tableModel.options.tableName;
        const table = _localDB[tableName] || [];
        if (!query || !query.where) return null;

        return table.find((entry: any) =>
            Object.keys(query.where).every(key => entry[key] === query.where[key])
        ) || null;
    },

    /**
     * Adds a new entry to a table.
     * @param {any} tableModel - The model of the table.
     * @param {any} entryObject - The object to add to the table.
     * @param {any} query - A query to check if the entry already exists.
     * @returns {Promise<any | null>} A promise that resolves to the new entry, or null if it already exists.
     */
    async add(tableModel: any, entryObject: any, query: any): Promise<any | null> {
        const table = await this.initTable(tableModel);
        const existingEntry = await this.get(tableModel, { where: query });
        if (existingEntry) return null;

        table.push(entryObject);
        _save();
        return entryObject;
    },

    /**
     * Updates an existing entry in a table.
     * @param {any} tableModel - The model of the table.
     * @param {any} entryObject - The new data for the entry.
     * @param {any} query - The query to find the entry to update.
     * @returns {Promise<any | null>} A promise that resolves to the updated entry, or null if not found.
     */
    async update(tableModel: any, entryObject: any, query: any): Promise<any | null> {
        const tableName = tableModel.options.tableName;
        const table = _localDB[tableName] || [];
        if (!query || !query.where) return null;

        const entryToUpdate = table.find((entry: any) =>
            Object.keys(query.where).every(key => entry[key] === query.where[key])
        );

        if (entryToUpdate) {
            Object.assign(entryToUpdate, entryObject);
            _save();
            return entryToUpdate;
        }
        return null;
    },

    /**
     * Creates a new entry if it doesn't exist, or updates it if it does.
     * @param {any} tableModel - The model of the table.
     * @param {any} entryObject - The entry to upsert.
     * @returns {Promise<any>} A promise that resolves to the created or updated entry.
     */
    async upsert(tableModel: any, entryObject: any): Promise<any> {
        const primaryKey = Object.keys(entryObject)[0];
        if (!primaryKey) {
            throw new Error("Cannot upsert an empty object.");
        }

        const query = { where: { [primaryKey]: entryObject[primaryKey] } };
        const existing = await this.get(tableModel, query);

        if (existing) {
            const result = await this.update(tableModel, entryObject, query);
            if(result) return result;
        }
        
        return await this.add(tableModel, entryObject, query);
    },

    /**
     * Deletes an entry from a table.
     * @param {any} tableModel - The model of the table.
     * @param {any} query - The query to find the entry to delete.
     * @returns {Promise<boolean>} A promise that resolves to true if the deletion was successful.
     */
    async delete(tableModel: any, query: any): Promise<boolean> {
        const tableName = tableModel.options.tableName;
        const table = _localDB[tableName];
        if (!table || !query) return false;

        const indexToDelete = table.findIndex((entry: any) =>
            Object.keys(query).every(key => entry[key] === query[key])
        );

        if (indexToDelete > -1) {
            table.splice(indexToDelete, 1);
            _save();
            return true;
        }
        return false;
    },

    /**
     * Deletes all entries from a table.
     * @param {any} tableModel - The model of the table to reset.
     * @returns {Promise<void>} A promise that resolves when the table has been reset.
     */
    async reset(tableModel: any): Promise<void> {
        const tableName = tableModel.options.tableName;
        if (_localDB[tableName]) {
            _localDB[tableName] = [];
            _save();
        }
    },

};
