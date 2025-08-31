
/**
 * The globally accessible module object.
 */
export const exampleModule = {

    // Module Logging Color
    moduleColor: "#801c1c",

    /**
     * Main Entry Point for the Example module.
     * @param {typeof Hexley} Hexley - The main Hexley global object.
     */
    exampleModuleStart(Hexley: any) {
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[example/StartExample]', this.moduleColor)} Initializing Example Module...`);
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[example/StartExample]', this.moduleColor)} Initialized Example Module successfully!`);
    
    },

     /**
     * A simple test function that returns a string.
     */
    sayHello(): string {
        return "Hello";
    },

}