const { SlashCommandBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('load_layout')
        .setDescription('Loads a server layout from a file.')
        .addStringOption(option =>
            option.setName('filename')
                .setDescription('The name of the file to load the layout from.')
                .setRequired(true)),
    async execute(interaction) {
        const filename = interaction.options.getString('filename');
        const layoutsDir = path.join(__dirname, '..', 'layouts');
        const filePath = path.join(layoutsDir, `${filename}.json`);

        if (!fs.existsSync(filePath)) {
            await interaction.reply({ content: `Layout file \`${filename}.json\` not found.`, ephemeral: true });
            return;
        }

        const layout = JSON.parse(fs.readFileSync(filePath));
        const guild = interaction.guild;

        await interaction.reply({ content: 'Applying layout...', ephemeral: true });

        for (const roleData of layout.roles) {
            const existingRole = guild.roles.cache.find(r => r.name === roleData.name);
            if (!existingRole) {
                await guild.roles.create({
                    name: roleData.name,
                    permissions: roleData.permissions,
                });
            }
        }

        for (const categoryData of layout.categories) {
            let category = guild.channels.cache.find(c => c.name === categoryData.name && c.type === ChannelType.GuildCategory);
            if (!category) {
                category = await guild.channels.create({
                    name: categoryData.name,
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: categoryData.permissions.map(p => ({
                        id: p.id,
                        type: p.type,
                        allow: BigInt(p.allow.reduce((a, b) => a | b, 0)),
                        deny: BigInt(p.deny.reduce((a, b) => a | b, 0)),
                    })),
                });
            }

            for (const channelData of categoryData.channels) {
                const existingChannel = guild.channels.cache.find(c => c.name === channelData.name && c.parentId === category.id);
                if (!existingChannel) {
                    await guild.channels.create({
                        name: channelData.name,
                        type: channelData.type,
                        parent: category.id,
                        permissionOverwrites: channelData.permissions.map(p => ({
                            id: p.id,
                            type: p.type,
                            allow: BigInt(p.allow.reduce((a, b) => a | b, 0)),
                            deny: BigInt(p.deny.reduce((a, b) => a | b, 0)),
                        })),
                    });
                }
            }
        }

        await interaction.followUp({ content: 'Layout applied successfully!', ephemeral: true });
    },
};
