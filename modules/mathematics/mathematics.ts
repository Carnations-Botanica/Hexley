
/**
 * The globally accessible module object.
 */
export const mathematics = {

    // Module Logging Color
    moduleColor: "#e26d5c",

    // Define the config object so TypeScript knows it exists.
    config: {} as { [key: string]: any },

    /**
     * Main Entry Point for the Mathematics module.
     * @param {any} Hexley - The main Hexley global object.
     */
    mathematicsInit(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[mathematics/mathematicsInit]', this.moduleColor)} Initializing verbose Module...`);
        
        // Accessing the config variable
        // const channelId = Hexley.modules.mathematics.config.MATHEMATICS_CHANNEL_ID; // This works if you don't want to define config as an object of `this`
        const channelId = this.config.MATHEMATICS_CHANNEL_ID; // Throws error in VSC without a config obj, but both work
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[mathematics/mathematicsInit]', this.moduleColor)} Mathematics channel ID is set to: ${channelId}`);

        Hexley.log(`${Hexley.frameworks.aurora.colorText('[mathematics/mathematicsInit]', this.moduleColor)} Initialized Mathematics Module successfully!`);
    },

};
