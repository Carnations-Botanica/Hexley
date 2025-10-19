import { Events, EmbedBuilder, type Message } from 'discord.js';

// Determine the color based on the time of day, basic 4 color gradient of sky
const getTimeOfDayColor = (date: Date) => {

    const hour = date.getHours();

    // Nautical Sunrise (5 AM - 7 AM)
    if (hour >= 5 && hour < 8) {
        return '#F7633D'; // Coral (bright orange)
    }
    // Sunrise (8 AM - 11 AM)
    if (hour >= 8 && hour < 12) {
        return '#FFD700'; // Gold (yellowish)
    }
    // Midday (12 PM - 5 PM)
    if (hour >= 12 && hour < 18) {
        return '#FFBE1D'; // Orange (dark orangeish)
    }
    // Night (6 PM - 4 AM)
    return '#708090'; // SlateGray (grayish blueish)

};

/**
 * The globally accessible module object.
 */
export const verbose = {

    // Module Logging Color
    moduleColor: "#688872",

    /**
     * Main Entry Point for the Verbose module.
     * @param {any} Hexley - The main Hexley global object.
     */
    verboseInit(Hexley: any) {
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[verbose/verboseInit]', this.moduleColor)} Initializing verbose Module...`);

        if (Hexley.resources.framework.discord.isLoaded) {
            const FOCUS_ENABLED =  true;

            Hexley.frameworks.discord.client.on(Events.MessageCreate, async (message: Message) => {
                if (!message.guild || !message.member) return;

                if (!FOCUS_ENABLED || message.guild.id === process.env.GUILD_ID) {
                    const now = new Date();
                    const currentTime = now.toLocaleTimeString();
                    const timeColor = getTimeOfDayColor(now);
                    const coloredTime = Hexley.frameworks.aurora.colorText(currentTime, timeColor);

                    const channel: any = message.channel;
                    const channelName = channel.name || 'Unknown Channel';
                    const channelColor = channel.type === 2 ? '#23E0AE' : '#ADFCFF';
                    const coloredChannelName = Hexley.frameworks.aurora.colorText(channelName, channelColor);

                    const guildName = message.guild.name;
                    const userId = message.author.id;
                    const attachments = message.attachments;
                    let content = message.content;

                    // Get user's role color and apply it to their name
                    const userColor = Hexley.frameworks.discord.getUserRoleColor(message.member);
                    const coloredUserName = Hexley.frameworks.aurora.colorText(message.author.tag, userColor);

                    if (attachments.size > 0) {
                        const attachmentText = attachments.size === 1 
                            ? `[Attachment: ${attachments.first()?.name}]` 
                            : `[Multiple Attachments]`;
                        content = content ? `${content} ${attachmentText}` : attachmentText;
                    }

                    if (!content.trim() && message.embeds.length === 0) {
                        content = '[No Content]';
                    } else if (message.embeds.length > 0) {
                        content = content.trim() ? `${content} [Embed]` : '[Embed]';
                    }

                    Hexley.log(`${Hexley.frameworks.aurora.colorText('[verbose]', this.moduleColor)} [ ${coloredTime} | #${coloredChannelName} ] [ ${coloredUserName} (${userId}) ]: ${content}`);
                }
            });
        }
        
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[verbose/verboseInit]', this.moduleColor)} Initialized verbose Module successfully! You will now get Discord messages in Console!`);
    
    },

}