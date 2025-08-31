import fs from 'fs';
import path from 'path';
import plist from 'plist';
import { type EntryInfo } from '../../PrivateFrameworks/registryFramework/registryFramework.ts'; // Import the master type
import { ApplicationCommandOptionType } from 'discord.js';

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
    'Module Settings'?: {
        moduleEntryPoint: string;
        dependsDiscordFramework?: boolean;
        canUseDiscord?: boolean;
        hasPreviousInit?: boolean;
        debugMode?: boolean;
        [key: string]: any;
    };
    'Module Commands'?: { [commandName: string]: string };
    'Module Command Arguments'?: { [commandName: string]: string };
    'Module Command Arg Type'?: { [argName: string]: number };
    'Module Command Arg Descriptions'?: { [argName: string]: string };
    'Module Command Arg Requirement'?: { [argName: string]: boolean };
}

/**
 * The globally accessible framework for loading and unloading modules and frameworks.
 */
export const loaderFramework = {

    // Framework Log Color
    loaderColor: "#abffc6",
    loaderLight: "#0f8bff",

    initializeLoader(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/initializeLoader]', this.loaderColor)} Initializing...`);

        const plistPath = path.join(Hexley.privateFrameworksRootPath, 'loaderFramework', 'info.plist');
        Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);

        Hexley.frameworks.version.addVersionEntry(Hexley, 'loaderFramework', 'Framework', '1.0.0');
        
        Hexley.loaderLoaded = true;
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/initializeLoader]', this.loaderColor)} Initialized! The Loader Framework is now accepting requests.`);
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
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/loadRequest]', this.loaderColor)} Error: Could not determine type for resource at: ${plistPath}`);
        }

        if (success) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/loadRequest]', this.loaderColor)} Successfully fulfilled load request for "${requestName}".`);
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/loadRequest]', Hexley.frameworks.aurora.tintRedBright)} Failed to fulfill load request for "${requestName}".`);
        }

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

            if (Hexley.versionLoaded) {
                Hexley.frameworks.version.addVersionEntry(Hexley, entry.Name, 'Framework', entry.Version);
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
                'Command Arg Requirement': parsedData['Module Command Arg Requirement']
            };
            
            const canUseDiscord = entry.Settings?.canUseDiscord;
            const dependsDiscordFramework = entry.Settings?.dependsDiscordFramework;

            // Check if Discord is a critical dependency first. If it fails, return false immediately.
            if (dependsDiscordFramework && !Hexley.discordLoaded) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', Hexley.frameworks.aurora.tintRed)} Fatal: Module "${entry.Name}" requires the Discord framework, which is not loaded. Skipping initialization.`);
                return false;
            } else if (canUseDiscord && !Hexley.discordLoaded) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${entry.Name}" wants to use Discord, but the Discord Framework is not loaded. Functionality may be limited.`);
            }

            // If dependency checks pass, add to registry and versions
            if (Hexley.registryLoaded) {
                await Hexley.frameworks.registry.addToRegistry(Hexley, entry);
            }
            if (Hexley.versionLoaded) {
                await Hexley.frameworks.version.addVersionEntry(Hexley, entry.Name, 'Module', entry.Version);
            }

            // Dynamic Module Loading and Execution
            const mainFilePath = path.join(requestedModuleRootPath, entry.Structure.Main);
            const entryPointName = entry['Entry Point'];

            if (entryPointName) {
                try {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Attempting to load and execute entry point for "${entry.Name}"...`);
                    const importedFile = await import(mainFilePath);
                    const moduleObject = importedFile[entry.Name];
                    const entryPointFunction = moduleObject?.[entryPointName];

                    if (typeof entryPointFunction === 'function') {
                        Hexley.modules[entry.Name] = moduleObject;
                        entryPointFunction.call(moduleObject, Hexley);
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
            if (Hexley.discordLoaded && canUseDiscord && canInit && !hasInitted && entry.Commands) {
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
                        const commandArgs = argNames.map((argName: any) => ({
                            name: argName.toLowerCase(),
                            description: entry['Command Arg Descriptions']?.[argName] ?? 'No description provided.',
                            type: entry['Command Arg Type']?.[argName] ?? ApplicationCommandOptionType.String,
                            required: entry['Command Arg Requirement']?.[argName] ?? false
                        }));
                        await Hexley.frameworks.discord.initArgdSlashCommand(Hexley, lowerCaseCommandName, commandDescription, commandArgs, moduleDebugMode);
                    }
                }
                if (parsedData['Module Settings'] && !moduleDebugMode) {
                    parsedData['Module Settings'].hasPreviousInit = true;
                    const updatedPlistContent = plist.build(parsedData as any);
                    fs.writeFileSync(plistPath, updatedPlistContent);
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Updated hasPreviousInit flag in Info.plist`);
                }
            } else if (Hexley.discordLoaded && canUseDiscord && canInit && hasInitted) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${entry.Name}" has already initialized its slash commands. Skipping.`);
            }

            return true;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', Hexley.frameworks.aurora.tintRed)} Error processing module load request for ${plistPath}: ${error.message}`);
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