import fs from 'fs';
import plist from 'plist';
import path from 'path';

// Define a master type for all loaded resources
export interface EntryInfo {
    // Common properties for both Modules and Frameworks
    'Name': string;
    'Type'?: 'Module' | 'Framework';
    'Description': string;
    'Identifier': string;
    'Entry Point': string;
    'Version': string;
    'Structure': {
        Main: string;
        [key: string]: string;
    };
    // Module-specific properties
    'Abilities'?: { [key: string]: any };
    'Settings'?: { [key: string]: any };
    'Commands'?: { [commandName: string]: string };
    'Command Arguments'?: { [commandName: string]: string };
    'Command Arg Type'?: { [argName: string]: number };
    'Command Arg Descriptions'?: { [argName: string]: string };
    'Command Arg Requirement'?: { [argName: string]: boolean };
}

/**
 * The globally accessible framework for managing loaded Hexley modules and frameworks information.
 */
export const registryFramework = {
    // A typed array to store module information
    globalRegistryBuffer: [] as EntryInfo[],

    // Framework Logging Color
    registryColor: "#f9ff82",

    /**
     * Initializes the Registry Framework.
     * @param {any} Hexley - The main Hexley global object.
     */
    initializeRegistry(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/initializeRegistry]', this.registryColor)} Initializing...`);

        // Listen for versionFramework.ready and add the version then.
        Hexley.core.once('versionFramework.ready', () => {
            Hexley.frameworks.version.addVersionEntry(Hexley, 'registryFramework', 'Framework', '1.0.0');
        });
        
        Hexley.registryLoaded = true;

        // Emit a ready event when initialization is complete
        Hexley.core.emit('registryFramework.ready');
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/initializeRegistry]', this.registryColor)} Initialized! The Registry is now accepting requests.`);
    },

    /**
     * Adds a resource's information to the registry by parsing its plist file.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} plistPath - The full path to the info.plist file.
     */
    addEntryByPlist(Hexley: any, plistPath: string) {
        try {
            const fileContent = fs.readFileSync(plistPath, 'utf8');
            const parsedData = plist.parse(fileContent) as any;

            let entryInfo: EntryInfo;

            // Check if it's a Framework or a Module
            if (parsedData['Framework Name']) {
                entryInfo = {
                    'Name': parsedData['Framework Name'],
                    'Type': 'Framework',
                    'Description': parsedData['Framework Description'],
                    'Identifier': parsedData['Framework Identifier'],
                    'Version': parsedData['Framework Version'],
                    'Structure': parsedData['Framework Structure'],
                    'Entry Point': parsedData['Framework Entry']
                };
            } else if (parsedData['Module Name']) {
                entryInfo = {
                    'Name': parsedData['Module Name'],
                    'Type': 'Module',
                    'Description': parsedData['Module Description'],
                    'Identifier': parsedData['Module Identifier'],
                    'Entry Point': parsedData['Module Settings']?.moduleEntryPoint ?? '',
                    'Version': parsedData['Module Version'],
                    'Structure': parsedData['Module Structure'],
                    'Abilities': parsedData['Module Abilities'],
                    'Settings': parsedData['Module Settings'],
                    'Commands': parsedData['Module Commands'],
                    'Command Arguments': parsedData['Module Command Arguments'],
                    'Command Arg Type': parsedData['Module Command Arg Type'],
                    'Command Arg Descriptions': parsedData['Module Command Arg Descriptions'],
                    'Command Arg Requirement': parsedData['Module Command Arg Requirement']
                };
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addEntryByPlist]', this.registryColor)} Error: Invalid plist file provided.`);
                return;
            }

            this.addToRegistry(Hexley, entryInfo);

        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addEntryByPlist]', this.registryColor)} Error processing plist file: ${error.message}`);
        }
    },

    /**
     * Adds a resource's information to the registry.
     * @param {any} Hexley - The main Hexley global object.
     * @param {EntryInfo} entryInfo - An object containing the resource's details.
     */
    addToRegistry(Hexley: any, entryInfo: EntryInfo) {
        if (typeof entryInfo !== 'object' || !entryInfo || !entryInfo['Name']) {
            Hexley.log(`[registryFramework] Error: Invalid entry information provided.`);
            return;
        }

        this.globalRegistryBuffer.push(entryInfo);

        Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addToRegistry]', this.registryColor)} Added entry: ${entryInfo['Name']}`);
        if (Hexley.debugMode) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addToRegistry]', this.registryColor)}   - Identifier: ${entryInfo['Identifier']}`);
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addToRegistry]', this.registryColor)}   - Version: ${entryInfo['Version']}`);
        }

    },

    /**
     * Removes a resource from the registry by its name.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} entryName - The name of the resource to remove.
     */
    removeFromRegistry(Hexley: any, entryName: string) {
        const index = this.globalRegistryBuffer.findIndex(entry => entry['Name'] === entryName);
        if (index !== -1) {
            this.globalRegistryBuffer.splice(index, 1);
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/removeFromRegistry]', this.registryColor)} Removed entry from registry: ${entryName}`);
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/removeFromRegistry]', this.registryColor)} Entry '${entryName}' not found in registry.`);
        }
    },

    /**
     * Retrieves all entries currently in the registry.
     * @returns {EntryInfo[]} An array of all entry information objects.
     */
    getAllEntries(): EntryInfo[] {
        return this.globalRegistryBuffer;
    },

    /**
     * Retrieves a specific entry by its name.
     * @param {string} entryName - The name of the entry to find.
     * @returns {EntryInfo | undefined} The entry info object, or undefined if not found.
     */
    getEntryByName(entryName: string): EntryInfo | undefined {
        return this.globalRegistryBuffer.find(entry => entry['Name'] === entryName);
    },

    /**
     * Gets the current count of entries in the registry.
     * @returns {number} The number of registered entries.
     */
    getEntryCount(): number {
        return this.globalRegistryBuffer.length;
    },

    /**
     * Gets the current count of modules in the registry.
     * @returns {number} The number of registered modules.
     */
    getModulesCount(): number {
        return this.globalRegistryBuffer.filter(entry => entry.Type === 'Module').length;
    },

    /**
     * Gets the current count of frameworks in the registry.
     * @returns {number} The number of registered frameworks.
     */
    getFrameworksCount(): number {
        return this.globalRegistryBuffer.filter(entry => entry.Type === 'Framework').length;
    },
    
};
