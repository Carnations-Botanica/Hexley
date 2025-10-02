import fs from 'fs';
import path from 'path';
import type { DatabaseDriver } from './databaseDriver';

// This will hold the in-memory representation of our JSON database.
let _localDB: { [tableName: string]: any[] } = {};

// This will hold the path to the db.json file.
let _dbPath: string = '';

// This will hold the Hexley global object for access to its utilities.
let _Hexley: any = null;

/**
 * Saves the current in-memory database to the db.json file.
 */
function _save() {
    try {
        fs.writeFileSync(_dbPath, JSON.stringify(_localDB, null, 2));
        if (_Hexley?.driverDebug) console.log(`[localDriver/_save] Successfully saved database to ${_dbPath}`);
    } catch (error: any) {
        if (_Hexley?.driverDebug) console.error(`[localDriver/_save] FATAL: Error saving local database: ${error.message}`);
    }
}

/**
 * Scans the in-memory database and assigns sequential IDs to any entries that are missing them.
 */
function _ensureSequentialIds() {
    let needsSave = false;
    if (_Hexley?.driverDebug) console.log('[localDriver/_ensureSequentialIds] Starting scan for missing IDs...');

    for (const tableName in _localDB) {
        const table = _localDB[tableName];
        if (Array.isArray(table)) {
            let maxId = table.reduce((max: number, entry: any) => Math.max(max, entry.id || 0), 0);

            table.forEach((entry: any) => {
                if (entry.id === undefined || entry.id === null || entry.id === '') {
                    maxId++;
                    entry.id = maxId;
                    needsSave = true;
                    if (_Hexley?.driverDebug) console.log(`[localDriver/_ensureSequentialIds] -> Assigned new ID ${entry.id} in table '${tableName}'`);
                }
            });
        }
    }

    if (needsSave) {
        if (_Hexley?.driverDebug) console.log('[localDriver/_ensureSequentialIds] Missing IDs were found and assigned. Saving changes...');
        _save();
    } else {
        if (_Hexley?.driverDebug) console.log('[localDriver/_ensureSequentialIds] Scan complete. No missing IDs found.');
    }
}


/**
 * Finds the index of an entry in a table that matches a query, with generic support for operators.
 */
function _findIndex(table: any[], query: any): number {
    if (!table || !query || Object.keys(query).length === 0) {
        if (_Hexley?.driverDebug) console.log(`[localDriver/_findIndex] Invalid table or empty query provided. Aborting search.`);
        return -1;
    }

    const queryKeys = Object.keys(query);
    if (_Hexley?.driverDebug) console.log(`[localDriver/_findIndex] Searching with keys: ${JSON.stringify(queryKeys)}`);

    const index = table.findIndex((entry, entryIndex) => {
        return queryKeys.every(key => {
            const queryValue = query[key];
            const entryValue = entry[key];

            if (typeof queryValue === 'object' && queryValue !== null && !Array.isArray(queryValue)) {
                const operator = Object.getOwnPropertySymbols(queryValue)[0];
                if (operator) {
                    const operatorString = operator.toString();
                    const comparisonValue = queryValue[operator];

                    // Attempt to parse values as dates.
                    const entryDate = new Date(entryValue);
                    const comparisonDate = new Date(comparisonValue);

                    // If both values are valid dates, compare them as dates.
                    if (!isNaN(entryDate.getTime()) && !isNaN(comparisonDate.getTime())) {
                        if (operatorString.includes('gt')) return entryDate > comparisonDate;
                        if (operatorString.includes('lte')) return entryDate <= comparisonDate;
                    } else {
                        // Otherwise, perform a generic comparison for numbers or other types.
                        if (operatorString.includes('gt')) return entryValue > comparisonValue;
                        if (operatorString.includes('lte')) return entryValue <= comparisonValue;
                    }
                }
            }

            const match = entryValue === queryValue;
            if (!match && _Hexley?.driverDebug) {
                console.log(`[localDriver/_findIndex] -> MISMATCH on Entry #${entryIndex} (ID: ${entry.id || 'N/A'}) | Key: '${key}' | Entry Value: "${entryValue}" | Query Value: "${queryValue}"`);
            }
            return match;
        });
    });

    if (_Hexley?.driverDebug) console.log(`[localDriver/_findIndex] Final index found: ${index}`);
    return index;
}

/**
 * Agnostically builds a minimal query object using fields likely intended as keys.
 */
function _buildAgnosticNaturalQuery(entryObject: any): any {
    const query: any = {};
    const valueFields = ['value', 'currentNumber', 'highScore', 'count', 'xp', 'endTime', 'type', 'version', 'lastUserIdValidCount'];

    for (const key in entryObject) {
        if (key !== 'id' && !valueFields.includes(key) && entryObject[key] !== undefined && entryObject[key] !== null) {
            query[key] = entryObject[key];
        }
    }
    if (_Hexley?.driverDebug) console.log(`[localDriver/_buildAgnosticNaturalQuery] Built query:`, query);
    return query;
}

/**
 * The localDriver provides a simple, file-based database using a single JSON file.
 * It is a fully self contained Database management system, with support for MySQL/MariaDB parity.
 * The usage of this driver is intended to allow portable development, without compromising the expectations
 * of a fully configured Hexley host machine, with a proper Database connection and access to a database.
 */
export const localDriver: DatabaseDriver = {

    async initialize(Hexley: any): Promise<boolean> {
        _Hexley = Hexley;
        _dbPath = Hexley.databaseLocalDir || path.join(Hexley.workingDir, 'vfs', 'var', 'db.json');
        if (_Hexley?.driverDebug) console.log(`[localDriver] Initializing... DB path set to: ${_dbPath}`);

        try {
            if (fs.existsSync(_dbPath)) {
                const fileContent = fs.readFileSync(_dbPath, 'utf8');
                _localDB = JSON.parse(fileContent);
                if (_Hexley?.driverDebug) console.log('[localDriver] Successfully loaded local database from file.');
                _ensureSequentialIds();
            } else {
                _localDB = {};
                if (_Hexley?.driverDebug) console.log('[localDriver] No local database file found. Starting with an empty in-memory DB.');
            }
        } catch (error: any) {
            if (_Hexley?.driverDebug) console.error(`[localDriver] FATAL: Error loading local database: ${error.message}`);
            _localDB = {};
            return false;
        }

        // Temporarily, we manually add it to the Version Table, as we don't define info.plist's for Drivers yet.
        _Hexley.core.once('versionFramework.ready', async () => {
             await _Hexley.frameworks.version.addVersionEntry(_Hexley, 'localDriver', 'Driver', '1.0.2');
        });

        return true;
    },

    async getTables(): Promise<string[]> {
        if (_Hexley?.driverDebug) console.log('[localDriver] Getting tables...');
        return Promise.resolve(Object.keys(_localDB));
    },

    async initTable(tableModel: any): Promise<any> {
        const tableName = tableModel?.options?.tableName;
        if (_Hexley?.driverDebug) console.log(`[localDriver] Initializing table: ${tableName}`);
        if (tableName && !_localDB[tableName]) {
            _localDB[tableName] = [];
            _save();
            if (_Hexley?.driverDebug) console.log(`[localDriver] Table '${tableName}' created and saved.`);
        }
        return Promise.resolve({ tableName: tableName });
    },

    async getAll(tableIdentifier: any): Promise<any[]> {
        const tableName = typeof tableIdentifier === 'string'
            ? tableIdentifier
            : tableIdentifier?.options?.tableName;
        if (_Hexley?.driverDebug) console.log(`[localDriver] Getting all from table: ${tableName}`);
        return Promise.resolve(_localDB[tableName] || []);
    },

    async get(tableModel: any, query: any): Promise<any | null> {
        const tableName = tableModel?.options?.tableName;
        if (_Hexley?.driverDebug) console.log(`[localDriver/get] Request for table: '${tableName}' with query:`, query);

        const table = _localDB[tableName];
        if (!table) {
            if (_Hexley?.driverDebug) console.log(`[localDriver/get] -> FAILED: Table '${tableName}' does not exist.`);
            return null;
        }

        const index = _findIndex(table, query);

        if (index === -1) {
             if (_Hexley?.driverDebug) console.log(`[localDriver/get] -> RESULT: NOT FOUND in table '${tableName}'`);
             return null;
        }

        const result = JSON.parse(JSON.stringify(table[index]));
        if (_Hexley?.driverDebug) console.log(`[localDriver/get] -> RESULT: FOUND`, JSON.stringify(result, null, 2));
        return result;
    },

    async add(tableModel: any, entryObject: any, query: any): Promise<any | null> {
        const tableName = tableModel?.options?.tableName;
        const table = _localDB[tableName];

        if (_Hexley?.driverDebug) console.log(`[localDriver/add] Request for table: '${tableName}'`);

        if (!table) {
            if (_Hexley?.driverDebug) console.log(`[localDriver/add] -> FAILED: Table '${tableName}' does not exist.`);
            return null;
        }

        if (query && Object.keys(query).length > 0) {
            const existingIndex = _findIndex(table, query);
            if (existingIndex !== -1) {
                if (_Hexley?.driverDebug) console.log(`[localDriver/add] -> FAILED: Entry with query already exists.`, query);
                return null;
            }
        }
        
        const maxId = table.reduce((max, entry) => Math.max(max, entry.id || 0), 0);
        const newEntry = { ...entryObject, id: entryObject.id || maxId + 1 };
        
        table.push(newEntry);
        _save();

        if (_Hexley?.driverDebug) console.log(`[localDriver/add] -> SUCCESS: Added new entry with ID ${newEntry.id}`, newEntry);
        return JSON.parse(JSON.stringify(newEntry));
    },

    async update(tableModel: any, entryObject: any, query: any): Promise<any | null> {
        const tableName = tableModel?.options?.tableName;
        const table = _localDB[tableName];

        if (_Hexley?.driverDebug) console.log(`[localDriver/update] Request for table: '${tableName}' with query:`, query);

        if (!table) {
            if (_Hexley?.driverDebug) console.log(`[localDriver/update] -> FAILED: Table '${tableName}' does not exist.`);
            return null;
        }

        const indexToUpdate = _findIndex(table, query);
        if (indexToUpdate === -1) {
            if (_Hexley?.driverDebug) console.log(`[localDriver/update] -> FAILED: No entry found with query.`, query);
            return null;
        }
        
        const updatedEntry = { ...table[indexToUpdate], ...entryObject };
        table[indexToUpdate] = updatedEntry;
        _save();

        if (_Hexley?.driverDebug) console.log(`[localDriver/update] -> SUCCESS: Updated entry at index ${indexToUpdate}`, updatedEntry);
        return JSON.parse(JSON.stringify(updatedEntry));
    },

    async upsert(tableModel: any, entryObject: any): Promise<any> {
        if (_Hexley?.driverDebug) console.log(`[localDriver/upsert] Request received for table: '${tableModel?.options?.tableName}'`, entryObject);

        if (entryObject.id) {
            const existing = await this.get(tableModel, { id: entryObject.id });
            if (existing) {
                if (_Hexley?.driverDebug) console.log(`[localDriver/upsert] -> Found existing entry by ID ${entryObject.id}. Updating.`);
                return this.update(tableModel, entryObject, { id: entryObject.id });
            }
        }

        const uniquenessQuery = _buildAgnosticNaturalQuery(entryObject);
        if (Object.keys(uniquenessQuery).length > 0) {
            const existing = await this.get(tableModel, uniquenessQuery);
            if (existing) {
                if (_Hexley?.driverDebug) console.log(`[localDriver/upsert] -> Found existing entry by natural key. Updating.`);
                return this.update(tableModel, entryObject, uniquenessQuery);
            }
        }

        if (_Hexley?.driverDebug) console.log(`[localDriver/upsert] -> No existing entry found. Adding new entry.`);
        return this.add(tableModel, entryObject, uniquenessQuery);
    },

    async delete(tableModel: any, query: any): Promise<boolean> {
        const tableName = tableModel?.options?.tableName;
        if (_Hexley?.driverDebug) console.log(`[localDriver/delete] Request for table: '${tableName}' with query:`, query);

        const table = _localDB[tableName];
        if (!table) {
            if (_Hexley?.driverDebug) console.log(`[localDriver/delete] -> FAILED: Table '${tableName}' not found.`);
            return false;
        }

        const indexToDelete = _findIndex(table, query);

        if (indexToDelete > -1) {
            table.splice(indexToDelete, 1);
            _save();
            if (_Hexley?.driverDebug) console.log(`[localDriver/delete] -> SUCCESS: Deleted entry from index ${indexToDelete}.`);
            return true;
        }
        
        if (_Hexley?.driverDebug) console.log(`[localDriver/delete] -> FAILED: No entry found with query.`);
        return false;
    },

    async reset(tableModel: any): Promise<void> {
        const tableName = tableModel?.options?.tableName;
        if (_Hexley?.driverDebug) console.log(`[localDriver/reset] Request to reset table: '${tableName}'`);

        if (_localDB[tableName]) {
            _localDB[tableName] = [];
            _save();
            if (_Hexley?.driverDebug) console.log(`[localDriver/reset] -> SUCCESS: Table '${tableName}' has been cleared.`);
        } else {
            if (_Hexley?.driverDebug) console.log(`[localDriver/reset] -> INFO: Table '${tableName}' not found. Nothing to reset.`);
        }
        return Promise.resolve();
    },

    async dropTable(tableModel: any): Promise<void> {
        const tableName = tableModel?.options?.tableName;
        if (_Hexley?.driverDebug) console.log(`[localDriver/dropTable] Request to drop table: '${tableName}'`);

        if (_localDB[tableName]) {
            delete _localDB[tableName];
            _save();
            if (_Hexley?.driverDebug) console.log(`[localDriver/dropTable] -> SUCCESS: Table '${tableName}' has been dropped.`);
        } else {
            if (_Hexley?.driverDebug) console.log(`[localDriver/dropTable] -> INFO: Table '${tableName}' not found. Nothing to drop.`);
        }
        return Promise.resolve();
    },

    async bulkCreate(tableName: string, data: any[]): Promise<any[]> {
        if (_Hexley?.driverDebug) console.log(`[localDriver/bulkCreate] Request to bulk create in table: '${tableName}'`);
        const results = [];
        for (const entry of data) {
            const newEntry = await this.upsert({ options: { tableName: tableName } }, entry);
            results.push(newEntry);
        }
        return results;
    },

};
