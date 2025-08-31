import chalk from 'chalk';
import path from 'path';

const tintRed = "#FF0000";
const tintRedBright = "#ED3931"
const tintOrange = "#FF7F00";
const tintYellow = "#FFFF00";
const tintGreen = "#00FF00";
const tintBlue = "#0000FF";
const tintIndigo = "#4B0082";
const tintViolet = "#8A2BE2";
const tintGray = "#7E6E62"
const tintBlurple = "#5865F2";
const tintBlurpleBright = "#E0E3FF";

/**
 * The globally accessible framework object holding all console logging and coloring interfaces.
 */
export const auroraFramework = {

    /**
     * Default list of provided colors
     */
    tintRed: tintRed,
    tintRedBright: tintRedBright,
    tintOrange: tintOrange,
    tintYellow: tintYellow,
    tintGreen: tintGreen,
    tintBlue: tintBlue,
    tintIndigo: tintIndigo,
    tintViolet: tintViolet,
    tintGray: tintGray,
    tintBlurple: tintBlurple,
    tintBlurpleBright : tintBlurpleBright,
    prodTint: "#00FFA5",
    devTint: "#FF5151",
    internalTint: "#F8B2B7",

    /**
    * Array of colors for the rainbow in order
    */
    rainbowColors: [
        tintRed,
        tintOrange,
        tintYellow,
        tintGreen,
        tintBlue,
        tintIndigo,
        tintViolet
    ],

    /**
     * Colors each letter of a string with a different color from the rainbow.
     * @param {string} text - The text to colorize.
     * @returns {string} The colorized text.
     */
    colorizeText(text: string): string {
        return text
            .split('')
            .map((char, index) => chalk.hex(this.rainbowColors[index % this.rainbowColors.length]!)(char))
            .join('');
    },

    /**
     * Colors a string of text with a specific hex color.
     * @param {string} text - The text to color.
     * @param {string} hexColor - The hex color code (e.g., "#FF5733").
     * @returns {string} The colorized text.
     */
    colorText(text: string, hexColor: string): string {
        return chalk.hex(hexColor)(text);
    },

    /**
     * Initializes the Aurora framework and signals that it's ready.
     * @param {any} Hexley - The main Hexley global object.
     */
    initializeAurora(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[auroraFramework/initializeAurora]', '#FFFFFF')} Initializing Aurora Framework...`);
        
        // Update the Hexley global object to signal that Aurora is loaded
        Hexley.auroraLoaded = true;

        // Use the framework's own function to colorize the output
        Hexley.log(`${this.colorizeText('[auroraFramework/initializeAurora]')} ${this.colorText('Color introduced!', this.tintGreen)}`);

        // Listen for registryFramework.ready and add the version to the database.
        Hexley.core.once('registryFramework.ready', () => {
            const plistPath = path.join(Hexley.privateFrameworksRootPath, 'auroraFramework', 'info.plist');
            Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
        });

        // Listen for versionFramework.ready and add the version to the database.
        Hexley.core.once('versionFramework.ready', () => {
            Hexley.frameworks.version.addVersionEntry(Hexley, 'auroraFramework', 'Framework', '1.0.0');
        });

        // Also add to the in-memory versions object
        Hexley.versions['auroraFramework'] = { version: '1.0.0', type: 'Framework' };

        Hexley.log(`${this.colorizeText('[auroraFramework/initializeAurora]')} ${this.colorText('Aurora has been loaded!', this.tintGreen)}`);
    }

}