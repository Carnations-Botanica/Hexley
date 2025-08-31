import fs from 'fs';
import os from 'os';
import path from 'path';
import * as dotenv from 'dotenv';
import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import { file, sleep } from 'bun';

// Function to get the current User's Username
function getCurrentUsername() {
    return os.userInfo().username;
}

// Function that gets the CPU architecture
function getHostArchitecture() {
    return os.arch().toUpperCase();
}

// Function that gets the CPU platform
function getHostPlatform() {
    return os.platform().toUpperCase();
}

// Function to check if a folder exists
function folderExists(folderPath: string) {
    return fs.existsSync(folderPath);
}

// Function to generate a root UUID for hexleyCore
function generateRootUUID() {
    return uuidv4();
}

// Function to generate a random Hex value
function generateRandomHex() {
    const hexDigits = '0123456789ABCDEF';
    let hexValue = '0x';
    for (let i = 0; i < 6; i++) {
        hexValue += hexDigits[Math.floor(Math.random() * 16)];
    }
    return hexValue;
}

// Function to get the current date in XNU Kernel Format
function generateBuildDate() {
    const date = new Date();

    // Add 'as const' here
    const options = {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
        year: 'numeric'
    } as const;

    return new Intl.DateTimeFormat('en-US', options).format(date);
}

// Function to randomly choose a thread of the host CPU for a kernel panic
function getRandomThreadCount() {
    const maxThreads = os.cpus().length * 1;

    return Math.floor(Math.random() * (maxThreads + 1));
}

// Function to calculate the elapsed time
function getElapsedTime() {
    const elapsedTime = Date.now() - Hexley.startTime;
    const seconds = Math.floor(elapsedTime / 1000);
    const milliseconds = elapsedTime % 1000;
    return `[${seconds}.${milliseconds.toString().padStart(3, '0')}s]`;
}

// Function to get the elapsed time in nanoseconds
function getElapsedTimeHelper() {
    const [seconds, nanoseconds] = process.hrtime(Hexley.startTimeArray);
    // Convert to total nanoseconds
    return BigInt(seconds) * BigInt(1_000_000_000) + BigInt(nanoseconds);
}

// Function to calculate the elapsed time in nanoseconds
function systemUptime() {
    // Get the elapsed time in nanoseconds from getElapsedTimeHelper
    const elapsedTimeNanoSeconds = getElapsedTimeHelper();

    return `System uptime in nanoseconds: ${elapsedTimeNanoSeconds}`;
}

// Function to generate the kernel build string
function getKernelBuildString(): string {
    const versionInfo = Hexley.versions['hexleyCore'];
    return `Hexley System Version ${versionInfo ? versionInfo.version : 'N/A'}: ${Hexley.hexBuildDate}; ${Hexley.username}:CarnationsInternal/${Hexley.buildType}_${Hexley.architecture}`;
}

// Print the copyright message
function printCopyright() {
    log(`Copyright (c) 2022, 2023, 2024, 2025 - BSD 3-Clause License`);
    console.log(`\t The Carnations Botánica Foundation. All rights reserved.\n`);
}

// Function to log messages to console, kprintf-like
function log(string: string) {
    const timestamp = getElapsedTime();
    const formattedMessage = `${Hexley.frameworks.aurora.colorText(timestamp, '#ED3131')} ${string}`;

    if (Hexley.hexShellLoaded) {
        fs.appendFileSync(Hexley.sessionLogFile, `${formattedMessage}\n`);
    } else {
        console.log(formattedMessage);
        if (Hexley.filesystemLoaded) {
            fs.appendFileSync(Hexley.sessionLogFile, `${formattedMessage}\n`);
        }
    }
}

// Define an interface for the version information
interface VersionInfo {
    version: string;
    type: string;
}

// Dummy Aurora Framework
// This object has the same "shape" as the real one, but its functions do nothing but satisfy the runtime in
// the event the actual Aurora Framework is disabled or not loaded in memory.
const dummyAuroraFramework = {
    // Dummy Functions
    colorizeText: (text: string) => text,
    colorText: (text: string, hexColor: string) => text,
    initializeAurora: (Hexley: any) => {
        Hexley.auroraLoaded = false; // This should never run, but if it does...
    },

    // Dummy Tint properties
    tintRed: "#FFFFFF",
    tintRedBright: "#FFFFFF",
    tintOrange: "#FFFFFF",
    tintYellow: "#FFFFFF",
    tintGreen: "#FFFFFF",
    tintBlue: "#FFFFFF",
    tintIndigo: "#FFFFFF",
    tintViolet: "#FFFFFF",
    tintGray: "#FFFFFF",
    prodTint: "#FFFFFF",
    devTint: "#FFFFFF",
    internalTint: "#FFFFFF",
    rainbowColors: []
};

// Hexley Global Object
export const Hexley = {
    // Base Object Data
    startTime: Date.now(),
    startTimeArray: process.hrtime(),
    filesystemLoad: true, // not a user defined variable
    filesystemLoaded: false,
    registryLoad: true, // not a user defined variable
    registryLoaded: false, //
    loaderLoad: true, // not a user defined variable
    loaderLoaded: false, // 
    versionLoad: true, // not a user defined variable
    versionLoaded: false, //
    auroraLoad: false,
    auroraLoaded: false,
    discordLoad: false,
    discordLoaded: false,
    sequelizerLoad: false,
    sequelizerLoaded: false,
    hexShellLoad: true,
    hexShellLoaded: false,
    hideLogInShell: false,
    architecture: "",
    platform: "",
    buildType: "",
    frameworksLoadedCount: 0,
    modulesLoadedCount: 0,
    cpuThreadPanic: 0,
    timeSinceBoot: "",
    cpuCallerHex: "",
    hexBuildDate: "",
    username: "",
    rootUUID: "",
    kernelString: "",
    versionNumber: "0.0.0",
    debugMode: false,
    core: new EventEmitter(),
    sequelize: null as any,
    database: {} as { [key: string]: any },
    versions: { 
        'hexleyCore': { version: '0.0.0', type: 'Kernel' } 
    } as { [key: string]: VersionInfo },
    vfsStructure: {},

    // Functions
    log: log,
    systemUptime: systemUptime,
    folderExists: folderExists,
    getElapsedTime: getElapsedTime,
    generateRootUUID: generateRootUUID,
    generateRandomHex: generateRandomHex,
    generateBuildDate: generateBuildDate,
    getCurrentUsername: getCurrentUsername,
    getHostArchitecture: getHostArchitecture,
    getKernelBuildString: getKernelBuildString,
    getRandomThreadCount: getRandomThreadCount,

    // Paths
    workingDir: process.cwd(),
    modulesRootPath: '',
    frameworksRootPath: '',
    privateFrameworksRootPath: '',
    publicFrameworksRootPath: '',
    filesystemRootDir: '',
    filesystemUserDir: '',
    filesystemCWDir: '',
    sessionLogFile: '',

    // Containers for loaded resources
    frameworks: {
        aurora: dummyAuroraFramework,
        filesystem: null as any,
        sequelizer: null as any,
        version: null as any,
        registry: null as any,
        loader: null as any,
        discord: null as any,
    } as { [key: string]: any }, // Cast the object to a type that allows any string key
    modules: {} as { [key: string]: any }

};

// Early Boot Process
dotenv.config({ quiet: true });
log(`hexleyCore init`);
Hexley.username = getCurrentUsername();
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.username is: ${Hexley.username}`);
}
Hexley.rootUUID = generateRootUUID();
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.rootUUID is: ${Hexley.rootUUID}`);
}
Hexley.timeSinceBoot = systemUptime();
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.timeSinceBoot is: ${Hexley.timeSinceBoot}`);
}
Hexley.hexBuildDate = generateBuildDate();
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.hexBuildDate is: ${Hexley.hexBuildDate}`);
}
Hexley.cpuCallerHex = generateRandomHex();
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.cpuCallerHex is: ${Hexley.cpuCallerHex}`);
}
Hexley.architecture = getHostArchitecture();
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.architecture is: ${Hexley.architecture}`);
}
Hexley.platform = getHostPlatform();
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.platform is: ${Hexley.platform}`);
}
Hexley.cpuThreadPanic = getRandomThreadCount();
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.cpuThreadPanic is: ${Hexley.cpuThreadPanic}`);
}
const debugModeRaw = process.env.DEBUG_MODE || "FALSE";
Hexley.debugMode = debugModeRaw.toUpperCase() === "TRUE";
const internalFilePath = path.join(Hexley.workingDir, '.internal');
if (fs.existsSync(internalFilePath)) {
    log("'.internal' file found. Forcing debug mode to TRUE.");
    Hexley.debugMode = true;
    Hexley.buildType = "INTERNAL";
}
const hexShellLoadRaw = process.env.HEXSHELL_ENABLED || "FALSE";
Hexley.hexShellLoad = hexShellLoadRaw.toUpperCase() === "TRUE";

if (Hexley.buildType !== "INTERNAL") {
    Hexley.buildType = Hexley.debugMode ? "DEVELOPMENT" : "RELEASE";
}
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.buildType is: ${Hexley.buildType}`);
}
Hexley.kernelString = getKernelBuildString();
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.kernelString is: ${Hexley.kernelString}`);
}
Hexley.modulesRootPath = path.join(Hexley.workingDir, "modules/");
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.modulesRootPath is: ${Hexley.modulesRootPath}`);
}
Hexley.frameworksRootPath = path.join(Hexley.workingDir, "frameworks/");
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.frameworksRootPath is: ${Hexley.frameworksRootPath}`);
}
Hexley.privateFrameworksRootPath = path.join(Hexley.frameworksRootPath, "PrivateFrameworks/");
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.privateFrameworksRootPath is: ${Hexley.privateFrameworksRootPath}`);
}
Hexley.publicFrameworksRootPath = path.join(Hexley.frameworksRootPath, "PublicFrameworks/");
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.publicFrameworksRootPath is: ${Hexley.publicFrameworksRootPath}`);
}

// Automatic Internal & 3rd Party Resource Initialization Map
// Defines scopes and reserved resources only to be init by hexleyCore
const resourcesToScan = [
    {
        name: 'Private Frameworks',
        path: Hexley.privateFrameworksRootPath,
        ignoreList: ['filesystemFramework', 'hexShellFramework', 'auroraFramework', 'discordFramework', 'loaderFramework', 'registryFramework', 'sequelizerFramework', 'versionFramework', '.DS_Store'],
        counter: 'frameworksLoadedCount'
    },
    {
        name: 'Public Frameworks',
        path: Hexley.publicFrameworksRootPath,
        ignoreList: ['.DS_Store'],
        counter: 'frameworksLoadedCount'
    },
    {
        name: 'Modules',
        path: Hexley.modulesRootPath,
        ignoreList: ['hexShell', '.DS_Store'],
        counter: 'modulesLoadedCount'
    }
];

log(`root device uuid is: ${generateRootUUID()}`);
log(`[hexleyCore] ${Hexley.kernelString}`);
printCopyright();
log(`Framework hexleyCore successfully initialized`);

// Filesystem Framework Initialization Logic
log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Filesystem framework...`);
const { filesystemFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'filesystemFramework/filesystemFramework.ts'));
Hexley.frameworks.filesystem = filesystemFramework;
Hexley.frameworks.filesystem.initializeFilesystem(Hexley);

// Conditional hexShell Module Initialization
if (Hexley.hexShellLoad) {

    // HexShell Framework Initialization Logic
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading HexShell framework...`);
    const { hexShellFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'hexShellFramework/hexShellFramework.ts'));
    Hexley.frameworks.hexShell = hexShellFramework;
    await Hexley.frameworks.hexShell.initializeShell(Hexley);

    Hexley.core.once('registryFramework.ready', () => {
        const plistPath = path.join(Hexley.privateFrameworksRootPath, 'hexShellFramework', 'info.plist');
        Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
    });

    Hexley.core.once('versionFramework.ready', () => {
        Hexley.frameworks.version.addVersionEntry(Hexley, 'hexShellFramework', 'Framework', '1.0.0');
    });

} else {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} hexShellFramework is disabled. Continuing...`);
}

// Aurora Framework Initialization Logic
Hexley.auroraLoad = process.env.AURORA_ENABLED === "TRUE";
if (Hexley.auroraLoad) {
    log("[hexleyCore] Loading Aurora framework...");
    const { auroraFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'auroraFramework/auroraFramework.ts'));
    Hexley.frameworks.aurora = auroraFramework;
    Hexley.frameworks.aurora.initializeAurora(Hexley);
} else {
    log("[hexleyCore] Aurora is disabled. Console output will not be colorized.");
    Hexley.auroraLoaded = false;

    // If we're in DEBUG, ensure we can still use log globally without any issues or rewrites.
    if (Hexley.debugMode) {
        log(`${Hexley.frameworks.aurora.colorizeText('[hexleyCore/Dbg]')} ${Hexley.frameworks.aurora.colorText('This is a test of the dummy framework! This message uses references to said Framework.', Hexley.frameworks.aurora.tintGreen)}`);
    }
}

// Sequelizer Framework Initialization Logic
Hexley.sequelizerLoad = process.env.SEQUELIZER_ENABLED === "TRUE";
if (Hexley.sequelizerLoad) {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Sequelizer framework...`);
    const { sequelizerFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'sequelizerFramework/sequelizerFramework.ts'));
    Hexley.frameworks.sequelizer = sequelizerFramework;
    await Hexley.frameworks.sequelizer.initializeSequelizerConnection(Hexley);
    Hexley.sequelizerLoaded = true;
} else {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Sequelizer support is disabled. Modules and Frameworks requiring database access may not work correctly.`);
    Hexley.sequelizerLoaded = false;
} if (Hexley.sequelizerLoad && Hexley.debugMode) {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Beginning database connection debug dump...`);
    const databases = Object.keys(Hexley.database);
    if (databases.length > 0) {
        for (const dbName of databases) {
            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - Found database: "${dbName}"`);
            const sequelizeInstance = Hexley.database[dbName];
            if (sequelizeInstance) {
                const host = sequelizeInstance.options.host;
                const port = sequelizeInstance.options.port;
                const dialect = sequelizeInstance.options.dialect;
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - Host: ${host}`);
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - Port: ${port}`);
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - Dialect: ${dialect}`);

                // Fetch and log tables for this database
                try {
                    const tables = await Hexley.frameworks.sequelizer.getDatabaseTables(Hexley, dbName);
                    if (tables.length > 0) {
                        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - Tables found:`);
                        for (const tableName of tables) {
                            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}       - ${tableName}`);
                        }
                    } else {
                        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - No tables found.`);
                    }
                } catch (error) {
                    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintRed)}     - Error fetching tables: ${error}`);
                }
            }
        }
    } else {
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} No databases found in Hexley.database.`);
    }
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Finished database connection debug dump.`);
}

// Version Framework Initialization Logic
log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Version framework...`)
const { versionFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'versionFramework/versionFramework.ts'))
Hexley.frameworks.version = versionFramework;
await Hexley.frameworks.version.initializeVersionFramework(Hexley); 

// Registry Framework Initialization Logic
log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Registry framework...`);
const { registryFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'registryFramework/registryFramework.ts'));
const plistPath = path.join(Hexley.privateFrameworksRootPath, 'registryFramework', 'info.plist');
Hexley.frameworks.registry = registryFramework;
Hexley.frameworks.registry.initializeRegistry(Hexley);
Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
Hexley.versions['registryFramework'] = { version: '1.0.0', type: 'Framework' };

// Loader Framework Initialization Logic
log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Loader framework...`);
const { loaderFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'loaderFramework/loaderFramework.ts'));
Hexley.frameworks.loader = loaderFramework;
Hexley.frameworks.loader.initializeLoader(Hexley);

// Discord Framework Initialization Logic
const isDiscordEnabled: boolean = process.env.DISCORD_ENABLED === "TRUE";
const guildId: string | undefined = process.env.GUILD_ID;
const token: string | undefined = process.env.DISCORD_TOKEN;
if (isDiscordEnabled) {
    if (!guildId || !token) {
        console.error("[hexleyCore] Fatal: DISCORD_ENABLED is true but GUILD_ID or DISCORD_TOKEN is missing.");
        process.exit(1);
    }

    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Discord support is enabled. Loading Discord framework...`);

    // Import and initialize the framework's IDs
    const { discordFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'discordFramework/discordFramework.ts'));
    Hexley.frameworks.discord = discordFramework;
    Hexley.frameworks.discord.initializeDiscordIds(Hexley);

    // Create a promise that resolves when the 'discord.ready' event is emitted by Hexley
    const discordReadyPromise = new Promise<void>(resolve => {
        Hexley.core.once('discordClient.ready', () => {
            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Core received signal from Discord framework.`);
            Hexley.discordLoaded = true;
            resolve();
        });
    });

    // Start the client initialization (this will run in the background)
    Hexley.frameworks.discord.initializeDiscordClient(Hexley);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Discord client is logging in...`);

    // Wait for the initialization of the Discord Framework to complete before moving on
    await discordReadyPromise;
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Discord framework loaded and initialized successfully.`);

    // We can now safely access the client and guild globally through the Hexley object!
    if (Hexley.debugMode) {
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Client Object: ${Hexley.frameworks.discord.client}`);
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Client User: ${Hexley.frameworks.discord.client?.user?.tag}`);
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Guild Name: ${Hexley.frameworks.discord.guild?.name}`);
    }

} else {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Discord support is disabled. Discord reliant 3rd-Party Modules and Frameworks may not work correctly.`);
    Hexley.discordLoaded = false;
}

// hexleyCore attempt loading modules, frameworks into memory
for (const resourceType of resourcesToScan) {
    let items: string[] = []; // Initialize an empty array
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Loader]', Hexley.frameworks.aurora.tintGray)} Beginning scan for ${resourceType.name}...`);

    if (Hexley.folderExists(resourceType.path)) {
        items = fs.readdirSync(resourceType.path).sort();
    } else {
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Loader]', Hexley.frameworks.aurora.tintGray)} Nothing to load.`);
    }

    for (const itemName of items) {
        const itemPath = path.join(resourceType.path, itemName);
        if (!resourceType.ignoreList.includes(itemName) && fs.lstatSync(itemPath).isDirectory()) {
            try {
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Loader]', Hexley.frameworks.aurora.tintGray)} Found ${resourceType.name.slice(0, -1)}: "${itemName}". Sending load request...`);
                const plistPath = path.join(itemPath, 'info.plist');
                await Hexley.frameworks.loader.loadRequest(Hexley, plistPath);
                (Hexley as any)[resourceType.counter]++;
            } catch (error) {
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Loader]', Hexley.frameworks.aurora.tintGray)} Failed to send load request for ${itemName}`);
                console.error(error);
            }
        }
    }

    const count = (Hexley as any)[resourceType.counter];
    const resourceName = count === 1 ? resourceType.name.slice(0, -1) : resourceType.name;
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Loader]', Hexley.frameworks.aurora.tintGray)} Finished scanning. Found and processed ${count} ${resourceName}.`);
}

// Final Debug Block
let wantDumpDebugBlock = false;
if (Hexley.buildType === "INTERNAL") {
    wantDumpDebugBlock = false; // temporarily disabled for internal devs
}

if (Hexley.debugMode && wantDumpDebugBlock) {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} === Final Debug Dump ===`);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}`); // For spacing

    // Sequelizer Dump
    if (Hexley.sequelizerLoaded) {
        const dbName = process.env.DB_NAME;
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Dumping database entries from "${dbName}"...`);
        try {
            const tables = await Hexley.frameworks.sequelizer.getDatabaseTables(Hexley, dbName);
            if (tables.length > 0) {
                for (const tableName of tables) {
                    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - Table: ${tableName}`);
                    const tableModel = { options: { tableName: tableName } };
                    const entries = await Hexley.frameworks.sequelizer.getTableDefinitionEntries(Hexley, dbName, tableModel);
                    if (entries.length > 0) {
                        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - Entries:`);
                        for (const entry of entries) {
                            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}       - ${JSON.stringify(entry.toJSON())}`);
                        }
                    } else {
                        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - No entries found.`);
                    }
                }
            } else {
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} No tables found in database "${dbName}".`);
            }
        } catch (error) {
            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintRed)} Error dumping tables and entries: ${error}`);
        }
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}`); // For spacing

    }

    // Version Dump
    if (Hexley.versionLoaded) {
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Dumping versions from Hexley.versions...`);
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}`); // For spacing

        const kernels: [string, VersionInfo][] = [];
        const frameworks: [string, VersionInfo][] = [];
        const modules: [string, VersionInfo][] = [];

        for (const [name, data] of Object.entries(Hexley.versions)) {
            if (data.type === 'Kernel') kernels.push([name, data]);
            else if (data.type === 'Framework') frameworks.push([name, data]);
            else if (data.type === 'Module') modules.push([name, data]);
        }

        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   --- Kernels ---`);
        for (const [name, data] of kernels) log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - ${name}: ${data.version}`);

        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   --- Frameworks ---`);
        for (const [name, data] of frameworks) log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - ${name}: ${data.version}`);

        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   --- Modules ---`);
        for (const [name, data] of modules) log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - ${name}: ${data.version}`);
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}`); // For spacing
    }

    // Registry Dump
    if (Hexley.registryLoaded) {
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Dumping all entries from registryFramework...`);
        const registryEntries = Hexley.frameworks.registry.getAllEntries();
        if (registryEntries.length > 0) {
            for (const entry of registryEntries) {
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - Name: ${entry.Name}`);
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - Identifier: ${entry.Identifier}`);
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}     - Version: ${entry.Version}`);
            }
        } else {
            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} No entries found in the registry.`);
        }
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}`); // For spacing
    }

    // Sanity Check Block
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Running Sanity Checks...`);
    let inconsistenciesFound = false;
    const allNames = new Set<string>();

    const dbNames = new Set<string>();
    if (Hexley.sequelizerLoaded) {
        const dbName = process.env.DB_NAME;
        const versionTable = { options: { tableName: 'versionTable' } };
        const dbEntries = await Hexley.frameworks.sequelizer.getTableDefinitionEntries(Hexley, dbName, versionTable);
        dbEntries.forEach((entry: any) => {
            const name = entry.toJSON().name;
            if (name !== 'hexleyCore') {
                dbNames.add(name);
                allNames.add(name);
            }
        });
    }

    const versionNames = new Set<string>();
    if (Hexley.versionLoaded) {
        Object.keys(Hexley.versions).forEach(name => {
            if (name !== 'hexleyCore') {
                versionNames.add(name);
                allNames.add(name);
            }
        });
    }

    const registryNames = new Set<string>();
    if (Hexley.registryLoaded) {
        Hexley.frameworks.registry.getAllEntries().forEach((entry: any) => {
            if (entry.Name !== 'hexleyCore') {
                registryNames.add(entry.Name);
                allNames.add(entry.Name);
            }
        });
    }

    for (const name of allNames) {
        const missingFrom = [];
        if (Hexley.sequelizerLoaded && !dbNames.has(name)) {
            missingFrom.push('database');
        }
        if (Hexley.versionLoaded && !versionNames.has(name)) {
            missingFrom.push('Hexley.versions');
        }
        if (Hexley.registryLoaded && !registryNames.has(name)) {
            missingFrom.push('registry');
        }

        if (missingFrom.length > 0) {
            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintYellow)}   - Sanity Fail: "${name}" is missing from: ${missingFrom.join(', ')}.`);
            inconsistenciesFound = true;
        }
    }

    if (!inconsistenciesFound) {
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGreen)}   - Sanity Check Passed: All resources are consistent.`);
    }
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}`); // For spacing

    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} === End of Final Debug Dump ===`);
}

// Filesystem Debug Block
if (Hexley.debugMode && Hexley.filesystemLoaded && wantDumpDebugBlock) {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} === Filesystem Debug Dump ===`);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - Root Directory: ${Hexley.filesystemRootDir}`);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - User Directory: ${Hexley.filesystemUserDir}`);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - VFS Environment Current Path: ${Hexley.filesystemCWDir}`);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - VFS Structure: ${JSON.stringify(Hexley.vfsStructure, null, 2)}`);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} === End of Filesystem Debug Dump ===`);
}

// Conditional hexShell Module Initialization
if (Hexley.hexShellLoad) {
    const modulePlistPath = path.join(Hexley.modulesRootPath, 'hexShell', 'info.plist');
    await Hexley.frameworks.registry.addEntryByPlist(Hexley, modulePlistPath);
    await Hexley.frameworks.version.addVersionEntry(Hexley, 'hexShell', 'Module', '1.0.0');
    const { hexShell } = await import(path.join(Hexley.modulesRootPath, 'hexShell/hexShell.ts'));

    // Initial Boot Process has wrapped up, lets log out what we've done
    // Get the number of modules and frameworks in the registry
    const moduleCount = Hexley.frameworks.registry.getModulesCount();
    const frameworkCount = Hexley.frameworks.registry.getFrameworksCount();
    const totalCount = Hexley.frameworks.registry.getEntryCount();
    const moduleWord = moduleCount === 1 ? 'module' : 'modules';
    const frameworkWord = frameworkCount === 1 ? 'framework' : 'frameworks';
    const entryWord = totalCount === 1 ? 'entry' : 'entries';
    const verb = moduleCount === 1 ? 'is' : 'are';

    log(`${Hexley.frameworks.aurora.colorText(`[hexleyCore]`, Hexley.frameworks.aurora.tintGray)} There ${verb} ${Hexley.frameworks.aurora.colorText(`${moduleCount}`, `#B5FF70`)} ${moduleWord} and ${Hexley.frameworks.aurora.colorText(`${frameworkCount}`, `#B5FF70`)} ${frameworkWord} in the registry, for a total of ${Hexley.frameworks.aurora.colorText(`${totalCount}`, `#B5FF70`)} ${entryWord}.`);

    hexShell.hexShellInit(Hexley);

} else {

    // Initial Boot Process has wrapped up, lets log out what we've done
    // Get the number of modules and frameworks in the registry
    const moduleCount = Hexley.frameworks.registry.getModulesCount();
    const frameworkCount = Hexley.frameworks.registry.getFrameworksCount();
    const totalCount = Hexley.frameworks.registry.getEntryCount();
    const moduleWord = moduleCount === 1 ? 'module' : 'modules';
    const frameworkWord = frameworkCount === 1 ? 'framework' : 'frameworks';
    const entryWord = totalCount === 1 ? 'entry' : 'entries';
    const verb = totalCount === 1 ? 'is' : 'are';

    log(`${Hexley.frameworks.aurora.colorText(`[hexleyCore]`, Hexley.frameworks.aurora.tintGray)} There ${verb} ${Hexley.frameworks.aurora.colorText(`${moduleCount}`, `#B5FF70`)} ${moduleWord} and ${Hexley.frameworks.aurora.colorText(`${frameworkCount}`, `#B5FF70`)} ${frameworkWord} in the registry, for a total of ${Hexley.frameworks.aurora.colorText(`${totalCount}`, `#B5FF70`)} ${entryWord}.`);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Boot process complete. hexShell is disabled. Continuing...`);
}

// You've reached the end! Enjoy!
