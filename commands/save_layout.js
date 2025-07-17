const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('save_layout')
        .setDescription('Saves the current server layout to a file.')
        .addStringOption(option =>
            option.setName('filename')
                .setDescription('The name of the file to save the layout to.')
                .setRequired(true)),
    async execute(interaction) {
        const filename = interaction.options.getString('filename');
        const guild = interaction.guild;
        const layout = {
            roles: [],
            categories: [],
        };

        guild.roles.cache.forEach(role => {
            if (role.name !== '@everyone') {
                layout.roles.push({
                    name: role.name,
                    permissions: role.permissions.toArray(),
                });
            }
        });

        const categories = guild.channels.cache.filter(c => c.type === 4); // 4 = GUILD_CATEGORY
        categories.forEach(category => {
            const categoryData = {
                name: category.name,
                permissions: category.permissionOverwrites.cache.map(overwrite => ({
                    id: overwrite.id,
                    type: overwrite.type,
                    allow: overwrite.allow.toArray(),
                    deny: overwrite.deny.toArray(),
                })),
                channels: [],
            };
            const channels = guild.channels.cache.filter(c => c.parentId === category.id);
            channels.forEach(channel => {
                categoryData.channels.push({
                    name: channel.name,
                    type: channel.type,
                    permissions: channel.permissionOverwrites.cache.map(overwrite => ({
                        id: overwrite.id,
                        type: overwrite.type,
                        allow: overwrite.allow.toArray(),
                        deny: overwrite.deny.toArray(),
                    })),
                });
            });
            layout.categories.push(categoryData);
        });

        const layoutsDir = path.join(__dirname, '..', 'layouts');
        if (!fs.existsSync(layoutsDir)) {
            fs.mkdirSync(layoutsDir);
        }

        fs.writeFileSync(path.join(layoutsDir, `${filename}.json`), JSON.stringify(layout, null, 2));

        await interaction.reply({ content: `Server layout saved to \`${filename}.json\``, ephemeral: true });
    },
};
