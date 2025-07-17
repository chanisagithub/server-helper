const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('layout_help')
        .setDescription('Shows how to format the input for the /server_layout command.'),
    async execute(interaction) {
        try {
            const helpEmbed = new EmbedBuilder()
                .setColor(0x0099FF) // Blue color
                .setTitle('📋 How to use `/server_layout`')
                .setDescription("Use the `/server_layout` command to open a form. Here's how to fill it out to define your server's structure, including basic privacy settings:")
                .addFields(
                    {
                        name: '1. Categories & Channels Field',
                        value: "In the **first input box**, define your categories and the channels within them:\n\n" +
                               "🔹 **Categories**: Type each category name on a new line.\n" +
                               "🔹 **Channels**:\n" +
                               "  - Underneath a category name, **indent** channel names (e.g., use 2 spaces or a Tab at the start of the line).\n" +
                               "  - **Text Channels**: Prefix with `#` OR use no prefix (e.g., `  # general-chat` or `  rules`).\n" +
                               "  - **Voice Channels**: Prefix with `*`, `v:`, or `voice:` (e.g., `  * Lounge`, `  v:gaming-vc`, `  voice:music room`)."
                    },
                    { // --- NEW FIELD FOR PERMISSIONS ---
                        name: '🔒 Applying Permissions (Optional)',
                        value: "You can apply basic privacy settings to categories or individual channels using a directive within square brackets `[]` directly after its name.\n\n" +
                               "**Private Access:**\n" +
                               "Makes the category or channel visible *only* to specified roles.\n" +
                               "- **Syntax**: `[private: RoleName1, RoleName2, ...]`\n" +
                                   "**Announcement Channel:**\n" +
                                   "Makes a channel readable by everyone, but only specified roles can send messages.\n" +
                                   "- **Syntax**: `[announcement: RoleName1, RoleName2, ...]`\n" +
                               "- **Effect**:\n" +
                                   "     - `@everyone` can view the channel and read history.\n" +
                                   "     - `@everyone` is **denied** permission to send messages.\n" +
                                   "     - The listed roles are **granted** permission to send messages.\n" +
                                   "- **Example**: `  #news [announcement: Staff, News Editors]`"
                    },
                    {
                        name: '2. Roles Field',
                        value: "In the **second input box**, list each role name you want to create, with each role on a new line. If you used role names in permission settings, ensure they are defined here or already exist on the server."
                    },
                        {
                        name: '📝 Example for "Categories & Channels" field (with permissions):',
                        value: "```markdown\n" +
                               "Community Hub\n" +
                               "  # welcome\n" +
                                   "  # announcements [announcement: Staff]\n" +
                               "  * General Voice Chat [private: Members, VIP]\n" +
                               "Staff Section [private: Staff, Admin]\n" +
                               "  # mod-chat\n" +
                               "  # admin-only-lounge\n" +
                               "  * Staff Meeting VC\n" +
                               "Project Alpha [private: Project Alpha Team, Staff]\n" +
                               "  # design-discussion\n" +
                               "  voice: Alpha Team Voice\n" +
                                   "Public Zone\n" +
                               "  # general\n" +
                               "```"
                    },
                    {
                        name: '👤 Example for "Roles" field:',
                        value: "```markdown\n" +
                               "Members\n" +
                               "VIP\n" +
                               "Staff\n" +
                               "Admin\n" +
                               "Project Alpha Team\n" +
                                   "News Editors\n" +
                               "```"
                    }
                )
                .setFooter({ text: 'The bot will show a confirmation plan before creating anything.' });

            await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
        } catch (error) {
            console.error("Error handling /layout_help command:", error);
            await interaction.reply({ content: "Sorry, I couldn't display the help information right now.", ephemeral: true });
        }
    },
};
