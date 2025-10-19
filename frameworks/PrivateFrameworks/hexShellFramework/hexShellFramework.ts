import fs from 'fs';
import path from 'path';
import readline from 'readline';

export const hexShellFramework = {
    // Framework Logging Color
    frameworkColor: "#ED3931",

    // Shell state
    shutdownConfirmed: false,
    rl: null as readline.Interface | null,
    commandMap: new Map<string, string>(),
    history: [] as string[],
    historyPath: '',

    /**
     * Internal function to load a .bud file from a module.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} commandName - The name of the command to load.
     * @returns {Promise<any | null>} The loaded module or null on error.
     */
    async _loadBudModule(Hexley: any, commandName: string): Promise<any | null> {
        const commandPath = this.commandMap.get(commandName) as string;
        const tempFilePath = path.join(Hexley.filesystemRootDir, 'tmp', `${commandName}-${Date.now()}.ts`);
        
        try {
            const fileContent = fs.readFileSync(commandPath, 'utf8');
            fs.writeFileSync(tempFilePath, fileContent);
            return await import(tempFilePath);
        } catch (error) {
            return null;
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }

    },

    /**
     * Internal function to execute a .bud file.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} commandName - The name of the command to execute.
     * @param {string[]} args - The arguments to pass to the command.
     */
    async _runBudExecutable(Hexley: any, commandName: string, args: string[]) {
        const commandPath = this.commandMap.get(commandName) as string;
        const tempFilePath = path.join(Hexley.filesystemRootDir, 'tmp', `${commandName}-${Date.now()}.ts`);
        
        try {
            const fileContent = fs.readFileSync(commandPath, 'utf8');
            fs.writeFileSync(tempFilePath, fileContent);

            const commandModule = await import(tempFilePath);
            const commandObject = commandModule[commandName];

            if (commandObject && typeof commandObject.main === 'function') {
                await commandObject.main(Hexley, args);
            } else {
                console.log(`Error: The .bud file for '${commandName}' is not a valid command.`);
            }
        } catch (error: any) {
            console.log(`Error: The command '${commandName}' failed to execute: ${error.message}`);
        } finally {
            // Clean up the temporary file
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }

    },

    /**
     * Saves the command history to the .hshistory file.
     */
    _saveHistory() {
        while (this.history.length > 50) {
            this.history.pop();
        }
        const historyToSave = [...this.history].reverse();
        fs.writeFileSync(this.historyPath, historyToSave.join('\n'));
    },

    /**
     * The completer function for the readline interface.
     * @param {any} Hexley - The main Hexley global object, passed via bind.
     * @param {string} line - The current line of input.
     * @returns {[string[], string]} An array of completions and the part of the line being completed.
     */
    _completer(Hexley: any, line: string): [string[], string] {
        const parts = line.split(' ');
        const currentPart = parts[parts.length - 1] || '';
        
        let hits: string[] = [];

        // If it's the first word or the line is empty, complete from commands
        if (parts.length <= 1) {
            const commands = [...this.commandMap.keys()];
            hits = commands.filter((c) => c.startsWith(currentPart));
        } 
        // Otherwise, complete from file system
        else {
            const dirContents = Hexley.frameworks.filesystem.readDirectory(Hexley, Hexley.filesystemCWDir, true);
            if (dirContents) {
                const names = dirContents.map((item: { name: string; }) => item.name);
                hits = names.filter((name: string) => name.startsWith(currentPart));
            }
        }
        
        return [hits, currentPart];
    },

    /**
     * Initializes the HexShell Framework.
     * @param {any} Hexley - The main Hexley global object.
     */
    initializeShell(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexShellFramework/initializeShell]', this.frameworkColor)} Initializing...`);

        this.historyPath = path.join(Hexley.filesystemUserDir, '.hshistory');

        // Load history if it exists
        if (fs.existsSync(this.historyPath)) {
            const historyData = fs.readFileSync(this.historyPath, 'utf8');

            // FIX: Load the file and reverse it so the most recent command is at index 0. (Comment to be removed in next commit)
            this.history = historyData.split('\n').filter(line => line).reverse();
        }

        // Scan for .bud files and build the command map
        const binPaths = [
            path.join(Hexley.filesystemRootDir, 'bin'),
            path.join(Hexley.filesystemRootDir, 'usr', 'bin')
        ];

        for (const dir of binPaths) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    if (file.endsWith('.bud')) {
                        const commandName = file.replace('.bud', '');
                        this.commandMap.set(commandName, path.join(dir, file));
                    }
                }
            }
        }

        Hexley.resources.framework.hexShell.isLoaded = true;
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexShellFramework/initializeShell]', this.frameworkColor)} Initialized! HexShell Framework is now ready.`);
    },

    /**
     * Creates and configures the readline interface.
     * @param {any} Hexley - The main Hexley global object.
     * @param {readline.ReadLineOptions} options - The options for the readline interface.
     */
    createInterface(Hexley: any, options: readline.ReadLineOptions) {
        options.completer = this._completer.bind(this, Hexley);
        this.rl = readline.createInterface(options);

        // @ts-ignore - Bun's readline type doesn't include history, but it's supported
        this.rl.history = this.history;

        this.rl.on('line', (input) => {
            this.shutdownConfirmed = false; // Reset on new command that wasn't ctrl+c
            if (input) {
                this._saveHistory();
            }
            this.handleInput(Hexley, input);
        });

        this.rl.on('SIGINT', () => {
            if (!this.shutdownConfirmed) {
                console.log('\n(Press Ctrl+C again to exit)');
                this.shutdownConfirmed = true;
                this.rl?.prompt();
                setTimeout(() => {
                    this.shutdownConfirmed = false;
                }, 3000); // Reset after 3 seconds
            } else {
                this.shutdownGracefully(Hexley);
            }
        });

        this.rl.prompt();
    },

    /**
     * Handles user input from the readline interface.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} input - The user's input.
     */
    async handleInput(Hexley: any, input: string) {
        const commands = input.split('&&').map(cmd => cmd.trim()).filter(cmd => cmd);

        for (const commandString of commands) {
            const args = commandString.split(' ');
            const command = args.shift() as string;

            if (this.commandMap.has(command)) {
                await this._runBudExecutable(Hexley, command, args);
            } else {
                console.log(`Error: The command '${command}' was not found.`);
            }
        }
        
        Hexley.core.emit('hexShell.commandExecuted');
        this.rl?.prompt();
    },

    /**
     * Public method to dynamically register a new command file from an external module/framework.
     * @param {string} commandName - The name of the command (e.g., 'status').
     * @param {string} commandPath - The absolute path to the .bud file.
     */
    registerExternalCommand(commandName: string, commandPath: string) {
        if (!this.commandMap.has(commandName)) {
            this.commandMap.set(commandName, commandPath);
        }
    },

    /**
     * Gracefully shuts down the application.
     * @param {any} Hexley - The main Hexley global object.
     */
    async shutdownGracefully(Hexley: any) {
        Hexley.resources.framework.hexShell.isLoaded = false;
        console.log("\n[shutdown] Received shutdown signal. Cleaning up...");

        // Twitch Module Shutdown
        if (Hexley.modules && Hexley.modules.twitch && typeof Hexley.modules.twitch.shutdown === 'function') {
            console.log("[shutdown] Shutting down Twitch module...");
            await Hexley.modules.twitch.shutdown(Hexley);
            console.log("[shutdown] Twitch module shutdown complete.");
        }

        // Discord Module Shutdown
        if (Hexley.resources.framework.discord.isLoaded) {
            console.log("[shutdown] Disconnecting Discord client...");
            await Hexley.frameworks.discord.client.destroy();
            console.log("[shutdown] Discord client successfully disconnected.");
        }

        // Clear Version Data
        if (Hexley.resources.framework.version.isLoaded && typeof Hexley.frameworks.version.shutdown === 'function') {
            console.log("[shutdown] Clearing versionTable.");
            await Hexley.frameworks.version.shutdown(Hexley);
            console.log("[shutdown] Successfully cleared versionTable.");
        }
        
        Hexley.log("[shutdown] All resources shut down gracefully. Goodbye.");
        process.exit(0);
    },

};
