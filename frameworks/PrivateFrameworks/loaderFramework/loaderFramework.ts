import fs from 'fs';
import path from 'path';
import plist from 'plist';
import { type EntryInfo } from '../../PrivateFrameworks/registryFramework/registryFramework.ts'; // Import the master type
import { ApplicationCommandOptionType } from 'discord.js';

interface CommandArgRequirements {
    [commandName: string]: {
        [argName: string]: boolean;
    };
}

interface FrameworkPlist {
    'Framework Name': string;
    'Framework Description': string;
    'Framework Version': string;
    'Framework Identifier': string;
    'Framework Entry': string;
    'Framework Structure': {
        Main: string;
        [key: string]: string;
    };
}

interface ModulePlist {
    'Module Name': string;
    'Module Description': string;
    'Module Version': string;
    'Module Identifier': string;
    'Module Structure': {
        Main: string;
        [key: string]: string;
    };
    'Module Abilities'?: {
        canInitSlashCommands?: boolean;
        [key: string]: any;
    };
    'Module Environment'?: { [key: string]: string };
    'Module Settings'?: {
        enabled?: boolean;
        moduleEntryPoint: string;
        depsOn?: string;
        hasPreviousInit?: boolean;
        debugMode?: boolean;
        [key: string]: any;
    };
    'Module Commands'?: { [commandName: string]: string };
    'Module Command Arguments'?: { [commandName: string]: string };
    'Module Command Arg Type'?: { [argName: string]: number };
    'Module Command Arg Descriptions'?: { [argName: string]: string };
    'Module Command Arg Requirement'?: CommandArgRequirements;
}

interface DriverPlist {
    'Driver Name': string;
    'Driver Description': string;
    'Driver Version': string;
    'Driver Identifier': string;
    'Driver Entry': string;
    'Driver Type'?: 'Private' | 'Public';
    'Driver Structure': {
        Main: string;
        [key: string]: string;
    };
}

/**
 * The globally accessible framework for loading and unloading modules and frameworks.
 */
export const loaderFramework = {

    // Framework Log Color
    loaderColor: "#abffc6",
    loaderLight: "#0f8bff",
    loaderQueue: [] as string[],

    async initializeLoader(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/initializeLoader]', this.loaderColor)} Initializing...`);

        const plistPath = path.join(Hexley.privateFrameworksRootPath, 'loaderFramework', 'info.plist');
        await Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
        
        Hexley.loaderLoaded = true;
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/initializeLoader]', this.loaderColor)} Initialized! The Loader Framework is now accepting requests.`);
    },

    async processLoaderQueue(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/processLoaderQueue]', this.loaderColor)} Processing loader queue...`);
        let loadedInPass = true;
        while (this.loaderQueue.length > 0 && loadedInPass) {
            loadedInPass = false;
            const queue = [...this.loaderQueue];
            this.loaderQueue = [];

            for (const plistPath of queue) {
                const success = await this.loadRequest(Hexley, plistPath);
                if (success) {
                    loadedInPass = true;
                } else {
                    this.loaderQueue.push(plistPath);
                }
            }
        }

        if (this.loaderQueue.length > 0) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/processLoaderQueue]', Hexley.frameworks.aurora.tintRed)} Could not load the following modules due to missing dependencies:`);
            for (const plistPath of this.loaderQueue) {
                const parentDir = path.dirname(plistPath);
                const requestName = path.basename(parentDir);
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/processLoaderQueue]', Hexley.frameworks.aurora.tintRed)} - ${requestName}`);
            }
        }
    },

    async loadRequest(Hexley: any, plistPath: string) {
        let requestType = 'Unknown';
        const parentDir = path.dirname(plistPath);
        const requestName = path.basename(parentDir);
        let success = false;

        if (plistPath.startsWith(Hexley.publicFrameworksRootPath) || plistPath.startsWith(Hexley.privateFrameworksRootPath)) {
            requestType = 'Framework';
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/loadRequest]', this.loaderColor)} Received a load request for ${requestType}: "${requestName}"`);
            success = await this._handleFrameworkLoad(Hexley, plistPath, requestName);
        } else if (plistPath.startsWith(Hexley.modulesRootPath)) {
            requestType = 'Module';
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/loadRequest]', this.loaderColor)} Received a load request for ${requestType}: "${requestName}"`);
            success = await this._handleModuleLoad(Hexley, plistPath, requestName);
        } else if (plistPath.startsWith(Hexley.driversRootPath)) {
            requestType = 'Driver';
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/loadRequest]', this.loaderColor)} Received a load request for ${requestType}: "${requestName}"`);
            success = await this._handleDriverLoad(Hexley, plistPath, requestName);
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/loadRequest]', this.loaderColor)} Error: Could not determine type for resource at: ${plistPath}`);
        }

        if (success) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/loadRequest]', this.loaderColor)} Successfully fulfilled load request for "${requestName}".`);
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/loadRequest]', Hexley.frameworks.aurora.tintRedBright)} Failed to fulfill load request for "${requestName}".`);
        }
        return success;

    },

    async _handleFrameworkLoad(Hexley: any, plistPath: string, frameworkName: string): Promise<boolean> {
        try {
            const requestedFrameworkRootPath = path.dirname(plistPath);
            const fileContent = fs.readFileSync(plistPath, 'utf8');
            const parsedData = plist.parse(fileContent) as unknown as FrameworkPlist;
            const entry: EntryInfo = {
                'Name': parsedData['Framework Name'],
                'Type': 'Framework',
                'Description': parsedData['Framework Description'],
                'Identifier': parsedData['Framework Identifier'],
                'Version': parsedData['Framework Version'],
                'Structure': parsedData['Framework Structure'],
                'Entry Point': parsedData['Framework Entry']
            };

            // Add the framework to the versioning object and registry
            if (Hexley.registryLoaded) {
                await Hexley.frameworks.registry.addToRegistry(Hexley, entry);
            }

            const mainFilePath = path.join(requestedFrameworkRootPath, entry.Structure.Main);
            // By convention, the exported object name is the same as the framework's name.
            const entryObjectName = entry.Name; 
            // The initializer function name is specified in the plist.
            const initializerName = entry['Entry Point'];

            if (entryObjectName && initializerName) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Attempting to load framework "${entryObjectName}"...`);
                const importedFile = await import(mainFilePath);
                const frameworkObject = importedFile[entryObjectName];

                if (frameworkObject) {
                    Hexley.frameworks[entry.Name] = frameworkObject;
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Successfully loaded framework object "${entry.Name}".`);

                    if (typeof frameworkObject[initializerName] === 'function') {
                        await frameworkObject[initializerName](Hexley);
                    } else {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Error: Main function "${initializerName}" not found in framework "${entry.Name}".`);
                    }
                } else {
                     Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Error: Could not find exported object "${entryObjectName}" in framework "${entry.Name}".`);
                }
            }

            // Recursive Sub-Framework Loading
            for (const key in entry.Structure) {
                if (key !== 'Main') {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad/subFrameworkLoad]', this.loaderLight)} Found sub-framework "${key}" for "${entry.Name}". Sending new load request...`);
                    const relativePlistPath = entry.Structure[key];
                    const subFrameworkPlistPath = path.join(requestedFrameworkRootPath, relativePlistPath!);
                    await this.loadRequest(Hexley, subFrameworkPlistPath); // Recursive call
                }
            }

            return true;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Error processing framework load request for ${plistPath}:`);
            console.error(error.message);
            return false;
        }
    },

    async _handleModuleLoad(Hexley: any, plistPath: string, moduleName: string): Promise<boolean> {
        try {
            const requestedModuleRootPath = path.dirname(plistPath);
            const fileContent = fs.readFileSync(plistPath, 'utf8');
            const parsedData = plist.parse(fileContent) as unknown as ModulePlist;
            const entry: EntryInfo = {
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
                'Command Arg Requirement': (parsedData as any)['Module Command Arg Requirement']
            };
            
            // Check if the module is enabled
            if (entry.Settings?.enabled === false) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${entry.Name}" is disabled. Skipping initialization.`);
                return true; // Return true to not indicate a failure
            }

            // Check for dependencies
            const depsOn = entry.Settings?.depsOn;
            if (depsOn) {
                const dependencies = depsOn.split(',').map((dep: string) => dep.trim());
                for (const dep of dependencies) {
                    // Check if a required framework is disabled in the global config
                    const frameworkLoadFlag = `${dep.replace('Framework', '')}Load`; // e.g., 'discordLoad'
                    if (Hexley[frameworkLoadFlag] === false) {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', Hexley.frameworks.aurora.tintYellow)} Module "${entry.Name}" was not loaded because its dependency "${dep}" is disabled.`);
                        return false; // Abort the load entirely
                    }

                    if (!Hexley.versions[dep]) {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${entry.Name}" has unmet dependency: "${dep}". Adding to loader queue.`);
                        if (!this.loaderQueue.includes(plistPath)) {
                            this.loaderQueue.push(plistPath);
                        }
                        return false;
                    }
                }
            }
            
            const usesDiscord = (entry.Settings?.depsOn ?? '').includes('discordFramework');

            // If dependency checks pass, add to registry and versions
            if (Hexley.registryLoaded) {
                await Hexley.frameworks.registry.addToRegistry(Hexley, entry);
            }

            // Dynamic Module Loading and Execution
            const mainFilePath = path.join(requestedModuleRootPath, entry.Structure.Main);
            const entryPointName = entry['Entry Point'];

            if (entryPointName) {
                try {
                    const importedFile = await import(mainFilePath);
                    const moduleObject = importedFile[entry.Name];
                    const entryPointFunction = moduleObject?.[entryPointName];

                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderLight)} Checking for Module Environment Data in "${entry.Name}"...`);
                    const moduleEnv = parsedData['Module Environment'];
                    if (moduleEnv && Object.keys(moduleEnv).length > 0) {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderLight)} Found Module Environment for "${entry.Name}". Attaching variables...`);
                        moduleObject.config = {}; // Initialize config object
                        for (const key in moduleEnv) {
                            moduleObject.config[key] = moduleEnv[key];
                            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderLight)}   - Attached: ${key} = ${moduleEnv[key]}`);
                        }
                    }

                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Attempting to load and execute entry point for "${entry.Name}"...`);
                    if (typeof entryPointFunction === 'function') {
                        Hexley.modules[entry.Name] = moduleObject;
                        await entryPointFunction.call(moduleObject, Hexley); // force one at a time
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Successfully executed entry point "${entryPointName}" for module "${entry.Name}".`);
                    } else {
                        throw new Error(`Entry point "${entryPointName}" is not a function in module "${entry.Name}".`);
                    }
                } catch (executionError: any) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', Hexley.frameworks.aurora.tintRed)} An error occurred while initializing module "${entry.Name}": ${executionError.message}`);
                    
                    // Cleanup on failure
                    if (Hexley.registryLoaded) {
                        await Hexley.frameworks.registry.removeFromRegistry(Hexley, entry.Name);
                    }
                    if (Hexley.versionLoaded) {
                        await Hexley.frameworks.version.removeVersionEntry(Hexley, entry.Name);
                    }
                    return false; // Return failure
                }
            }

            // Recursive Sub-Module Loading
            for (const key in entry.Structure) {
                if (key !== 'Main') {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad/subModuleLoad]', this.loaderLight)} Found sub-module "${key}" for "${entry.Name}". Sending new load request...`);
                    const relativePlistPath = entry.Structure[key];
                    const subModulePlistPath = path.join(requestedModuleRootPath, relativePlistPath!);
                    await this.loadRequest(Hexley, subModulePlistPath); // Recursive call
                }
            }

            // Slash Command Registration Logic
            const canInit = entry.Abilities?.canInitSlashCommands;
            const hasInitted = entry.Settings?.hasPreviousInit;
            if (Hexley.discordLoaded && usesDiscord && canInit && !hasInitted && entry.Commands) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${entry.Name}" requires initial slash command registration.`);
                const moduleDebugMode = entry.Settings?.debugMode ?? false;
                for (const commandName in entry.Commands) {
                    const lowerCaseCommandName = commandName.toLowerCase();
                    const commandDescription = entry.Commands[commandName];
                    const argsString = entry['Command Arguments']?.[commandName];
                    if (!argsString || argsString.toLowerCase() === 'none') {
                        await Hexley.frameworks.discord.initBasicSlashCommand(Hexley, lowerCaseCommandName, commandDescription, moduleDebugMode);
                    } else {
                        const argNames = argsString.split(',').map((arg: any) => arg.trim());
                        const commandArgs = argNames.map((argName: any) => {
                            // Look up the requirement in the nested structure for better granular control
                            const isRequired = (entry as any)['Command Arg Requirement']?.[commandName]?.[argName] ?? false;
                            
                            return {
                                name: argName.toLowerCase(),
                                description: entry['Command Arg Descriptions']?.[argName] ?? 'No description provided.',
                                type: entry['Command Arg Type']?.[argName] ?? ApplicationCommandOptionType.String,
                                required: isRequired
                            };
                        });
                        await Hexley.frameworks.discord.initArgdSlashCommand(Hexley, lowerCaseCommandName, commandDescription, commandArgs, moduleDebugMode);
                    }
                }
                if (parsedData['Module Settings'] && !moduleDebugMode) {
                    parsedData['Module Settings'].hasPreviousInit = true;
                    const updatedPlistContent = plist.build(parsedData as any);
                    fs.writeFileSync(plistPath, updatedPlistContent);
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Updated hasPreviousInit flag in Info.plist`);
                }
            } else if (Hexley.discordLoaded && usesDiscord && canInit && hasInitted) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${entry.Name}" has already initialized its slash commands. Skipping.`);
            }

            return true;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', Hexley.frameworks.aurora.tintRed)} Error processing module load request for ${plistPath}: ${error.message}`);
            return false;
        }
    },

    async _handleDriverLoad(Hexley: any, plistPath: string, driverName: string): Promise<boolean> {
        try {
            const requestedDriverRootPath = path.dirname(plistPath);
            const fileContent = fs.readFileSync(plistPath, 'utf8');
            const parsedData = plist.parse(fileContent) as unknown as DriverPlist;
            
            // Construct entry object using Registry's EntryInfo interface
            const entry: EntryInfo = {
                'Name': parsedData['Driver Name'],
                'Type': 'Driver',
                'Driver Type': parsedData['Driver Type'],
                'Description': parsedData['Driver Description'],
                'Identifier': parsedData['Driver Identifier'],
                'Version': parsedData['Driver Version'],
                'Structure': parsedData['Driver Structure'],
                'Entry Point': parsedData['Driver Entry']
            };

            // Register the driver with the registry
            if (Hexley.registryLoaded) {
                await Hexley.frameworks.registry.addToRegistry(Hexley, entry);
            }

            const mainFilePath = path.join(requestedDriverRootPath, entry.Structure.Main);
            const entryObjectName = entry.Name;

            if (entryObjectName) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderColor)} Attempting to load driver "${entryObjectName}"...`);
                const importedFile = await import(mainFilePath);
                const driverObject = importedFile[entryObjectName];

                if (driverObject) {
                    // Drivers are stored in Hexley.drivers
                    Hexley.drivers = Hexley.drivers || {};
                    Hexley.drivers[entry.Name] = driverObject;
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderColor)} Successfully loaded driver object "${entry.Name}".`);

                    // Recursive Sub-Driver Loading
                    for (const key in entry.Structure) {
                        if (key !== 'Main') {
                            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad/subDriverLoad]', this.loaderLight)} Found sub-driver "${key}" for "${entry.Name}". Sending new load request...`);
                            const relativePlistPath = entry.Structure[key];
                            const subDriverPlistPath = path.join(requestedDriverRootPath, relativePlistPath!);
                            await this.loadRequest(Hexley, subDriverPlistPath); // Recursive call
                        }
                    }
                    
                    return true;
                } else {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderColor)} Error: Could not find exported object "${entryObjectName}" in driver "${entry.Name}".`);
                }
            }

            return false;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderColor)} Error processing driver load request for ${plistPath}:`);
            console.error(error.message);
            return false;
        }
    },

    unloadRequest(Hexley: any, resourceName: string) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/unloadRequest]', this.loaderColor)} Received an unload request for: ${resourceName}`);
    },

    requestFramework(Hexley: any, frameworkName: string) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/requestFramework]', this.loaderColor)} Searching registry for framework: ${frameworkName}`);
        const foundEntry = Hexley.frameworks.registry.getEntryByName(frameworkName);
        if (foundEntry) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/requestFramework]', this.loaderColor)} Found framework "${frameworkName}" in registry.`);
            return foundEntry;
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/requestFramework]', this.loaderColor)} Framework "${frameworkName}" not found in registry.`);
            return null;
        }
    },

    requestModule(Hexley: any, moduleName: string) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/requestModule]', this.loaderColor)} Searching registry for module: ${moduleName}`);
        const foundEntry = Hexley.frameworks.registry.getEntryByName(moduleName);
        if (foundEntry) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/requestModule]', this.loaderColor)} Found module "${moduleName}" in registry.`);
            return foundEntry;
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/requestModule]', this.loaderColor)} Module "${moduleName}" not found in registry.`);
            return null;
        }
    },

};
