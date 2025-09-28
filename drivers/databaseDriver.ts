/**
 * Defines the standard interface for all database drivers in Hexley.
 * This ensures that the application can interact with any database
 * in a consistent way.
 */
export interface DatabaseDriver {
    /**
     * Initializes the database connection.
     * @param {any} Hexley - The main Hexley global object.
     * @returns {Promise<boolean>} A promise that resolves to true if the connection was successful, and false otherwise.
     */
    initialize(Hexley: any): Promise<boolean>;

    /**
     * Retrieves all tables in the database.
     * @returns {Promise<string[]>} A promise that resolves to an array of table names.
     */
    getTables(): Promise<string[]>;

    /**
     * Initializes a table definition. In many drivers, this will create the table if it doesn't exist.
     * @param {any} tableModel - An object describing the table's schema and options.
     * @returns {Promise<any>} A promise that resolves when the table is ready.
     */
    initTable(tableModel: any): Promise<any>;

    /**
     * Retrieves all entries from a given table.
     * @param {any} tableModel - The model of the table to query.
     * @returns {Promise<any[]>} A promise that resolves to an array of entries.
     */
    getAll(tableModel: any): Promise<any[]>;

    /**
     * Retrieves a single entry from a table based on a query.
     * @param {any} tableModel - The model of the table to query.
     * @param {any} query - The query to use for finding the entry.
     * @returns {Promise<any | null>} A promise that resolves to the found entry, or null if not found.
     */
    get(tableModel: any, query: any): Promise<any | null>;

    /**
     * Adds a new entry to a table.
     * @param {any} tableModel - The model of the table.
     * @param {any} entryObject - The object to add to the table.
     * @param {any} query - A query to check if the entry already exists.
     * @returns {Promise<any | null>} A promise that resolves to the new entry, or null if it already exists.
     */
    add(tableModel: any, entryObject: any, query: any): Promise<any | null>;

    /**
     * Updates an existing entry in a table.
     * @param {any} tableModel - The model of the table.
     * @param {any} entryObject - The new data for the entry.
     * @param {any} query - The query to find the entry to update.
     * @returns {Promise<any | null>} A promise that resolves to the updated entry, or null if not found.
     */
    update(tableModel: any, entryObject: any, query: any): Promise<any | null>;

    /**
     * Creates a new entry if it doesn't exist, or updates it if it does.
     * @param {any} tableModel - The model of the table.
     * @param {any} entryObject - The entry to upsert.
     * @returns {Promise<any>} A promise that resolves to the created or updated entry.
     */
    upsert(tableModel: any, entryObject: any): Promise<any>;

    /**
     * Deletes an entry from a table.
     * @param {any} tableModel - The model of the table.
     * @param {any} query - The query to find the entry to delete.
     * @returns {Promise<boolean>} A promise that resolves to true if the deletion was successful, and false otherwise.
     */
    delete(tableModel: any, query: any): Promise<boolean>;

    /**
     * Deletes all entries from a table.
     * @param {any} tableModel - The model of the table to reset.
     * @returns {Promise<void>} A promise that resolves when the table has been reset.
     */
    reset(tableModel: any): Promise<void>;
    
}
