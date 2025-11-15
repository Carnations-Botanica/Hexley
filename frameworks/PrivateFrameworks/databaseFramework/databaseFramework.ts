import path from "path";
import type { DatabaseDriver } from "../../../drivers/databaseDriver/databaseDriver";
import { parse } from "csv-parse/sync";

/**
 * The globally accessible framework for managing Hexley's database connection.
 * It uses a driver-based architecture to support different database backends.
 */
export const databaseFramework = {
  // Framework Logging Color
  frameworkColor: "#b6ccfe",

  // This will hold the currently active database driver.
  _activeDriver: null as DatabaseDriver | null,

  // Property to track the active mode
  mode: "Local" as "Local" | "Sequelizer",

  /**
   * Initializes the Database framework by loading the appropriate driver.
   * @param {any} Hexley - The main Hexley global object.
   */
  async initializeDatabaseConnection(Hexley: any) {
    const mode = Hexley.databaseMode; // 'Local' or 'Sequelizer'
    Hexley.log(
      `${Hexley.frameworks.aurora.colorText(`[databaseFramework]`, this.frameworkColor)} Initializing in ${mode} mode...`,
    );

    try {
      // Dynamically import the correct driver based on the mode.
      const mode = Hexley.databaseMode;
      this.mode = mode;
      const baseDriverPlistPath = path.join(
        Hexley.workingDir,
        "drivers",
        `databaseDriver`,
        `info.plist`,
      );
      const driverPath = path.join(
        Hexley.workingDir,
        "drivers",
        `${mode.toLowerCase()}Driver`,
        `${mode.toLowerCase()}Driver.ts`,
      );
      const driverPlistPath = path.join(
        Hexley.workingDir,
        "drivers",
        `${mode.toLowerCase()}Driver`,
        `info.plist`,
      );
      const driverModule = await import(driverPath);
      this._activeDriver = driverModule[`${mode.toLowerCase()}Driver`];

      if (!this._activeDriver) {
        Hexley.resources.framework.database.activeDriver = "None";
        throw new Error(`Driver for mode "${mode}" could not be loaded.`);
      }

      // Initialize the active driver.
      const success = await this._activeDriver.initialize(Hexley);
      if (!success) {
        Hexley.log(`Failed to initialize the "${mode}" database driver.`);
        Hexley.resources.framework.database.isLoaded = false;
        throw new Error(
          `Failed to initialize the "${this._activeDriver}" driver.`,
        );
      } else {
        Hexley.resources.framework.database.selectedMode = mode;
        Hexley.log(
          `${Hexley.frameworks.aurora.colorText("[databaseFramework/initializeDatabaseConnection]", this.frameworkColor)} Initialized in ${mode} successfully.`,
        );
      }

      Hexley.resources.framework.database.isLoaded = true;
      Hexley.log(
        `${Hexley.frameworks.aurora.colorText("[databaseFramework]", this.frameworkColor)} Initialized! Database Framework is now loaded into memory.`,
      );
    } catch (error: any) {
      Hexley.log(
        Hexley.frameworks.aurora.colorText(
          `[databaseFramework] Fatal: ${error.message}`,
          Hexley.frameworks.aurora.tintRedBright,
        ),
      );
      process.exit(1);
    }
  },

  // The following methods are wrappers that call the corresponding methods on the active driver.
  // This ensures that any part of Hexley can interact with the database in the same way,
  // regardless of which driver is currently active.

  async getTables(): Promise<string[]> {
    if (!this._activeDriver) return [];
    return this._activeDriver.getTables();
  },

  async initTable(tableModel: any): Promise<any> {
    if (!this._activeDriver) return null;
    return this._activeDriver.initTable(tableModel);
  },

  async getAll(tableModel: any): Promise<any[]> {
    if (!this._activeDriver) return [];
    return this._activeDriver.getAll(tableModel);
  },

  async get(tableModel: any, query: any): Promise<any | null> {
    if (!this._activeDriver) return null;
    return this._activeDriver.get(tableModel, query);
  },

  async add(
    tableModel: any,
    entryObject: any,
    query: any,
  ): Promise<any | null> {
    if (!this._activeDriver) return null;
    return this._activeDriver.add(tableModel, entryObject, query);
  },

  async update(
    tableModel: any,
    entryObject: any,
    query: any,
  ): Promise<any | null> {
    if (!this._activeDriver) return null;
    return this._activeDriver.update(tableModel, entryObject, query);
  },

  async upsert(tableModel: any, entryObject: any): Promise<any> {
    if (!this._activeDriver) return null;
    return this._activeDriver.upsert(tableModel, entryObject);
  },

  async delete(tableModel: any, query: any): Promise<boolean> {
    if (!this._activeDriver) return false;
    return this._activeDriver.delete(tableModel, query);
  },

  async reset(tableModel: any): Promise<void> {
    if (!this._activeDriver) return;
    await this._activeDriver.reset(tableModel);
  },

  async dropTable(tableModel: any): Promise<void> {
    if (!this._activeDriver) return;
    await this._activeDriver.dropTable(tableModel);
  },

  async bulkCreate(tableName: string, data: any[]): Promise<any[]> {
    if (
      !this._activeDriver ||
      typeof this._activeDriver.bulkCreate !== "function"
    ) {
      throw new Error(
        `Driver does not support bulkCreate in ${this.mode} mode.`,
      );
    }
    return this._activeDriver.bulkCreate(tableName, data);
  },

  async parseCSV(Hexley: any, csvContents: string) {
    let headers: string[] = [];

    let firstline = csvContents.split("\n")[0];
    if (!firstline) {
      Hexley.log(
        `${Hexley.frameworks.aurora.colorText("[databaseFramework/parseCSV]", this.frameworkColor)} Error: Empty CSV content.`,
      );
      return null;
    }
    headers = firstline.split(",").filter((h) => h !== "");
    if (Hexley.debugMode)
      Hexley.log(
        `${Hexley.frameworks.aurora.colorText("[databaseFramework/parseCSV]", this.frameworkColor)} Parsing CSV headers: ${headers}`,
      );

    const records = parse(csvContents, { columns: headers });

    return records;
  },
};
