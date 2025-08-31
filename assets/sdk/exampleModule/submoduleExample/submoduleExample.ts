
/**
 * The globally accessible module object.
 */
export const submoduleExample = {

    // Module Logging Color
    moduleColor: "#23db3f",

    /**
     * Main Entry Point for the Example module.
     * @param {typeof Hexley} Hexley - The main Hexley global object.
     */
    submoduleExampleStart(Hexley: any) {
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[submoduleExample/submoduleExampleStart]', this.moduleColor)} Initializing Example Submodule...`);
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[submoduleExample/submoduleExampleStart]', this.moduleColor)} Initialized Example Submodule successfully!`);
    
    },

     /**
     * A simple test function that returns a string.
     */
    sayHello(): string {
        return "Hello";
    },

}