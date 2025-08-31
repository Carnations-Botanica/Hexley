/**
 * The globally accessible framework for managing Hexley modules.
 */
export const exampleFramework = {
    // Framework Logging Color
    frameworkColor: "#cfabff",

    /**
     * Initializes the Registry Framework.
     * @param {any} Hexley - The main Hexley global object.
     */
    initializeExample(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[exampleFramework/initializeExample]', this.frameworkColor)} Initializing...`);


        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[exampleFramework/initializeExample]', this.frameworkColor)} Initialized! Example Framework is now loaded into memory.`);
    },
    
};
