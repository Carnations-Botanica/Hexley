/**
 * The globally accessible framework for managing Hexley modules.
 */
export const exampleSubFramework = {
    // Framework Logging Color
    frameworkColor: "#ffc7c8",

    /**
     * Initializes the Registry Framework.
     * @param {any} Hexley - The main Hexley global object.
     */
    initializeSubExample(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[exampleSubFramework/initializeSubExample]', this.frameworkColor)} Initializing...`);

        

        Hexley.log(`${Hexley.frameworks.aurora.colorText('[exampleSubFramework/initializeSubExample]', this.frameworkColor)} Initialized! Example Sub Framework is now loaded into memory.`);
    },
    
};
