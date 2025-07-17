const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  Collection,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} = require("discord.js");
require("dotenv").config();

const { parseLayout } = require('./utils/layoutParser');
const { applyPermissionPreset } = require('./utils/permissionManager');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Error: DISCORD_TOKEN or CLIENT_ID is missing from your .env file!");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log(`Started refreshing ${client.commands.size} application (/) commands.`);
    const commandsData = client.commands.map((command) => command.data.toJSON());

    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commandsData,
      });
      console.log(`Successfully reloaded ${commandsData.length} application (/) commands for guild ${GUILD_ID}.`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: commandsData,
      });
      console.log(`Successfully reloaded ${commandsData.length} global application (/) commands.`);
    }
  } catch (error) {
    console.error("Error during command registration:", error);
  }
}

const pendingLayouts = new Map();

client.once(Events.ClientReady, (readyClient) => {
  console.log(`🎉 Logged in as ${readyClient.user.tag}!`);
  console.log(`🤖 Bot is ready and online on ${readyClient.guilds.cache.size} server(s).`);
  registerCommands();
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    } else if (interaction.isModalSubmit()) {
        const layoutId = interaction.id;
        const layoutIdForTimeout = layoutId;

        setTimeout(() => {
            if (pendingLayouts.has(layoutIdForTimeout)) {
                pendingLayouts.delete(layoutIdForTimeout);
                console.log(`Pending layout ${layoutIdForTimeout} timed out and was removed.`);
            }
        }, 60000);

        if (interaction.customId === 'serverSetupModal_v2') {
            try {
                await interaction.deferReply({ ephemeral: true });

                const layoutDefinitionRaw = interaction.fields.getTextInputValue('layoutDefinition');
                const roleNamesRaw = interaction.fields.getTextInputValue('roleNames');

                const rolesToCreateFromInput = roleNamesRaw.split('\n').map(name => name.trim()).filter(name => name.length > 0);

                const layoutData = parseLayout(layoutDefinitionRaw);

                if (layoutData.length === 0 && rolesToCreateFromInput.length === 0) {
                    await interaction.editReply({ content: "ℹ️ Nothing to create. Please define categories/channels or roles.", ephemeral: true });
                    return;
                }

                pendingLayouts.set(layoutId, { layoutData, rolesToCreate: rolesToCreateFromInput, originalInteractionId: interaction.id });

                const confirmButton = new ButtonBuilder().setCustomId(`confirm_layout_${layoutId}`).setLabel('Confirm').setStyle(ButtonStyle.Success);
                const cancelButton = new ButtonBuilder().setCustomId(`cancel_layout_${layoutId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger);
                const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

                const confirmationEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Confirm Server Layout Plan')
                    .setDescription('Review items to be created. Permissions will be applied as specified.')
                    .setTimestamp();

                if (layoutData.length > 0) {
                    let categoriesFieldString = "";
                    layoutData.forEach(catDef => {
                        categoriesFieldString += `**${catDef.name}** ${catDef.permString ? `\n  └ *Permissions: ${catDef.permString}*` : ''}\n`;
                        if (catDef.channels.length > 0) {
                            catDef.channels.forEach(chDef => {
                                let permSuffix = '';
                                if (chDef.permString) {
                                    permSuffix = `\n      └ *Permissions: ${chDef.permString}*`;
                                }
                                categoriesFieldString += `  ${chDef.type === ChannelType.GuildText ? '📝' : '🔊'} ${chDef.name}${permSuffix}\n`;
                            });
                        } else {
                            categoriesFieldString += `  *(No channels for this category)*\n`;
                        }
                    });
                    if (categoriesFieldString) confirmationEmbed.addFields({ name: 'Planned Categories & Channels', value: categoriesFieldString.substring(0, 1020) + (categoriesFieldString.length > 1020 ? "..." : "") });
                }

                if (rolesToCreateFromInput.length > 0) {
                    confirmationEmbed.addFields({ name: 'Planned Roles', value: rolesToCreateFromInput.join('\n').substring(0, 1020) + (rolesToCreateFromInput.join('\n').length > 1020 ? "..." : "") });
                }

                await interaction.editReply({ embeds: [confirmationEmbed], components: [row], ephemeral: true });

            } catch (error) {
                console.error("Modal submit processing error:", error);
                const errorProcessingEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('⚠️ Error Processing Submission');
                await interaction.editReply({ embeds: [errorProcessingEmbed], components: [] }).catch(e => console.error("Failed to edit reply with error embed:", e));
            }
        }
    } else if (interaction.isButton()) {
        const [action, type, layoutId] = interaction.customId.split('_');

        if (type !== 'layout' || !pendingLayouts.has(layoutId)) {
            await interaction.reply({ content: "This confirmation is no longer valid or has expired.", ephemeral: true });
            return;
        }

        await interaction.deferUpdate();
        const { layoutData, rolesToCreate } = pendingLayouts.get(layoutId);
        pendingLayouts.delete(layoutId);

        if (action === 'confirm') {
            await interaction.editReply({ content: '⚙️ Applying server layout... please wait.', embeds: [], components: [] });
            const guild = interaction.guild;
            if (!guild) {
                await interaction.followUp({ content: 'Error: Guild not found when trying to apply layout.', ephemeral: true });
                return;
            }

            let createdItemsLog = { categories: [], roles: [], channels: {} };
            let errorLog = [];
            let createdOrFetchedRoles = new Map();

            if (rolesToCreate && rolesToCreate.length > 0) {
                for (const roleName of rolesToCreate) {
                    try {
                        const existingRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
                        if (existingRole) {
                            createdOrFetchedRoles.set(roleName.toLowerCase(), existingRole);
                        } else {
                            const createdRole = await guild.roles.create({ name: roleName, reason: `Layout by ${interaction.user.tag}` });
                            createdItemsLog.roles.push(createdRole.name);
                            createdOrFetchedRoles.set(roleName.toLowerCase(), createdRole);
                        }
                    } catch (rError) {
                        errorLog.push({ item: `Role "${roleName}"`, message: rError.message });
                    }
                }
            }

            for (const categoryDef of layoutData) {
                let createdCategory = null;
                try {
                    let existingCategory = guild.channels.cache.find(c => c.name.toLowerCase() === categoryDef.name.toLowerCase() && c.type === ChannelType.GuildCategory);
                    if (existingCategory) {
                        createdCategory = existingCategory;
                    } else {
                        createdCategory = await guild.channels.create({ name: categoryDef.name, type: ChannelType.GuildCategory, reason: `Layout by ${interaction.user.tag}` });
                        createdItemsLog.categories.push(createdCategory.name);
                    }
                    if (!createdItemsLog.channels[createdCategory.name]) {
                         createdItemsLog.channels[createdCategory.name] = [];
                    }
                    if (createdCategory && categoryDef.permString) {
                        await applyPermissionPreset(guild, createdCategory, categoryDef.permString, createdOrFetchedRoles, errorLog);
                    }
                    for (const channelDef of categoryDef.channels) {
                        let createdChannel = null;
                        try {
                            let existingChannel = guild.channels.cache.find(c => c.name.toLowerCase() === channelDef.name.toLowerCase() && c.parentId === createdCategory.id && c.type === channelDef.type);
                            if(existingChannel){
                                createdChannel = existingChannel;
                            } else {
                                createdChannel = await guild.channels.create({
                                    name: channelDef.name, type: channelDef.type, parent: createdCategory.id, reason: `Layout by ${interaction.user.tag}`
                                });
                                createdItemsLog.channels[createdCategory.name].push(`${channelDef.type === ChannelType.GuildText ? '📝' : '🔊'} ${createdChannel.name}`);
                            }
                            if (createdChannel && channelDef.permString) {
                                await applyPermissionPreset(guild, createdChannel, channelDef.permString, createdOrFetchedRoles, errorLog);
                            }
                        } catch (chError) {
                            errorLog.push({ item: `Channel "${channelDef.name}"`, message: chError.message });
                        }
                    }
                } catch (catError) {
                    errorLog.push({ item: `Category "${categoryDef.name}"`, message: catError.message });
                }
            }

            const resultEmbed = new EmbedBuilder();
            resultEmbed.setColor(errorLog.length > 0 ? 0xFF0000 : 0x00FF00)
                .setTitle('Server Layout Update Complete!')
                .setTimestamp();

            if (createdItemsLog.categories.length > 0 || Object.values(createdItemsLog.channels).some(chArr => chArr.length > 0)) {
                let description = '';
                if (createdItemsLog.categories.length > 0) {
                    description += `**Created Categories:**\n${createdItemsLog.categories.join('\n')}\n\n`;
                }
                if (Object.values(createdItemsLog.channels).some(chArr => chArr.length > 0)) {
                    description += '**Created Channels:**\n';
                    for (const categoryName in createdItemsLog.channels) {
                        if (createdItemsLog.channels[categoryName].length > 0) {
                            description += `**${categoryName}**\n  ${createdItemsLog.channels[categoryName].join('\n  ')}\n`;
                        }
                    }
                }
                resultEmbed.setDescription(description);
             }

            if (createdItemsLog.roles.length > 0) {
                resultEmbed.addFields({ name: 'Created Roles', value: createdItemsLog.roles.join('\n') });
            }

            if (errorLog.length > 0) {
                resultEmbed.addFields({ name: 'Errors', value: errorLog.map(e => `**${e.item}**: ${e.message}`).join('\n') });
            }

            if (!resultEmbed.data.fields && !resultEmbed.data.description) {
                resultEmbed.setDescription('No changes were made.');
            }

            await interaction.editReply({ content: null, embeds: [resultEmbed], components: [] });

        } else if (action === 'cancel') {
            await interaction.editReply({ content: '❌ Server layout creation cancelled by user.', embeds: [], components: [] });
        }
    }
});

client.login(TOKEN).catch((error) => {
  console.error("Failed to log in:", error);
  if (error.code === "DisallowedIntents") {
    console.error("Error: Missing Privileged Gateway Intents! Please ensure your bot has the necessary intents enabled in the Discord Developer Portal.");
  }
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});
