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
     * Initializes the HexShell Framework.
     * @param {any} Hexley - The main Hexley global object.
     */
    initializeShell(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexShellFramework/initializeShell]', this.frameworkColor)} Initializing...`);

        this.historyPath = path.join(Hexley.filesystemUserDir, '.hshistory');
        // Load history if it exists
        if (fs.existsSync(this.historyPath)) {
            const historyData = fs.readFileSync(this.historyPath, 'utf8');
            this.history = historyData.split('\n').filter(line => line);
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

        Hexley.log(`${Hexley.frameworks.aurora.colorText('[hexShellFramework/initializeShell]', this.frameworkColor)} Initialized! HexShell Framework is now ready.`);
    },

    /**
     * Saves the command history to the .hshistory file.
     */
    _saveHistory() {
        if (this.history.length > 50) {
            this.history = this.history.slice(this.history.length - 50);
        }
        fs.writeFileSync(this.historyPath, this.history.join('\n'));
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
                this.history.push(input);
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
     * Internal function to load a .bud file as a module.
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
        
        Hexley.core.emit('hexshell.commandExecuted');
        this.rl?.prompt();
    },

    /**
     * Gracefully shuts down the application.
     * @param {any} Hexley - The main Hexley global object.
     */
    async shutdownGracefully(Hexley: any) {
        console.log("\nReceived shutdown signal.");

        if (Hexley.discordLoaded) {
            await Hexley.frameworks.discord.client.destroy()
                .then(() => {
                    console.log("Discord client successfully disconnected.");
                    process.exit(0);
                })
                .catch((error: any) => {
                    console.error("Error while disconnecting Discord client:", error);
                    process.exit(1);
                });
        } else {
            process.exit(0);
        }
    }

};