import { Events, EmbedBuilder, type Interaction } from 'discord.js';

// Define an interface for the version information
interface VersionInfo {
    version: string;
    type: string;
}

/**
 * The globally accessible module object.
 */
export const version = {

    // Module Logging Color
    moduleColor: "#688872",

    /**
     * Main Entry Point for the Version module.
     * @param {any} Hexley - The main Hexley global object.
     */
    versionInit(Hexley: any) {
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[version/versionInit]', this.moduleColor)} Initializing Version Module...`);

        if (Hexley.discordLoaded) {
            Hexley.frameworks.discord.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
                if (!interaction.isChatInputCommand() || interaction.commandName !== 'version') return;

                await interaction.deferReply();

                // Define which types to display in the embed
                // const typesToShow = ['Kernel', 'Module'];
                // const typesToShow = ['Kernel', 'Framework', 'Module'];
                const typesToShow = ['Framework', 'Module'];
                // const typesToShow = ['Module'];
                let sourcedFrom = 'an unknown source';

                const versionEmbed = new EmbedBuilder()
                    .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
                    .setTitle('Hexley says...')
                    .setTimestamp();

                // Prioritize sequelizerFramework for detailed version info
                if (Hexley.sequelizerLoaded) {
                    sourcedFrom = 'sequelizerFramework';
                    
                    const versionTable = { options: { tableName: 'versionTable' } };
                    const allEntries = await Hexley.frameworks.sequelizer.getTableDefinitionEntries(Hexley, process.env.DB_NAME, versionTable);
                    
                    const filteredEntries = allEntries.filter((entry: any) => typesToShow.includes(entry.toJSON().type));

                    if (filteredEntries.length > 0) {
                        const includedTypes = [];
                        if (typesToShow.includes('Kernel')) includedTypes.push('Kernel');
                        if (typesToShow.includes('Module')) includedTypes.push('Modules');
                        if (typesToShow.includes('Framework')) includedTypes.push('Frameworks');

                        let description = 'Here are all the versions of the loaded ';
                        if (includedTypes.length > 1) {
                            const last = includedTypes.pop();
                            description += includedTypes.join(', ') + ` and ${last}.`;
                        } else if (includedTypes.length === 1) {
                            description += `${includedTypes[0]}.`;
                        }
                        versionEmbed.setDescription(description);

                        for (const entry of filteredEntries) {
                            const entryData = entry.toJSON();
                            versionEmbed.addFields({ name: entryData.name, value: `Version: ${entryData.version}\nType: ${entryData.type}`, inline: true });
                        }
                    } else {
                        versionEmbed.setDescription('No version information found for the specified types.');
                    }
                    
                    const moduleCount = allEntries.filter((entry: any) => entry.toJSON().type === 'Module').length;
                    const frameworkCount = allEntries.filter((entry: any) => entry.toJSON().type === 'Framework').length;
                    versionEmbed.setFooter({ text: `Modules: ${moduleCount} | Frameworks: ${frameworkCount}` });

                } 
                // Fallback to the global Hexley.versions object
                else if (Hexley.versions && Object.keys(Hexley.versions).length > 0) {
                    sourcedFrom = 'Hexley.versions';
                    versionEmbed.setDescription('Here are all the versions from the global versions object.');
                    
                    let entriesAdded = 0;
                    for (const name in Hexley.versions) {
                        if (Object.prototype.hasOwnProperty.call(Hexley.versions, name)) {
                            const data = Hexley.versions[name];
                            if (typesToShow.includes(data.type)) {
                                versionEmbed.addFields({ name: name, value: `Version: ${data.version}\nType: ${data.type}`, inline: true });
                                entriesAdded++;
                            }
                        }
                    }

                    if (entriesAdded === 0) {
                        versionEmbed.setDescription('No version information found for the specified types.');
                    }

                    const allEntries: VersionInfo[] = Object.values(Hexley.versions);
                    const moduleCount = allEntries.filter(entry => entry.type === 'Module').length;
                    const frameworkCount = allEntries.filter(entry => entry.type === 'Framework').length;
                    versionEmbed.setFooter({ text: `Modules: ${moduleCount} | Frameworks: ${frameworkCount}` });
                } 
                // If no data is available
                else {
                    sourcedFrom = 'N/A';
                    versionEmbed.setDescription('Cannot fetch system version data at this time.');
                }

                await interaction.editReply({ embeds: [versionEmbed] });
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[version/interaction]', this.moduleColor)} Replied to ${interaction.user.username} (${interaction.user.id}) with version information from ${sourcedFrom}.`);
            });
        }
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[version/versionInit]', this.moduleColor)} Initialized Version Module successfully!`);
    
    },

}