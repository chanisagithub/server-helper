const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server_layout')
        .setDescription('Opens a form to define categories and roles for a new server layout.'),
    async execute(interaction) {
        try {
            const modal = new ModalBuilder()
                .setCustomId('serverSetupModal_v2')
                .setTitle('Server Layout Definition');

            const layoutInput = new TextInputBuilder()
                .setCustomId('layoutDefinition')
                .setLabel('Categories & Channels (see placeholder)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(
                    `Category Name
  #text-channel
  *voice-channel (or v:)
Indent channels under category.`
                )
                .setRequired(true);

            const roleInput = new TextInputBuilder()
                .setCustomId('roleNames')
                .setLabel('Role Names (one per line)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('e.g.,\nMember\nModerator\nAdmin')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(layoutInput),
                new ActionRowBuilder().addComponents(roleInput)
            );
            await interaction.showModal(modal);
        } catch (error) {
            console.error('Modal show error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Error opening form.',
                    ephemeral: true,
                });
            }
        }
    },
};
