import path from 'path';

/**
 * The globally accessible module object.
 */
export const hexShell = {

    // Module Logging Color
    moduleColor: "#ED3931",

    /**
     * Main Entry Point for the hexShell module.
     * @param {any} Hexley - The main Hexley global object.
     */
    hexShellInit(Hexley: any) {
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexShell/hexShellInit]', this.moduleColor)} Initializing hexShell...`);

        const shellUsername = Hexley.username;
        const shellHostname = "Hexley";
        const redBright = "#ED3931";
        const gray = "#7E6E62";
        const blue = "#0000FF";

        const getPrompt = () => {
            const displayPath = Hexley.filesystemCWDir.replace(path.join('/home', shellUsername), '~');
            return `${Hexley.frameworks.aurora.colorText(shellUsername, redBright)}@${Hexley.frameworks.aurora.colorText(shellHostname, gray)}:${Hexley.frameworks.aurora.colorText(displayPath, blue)} $ `;
        };
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexShell/hexShellInit]', this.moduleColor)} Initialized hexShell successfully!`);
        Hexley.hexShellLoaded = true;
        
        // Welcome Message
        console.log(``); // Spacing
        console.log(`Welcome to hSh! Interactive Shell for Hexley.`);
        console.log(`Version ${Hexley.versions.hexShell.version} for ${Hexley.platform} ${Hexley.architecture}.`);

        Hexley.frameworks.hexShell.createInterface(Hexley, {
            input: process.stdin,
            output: process.stdout,
            prompt: getPrompt(),
            historySize: 250,
            removeHistoryDuplicates: false
        });

        // Update the prompt after every command
        Hexley.core.on('hexshell.commandExecuted', () => {
            Hexley.frameworks.hexShell.rl.setPrompt(getPrompt());
        });
        
    },

}
