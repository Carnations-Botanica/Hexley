import { Events, EmbedBuilder, type Interaction, MessageFlags } from 'discord.js';

/**
 * The globally accessible module for interacting with the Firewall Framework.
 */
export const firewall = {

    moduleColor: "#FF6347", // Same as framework

    /**
     * Main Entry Point for the Firewall module.
     * @param {any} Hexley - The main Hexley global object.
     */
    firewallInit(Hexley: any) {
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewall/firewallInit]', this.moduleColor)} Initializing Firewall Module...`);

        if (Hexley.discordLoaded) {
            Hexley.frameworks.discord.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
                if (!interaction.isChatInputCommand() || interaction.commandName !== 'firewall') return;
                await this.handleFirewallCommand(Hexley, interaction);
            });
        }
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewall/firewallInit]', this.moduleColor)} Initialized Firewall Module successfully!`);
    },
    
    /**
     * Formats a time string in milliseconds, adding context and a witty comment.
     * @param {string} timeString - The time string (e.g., "123.45 ms").
     * @returns {string} The formatted string with additional context.
     */
    _formatTimeWithComment(timeString: string): string {
        if (!timeString.includes('ms')) {
            return timeString; // Return as-is if it's an error message like "TLS Error"
        }

        const ms = parseFloat(timeString);
        if (isNaN(ms)) {
            return timeString; // Return original if parsing fails
        }

        let comment = '';
        if (ms < 100) {
            comment = 'Faster than a blink!';
        } else if (ms < 400) {
            comment = 'Pretty snappy!';
        } else if (ms < 800) {
            comment = 'Decent speed.';
        } else {
            comment = 'A bit sluggish.';
        }

        return `${timeString} (${Math.round(ms)}/1000ths of a second) - *${comment}*`;
    },

    /**
     * Handles the /firewall slash command.
     */
    async handleFirewallCommand(Hexley: any, interaction: any) {
        await interaction.deferReply();

        if (!Hexley.databaseLoaded) {
            await interaction.editReply('Firewall statistics are unavailable because the database is not loaded.');
            return;
        }

        // Database Statistics
        const allIps = await Hexley.frameworks.database.getAll('firewallMetIPsTable');
        const totalIPs = allIps.length;
        const totalRequestsEntry = await Hexley.frameworks.database.get({ options: { tableName: 'firewallConfigTable' } }, { setting: 'totalRequestsFulfilled' });
        const totalRequests = totalRequestsEntry ? parseInt(totalRequestsEntry.value, 10) : 0;
        const whitelistedIPs = allIps.filter((ip: any) => ip.isWhitelisted).length;
        const blacklistedIPs = allIps.filter((ip: any) => ip.isBlacklisted).length;

        // Ping Test
        let pingTime = 'N/A';
        let internalTime = 'N/A';
        const protocol = process.env.ENABLE_HTTPS === 'TRUE' ? 'https' : 'http';
        const hostname = 'hexley.carnations.dev'; // Would need to be modified for 3rd Party Hosts
        const port = process.env.ENDPOINT_PORT || (protocol === 'https' ? '443' : '80');
        const url = `${protocol}://${hostname}:${port}/`;

        try {
            Hexley.log(`[firewall/handleFirewallCommand/ping] Attempting to connect to ${url}`);
            const startTime = performance.now();
            const response = await fetch(url);
            const endTime = performance.now();
            
            pingTime = `${(endTime - startTime).toFixed(2)} ms`;
            internalTime = response.headers.get('X-Internal-Resolve-Time') || 'N/A';
        } catch (error: any) {
            if (error.message.includes('certificate') || error.message.includes('TLS') || error.message.includes('SSL')) {
                pingTime = 'TLS Error (Host mismatch)';
            } else {
                pingTime = 'Failed to connect';
            }
            Hexley.log(`[firewall/handleFirewallCommand/ping] Ping failed: ${error.message}`);
        }

        // Get the framework version dynamically
        const frameworkVersion = Hexley.versions.firewallFramework?.version || 'N/A';
        
        const embed = new EmbedBuilder()
            .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
            .setTitle(`Hexley says...`)
            .setDescription(`Here's a summary of network traffic and security information from the Firewall.`)
            .addFields(
                { name: 'Total Requests Fulfilled', value: totalRequests.toLocaleString(), inline: false },
                { name: 'Total Unique IPs Seen', value: totalIPs.toLocaleString(), inline: false },
                { name: 'Whitelisted IPs', value: whitelistedIPs.toLocaleString(), inline: false },
                { name: 'Blacklisted IPs', value: blacklistedIPs.toLocaleString(), inline: false },
                { name: 'Internal Resolve Time', value: this._formatTimeWithComment(internalTime), inline: false },
                { name: 'Server Response Time', value: this._formatTimeWithComment(pingTime), inline: false },
            )
            .setTimestamp()
            .setFooter({ text: `Firewall Framework Version ${frameworkVersion}` });

        await interaction.editReply({ embeds: [embed] });
    },

};

