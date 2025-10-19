/**
 * Hexley Framework Support Definitions (hexleyFrameworkSupport.ts)
 * Provides dummy/mock objects for Frameworks that are initialized later in the boot process.
 * This ensures the global Hexley object remains type-safe and functional even if a framework is disabled.
 */

// Define an interface for the global loaded version information
export interface versionInfo {
    version: string;
    type: string;
}

// Interface defining the required status structure for frameworks.
export interface coreFrameworkStatus {
    /** Whether the framework is configured to load (from ENV or default setting). */
    wantLoad: boolean;
    /** Whether the framework has finished initialization and is ready for use. */
    isLoaded: boolean;
}

// Interface defining the required status structure for modules.
export interface coreModuleStatus {
    /** Whether the module is configured to load (from ENV or default setting). */
    wantLoad: boolean;
    /** Whether the module has finished initialization and is ready for use. */
    isLoaded: boolean;
}

// Interface defining the required status structure for drivers.
export interface coreDriverStatus {
    /** Whether the driver is configured to load (from ENV or default setting). */
    wantLoad: boolean;
    /** Whether the driver has finished initialization and is ready for use. */
    isLoaded: boolean;
}

// Union type that holds the status objects for all Hexley-managed resources.
export interface resourceStatusContainer {
    // We would put stuff in here, but to prevent clutter, we make this
    // the global Type, we can assign things *in to*
    framework: { [key: string]: coreFrameworkStatus };
    module: { [key: string]: coreModuleStatus };
    driver: { [key: string]: coreDriverStatus };
}

// Specific interface extension for DBFW
export interface databaseFrameworkStatus extends coreFrameworkStatus {
    /** The name of the currently active database driver (e.g., 'Sequelizer' or 'Local'). */
    selectedMode: string | null;
}

/**
 * Dummy Aurora Framework
 */
export const dummyAuroraFramework = {
    colorizeText: (text: string) => text,
    colorText: (text: string, hexColor: string) => text,
    initializeAurora: (Hexley: any) => {
        Hexley.resources.framework.aurora.isLoaded = false; // This should never run, but indicates status if called prematurely
    },

    // Dummy Tint properties (Must be defined to prevent runtime crashes when log is called early)
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

/**
 * Dummy Event Framework
 */
export const dummyEventFramework = {
    emit: (eventName: string, ...args: any[]) => { /* no-op */ },
    on: (eventName: string, listener: (...args: any[]) => void) => { /* no-op */ },
    // Return a Promise that never resolves, preventing deadlock in async waits
    waitForEmit: (eventName: string): Promise<any[]> => new Promise(() => {}), 
    timedEmit: (eventName: string, delayMs: number, ...args: any[]): NodeJS.Timeout => {
        return setTimeout(() => {}, 0); // Returns a dummy timeout
    },
    initializeEvents: (Hexley: any) => { /* no-op */ }
};

// We will add other required dummy frameworks here as needed, based on the structure of Hexley.frameworks.
// Example:
/*
export const dummyDiscordFramework = {
    // ... all discord framework methods and properties for global access even when missing
    // ... and what to do with them, when called, safety net style
};
*/