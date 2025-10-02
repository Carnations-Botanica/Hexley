import fs from 'fs';
import os from 'os';
import path from 'path';
import * as dotenv from 'dotenv';
import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';

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
    filesystemLoaded: false, //
    firewallLoad: true, // not a user defined variable
    firewallLoaded: false, //
    endpointLoad: true, // not a user defined variable
    endpointLoaded: false, //
    registryLoad: true, // not a user defined variable
    registryLoaded: false, //
    loaderLoad: true, // not a user defined variable
    loaderLoaded: false, //
    versionLoad: true, // not a user defined variable
    versionLoaded: false, //
    experienceLoad: true, // not a user defined variable
    experienceLoaded: false,
    cooldownLoad: true, // not a user defined variable
    cooldownLoaded: false, //
    auroraLoad: false,
    auroraLoaded: false,
    discordLoad: false,
    discordLoaded: false,
    databaseLoad: false,
    databaseLoaded: false,
    databaseMode: "Local", // Framework supports "Local" or "Sequelizer" modes, define in your .env!
    hexShellLoad: true,
    hexShellLoaded: false,
    hideLogInShell: false,
    driverDebug: false,
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
    versionNumber: "3.0.0",
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
    databaseLocalDir: '',

    // Containers for loaded resources
    frameworks: {
        aurora: dummyAuroraFramework,
        filesystem: null as any,
        database: null as any,
        version: null as any,
        registry: null as any,
        loader: null as any,
        discord: null as any,
    } as { [key: string]: any }, // Cast the object to a type that allows any string key

    modules: {
        hexShell: null as any,
    } as { [key: string]: any }, // Cast the object to a type that allows any string key

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
const databaseModeRaw = process.env.DATABASE_MODE || "Local";
Hexley.databaseMode = databaseModeRaw.charAt(0).toUpperCase() + databaseModeRaw.slice(1).toLowerCase(); // Capitalizes the mode (e.g. local -> Local)
if (Hexley.debugMode) {
    log(`[hexleyCore/Dbg] Hexley.databaseMode is: ${Hexley.databaseMode}`);
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
        ignoreList: ['firewallFramework', 'cooldownFramework', 'experienceFramework', 'endpointFramework', 'filesystemFramework', 'hexShellFramework', 'auroraFramework', 'discordFramework', 'loaderFramework', 'registryFramework', 'databaseFramework', 'versionFramework', '.DS_Store'],
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
await Hexley.frameworks.filesystem.initializeFilesystem(Hexley);
if (Hexley.debugMode && Hexley.databaseMode === "Local") {
    Hexley.databaseLocalDir = path.join(Hexley.filesystemRootDir, 'var', 'db.json');
    log(`[hexleyCore/Dbg] Hexley.databaseLocalDir is: ${Hexley.databaseLocalDir}`);
}

// Database Framework Initialization Logic
Hexley.databaseLoad = process.env.DATABASE_ENABLED === "TRUE";
if (Hexley.databaseLoad) {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Database framework...`);
    const { databaseFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'databaseFramework/databaseFramework.ts'));
    Hexley.frameworks.database = databaseFramework;
    await Hexley.frameworks.database.initializeDatabaseConnection(Hexley);
} else {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Database support is disabled. Modules and Frameworks requiring database access may not work correctly.`);
}

// Database Debug Block
if (Hexley.databaseLoad && Hexley.debugMode) {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Beginning database connection debug dump...`);
    
    try {
        const tables = await Hexley.frameworks.database.getTables();
        
        if (Hexley.databaseMode === 'Sequelizer') {
            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - Mode: Sequelizer`);
            if (tables.length > 0) {
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - Tables: [${tables.join(', ')}]`);
            } else {
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - No tables found in the database.`);
            }
        } else { // Local Mode
            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - Mode: Local`);
            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - File: ${Hexley.databaseLocalDir}`);
            if (tables.length > 0) {
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - Tables: [${tables.join(', ')}]`);
            } else {
                log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - No tables found in the local database file.`);
            }
        }
    } catch (error: any) {
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintRed)} Error during database debug dump: ${error.message}`);
    }

    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Finished database connection debug dump.`);
}

// Firewall Framework Initialization Logic
log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Firewall framework...`);
const { firewallFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'firewallFramework/firewallFramework.ts'));
Hexley.frameworks.firewall = firewallFramework;
await Hexley.frameworks.firewall.initializeFirewall(Hexley);

// Endpoint Framework Initialization Logic
log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Endpoint framework...`);
const { endpointFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'endpointFramework/endpointFramework.ts'));
Hexley.frameworks.endpoint = endpointFramework;
await Hexley.frameworks.endpoint.initializeEndpoint(Hexley);

// Conditional hexShell Module Initialization
if (Hexley.hexShellLoad) {

    // HexShell Framework Initialization Logic
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading HexShell framework...`);
    const { hexShellFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'hexShellFramework/hexShellFramework.ts'));
    Hexley.frameworks.hexShell = hexShellFramework;
    await Hexley.frameworks.hexShell.initializeShell(Hexley);

    Hexley.core.once('registryFramework.ready', async () => {
        const plistPath = path.join(Hexley.privateFrameworksRootPath, 'hexShellFramework', 'info.plist');
        await Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
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
    await Hexley.frameworks.aurora.initializeAurora(Hexley);
} else {
    log("[hexleyCore] Aurora is disabled. Console output will not be colorized.");
    Hexley.auroraLoaded = false;

    // If we're in DEBUG, ensure we can still use log globally without any issues or rewrites.
    if (Hexley.debugMode) {
        log(`${Hexley.frameworks.aurora.colorizeText('[hexleyCore/Dbg]')} ${Hexley.frameworks.aurora.colorText('This is a test of the dummy framework! This message uses references to said Framework.', Hexley.frameworks.aurora.tintGreen)}`);
    }
}

// Version Framework Initialization Logic
log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Version framework...`)
const { versionFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'versionFramework/versionFramework.ts'))
Hexley.frameworks.version = versionFramework;
await Hexley.frameworks.version.initializeVersionFramework(Hexley);

// Experience Framework Initialization Logic
log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Experience framework...`)
const { experienceFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'experienceFramework/experienceFramework.ts'))
Hexley.frameworks.experience = experienceFramework;
await Hexley.frameworks.experience.initExperience(Hexley); 
Hexley.experienceLoaded = true;

// Cooldown Framework Initialization Logic
log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Cooldown framework...`)
const { cooldownFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'cooldownFramework/cooldownFramework.ts'))
Hexley.frameworks.cooldown = cooldownFramework;
await Hexley.frameworks.cooldown.initCooldownFramework(Hexley); 
Hexley.cooldownLoaded = true;

// Registry Framework Initialization Logic
log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Registry framework...`);
const { registryFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'registryFramework/registryFramework.ts'));
const plistPath = path.join(Hexley.privateFrameworksRootPath, 'registryFramework', 'info.plist');
Hexley.frameworks.registry = registryFramework;
await Hexley.frameworks.registry.initializeRegistry(Hexley);
// Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
// Hexley.versions['registryFramework'] = { version: '1.0.0', type: 'Framework' };

// Loader Framework Initialization Logic
log(`${Hexley.frameworks.aurora.colorText('[hexleyCore]', Hexley.frameworks.aurora.tintGray)} Loading Loader framework...`);
const { loaderFramework } = await import(path.join(Hexley.privateFrameworksRootPath, 'loaderFramework/loaderFramework.ts'));
Hexley.frameworks.loader = loaderFramework;
await Hexley.frameworks.loader.initializeLoader(Hexley);

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
            Hexley.discordLoad = true;
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
    wantDumpDebugBlock = true;
}

// Final Debug Block
if (Hexley.debugMode && wantDumpDebugBlock) {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Beginning final consistency check...`);
    
    // Setup some variables
    const registryEntries = Hexley.frameworks.registry.getAllEntries().map((entry: any) => entry.Name);
    const versionEntries = (await Hexley.frameworks.version.getAllVersionEntries(Hexley)).map((entry: any) => entry.name);
    const registrySet = new Set(registryEntries);
    const versionSet = new Set(versionEntries);
    let issuesFound = false;

    // Check for items in registry but not in versioning
    registryEntries.forEach((name: string) => {
        if (!versionSet.has(name)) {
            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintRed)}   - Discrepancy: "${name}" is in the registry but not in the version table.`);
            issuesFound = true;
        }
    });

    // Check for items in versioning but not in registry
    versionEntries.forEach((name: string) => {
        if (!registrySet.has(name)) {
            log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintRed)}   - Discrepancy: "${name}" is in the version table but not in the registry.`);
            issuesFound = true;
        }
    });

    if (!issuesFound) {
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGreen)}   - All checks passed. Registry and versioning are consistent.`);
    }

    // Dump all database tables if the database is loaded
    if (Hexley.databaseLoaded) {
        const dbName = Hexley.databaseMode === 'Sequelizer' ? process.env.DB_NAME : 'Local JSON';
        log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Dumping database entries from "${dbName}"...`);
        
        const tables = await Hexley.frameworks.database.getTables();
        for (const tableName of tables) {
            log(`${Hexley.frameworks.aurora.colorText(`[hexleyCore/Dbg]`, Hexley.frameworks.aurora.tintGray)}   - Table: ${tableName}`);
            const tableData = await Hexley.frameworks.database.getAll(tableName);
            console.table(tableData);
        }
    }

    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} Finished consistency check.`);
}

// Filesystem Debug Block
if (Hexley.debugMode && Hexley.filesystemLoaded && wantDumpDebugBlock) {
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} === Filesystem Debug Dump ===`);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - Root Directory: ${Hexley.filesystemRootDir}`);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - User Directory: ${Hexley.filesystemUserDir}`);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - VFS Environment Current Path: ${Hexley.filesystemCWDir}`);
    // log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)}   - VFS Structure: ${JSON.stringify(Hexley.vfsStructure, null, 2)}`);
    log(`${Hexley.frameworks.aurora.colorText('[hexleyCore/Dbg]', Hexley.frameworks.aurora.tintGray)} === End of Filesystem Debug Dump ===`);
}

// Conditional hexShell Module Initialization
if (Hexley.hexShellLoad) {
    const modulePlistPath = path.join(Hexley.modulesRootPath, 'hexShell', 'info.plist');
    await Hexley.frameworks.registry.addEntryByPlist(Hexley, modulePlistPath);
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
