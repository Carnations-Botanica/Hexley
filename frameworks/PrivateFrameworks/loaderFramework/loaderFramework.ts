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
    'Framework Bin Support': boolean;
    'Framework Dependencies': string;
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
        binSupport?: boolean;
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

    // Framework Logging Color
    loaderColor: "#9bc1bc",
    loaderLight: "#fefae0",
    loaderDark: "#0f8bff",
    loaderQueue: [] as string[],

    // Used to normalize names before HGO assignment
    _normalizeName(itemName: string, type: 'framework' | 'module' | 'driver'): string {
        let normalizedName = itemName;
        if (type === 'framework' && normalizedName.endsWith('Framework')) {
            normalizedName = normalizedName.replace('Framework', '');
        } else if (type === 'module' && normalizedName.endsWith('Module')) {
            normalizedName = normalizedName.replace('Module', '');
        } else if (type === 'driver' && normalizedName.endsWith('Driver')) {
            normalizedName = normalizedName.replace('Driver', '');
        }
        return normalizedName;
    },

    async initializeLoader(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/initializeLoader]', this.loaderColor)} Initializing...`);

        // The loader registers itself, but we prevent re-initialization later.
        const plistPath = path.join(Hexley.privateFrameworksRootPath, 'loaderFramework', 'info.plist');
        if (Hexley.resources.framework.registry.isLoaded) {
            await Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
        }
        
        Hexley.resources.framework.loader!.isLoaded = true;
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/initializeLoader]', this.loaderColor)} Initialized! The Loader Framework is now accepting requests.`);
        await this._beginLoadingSequence(Hexley);
    },

    /**
     * The main orchestrator for the loading process.
     */
    async _beginLoadingSequence(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/sequence]', this.loaderColor)} Beginning resource loading sequence...`);

        // Discover all resources
        const allResourcePlists = this._scanForAllResources(Hexley);
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/sequence]', this.loaderColor)} Discovered ${allResourcePlists.length} total resources.`);

        // Build the dependency graph
        const { graph, nameToPathMap } = this._buildDependencyGraph(Hexley, allResourcePlists);

        // Topologically sort the graph to get the loading order
        const loadOrder = this._topologicalSort(graph);
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/sequence]', this.loaderColor)} Determined logical loading order for ${loadOrder.length} resources.`);
        if (Hexley.debugMode && Hexley.frameworkDebug) {
            Hexley.log(loadOrder);
        }

        // Load resources in the correct order
        for (const resourceName of loadOrder) {
            const plistPath = nameToPathMap[resourceName];
            if (plistPath) {
                await this.loadRequest(Hexley, plistPath);
            }
        }

        // Process any items that were queued due to other issues
        await this.processLoaderQueue(Hexley);
    },

    /**
     * Scans all resource directories and returns a list of all info.plist paths.
     */
    _scanForAllResources(Hexley: any): string[] {
        const resourcePaths = [
            Hexley.privateFrameworksRootPath,
            Hexley.publicFrameworksRootPath,
            Hexley.modulesRootPath,
            Hexley.driversRootPath,
        ];
        let allPlists: string[] = [];

        for (const dirPath of resourcePaths) {
            if (fs.existsSync(dirPath)) {
                const items = fs.readdirSync(dirPath);
                for (const itemName of items) {
                    const itemPath = path.join(dirPath, itemName);
                    const plistPath = path.join(itemPath, 'info.plist');
                    if (fs.lstatSync(itemPath).isDirectory() && fs.existsSync(plistPath)) {
                        allPlists.push(plistPath);
                    }
                }
            }
        }
        return allPlists;
    },

    /**
     * Parses all plist files to build a dependency graph.
     */
    _buildDependencyGraph(Hexley: any, plistPaths: string[]): { graph: Map<string, string[]>, nameToPathMap: { [key: string]: string } } {
        const graph = new Map<string, string[]>();
        const nameToPathMap: { [key: string]: string } = {};

        for (const plistPath of plistPaths) {
            try {
                const fileContent = fs.readFileSync(plistPath, 'utf8');
                const parsedData = plist.parse(fileContent) as any;
                const name = parsedData['Framework Name'] || parsedData['Module Name'] || parsedData['Driver Name'];
                if (!name) continue;

                nameToPathMap[name] = plistPath;
                const depsString = parsedData['Framework Dependencies'] || parsedData['Module Settings']?.depsOn || '';
                const dependencies = depsString ? depsString.split(',').map((d: string) => d.trim()) : [];
                
                graph.set(name, dependencies);
            } catch (e) {
                // ignore invalid plists
            }
        }
        return { graph, nameToPathMap };
    },

    /**
     * Performs a topological sort on the dependency graph.
     */
    _topologicalSort(graph: Map<string, string[]>): string[] {
        const sorted: string[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>(); // For detecting cycles

        const visit = (node: string) => {
            if (visiting.has(node)) {
                console.error(`[loaderFramework/sort] Cycle detected in dependencies involving "${node}"`);
                return;
            }
            if (visited.has(node)) {
                return;
            }

            visiting.add(node);
            
            const dependencies = graph.get(node) || [];
            for (const dependency of dependencies) {
                // Find the full name of the dependency in the graph
                const depFullName = Array.from(graph.keys()).find(k => k.toLowerCase().replace('framework', '') === dependency.toLowerCase().replace('framework', ''));
                if (depFullName) {
                    visit(depFullName);
                }
            }

            visiting.delete(node);
            visited.add(node);
            sorted.push(node);
        };

        for (const node of graph.keys()) {
            if (!visited.has(node)) {
                visit(node);
            }
        }

        return sorted;
    },


    async processLoaderQueue(Hexley: any) {
        if (this.loaderQueue.length === 0) return;

        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/processLoaderQueue]', this.loaderColor)} Processing loader queue with ${this.loaderQueue.length} items...`);
        let loadedInPass = false;
        
        // Use a copy of the queue to iterate over, while modifying the original
        const queueToProcess = [...this.loaderQueue];
        this.loaderQueue = []; // Clear the main queue

        for (const plistPath of queueToProcess) {
            const success = await this.loadRequest(Hexley, plistPath);
            if (success) {
                loadedInPass = true;
            } else {
                // If it fails again, add it back to the main queue
                this.loaderQueue.push(plistPath);
            }
        }

        // If we successfully loaded at least one item, it might have resolved dependencies for others. Retry.
        if (loadedInPass) {
            await this.processLoaderQueue(Hexley);
        } else if (this.loaderQueue.length > 0) {
            // If we made a full pass and loaded nothing, then the remaining items are unresolvable.
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/processLoaderQueue]', Hexley.frameworks.aurora.tintRed)} Could not load the following resources due to permanently unmet dependencies:`);
            for (const plistPath of this.loaderQueue) {
                const requestName = path.basename(path.dirname(plistPath));
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
            // Success is logged inside the handlers to avoid double-logging skips
        } else {
            // Only log failure if it's not being added to the queue
            if (!this.loaderQueue.some(p => p.includes(requestName))) {
                 Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/loadRequest]', Hexley.frameworks.aurora.tintRedBright)} Failed to fulfill load request for "${requestName}".`);
            }
        }
        return success;

    },

    /**
     * Usage of internal search for a resource's bin/ directory and registers all .bud files via hexShellFramework.
     */
    async _loadBinSupportCommands(Hexley: any, resourceRootPath: string, resourceName: string) {
        const { aurora, hexShell } = Hexley.frameworks;

        // Check if hexShell is loaded and has the required registration method
        if (!Hexley.resources.framework.hexShell.isLoaded || typeof hexShell.registerExternalCommand !== 'function') {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/binSupport]', this.loaderColor)} Framework hexShell has isLoaded: ${Hexley.resources.framework.hexShell.isLoaded}.`);
            return;
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/binSupport]', this.loaderColor)} Framework hexShell has isLoaded: ${Hexley.resources.framework.hexShell.isLoaded}.`);
        }

        const binPath = path.join(resourceRootPath, 'bin');

        if (fs.existsSync(binPath)) {
            Hexley.log(aurora.colorText(`[loaderFramework/binSupport] Scanning bin folder for "${resourceName}"...`, this.loaderLight));
            
            const files = fs.readdirSync(binPath);
            for (const file of files) {
                if (file.endsWith('.bud')) {
                    const commandName = file.replace('.bud', '');
                    const commandPath = path.join(binPath, file);

                    hexShell.registerExternalCommand(commandName, commandPath);
                    Hexley.log(aurora.colorText(`[loaderFramework/binSupport]   - Added command: ${commandName}`, this.loaderLight));
                }
            }
        }
        
    },

    /**
     * Public function to scan a resource's bin/ directory and register all .bud files via hexShellFramework.
     * This is exposed so modules/frameworks can manually trigger bin loading outside the automatic scan.
     * @param {any} Hexley - The Hexley object.
     * @param {string} resourceRootPath - The absolute path to the resource directory (containing a 'bin/' folder).
     * @param {string} resourceName - The name of the resource (for logging purposes).
     */
    async loadBinCommands(Hexley: any, resourceRootPath: string, resourceName: string) {
        const { aurora, hexShell } = Hexley.frameworks;
        // Check if hexShell is loaded and has the required registration method
        if (!Hexley.hexShellLoad || typeof hexShell.registerExternalCommand !== 'function') return;

        const binPath = path.join(resourceRootPath, 'bin');

        if (fs.existsSync(binPath)) {
            Hexley.log(aurora.colorText(`[loaderFramework/binSupport] Scanning bin folder for "${resourceName}"...`, this.loaderLight));
            
            const files = fs.readdirSync(binPath);
            for (const file of files) {
                if (file.endsWith('.bud')) {
                    const commandName = file.replace('.bud', '');
                    const commandPath = path.join(binPath, file);

                    hexShell.registerExternalCommand(commandName, commandPath);
                    Hexley.log(aurora.colorText(`[loaderFramework/binSupport]   - Added command: ${commandName}`, this.loaderLight));
                }
            }
        }
    },

    async _handleFrameworkLoad(Hexley: any, plistPath: string, frameworkName: string): Promise<boolean> {
        try {
            const requestedFrameworkRootPath = path.dirname(plistPath);
            const fileContent = fs.readFileSync(plistPath, 'utf8');
            const parsedData = plist.parse(fileContent) as unknown as FrameworkPlist;

            // Use original name from plist for accuracy
            const originalName = parsedData['Framework Name'];
            const normalizedName = this._normalizeName(originalName, 'framework');
            if (!originalName) throw new Error(`Plist missing 'Framework Name': ${plistPath}`);
            if (!normalizedName) {
                throw new Error(`_handleFrameworkLoad failed to generate normalizedName`);
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Normalized as ${normalizedName}.`);
            }

            const entry: EntryInfo = {
                'Name': parsedData['Framework Name'],
                'Type': 'Framework',
                'Description': parsedData['Framework Description'],
                'Identifier': parsedData['Framework Identifier'],
                'Framework Type': (parsedData as any)['Framework Type'],
                'Version': parsedData['Framework Version'],
                'Structure': parsedData['Framework Structure'],
                'Entry Point': parsedData['Framework Entry']
            };

            // We need to ensure that if we've discovered this Framework, that we add it to the HGO so that it becomes globally accesible, with a status property.
            if (!Hexley.resources.framework[normalizedName]) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderLight)} Dynamically creating HGO entry for framework "${originalName}".`);
                // Frameworks default to wantLoad: true unless explicitly defined otherwise in kernel
                Hexley.resources.framework[normalizedName] = { wantLoad: true, isLoaded: false };
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderLight)} HGO entry for framework "${originalName}" already exists.`);
            }
            
            const resourceStatus = Hexley.resources.framework[normalizedName];
            if (resourceStatus) {
                if (!resourceStatus.wantLoad) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Framework "${entry.Name}" is disabled via HGO. Skipping.`);
                    return true;
                }
                if (resourceStatus.isLoaded) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Framework "${entry.Name}" is already loaded. Skipping.`);
                    return true;
                }
                if (resourceStatus.wantLoad) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Will now handle "${entry.Name}" loading.`);
                }
            }

            // Check dependencies, Must happen BEFORE registry add
            const depsOn = parsedData['Framework Dependencies'];
            if (depsOn) {
                const dependencies = depsOn.split(',').map((dep: string) => dep.trim());
                for (const dep of dependencies) {
                    const normalizedDepName = this._normalizeName(dep, 'framework');

                    if (!Hexley.resources.framework[normalizedDepName] || !Hexley.resources.framework[normalizedDepName].isLoaded) {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', Hexley.frameworks.aurora.tintYellow)} Framework "${originalName}" has unmet dependency: "${dep}". Adding to loader queue.`);
                        if (!this.loaderQueue.includes(plistPath)) {
                            this.loaderQueue.push(plistPath);
                        }

                        return false; // Failed this attempt, needs retry
                    }
                }
            }

            // Add to the registry if loaded
            if (Hexley.resources.framework.registry!.isLoaded) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Registering Framework "${entry.Name}".`);
                await Hexley.frameworks.registry.addToRegistry(Hexley, entry);
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Could not register Framework "${entry.Name}" as The Registry is not loaded.`);
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
                    Hexley.frameworks[normalizedName] = frameworkObject;
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Successfully attached framework object "${entry.Name}" to HGO property as Hexley.frameworks.${normalizedName}.`);

                    if (typeof frameworkObject[initializerName] === 'function') {
                        await frameworkObject[initializerName](Hexley);
                        if(resourceStatus) {
                            resourceStatus.isLoaded = true;
                             Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Updated HGO status for framework "${entry.Name}" to isLoaded: true.`);
                        }
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Successfully executed entry point "${initializerName}" for framework "${entry.Name}".`);
                    } else {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Error: Main function "${initializerName}" not found in framework "${entry.Name}".`);
                    }

                } else {
                     Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Error: Could not find exported object "${entryObjectName}" in framework "${entry.Name}".`);
                }
            }

            // Check for top level bins to add to hexShellFramework
            const binSupport = parsedData['Framework Bin Support'];
            if (binSupport) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Framework "${entry.Name}" reports binSupport.`);
                await this._loadBinSupportCommands(Hexley, requestedFrameworkRootPath, frameworkName);
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Framework "${entry.Name}" does not have binSupport.`);
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

            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Framework "${entry.Name}" loaded successfully.`);
            return true;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleFrameworkLoad]', this.loaderColor)} Error processing framework load request for ${plistPath}:`);
            
            // Log stack trace if available and in debug mode
            if (Hexley.debugMode && error.stack) {
                console.log(error.stack);
            }

            if (Hexley.resources.framework.registry!.isLoaded) {
                Hexley.frameworks.registry.removeFromRegistry(Hexley, frameworkName);
            }

            if (Hexley.resources.framework.version!.isLoaded) {
                await Hexley.frameworks.version.removeVersionEntry(Hexley, frameworkName);
            }

            return false;
        }
    },

    async _handleModuleLoad(Hexley: any, plistPath: string, moduleName: string): Promise<boolean> {
        try {
            const requestedModuleRootPath = path.dirname(plistPath);
            const fileContent = fs.readFileSync(plistPath, 'utf8');
            const parsedData = plist.parse(fileContent) as unknown as ModulePlist;
            const originalName = parsedData['Module Name'];
            if (!originalName) throw new Error(`Plist missing 'Module Name': ${plistPath}`);

            const entry: EntryInfo = {
                'Name': originalName,
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

            const normalizedName = this._normalizeName(originalName, 'module');

            // Ensure HGO entry exists, dynamic detection of modules require this like frameworks above
            if (!Hexley.resources.module[normalizedName]) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderLight)} Dynamically creating HGO entry for module "${originalName}".`);
                // Default wantLoad based on plist enabled flag, fallback to true if key missing
                const wantLoadDefault = entry.Settings?.enabled !== false;
                Hexley.resources.module[normalizedName] = { wantLoad: wantLoadDefault, isLoaded: false };
            }
            const resourceStatus = Hexley.resources.module[normalizedName];
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/loadRequest]', this.loaderColor)} Received load request for Module: "${originalName}"`);

            // Skip if disabled (via HGO or plist) or already loaded
            if (!resourceStatus.wantLoad || resourceStatus.isLoaded || entry.Settings?.enabled === false) {
                if (!resourceStatus.wantLoad) Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${originalName}" is disabled via HGO. Skipping.`);
                if (resourceStatus.isLoaded) Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${originalName}" is already loaded. Skipping.`);
                if (entry.Settings?.enabled === false) Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${originalName}" is disabled via plist. Skipping.`);
                return true; // Success in terms of processing
            }


            // Check for dependencies
            const depsOn = entry.Settings?.depsOn;
            if (depsOn) {
                const dependencies = depsOn.split(',').map((dep: string) => dep.trim());
                for (const dep of dependencies) {

                    const normalizedDepName = this._normalizeName(dep, 'framework'); // Assume deps are frameworks
                    const depResource = Hexley.resources.framework[normalizedDepName];

                    if (!depResource) {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', Hexley.frameworks.aurora.tintRed)} Module "${originalName}" dependency error: Resource "${dep}" not defined in HGO.`);
                        return false;
                    }

                    if (!depResource.wantLoad) {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', Hexley.frameworks.aurora.tintYellow)} Module "${originalName}" was not loaded because its dependency "${dep}" is disabled in configuration.`);
                        return false;
                    }

                    if (!depResource.isLoaded) {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${originalName}" has unmet dependency: "${dep}". Adding to loader queue.`);
                        if (!this.loaderQueue.includes(plistPath)) {
                            this.loaderQueue.push(plistPath);
                        }
                        return false;
                    }
                }
            }
            const usesDiscord = (entry.Settings?.depsOn ?? '').includes('discordFramework');

            if (Hexley.resources.framework.registry.isLoaded) {
                await Hexley.frameworks.registry.addToRegistry(Hexley, entry);
            }

            // Dynamic Module Loading and Execution
            const mainFilePath = path.join(requestedModuleRootPath, entry.Structure.Main);
            const entryPointName = entry['Entry Point'];

            if (entryPointName) {
                try {
                    const importedFile = await import(mainFilePath);
                     // Use original name to get the export
                    const moduleObject = importedFile[originalName];
                    if (!moduleObject) throw new Error(`Could not find exported object "${originalName}" in ${entry.Structure.Main}`);

                    const entryPointFunction = moduleObject?.[entryPointName];

                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderLight)} Checking for Module Environment Data in "${originalName}"...`);
                    const moduleEnv = parsedData['Module Environment'];
                    if (moduleEnv && Object.keys(moduleEnv).length > 0) {
                         Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderLight)} Found Module Environment for "${originalName}". Attaching variables...`);
                         moduleObject.config = {}; // Initialize config object
                         for (const key in moduleEnv) {
                             moduleObject.config[key] = moduleEnv[key];
                             Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderLight)}   - Attached: ${key} = ${moduleEnv[key]}`);
                         }
                    }

                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Attempting to load and execute entry point for "${originalName}"...`);
                    if (typeof entryPointFunction === 'function') {
                        Hexley.modules[originalName] = moduleObject; // Use original name for HGO modules object
                        await entryPointFunction.call(moduleObject, Hexley);
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Successfully executed entry point "${entryPointName}" for module "${originalName}".`);
                        if(resourceStatus) {
                             resourceStatus.isLoaded = true;
                             Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Updated HGO status for module "${originalName}" to isLoaded: true.`);
                        }
                    } else {
                        throw new Error(`Entry point "${entryPointName}" is not a function in module "${originalName}".`);
                    }
                } catch (executionError: any) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', Hexley.frameworks.aurora.tintRed)} An error occurred while initializing module "${originalName}": ${executionError.message}`);
                    // Log stack trace if available and in debug mode
                    if (Hexley.debugMode && executionError.stack) {
                        Hexley.log(executionError.stack);
                    }

                    if (Hexley.resources.framework.registry.isLoaded) {
                        await Hexley.frameworks.registry.removeFromRegistry(Hexley, originalName);
                    }
                    if (Hexley.resources.framework.version.isLoaded) {
                        await Hexley.frameworks.version.removeVersionEntry(Hexley, originalName);
                    }
                    return false; // Return failure
                }
            } else {
                 Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', Hexley.frameworks.aurora.tintYellow)} Module "${originalName}" has no entry point defined. Skipping execution.`);
                 // Consider it loaded if there's no entry point to fail
                 if(resourceStatus) resourceStatus.isLoaded = true;
            }

            // Recursive Sub-Module Loading
            for (const key in entry.Structure) {
                if (key !== 'Main') {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad/subModuleLoad]', this.loaderLight)} Found sub-module "${key}" for "${originalName}". Sending new load request...`);
                    const relativePlistPath = entry.Structure[key];
                    const subModulePlistPath = path.join(requestedModuleRootPath, relativePlistPath!);
                    await this.loadRequest(Hexley, subModulePlistPath); // Recursive call
                }
            }

            // Slash Command Registration Logic
            const canInit = entry.Abilities?.canInitSlashCommands;
            const hasInitted = entry.Settings?.hasPreviousInit;
            if (Hexley.resources.framework.discord.isLoaded && usesDiscord && canInit && !hasInitted && entry.Commands) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${originalName}" requires initial slash command registration.`);
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
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Updated hasPreviousInit flag in Info.plist for ${originalName}`);
                }
            } else if (Hexley.resources.framework.discord.isLoaded && usesDiscord && canInit && hasInitted) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${originalName}" has already initialized its slash commands.`);
            }

            // Bin Support Check
            if (entry.Settings?.binSupport === true) {
                 Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${originalName}" reports binSupport.`);
                await this._loadBinSupportCommands(Hexley, requestedModuleRootPath, originalName);
            }
             Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', this.loaderColor)} Module "${originalName}" loaded successfully.`);

            return true;
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleModuleLoad]', Hexley.frameworks.aurora.tintRed)} Error processing module load request for (${plistPath}): ${error.message}`);
             // Log stack trace if available and in debug mode
             if (Hexley.debugMode && error.stack) {
                 Hexley.log(error.stack);
             }

             // Cleanup
             if (Hexley.resources.framework.registry!.isLoaded) {
                 await Hexley.frameworks.registry.removeFromRegistry(Hexley, plistPath);
             }
             if (Hexley.resources.framework.version!.isLoaded) {
                 await Hexley.frameworks.version.removeVersionEntry(Hexley, plistPath);
             }
            return false;
        }
    },

    async _handleDriverLoad(Hexley: any, plistPath: string, driverName: string): Promise<boolean> {
        try {
            const requestedDriverRootPath = path.dirname(plistPath);
            const fileContent = fs.readFileSync(plistPath, 'utf8');
            const parsedData = plist.parse(fileContent) as unknown as DriverPlist;
            const originalName = parsedData['Driver Name'];
            if (!originalName) throw new Error(`Plist missing 'Driver Name': ${plistPath}`);
            
            // Construct entry object using Registry's EntryInfo interface
            const entry: EntryInfo = {
                'Name': originalName,
                'Type': 'Driver',
                'Driver Type': parsedData['Driver Type'],
                'Description': parsedData['Driver Description'],
                'Identifier': parsedData['Driver Identifier'],
                'Version': parsedData['Driver Version'],
                'Structure': parsedData['Driver Structure'],
                'Entry Point': parsedData['Driver Entry']
            };

            // Ensure HGO entry exists
            const normalizedName = this._normalizeName(entry.Name, 'driver');
            if (!Hexley.resources.driver[normalizedName]) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderLight)} Dynamically creating HGO entry for driver "${originalName}".`);
                Hexley.resources.driver[normalizedName] = { wantLoad: true, isLoaded: false };
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderLight)} Entry for driver "${originalName}" already exists in the HGO.`);
            }

            const resourceStatus = Hexley.resources.driver[normalizedName];
            if (resourceStatus) {
                if (!resourceStatus.wantLoad) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderColor)} Driver "${entry.Name}" is disabled via HGO. Skipping.`);
                    return true;
                }
                if (resourceStatus.isLoaded) {
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderColor)} Driver "${entry.Name}" is already loaded. Skipping.`);
                    return true;
                }
            }

            // Add to the registry
            if (Hexley.resources.framework.registry.isLoaded) {
                await Hexley.frameworks.registry.addToRegistry(Hexley, entry);
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderColor)} Cannot add to The Registry, it seems to not be loaded.`);
            }

            const mainFilePath = path.join(requestedDriverRootPath, entry.Structure.Main);
            const entryObjectName = entry.Name;
            const initializerName = entry['Entry Point']; // Drivers also have an init entry point

            if (entryObjectName && initializerName) {
                const importedFile = await import(mainFilePath);
                const driverObject = importedFile[originalName];
                if (!driverObject) {
                    throw new Error(`Could not find exported object "${originalName}" in ${entry.Structure.Main}`);
                } else {
                    Hexley.drivers = Hexley.drivers || {};
                    Hexley.drivers[originalName] = driverObject; // Use original name
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderColor)} Successfully loaded driver object "${originalName}".`);

                    // Call the driver's initializer if it exists
                    if (typeof driverObject[initializerName] === 'function') {
                        await driverObject[initializerName](Hexley); // Initialize the driver
                            if(resourceStatus) {
                                resourceStatus.isLoaded = true; // Update HGO status AFTER successful init
                                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderColor)} Updated HGO status for driver "${originalName}" to isLoaded: true.`);
                        }
                    } else {
                        Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', Hexley.frameworks.aurora.tintYellow)} Warning: Initializer function "${initializerName}" not found for driver "${originalName}".`);
                        // Consider it loaded if the object exists but no init needed
                        if(resourceStatus) resourceStatus.isLoaded = true;
                    }
                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderColor)} Driver "${originalName}" loaded successfully.`);
                    return true; // Return success after potential initialization
                }
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', this.loaderColor)} Error: Missing 'Driver Name' or 'Driver Entry' in plist for ${driverName}.`);
            }

            return false; // Return failure if object/initializer is missing
        } catch (error: any) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[loaderFramework/_handleDriverLoad]', Hexley.frameworks.aurora.tintRed)} Error processing driver load request for ${plistPath}: ${error.message}`);
            if (Hexley.debugMode && error.stack) {
                Hexley.log(error.stack);
            }
            // Cleanup
            if (Hexley.resources.framework.registry!.isLoaded) {
                await Hexley.frameworks.registry.removeFromRegistry(Hexley, plistPath);
            }
            if (Hexley.resources.framework.version!.isLoaded) {
                await Hexley.frameworks.version.removeVersionEntry(Hexley, plistPath);
            }
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
