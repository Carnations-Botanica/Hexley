import fs from 'fs';
import plist from 'plist';
import path from 'path';

// Define a master type for all loaded resources
export interface EntryInfo {
    // Common properties for both Modules and Frameworks
    'Name': string;
    'Type'?: 'Kernel' | 'Framework' | 'Module' | 'Driver';
    'Framework Type'?: 'Private' | 'Public';
    'Driver Type'?: string;
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
    registryColor: "#0091AD",

    // Module-scoped reference to the Hexley global object
    _Hexley: null as any | null,

    /**
     * Initializes the Registry Framework.
     * @param {any} Hexley - The main Hexley global object.
     */
    async initializeRegistry(Hexley: any) {
        // Cache the Hexley object for later use by non-argument functions
        this._Hexley = Hexley;

        Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/initializeRegistry]', this.registryColor)} Initializing...`);

        // The Registry registers itself using its own info.plist
        const plistPath = path.join(Hexley.privateFrameworksRootPath, 'registryFramework', 'info.plist');
        await this.addEntryByPlist(Hexley, plistPath);
        Hexley.resources.framework.registry!.isLoaded = true;

        Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/initializeRegistry]', this.registryColor)} Initialized! The Registry is now accepting requests.`);
    },

    /**
     * Adds a resource's information to the registry by parsing its plist file.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} plistPath - The full path to the info.plist file.
     */
    async addEntryByPlist(Hexley: any, plistPath: string) {
        try {
            const hexleyIndex = plistPath.indexOf('Hexley/');
            const trimmedPath = hexleyIndex !== -1 ? plistPath.substring(hexleyIndex) : plistPath;
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addEntryByPlist]', this.registryColor)} Attempting to parse plist at: ${trimmedPath}`);
            
            const fileContent = fs.readFileSync(plistPath, 'utf8');
            const parsedData = plist.parse(fileContent) as any;

            let entryInfo: EntryInfo;

            // Check if it's a Framework
            if (parsedData['Framework Name']) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addEntryByPlist]', this.registryColor)} Found Framework: ${parsedData['Framework Name']}`);
                
                entryInfo = {
                    'Name': parsedData['Framework Name'],
                    'Type': 'Framework',
                    'Framework Type': parsedData['Framework Type'],
                    'Description': parsedData['Framework Description'],
                    'Identifier': parsedData['Framework Identifier'],
                    'Version': parsedData['Framework Version'],
                    'Structure': parsedData['Framework Structure'],
                    'Entry Point': parsedData['Framework Entry']
                };
            // Check if it's a Module
            } else if (parsedData['Module Name']) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addEntryByPlist]', this.registryColor)} Found Module: ${parsedData['Module Name']}`);
                
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
            // Check if it's a Driver
            } else if (parsedData['Driver Name']) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addEntryByPlist]', this.registryColor)} Found Driver: ${parsedData['Driver Name']}`);

                entryInfo = {
                    'Name': parsedData['Driver Name'],
                    'Type': 'Driver',
                    'Driver Type': parsedData['Driver Type'],
                    'Description': parsedData['Driver Description'],
                    'Identifier': parsedData['Driver Identifier'],
                    'Entry Point': parsedData['Driver Entry'],
                    'Version': parsedData['Driver Version'],
                    'Structure': parsedData['Driver Structure']
                };
            // Check if it's a Kernel
            } else if (parsedData['Kernel Name']) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addEntryByPlist]', this.registryColor)} Found Kernel: ${parsedData['Kernel Name']}`);

                entryInfo = {
                    'Name': parsedData['Kernel Name'],
                    'Type': 'Kernel',
                    'Description': parsedData['Kernel Description'],
                    'Identifier': parsedData['Kernel Identifier'],
                    'Entry Point': parsedData['Kernel Entry'],
                    'Version': parsedData['Kernel Version'],
                    'Structure': parsedData['Kernel Structure']
                };
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addEntryByPlist]', this.registryColor)} Error: Invalid plist file provided.`);
                return;
            }

            await this.addToRegistry(Hexley, entryInfo);

        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addEntryByPlist]', this.registryColor)} Error processing plist file: ${error.message}`);
        }
    },

    /**
     * Adds a resource's information to the registry.
     * @param {any} Hexley - The main Hexley global object.
     * @param {EntryInfo} entryInfo - An object containing the resource's details.
     */
    async addToRegistry(Hexley: any, entryInfo: EntryInfo) {
        if (typeof entryInfo !== 'object' || !entryInfo || !entryInfo['Name']) {
            Hexley.log(`[registryFramework] Error: Invalid entry information provided.`);
            return;
        }

        this.globalRegistryBuffer.push(entryInfo);

        // Automatically add the version to the version framework
        if (Hexley.resources.framework.version.isLoaded && entryInfo.Type && entryInfo.Version) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addToRegistry]', this.registryColor)} Requesting to add ${entryInfo['Type']} to versionTable as: ${entryInfo['Name']} (${entryInfo['Version']})`);
            await Hexley.frameworks.version.addVersionEntry(Hexley, entryInfo.Name, entryInfo.Type, entryInfo.Version);
        }

        Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addToRegistry]', this.registryColor)} Added entry: ${entryInfo['Name']}`);
        if (Hexley.debugMode) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addToRegistry]', this.registryColor)}   - Identifier: ${entryInfo['Identifier']}`);
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addToRegistry]', this.registryColor)}   - Version: ${entryInfo['Version']}`);
            if (entryInfo.Type === 'Framework') {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addToRegistry]', this.registryColor)}   - Framework Type: ${entryInfo['Framework Type']}`);
            }
            if (entryInfo.Type === 'Driver') {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/addToRegistry]', this.registryColor)}   - Driver Type: ${entryInfo['Driver Type']}`);
            }
        }

    },

    /**
     * Removes a resource from the registry by its name.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} entryName - The name of the resource to remove.
     */
    removeFromRegistry(Hexley: any, entryName: string) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[registryFramework/removeFromRegistry]', this.registryColor)} Attempting to remove entry: ${entryName}`);
        
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
        const H = this._Hexley;
        if (H && H.debugMode && H.wantDebug) {
             H.log(H, `${H.frameworks.aurora.colorText('[registryFramework/getEntryByName]', this.registryColor)} Searching for entry: ${entryName}`);
        }

        const found = this.globalRegistryBuffer.find(entry => entry['Name'] === entryName);
        if (H && H.debugMode && H.wantDebug) {
            if (found) {
                H.log(H, `${H.frameworks.aurora.colorText('[registryFramework/getEntryByName]', this.registryColor)} Found entry: ${entryName}`);
            } else {
                 H.log(H, `${H.frameworks.aurora.colorText('[registryFramework/getEntryByName]', this.registryColor)} Entry not found: ${entryName}`);
            }
        }

        return found;
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

    /**
     * Gets the current count of kernels in the registry.
     * @returns {number} The number of registered kernels.
     */
    getKernelsCount(): number {
        return this.globalRegistryBuffer.filter(entry => entry.Type === 'Kernel').length;
    },
    
    /**
     * Gets the current count of drivers in the registry.
     * @returns {number} The number of registered drivers.
     */
    getDriversCount(): number {
        return this.globalRegistryBuffer.filter(entry => entry.Type === 'Driver').length;
    },

    /**
     * Gets the current count of private drivers in the registry.
     * @returns {number} The number of registered private drivers.
     */
    getPrivateDriversCount(): number {
        return this.globalRegistryBuffer.filter(entry => entry.Type === 'Driver' && entry['Driver Type'] === 'Private').length;
    },

    /**
     * Gets the current count of public drivers in the registry.
     * @returns {number} The number of registered public drivers.
     */
    getPublicDriversCount(): number {
        return this.globalRegistryBuffer.filter(entry => entry.Type === 'Driver' && entry['Driver Type'] === 'Public').length;
    },

};
