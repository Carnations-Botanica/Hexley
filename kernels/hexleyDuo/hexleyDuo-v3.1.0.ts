/**
 * Hexley Development Software Kit Kernel Object (codenamed hexleyDuo)
 * This kernel object is responsible for bootstrapping the Hexley OS environment.
 * Creation Timestamp: Tue, Oct 07, 2025 at 03:35:00 AM CDT
 * Copyright (c) 2025 - The Carnations Botánica Foundation. All rights reserved.
 */

// Import from Node Modules
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import EventEmitter from 'events';

// Import from Kernel Support Files
import { 
    getCurrentUsername, getHostArchitecture, getHostPlatform,
    folderExists, generateRootUUID, generateRandomHex, generateBuildDate,
    getRandomThreadCount, getElapsedTime, getSystemUptime, getKernelBuildString,
    printCopyright,
} from './hexleyKernelCache.ts';

import {
    type versionInfo,
    type coreFrameworkStatus,
    type coreModuleStatus,
    type coreDriverStatus,
    type resourceStatusContainer,
    type databaseFrameworkStatus,
    dummyAuroraFramework, dummyEventFramework, 
} from './hexleyFrameworkSupport.ts';

// Function to log messages to console and /var/log, kprintf-like
export function log(message: any = "Undefined Log Message") {
    const timestamp = getElapsedTime(Hexley);
    const auroraInstance = Hexley.frameworks.aurora;
    const colorizedTimestamp = auroraInstance.colorText(timestamp, '#ED3131');

    // Handle any input type and split into lines
    let outputString: string;
    if (typeof message === 'object' && message !== null) {
        // Add replacer for BigInt and Cycles
        const cache = new Set(); // Keep track of objects we've seen
        outputString = JSON.stringify(message, (key, value) => {
            if (typeof value === 'bigint') {
                return value.toString(); // Convert BigInts to strings
            }
            if (typeof value === 'object' && value !== null) {
                if (cache.has(value)) {
                    // Circular reference found, replace with a placeholder
                    return '[Circular]'; 
                }
                // Store the object instance in our cache
                cache.add(value);
            }
            return value; // Return other values unchanged
        }, 2); // 2 spaces for indentation
        // cache.clear(); // Technically not needed as cache goes out of scope, but good practice if reused elsewhere
    } else { // Handles strings, numbers, booleans, null, undefined
        outputString = String(message);
    }

    const lines = outputString.split('\n');
    for (const line of lines) {
        const formattedLine = `${colorizedTimestamp} ${line}`;
        
        if (Hexley.resources.module.hexShell!.isLoaded) {
            // When shell is active, it handles console output via readline, so we can only append logs to the sessionFile.
            fs.appendFileSync(Hexley.sessionLogFile, `${formattedLine}\n`);
        } else {
            // Before shell is active, log directly to the console and file if available.
            console.log(formattedLine);
            if (Hexley.resources.framework.filesystem!.isLoaded) {
                fs.appendFileSync(Hexley.sessionLogFile, `${formattedLine}\n`);
            }
        }
    }
}

// Hexley Global Object - The HGO provies a globally accessible object with all required details
export const Hexley = {
    // Initial Configuration
    startTime: Date.now(), // As early as we can we want this
    startTimeArray: process.hrtime(),
    databaseMode: "Sequelizer", // Framework supports "Local" or "Sequelizer" modes, define in your .env!
    hideLogInShell: false, // Modifies Hexley.log() behaviour
    frameworkDebug: false, // Allow frameworks to console.log debug messages
    moduleDebug: false, // Allow modules to console.log debug messages
    driverDebug: false, // Allow drivers to console.log debug messages
    debugMode: false, // Automatically set by detection code, do not manually change
    wantDebug: false, // This can be set to disable debug level logs, even in internal
    buildType: "",
    hexBuildDate: "",
    username: "",
    rootUUID: "",
    platform: "",
    architecture: "",
    timeSinceBoot: 0n,
    cpuThreadPanic: 0,
    kernelString: "",
    cpuCallerHex: "",
    frameworksLoadedCount: 0,
    modulesLoadedCount: 0,
    driversLoadedCount: 0,

    // Global centralized Resource information Container
    resources: {
        framework: {
            aurora: { wantLoad: true, isLoaded: false } as coreFrameworkStatus,
            database: { wantLoad: true, isLoaded: false, selectedMode: null } as databaseFrameworkStatus,
            endpoint: { wantLoad: true, isLoaded: false } as coreFrameworkStatus,
            event: { wantLoad: true, isLoaded: false } as coreFrameworkStatus,
            filesystem: { wantLoad: true, isLoaded: false } as coreFrameworkStatus,
            firewall: { wantLoad: true, isLoaded: false } as coreFrameworkStatus,
            hexShell: { wantLoad: true, isLoaded: false } as coreFrameworkStatus,
            loader: { wantLoad: true, isLoaded: false } as coreFrameworkStatus,
            registry: { wantLoad: true, isLoaded: false } as coreFrameworkStatus,
            version: { wantLoad: true, isLoaded: false } as coreFrameworkStatus,
        },

        module: {
            hexShell: { wantLoad: false, isLoaded: false } as coreModuleStatus,
        },

        driver: {
            database: { wantLoad: false, isLoaded: false } as coreDriverStatus,
            local: { wantLoad: false, isLoaded: false } as coreDriverStatus,
            sequelizer: { wantLoad: false, isLoaded: false } as coreDriverStatus,
        },

    } as resourceStatusContainer,

    // Provided "Kernel" Functions
    log: log,
    folderExists: folderExists,
    getSystemUptime: getSystemUptime,
    printCopyright: printCopyright,
    getElapsedTime: getElapsedTime,
    getHostPlatform: getHostPlatform,
    generateRootUUID: generateRootUUID,
    generateRandomHex: generateRandomHex,
    generateBuildDate: generateBuildDate,
    getCurrentUsername: getCurrentUsername,
    getHostArchitecture: getHostArchitecture,
    getKernelBuildString: getKernelBuildString,
    getRandomThreadCount: getRandomThreadCount,

    // Probe-able paths from Hexley
    workingDir: process.cwd(),
    kernelsRootPath: '',
    frameworksRootPath: '',
    privateFrameworksRootPath: '',
    publicFrameworksRootPath: '',
    modulesRootPath: '',
    driversRootPath: '',
    filesystemRootDir: '',
    filesystemUserDir: '',
    filesystemCWDir: '',
    databaseLocalDir: '',
    sessionLogFile: '',

    // Globally accessible runtime data
    core: new EventEmitter(), // We'll be using eventFramework later in "userspace"

    database: {
    } as { [key: string]: any }, // Create the database interface

    versions: { 
        'hexleyDuo': { version: '3.1.0', type: 'Kernel' } // Set the major version, minor later by plist
    } as { [key: string]: versionInfo }, // This is what versionInfo is for, as a container

    vfsStructure: {
        // Populated later by the filesystemFramework!
    },

    // Access to loaded resources exported functions
    frameworks: {
        aurora: dummyAuroraFramework, // These are added by default,
        event: dummyEventFramework, // as they are used internally right away!
        filesystem: null as any, // Private Framework definition
        hexShell: null as any, // Internal Shell Environment
    } as { [key: string]: any }, // but support adding more entries!

    modules: {
        hexShell: null as any, // hexShell, even as a module, is internally defined!
    } as { [key: string]: any },

    drivers: {
        // simply allows adding entries, none required for the OS to boot.
    } as { [key: string]: any },

};

// Early Boot Process
dotenv.config({ quiet: true });
Hexley.log(`hexleyDuo init`);
Hexley.log(`time at strapping is ${Hexley.startTime}`);
Hexley.hexBuildDate = generateBuildDate();
Hexley.log(`Hexley build date ${Hexley.hexBuildDate}`);
const debugModeRaw = process.env.DEBUG_MODE || "FALSE";
Hexley.debugMode = debugModeRaw.toUpperCase() === "TRUE";
Hexley.log(`setting property debugMode: ${Hexley.debugMode}`);
Hexley.buildType = Hexley.debugMode ? "DEVELOPMENT" : "RELEASE";
Hexley.log(`setting property buildType: ${Hexley.buildType}`);
const internalFilePath = path.join(Hexley.workingDir, '.internal');
if (fs.existsSync(internalFilePath)) {
    Hexley.log("'.internal' file found. Forcing INTERNAL build type.");
    Hexley.debugMode = true;
    Hexley.buildType = "INTERNAL";
    Hexley.log(`updated property debugMode: ${Hexley.debugMode}`);
    Hexley.log(`updated property buildType: ${Hexley.buildType}`);
}
Hexley.username = getCurrentUsername();
Hexley.rootUUID = generateRootUUID();
Hexley.platform = getHostPlatform();
Hexley.architecture = getHostArchitecture();
Hexley.timeSinceBoot = getSystemUptime(Hexley);
Hexley.cpuThreadPanic = getRandomThreadCount();
Hexley.cpuCallerHex = generateRandomHex();
Hexley.kernelString = getKernelBuildString(Hexley);
Hexley.workingDir = process.cwd();
Hexley.kernelsRootPath = path.join(Hexley.workingDir, "kernels/");
Hexley.frameworksRootPath = path.join(Hexley.workingDir, "frameworks/");
Hexley.privateFrameworksRootPath = path.join(Hexley.frameworksRootPath, "PrivateFrameworks/");
Hexley.publicFrameworksRootPath = path.join(Hexley.frameworksRootPath, "PublicFrameworks/");
Hexley.modulesRootPath = path.join(Hexley.workingDir, "modules/");
Hexley.driversRootPath = path.join(Hexley.workingDir, "drivers/");
if (Hexley.debugMode && Hexley.wantDebug) {
    Hexley.log(`[hexleyCore/Dbg] Hexley.username is: ${Hexley.username}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.rootUUID is: ${Hexley.rootUUID}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.platform is: ${Hexley.platform}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.architecture is: ${Hexley.architecture}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.timeSinceBoot is: ${Hexley.timeSinceBoot}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.cpuThreadPanic is: ${Hexley.cpuThreadPanic}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.cpuCallerHex is: ${Hexley.cpuCallerHex}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.kernelString is: ${Hexley.kernelString}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.workingDir is: ${Hexley.workingDir}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.kernelsRootPath is: ${Hexley.kernelsRootPath}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.frameworksRootPath is: ${Hexley.frameworksRootPath}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.privateFrameworksRootPath is: ${Hexley.privateFrameworksRootPath}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.publicFrameworksRootPath is: ${Hexley.publicFrameworksRootPath}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.modulesRootPath is: ${Hexley.modulesRootPath}`);
    Hexley.log(`[hexleyCore/Dbg] Hexley.driversRootPath is: ${Hexley.driversRootPath}`);
}
Hexley.log(`root device uuid is: ${Hexley.rootUUID}`);
Hexley.log(`[hexleyCore] ${Hexley.kernelString}`);
Hexley.printCopyright(Hexley);
Hexley.log(`Kernel hexleyDuo successfully initialized`);

// Event Framework Initialization Logic
if (Hexley.resources.framework.event!.wantLoad) {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Event framework...`);
    const { eventFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'eventFramework/eventFramework.ts'));
    Hexley.frameworks.event = eventFramework;
    await Hexley.frameworks.event.initializeEvents(Hexley);
    if (Hexley.resources.framework.event!.isLoaded && Hexley.wantDebug) {
        // This section is a test run of the Hexley XPC solution, using eventFramework we can send out global notifications to the system
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Simulating a kernel event...`);
    
        // Define the listener using the eventFramework's API
        // We use the promise-based waitForEmit to ensure the listener is active *before* emitting.
        const listenerPromise = Hexley.frameworks.event.waitForEmit('kernel.simulated.test');
    
        // Emit the event immediately afterwards (or after a slight delay if needed, 
        // but immediate is fine for testing if listener is attached first).
        Hexley.frameworks.event.emit(
            'kernel.simulated.test',
            Hexley.rootUUID,
            Hexley.timeSinceBoot.toString(),
            true
        );
    
        // Await the listener promise to confirm reception and execute the log block
        // Note: This must be in an async function or block of code, which the kernel is.
        await listenerPromise.then(([uuid, uptime, status]: [string, string, boolean]) => {
            const color = Hexley.frameworks.aurora.tintGray;
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', color)} Success: Event 'kernel.simulated.test' received!`);
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', color)}   -> UUID: ${uuid as any}`);
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', color)}   -> Uptime: ${uptime as any} nanoseconds`);
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', color)}   -> Status: ${status as any}`);
        });
        
        // We also test the "no listeners" log here if we emit an event that nothing is actively listening for, before this emit takes place
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Emitting an event with no previously registered listeners...`);
        Hexley.frameworks.event.emit('kernel.unhandled.test', 'data');
    } else {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintRed)} Event Framework not loaded. Skipping simulation.`);
    }
} else {
    // If the real framework is disabled, we still mark the status as loaded since the core EventEmitter is always available.
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Event support is disabled. Falling back to core EventEmitter.`);
    Hexley.resources.framework.event!.isLoaded = true;
}

// Aurora Framework Initialization Logic
if (Hexley.resources.framework.aurora!.wantLoad) {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Aurora framework...`);
    const { auroraFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'auroraFramework/auroraFramework.ts'));
    Hexley.frameworks.aurora = auroraFramework;
    await Hexley.frameworks.aurora.initializeAurora(Hexley);
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Test]', Hexley.frameworks.aurora.tintRedBright)} Aurora loaded successfully! Console output is now colorized.`);
} else {
    // Since the actual framework is disabled, we mark the dummy as loaded to not fail on requests.
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Aurora support is disabled. Console output will not be colorized.`);
    Hexley.resources.framework.aurora!.isLoaded = true;
}

// Let's init the filesystem
Hexley.log(`first stage config complete!`);
Hexley.log(`initializing mass storage`);
Hexley.log(`trying system partition mount from device /dev/vfs`);
if (Hexley.resources.framework.filesystem!.wantLoad) {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Filesystem framework...`);
    const { filesystemFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'filesystemFramework/filesystemFramework.ts'));
    Hexley.frameworks.filesystem = filesystemFramework;
    await Hexley.frameworks.filesystem.initializeFilesystem(Hexley);
    
    // Guarantee isLoaded is set in the kernel after initialization resolves.
    Hexley.resources.framework.filesystem!.isLoaded = true; 
    
    Hexley.log(`mount successful`);
    
    if (Hexley.debugMode && Hexley.wantDebug && Hexley.databaseMode === "Local") {
        Hexley.databaseLocalDir = path.join(Hexley.filesystemRootDir, 'var', 'db.json');
        Hexley.log(`[hexleyCore/Dbg] Hexley.databaseLocalDir is: ${Hexley.databaseLocalDir}`);
    }

    // Filesystem Debug Block
    if (Hexley.debugMode && Hexley.resources.framework.filesystem?.isLoaded && Hexley.wantDebug) {
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} === Filesystem Debug Dump ===`);
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - Root Directory: ${Hexley.filesystemRootDir}`);
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - User Directory: ${Hexley.filesystemUserDir}`);
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - VFS Environment Current Path: ${Hexley.filesystemCWDir}`);
        // log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - VFS Structure: ${JSON.stringify(Hexley.vfsStructure, null, 2)}`);
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} === Filesystem Info Dumped! ===`);
    }

} else {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Filesystem support is disabled. System will run in memory only.`);
}

// Database Framework Initialization Logic
if (Hexley.resources.framework.database!.wantLoad) {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Database framework...`);
    
    // Check if the filesystem has loaded (required to know where the local database file is)
    if (!Hexley.resources.framework.filesystem!.isLoaded) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintRed)} ERROR: Cannot load Database Framework. Filesystem is not ready.`);
    } else {
        const { databaseFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'databaseFramework/databaseFramework.ts'));
        Hexley.frameworks.database = databaseFramework;
        await Hexley.frameworks.database.initializeDatabaseConnection(Hexley); 
        Hexley.resources.framework.database!.isLoaded = true;
    }
} else {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Database support is disabled. Modules and Frameworks requiring database access may not work correctly.`);
}

// Version Framework Initialization Logic
if (Hexley.resources.framework.version!.wantLoad) {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Version framework...`);
    const { versionFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'versionFramework/versionFramework.ts'));
    Hexley.frameworks.version = versionFramework;
    await Hexley.frameworks.version.initializeVersionFramework(Hexley);
    Hexley.resources.framework.version!.isLoaded = true;
} else {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Version support is disabled. Version tracking will be unavailable.`);
}

// We'll require The Registry's framework to be loaded in before continuing
if (Hexley.resources.framework.registry!.wantLoad) {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading The Registry...`);
    const { registryFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'registryFramework/registryFramework.ts'));
    Hexley.frameworks.registry = registryFramework;
    await Hexley.frameworks.registry.initializeRegistry(Hexley);
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/registration]', Hexley.frameworks.aurora.tintGray)} Beginning sequential registration of core components...`);
    const registry = Hexley.frameworks.registry;
    await registry.addEntryByPlist(Hexley, path.join(Hexley.kernelsRootPath, 'hexleyDuo', 'info.plist'));
    await registry.addEntryByPlist(Hexley, path.join(Hexley.privateFrameworksRootPath, 'eventFramework', 'info.plist'));
    if (Hexley.resources.framework.aurora!.isLoaded) {
        await registry.addEntryByPlist(Hexley, path.join(Hexley.privateFrameworksRootPath, 'auroraFramework', 'info.plist'));
    }
    if (Hexley.resources.framework.filesystem!.isLoaded) {
        await registry.addEntryByPlist(Hexley, path.join(Hexley.privateFrameworksRootPath, 'filesystemFramework', 'info.plist'));
    }
    if (Hexley.resources.framework.database!.isLoaded) {
        const mode = (Hexley.resources.framework.database as databaseFrameworkStatus).selectedMode;
        const baseDriverPlistPath = path.join(Hexley.workingDir, 'drivers', `databaseDriver`, `info.plist`);
        const driverPlistPath = path.join(Hexley.workingDir, 'drivers', `${mode!.toLowerCase()}Driver`, `info.plist`);
        await registry.addEntryByPlist(Hexley, path.join(Hexley.privateFrameworksRootPath, 'databaseFramework', 'info.plist'));
        await registry.addEntryByPlist(Hexley, baseDriverPlistPath);
        await registry.addEntryByPlist(Hexley, driverPlistPath);
    }
    if (Hexley.resources.framework.version!.isLoaded) {
        await registry.addEntryByPlist(Hexley, path.join(Hexley.privateFrameworksRootPath, 'versionFramework', 'info.plist'));
    }

    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/registration]', Hexley.frameworks.aurora.tintGray)} Core component registration complete.`);
} else {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} The Registery is disabled. This can be considered a critical error, if issues arise later, this was the cause.`);
}

// Time for the Loader framework itself to get added in
if (Hexley.resources.framework.loader!.wantLoad) {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Loader framework...`);
    const { loaderFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'loaderFramework/loaderFramework.ts'));
    Hexley.frameworks.loader = loaderFramework;
    await Hexley.frameworks.loader.initializeLoader(Hexley);
} else {
    Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loader support is disabled. No 3rd party frameworks or modules will be loaded.`);
}

// Final Boot Process Metrics
const kernelCount = Hexley.frameworks.registry.getKernelsCount();
const kernelWord = kernelCount === 1 ? 'kernel' : 'kernels';
const frameworkCount = Hexley.frameworks.registry.getFrameworksCount();
const frameworkWord = frameworkCount === 1 ? 'framework' : 'frameworks';
const moduleCount = Hexley.frameworks.registry.getModulesCount();
const moduleWord = moduleCount === 1 ? 'module' : 'modules';
const driverCount = Hexley.frameworks.registry.getDriversCount();
const driverWord = driverCount === 1 ? 'driver' : 'drivers';
const totalCount = Hexley.frameworks.registry.getEntryCount();
const verb = moduleCount === 1 ? 'is' : 'are';
const entryWord = totalCount === 1 ? 'entry' : 'entries';

Hexley.log(`${Hexley.frameworks.aurora.colorText(`[hexleyCore]`, Hexley.frameworks.aurora.tintGray)} There ${verb} ${Hexley.frameworks.aurora.colorText(`${moduleCount}`, `#B5FF70`)} ${moduleWord}, ${Hexley.frameworks.aurora.colorText(`${frameworkCount}`, `#B5FF70`)} ${frameworkWord}, ${Hexley.frameworks.aurora.colorText(`${driverCount}`, `#B5FF70`)} ${driverWord}, and ${Hexley.frameworks.aurora.colorText(`${kernelCount}`, `#B5FF70`)} ${kernelWord} in the registry, for a total of ${Hexley.frameworks.aurora.colorText(`${totalCount}`, `#B5FF70`)} ${entryWord}.`);
Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Bootstrapping process complete.`);

// Conditionally drop into hexShell
if (Hexley.resources.framework.hexShell?.isLoaded) {
    Hexley.log(`${Hexley.frameworks.aurora.colorText(`[hexleyCore]`, Hexley.frameworks.aurora.tintGray)} hexShell will now be loaded.`);
    const modulePlistPath = path.join(Hexley.modulesRootPath, 'hexShell', 'info.plist');
    await Hexley.frameworks.registry.addEntryByPlist(Hexley, modulePlistPath);
    const { hexShell } = await import(path.join(Hexley.modulesRootPath, 'hexShell/hexShell.ts'));
    hexShell.hexShellInit(Hexley);
} else {
    Hexley.log(`${Hexley.frameworks.aurora.colorText(`[hexleyCore]`, Hexley.frameworks.aurora.tintGray)} hexShell Framework was not loaded, system will run without user shell.`);
}
