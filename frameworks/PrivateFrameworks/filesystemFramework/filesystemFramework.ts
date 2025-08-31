import fs from 'fs';
import path from 'path';

export const filesystemFramework = {
    // Framework Logging Color
    frameworkColor: "#90EE90", // A light green for file operations

    // VFS state
    vfsRootPath: '',
    currentWorkingDirectory: '/',
    vfsStructure: {},

    /**
     * Internal function to create and set the session log file.
     * @param {any} Hexley - The main Hexley global object.
     */
    _initLogFile(Hexley: any) {
        const now = new Date();
        const date = `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;
        const time = `${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
        const logFileName = `hexleyCore-${date}-${time}.log`;
        const logFilePath = path.join(this.vfsRootPath, 'var', 'log', logFileName);

        fs.writeFileSync(logFilePath, `Hexley Core Session Log - ${now.toLocaleString()}\n\n`);
        Hexley.sessionLogFile = logFilePath;
    },

    /**
     * Internal function to rescan and update the VFS structure.
     * @param {any} Hexley - The main Hexley global object.
     */
    _updateVfsStruct(Hexley: any) {
        const readVfsTree = (dir: string): any => {
            const structure: { [key: string]: any } = {};
            const items = fs.readdirSync(dir);

            for (const item of items) {
                if (item === '.DS_Store') continue;
                
                const itemPath = path.join(dir, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory()) {
                    structure[item] = readVfsTree(itemPath);
                } else {
                    structure[item] = null;
                }
            }
            return structure;
        };

        this.vfsStructure = readVfsTree(this.vfsRootPath);
        Hexley.vfsStructure = this.vfsStructure;
    },

    /**
     * Updates the current working directory across the system.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} newCwd - The new current working directory.
     */
    updateCwd(Hexley: any, newCwd: string) {
        this.currentWorkingDirectory = newCwd;
        Hexley.filesystemCWDir = newCwd;
    },

    /**
     * Initializes the Filesystem Framework and the virtual file system (VFS).
     * @param {any} Hexley - The main Hexley global object.
     */
    initializeFilesystem(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[filesystemFramework/initializeFilesystem]', this.frameworkColor)} Initializing...`);
        
        this.vfsRootPath = path.join(Hexley.workingDir, 'vfs');
        Hexley.filesystemRootDir = this.vfsRootPath;

        const initialVfsStructure = {
            'bin': {}, 'etc': {}, 'home': {}, 'tmp': {},
            'usr': { 'bin': {}, 'lib': {}, 'local': {} },
            'var': { 'log': {}, 'mail': {} }
        };

        const createInitialVfsTree = (basePath: string, structure: any) => {
            for (const dir in structure) {
                const dirPath = path.join(basePath, dir);
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath);
                }
                createInitialVfsTree(dirPath, structure[dir]);
            }
        };

        createInitialVfsTree(this.vfsRootPath, initialVfsStructure);

        // Clear the tmp directory on boot
        const tmpDir = path.join(this.vfsRootPath, 'tmp');
        const files = fs.readdirSync(tmpDir);
        for (const file of files) {
            fs.unlinkSync(path.join(tmpDir, file));
        }
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[filesystemFramework/initializeFilesystem]', this.frameworkColor)} Cleared temporary directory.`);

        this._initLogFile(Hexley);
        
        this._updateVfsStruct(Hexley);
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[filesystemFramework/initializeFilesystem]', this.frameworkColor)} VFS directory tree has been scanned and mapped.`);

        // Verify and set the user's home directory
        Hexley.filesystemUserDir = path.join(this.vfsRootPath, 'home', Hexley.username);
        if (!fs.existsSync(Hexley.filesystemUserDir)) {
            fs.mkdirSync(Hexley.filesystemUserDir, { recursive: true });
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[filesystemFramework/initializeFilesystem]', this.frameworkColor)} User home directory created at: ${Hexley.filesystemUserDir}`);   
        }
        
        // Set the current working directory AFTER the user's home is established
        this.updateCwd(Hexley, path.join('/home', Hexley.username));

        Hexley.core.once('registryFramework.ready', () => {
            const plistPath = path.join(Hexley.privateFrameworksRootPath, 'filesystemFramework', 'info.plist');
            Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
        });

        Hexley.core.once('versionFramework.ready', () => {
            Hexley.frameworks.version.addVersionEntry(Hexley, 'filesystemFramework', 'Framework', '1.0.0');
        });

        Hexley.filesystemLoaded = true;
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[filesystemFramework/initializeFilesystem]', this.frameworkColor)} Initialized! Filesystem Framework is now ready.`);
    },

    /**
     * Gets the current working directory.
     * @returns {string} The current working directory path.
     */
    getWorkingDirectory(): string {
        return this.currentWorkingDirectory;
    },

    /**
     * Changes the current working directory.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} newPath - The path to change to.
     * @returns {boolean} True on success, false on failure.
     */
    changeDirectory(Hexley: any, newPath: string): boolean {
        let resolvedPath;

        if (newPath === '~' || !newPath) {
            resolvedPath = path.join('/home', Hexley.username);
        } else {
            resolvedPath = path.resolve(this.currentWorkingDirectory, newPath);
        }

        const absolutePath = path.join(this.vfsRootPath, resolvedPath);
        if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
            this.updateCwd(Hexley, resolvedPath);
            return true;
        } else {
            return false;
        }
    },

    /**
     * Moves a file or directory.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} sourcePath - The virtual path of the file or directory to move.
     * @param {string} destinationPath - The virtual path of the destination.
     * @returns {'success' | 'source_not_found' | 'destination_exists' | 'error'} The result of the operation.
     */
    move(Hexley: any, sourcePath: string, destinationPath: string): 'success' | 'source_not_found' | 'destination_exists' | 'error' {
        try {
            const absoluteSource = path.join(this.vfsRootPath, this.currentWorkingDirectory, sourcePath);
            const absoluteDestination = path.join(this.vfsRootPath, this.currentWorkingDirectory, destinationPath);

            if (!fs.existsSync(absoluteSource)) {
                return 'source_not_found';
            }

            if (fs.existsSync(absoluteDestination)) {
                return 'destination_exists';
            }

            fs.renameSync(absoluteSource, absoluteDestination);
            this._updateVfsStruct(Hexley);
            return 'success';
        } catch (error) {
            return 'error';
        }
    },

    /**
     * Gets information about a file or directory.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} targetPath - The virtual path of the file or directory.
     * @returns {{isDirectory: () => boolean} | null} A stat object or null if not found.
     */
    stat(Hexley: any, targetPath: string): { isDirectory: () => boolean; } | null {
        try {
            const absolutePath = path.join(this.vfsRootPath, this.currentWorkingDirectory, targetPath);
            return fs.statSync(absolutePath);
        } catch (error) {
            return null;
        }
    },

    /**
     * Writes content to a file in the VFS.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} filePath - The virtual path of the file to write to.
     * @param {string | Buffer} content - The content to write.
     * @returns {boolean} True if the write was successful, false otherwise.
     */
    writeFile(Hexley: any, filePath: string, content: string | Buffer): boolean {
        try {
            const resolvedPath = path.resolve(this.currentWorkingDirectory, filePath);
            const absolutePath = path.join(this.vfsRootPath, resolvedPath);
            fs.writeFileSync(absolutePath, content);
            this._updateVfsStruct(Hexley);
            return true;
        } catch (error: any) {
            return false;
        }
    },
    
    /**
     * Removes a file from the VFS.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} filePath - The virtual path of the file to remove.
     * @returns {boolean} True if the removal was successful, false otherwise.
     */
    removeFile(Hexley: any, filePath: string): boolean {
        try {
            const resolvedPath = path.resolve(this.currentWorkingDirectory, filePath);
            const absolutePath = path.join(this.vfsRootPath, resolvedPath);
            fs.unlinkSync(absolutePath);
            this._updateVfsStruct(Hexley);
            return true;
        } catch (error) {
            return false;
        }
    },

    /**
     * Reads the contents of a file in the VFS.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} filePath - The virtual path of the file to read.
     * @returns {string | null} The file content as a string, or null if an error occurs.
     */
    readFile(Hexley: any, filePath: string): string | null {
        try {
            const resolvedPath = path.resolve(this.currentWorkingDirectory, filePath);
            const absolutePath = path.join(this.vfsRootPath, resolvedPath);
            return fs.readFileSync(absolutePath, 'utf8');
        } catch (error) {
            return null;
        }
    },


    /**
     * Creates a new directory in the VFS.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} dirPath - The virtual path of the directory to create.
     * @returns { 'success' | 'exists' | 'error' } The result of the operation.
     */
    createDirectory(Hexley: any, dirPath: string): 'success' | 'exists' | 'error' {
        try {
            const resolvedPath = path.resolve(this.currentWorkingDirectory, dirPath);
            const absolutePath = path.join(this.vfsRootPath, resolvedPath);

            if (fs.existsSync(absolutePath)) {
                return 'exists';
            }

            fs.mkdirSync(absolutePath, { recursive: true });
            this._updateVfsStruct(Hexley);
            return 'success';
        } catch (error: any) {
            return 'error';
        }
    },

    /**
     * Removes a directory from the VFS.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} dirPath - The virtual path of the directory to remove.
     * @param {boolean} recursive - Whether to remove the directory recursively.
     * @returns {'success' | 'not_empty' | 'error'} The result of the operation.
     */
    removeDirectory(Hexley: any, dirPath: string, recursive: boolean): 'success' | 'not_empty' | 'error' {
        try {
            const absolutePath = path.join(this.vfsRootPath, this.currentWorkingDirectory, dirPath);
            if (fs.readdirSync(absolutePath).length > 0 && !recursive) {
                return 'not_empty';
            }
            fs.rmSync(absolutePath, { recursive: true, force: true });
            this._updateVfsStruct(Hexley);
            return 'success';
        } catch (error) {
            return 'error';
        }
    },

    /**
     * Reads the contents of a directory in the VFS.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} dirPath - The virtual path of the directory to read.
     * @param {boolean} showHidden - Whether to include hidden files.
     * @returns {{name: string, stat: fs.Stats}[] | null} An array of objects or null on error.
     */
    readDirectory(Hexley: any, dirPath: string, showHidden: boolean): {name: string, stat: fs.Stats}[] | null {
        try {
            const resolvedPath = path.resolve(this.currentWorkingDirectory, dirPath);
            const absolutePath = path.join(this.vfsRootPath, resolvedPath);
            let items = fs.readdirSync(absolutePath);

            if (!showHidden) {
                items = items.filter(item => !item.startsWith('.'));
            }

            const detailedItems = items.map(item => {
                const itemPath = path.join(absolutePath, item);
                const stat = fs.statSync(itemPath);
                return { name: item, stat: stat };
            });
            
            return detailedItems;
        } catch (error) {
            return null;
        }
    },
    
};