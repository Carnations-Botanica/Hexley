// modules/version/version.ts

import { Events, EmbedBuilder, type Interaction } from 'discord.js';

/**
 * The globally accessible module object for the Version command.
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

        if (Hexley.resources.framework.discord.isLoaded) {
            Hexley.frameworks.discord.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
                if (!interaction.isChatInputCommand() || interaction.commandName !== 'version') return;
                if (!interaction.member) return;

                await interaction.deferReply();

                const allEntries = await Hexley.frameworks.version.getAllVersionEntries(Hexley);

                const versionEmbed = new EmbedBuilder()
                    .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
                    .setTitle('Hexley says...')
                    .setTimestamp();

                if (allEntries.length > 0) {
                    const groupedEntries: { [key: string]: any[] } = {};
                    for (const entry of allEntries) {
                        if (!groupedEntries[entry.type]) {
                            groupedEntries[entry.type] = [];
                        }
                        groupedEntries[entry.type]!.push(entry);
                    }

                    for (const type in groupedEntries) {
                        const entriesOfType = groupedEntries[type];
                        if (!entriesOfType) continue;

                        const value = entriesOfType.map((e: any) => `\`${e.name.padEnd(20, ' ')} ${e.version}\``).join('\n');
                        versionEmbed.addFields({ name: `❯ ${type}s`, value: value, inline: false });
                    }

                    const kernelCount = allEntries.filter((entry: any) => entry.type === 'Kernel').length;
                    const moduleCount = allEntries.filter((entry: any) => entry.type === 'Module').length;
                    const driverCount = allEntries.filter((entry: any) => entry.type === 'Driver').length;
                    const frameworkCount = allEntries.filter((entry: any) => entry.type === 'Framework').length;
                    const totalCount = kernelCount + moduleCount + frameworkCount + driverCount;
                    const description = `Here are all ${totalCount} entries in the version table.`;
                    versionEmbed.setFooter({ text: `Frameworks: ${frameworkCount} | Modules: ${moduleCount} | Drivers: ${driverCount}` });
                    versionEmbed.setDescription(description);

                } else {
                    versionEmbed.setDescription('Could not find any version information.');
                }

                await interaction.editReply({ embeds: [versionEmbed] });
            });
        }
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[version/versionInit]', this.moduleColor)} Initialized Version Module successfully!`);
    },
};