// Require necessary discord.js classes
const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
// Require dotenv to manage environment variables
require("dotenv").config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // Can be undefined if you want global commands

if (!TOKEN || !CLIENT_ID) {
  console.error(
    "Error: DISCORD_TOKEN or CLIENT_ID is missing from your .env file!"
  );
  console.error(
    "Please ensure you have a .env file with DISCORD_TOKEN and CLIENT_ID defined."
  );
  process.exit(1); // Exit the process if critical variables are missing
}

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Necessary for basic bot functionality and guild information
    // If you need to access guild members or message content in the future, you'll add more intents here.
    // For now, Guilds is enough for slash commands and basic presence.
  ],
});

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, (readyClient) => {
  console.log(`🎉 Logged in as ${readyClient.user.tag}!`);
  console.log(
    `🤖 Bot is ready and online on ${readyClient.guilds.cache.size} server(s).`
  );

  // Register slash commands
  registerCommands();
});

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong! Checks if the bot is responsive."),
  new SlashCommandBuilder()
    .setName("server_layout")
    .setDescription(
      "Opens a form to define categories and roles for a new server layout."
    ),
  new SlashCommandBuilder()
    .setName("layout_help")
    .setDescription(
      "Shows how to format the input for the /server_layout command."
    ),
];

// Construct and prepare an instance of the REST module for command registration
const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    const commandsData = commands.map((command) => command.toJSON());

    if (GUILD_ID) {
      // Register commands to a specific guild (for testing/development)
      // This is faster than global commands.
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commandsData,
      });
      console.log(
        `Successfully reloaded ${commandsData.length} application (/) commands for guild ${GUILD_ID}.`
      );
    } else {
      // Register commands globally (for production)
      // Global commands can take up to an hour to update.
      await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: commandsData,
      });
      console.log(
        `Successfully reloaded ${commandsData.length} global application (/) commands.`
      );
    }
  } catch (error) {
    console.error("Error during command registration:", error);
  }
}

const pendingLayouts = new Map();

// Listen for interactions (slash commands AND modal submissions)
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === "ping") {
      await interaction.reply({ content: "Pong! 🏓", ephemeral: true });
    } else if (commandName === "server_layout") {
      try {
        const modal = new ModalBuilder()
          .setCustomId("serverSetupModal_v2")
          .setTitle("Server Layout Definition");

        const layoutInput = new TextInputBuilder()
          .setCustomId("layoutDefinition")
          .setLabel("Categories & Channels (see placeholder)")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder(
            `Category Name
  #text-channel
  *voice-channel (or v:)
Indent channels under category.`
          )
          .setRequired(true);

        const roleInput = new TextInputBuilder()
          .setCustomId("roleNames")
          .setLabel("Role Names (one per line)")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("e.g.,\nMember\nModerator\nAdmin")
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(layoutInput),
          new ActionRowBuilder().addComponents(roleInput)
        );
        await interaction.showModal(modal);
      } catch (error) {
        console.error("Modal show error:", error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Error opening form.",
            ephemeral: true,
          });
        }
      }
    } else if (commandName === "layout_help") {
      // --- HANDLER FOR NEW HELP COMMAND ---
      try {
        const helpEmbed = new EmbedBuilder()
          .setColor(0x0099ff) // Blue color
          .setTitle("📋 How to use `/server_layout`")
          .setDescription(
            "Use the `/server_layout` command to open a form. Here's how to fill it out:"
          )
          .addFields(
            {
              name: "1. Categories & Channels Field",
              value:
                "In the **first input box**, define your categories and the channels within them:\n\n" +
                "🔹 **Categories**: Type each category name on a new line.\n" +
                "🔹 **Channels**:\n" +
                "  - Underneath a category name, **indent** channel names (e.g., use 2 spaces or a Tab at the start of the line).\n" +
                "  - **Text Channels**: Prefix with `#` OR use no prefix (e.g., `  # general-chat` or `  rules`).\n" +
                "  - **Voice Channels**: Prefix with `*`, `v:`, or `voice:` (e.g., `  * Lounge`, `  v:gaming-vc`, `  voice:music room`).",
            },
            {
              name: "2. Roles Field",
              value:
                "In the **second input box**, list each role name you want to create, with each role on a new line.",
            },
            {
              name: '📝 Example for "Categories & Channels" field:',
              value:
                "```markdown\n" +
                "Community Hub\n" +
                "  # welcome\n" +
                "  # announcements\n" +
                "  * General Voice Chat\n" +
                "  v: Hangout Spot\n" +
                "Project Area\n" +
                "  # project-discussion\n" +
                "  voice: Team Meeting\n" +
                "Just A Category (no channels listed)\n" +
                "```",
            },
            {
              name: '👤 Example for "Roles" field:',
              value:
                "```markdown\n" +
                "Member\n" +
                "Contributor\n" +
                "Team Lead\n" +
                "```",
            }
          )
          .setFooter({
            text: "The bot will show a confirmation plan before creating anything.",
          });

        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
      } catch (error) {
        console.error("Error handling /layout_help command:", error);
        await interaction.reply({
          content: "Sorry, I couldn't display the help information right now.",
          ephemeral: true,
        });
      }
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === "serverSetupModal_v2") {
      try {
        await interaction.deferReply({ ephemeral: true });

        const layoutDefinitionRaw =
          interaction.fields.getTextInputValue("layoutDefinition");
        const roleNamesRaw = interaction.fields.getTextInputValue("roleNames");

        const rolesToCreate = roleNamesRaw
          .split("\n")
          .map((name) => name.trim())
          .filter((name) => name.length > 0);

        const layoutData = [];
        let currentCategoryData = null;
        const lines = layoutDefinitionRaw
          .split("\n")
          .map((line) => line.trimEnd());

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) continue;

          if (line.startsWith("  ") || line.startsWith("\t")) {
            if (currentCategoryData) {
              let channelName = trimmedLine;
              let channelType = ChannelType.GuildText;
              if (trimmedLine.startsWith("#"))
                channelName = trimmedLine.substring(1).trim();
              else if (trimmedLine.startsWith("*")) {
                channelName = trimmedLine.substring(1).trim();
                channelType = ChannelType.GuildVoice;
              } else if (trimmedLine.toLowerCase().startsWith("v:")) {
                channelName = trimmedLine.substring(2).trim();
                channelType = ChannelType.GuildVoice;
              } else if (trimmedLine.toLowerCase().startsWith("voice:")) {
                channelName = trimmedLine.substring(6).trim();
                channelType = ChannelType.GuildVoice;
              }
              if (channelName)
                currentCategoryData.channels.push({
                  name: channelName,
                  type: channelType,
                });
            }
          } else {
            currentCategoryData = { name: trimmedLine, channels: [] };
            layoutData.push(currentCategoryData);
          }
        }

        if (layoutData.length === 0 && rolesToCreate.length === 0) {
          await interaction.editReply({
            content:
              "ℹ️ Nothing to create. Please define categories/channels or roles.",
            ephemeral: true,
          });
          return;
        }

        // --- Store parsed data for confirmation ---
        const layoutId = interaction.id; // Use interaction ID as a temporary ID for the layout
        pendingLayouts.set(layoutId, {
          layoutData,
          rolesToCreate,
          originalInteractionId: interaction.id,
        });

        // --- BUILD CONFIRMATION EMBED ---
        const confirmationEmbed = new EmbedBuilder()
          .setColor(0x0099ff) // Blue for confirmation
          .setTitle("Confirm Server Layout Plan")
          .setDescription(
            'Please review the items that will be created. Press "Confirm" to proceed or "Cancel".'
          )
          .setTimestamp();

        if (layoutData.length > 0) {
          let categoriesFieldString = "";
          layoutData.forEach((catDef) => {
            categoriesFieldString += `**${catDef.name}**\n`;
            if (catDef.channels.length > 0) {
              catDef.channels.forEach(
                (chDef) =>
                  (categoriesFieldString += `  ${
                    chDef.type === ChannelType.GuildText ? "📝" : "🔊"
                  } ${chDef.name}\n`)
              );
            } else {
              categoriesFieldString += `  *(No channels for this category)*\n`;
            }
          });
          if (categoriesFieldString)
            confirmationEmbed.addFields({
              name: "Planned Categories & Channels",
              value:
                categoriesFieldString.substring(0, 1020) +
                (categoriesFieldString.length > 1020 ? "..." : ""),
            });
        }

        if (rolesToCreate.length > 0) {
          confirmationEmbed.addFields({
            name: "Planned Roles",
            value:
              rolesToCreate.join("\n").substring(0, 1020) +
              (rolesToCreate.join("\n").length > 1020 ? "..." : ""),
          });
        }

        const confirmButton = new ButtonBuilder()
          .setCustomId(`confirm_layout_${layoutId}`)
          .setLabel("Confirm")
          .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
          .setCustomId(`cancel_layout_${layoutId}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(
          confirmButton,
          cancelButton
        );

        await interaction.editReply({
          embeds: [confirmationEmbed],
          components: [row],
          ephemeral: true,
        });

        // Set a timeout to remove the pending layout if not confirmed
        setTimeout(() => {
          if (pendingLayouts.has(layoutId)) {
            pendingLayouts.delete(layoutId);
            console.log(
              `Pending layout ${layoutId} timed out and was removed.`
            );
            // Optionally, edit the original message to indicate timeout
            interaction
              .editReply({
                content: "Confirmation timed out.",
                embeds: [],
                components: [],
              })
              .catch(() => {}); // Ignore errors if message already gone
          }
        }, 60000); // 60 seconds timeout
      } catch (error) {
        console.error("Modal submit processing error:", error);
        await interaction
          .editReply({
            content: "Error preparing layout confirmation.",
            ephemeral: true,
          })
          .catch(console.error);
      }
    }
  } else if (interaction.isButton()) {
    // --- HANDLE BUTTON INTERACTIONS ---
    const [action, type, layoutId] = interaction.customId.split("_"); // e.g., confirm_layout_xyz

    if (type !== "layout" || !pendingLayouts.has(layoutId)) {
      // Potentially an old button or invalid customId
      await interaction
        .reply({
          content: "This confirmation is no longer valid or has expired.",
          ephemeral: true,
        })
        .catch(console.error);
      return;
    }

    await interaction.deferUpdate(); // Acknowledge button press immediately

    const { layoutData, rolesToCreate } = pendingLayouts.get(layoutId);
    pendingLayouts.delete(layoutId); // Remove from pending once handled

    if (action === "confirm") {
      await interaction.editReply({
        content: "⚙️ Applying server layout... please wait.",
        embeds: [],
        components: [],
      });

      const guild = interaction.guild;
      if (!guild) {
        // Should not happen if original interaction was in guild
        await interaction.followUp({
          content: "Error: Guild not found.",
          ephemeral: true,
        });
        return;
      }

      let createdItemsLog = { categories: [], roles: [], channels: {} };
      let errorLog = [];

      // --- Actual Creation Logic (copied from previous step) ---
      for (const categoryDef of layoutData) {
        try {
          const createdCategory = await guild.channels.create({
            name: categoryDef.name,
            type: ChannelType.GuildCategory,
            reason: `Layout by ${interaction.user.tag}`,
          });
          createdItemsLog.categories.push(createdCategory.name);
          createdItemsLog.channels[createdCategory.name] = [];
          for (const channelDef of categoryDef.channels) {
            try {
              const createdChannel = await guild.channels.create({
                name: channelDef.name,
                type: channelDef.type,
                parent: createdCategory.id,
                reason: `Layout by ${interaction.user.tag}`,
              });
              createdItemsLog.channels[createdCategory.name].push(
                `${channelDef.type === ChannelType.GuildText ? "📝" : "🔊"} ${
                  createdChannel.name
                }`
              );
            } catch (chError) {
              errorLog.push(
                `Channel "${channelDef.name}" (in ${categoryDef.name}): ${chError.message}`
              );
            }
          }
        } catch (catError) {
          errorLog.push(`Category "${categoryDef.name}": ${catError.message}`);
        }
      }
      for (const roleName of rolesToCreate) {
        try {
          const createdRole = await guild.roles.create({
            name: roleName,
            reason: `Layout by ${interaction.user.tag}`,
          });
          createdItemsLog.roles.push(createdRole.name);
        } catch (rError) {
          errorLog.push(`Role "${roleName}": ${rError.message}`);
        }
      }
      // --- End of Creation Logic ---

      const resultEmbed = new EmbedBuilder()
        .setColor(errorLog.length > 0 ? 0xff0000 : 0x00ff00)
        .setTitle("Server Layout Update Complete!")
        .setTimestamp();
      // (Build resultEmbed fields as in the previous step)
      if (createdItemsLog.categories.length > 0) {
        let categoriesFieldString = "";
        for (const catName of createdItemsLog.categories) {
          categoriesFieldString += `**${catName}**\n`;
          if (
            createdItemsLog.channels[catName] &&
            createdItemsLog.channels[catName].length > 0
          ) {
            createdItemsLog.channels[catName].forEach(
              (ch) => (categoriesFieldString += `  ${ch}\n`)
            );
          } else {
            categoriesFieldString += `  *(No channels created for this category)*\n`;
          }
        }
        if (categoriesFieldString)
          resultEmbed.addFields({
            name: "📁 Created Categories & Channels",
            value:
              categoriesFieldString.substring(0, 1020) +
              (categoriesFieldString.length > 1020 ? "..." : ""),
          });
      }
      if (createdItemsLog.roles.length > 0) {
        resultEmbed.addFields({
          name: "👤 Created Roles",
          value:
            createdItemsLog.roles.join("\n").substring(0, 1020) +
            (createdItemsLog.roles.join("\n").length > 1020 ? "..." : ""),
        });
      }
      if (errorLog.length > 0) {
        resultEmbed.addFields({
          name: "❌ Errors Encountered",
          value:
            errorLog.join("\n").substring(0, 1020) +
            (errorLog.join("\n").length > 1020 ? "..." : ""),
        });
      }
      if (
        createdItemsLog.categories.length === 0 &&
        createdItemsLog.roles.length === 0 &&
        layoutData.length === 0 &&
        rolesToCreate.length === 0 &&
        errorLog.length === 0
      ) {
        resultEmbed.setDescription(
          "ℹ️ No layout definition or roles were specified, or nothing was created."
        );
        resultEmbed.setColor(0xffff00);
      }

      await interaction.editReply({
        content: null,
        embeds: [resultEmbed],
        components: [],
      });
    } else if (action === "cancel") {
      await interaction.editReply({
        content: "❌ Server layout creation cancelled by user.",
        embeds: [],
        components: [],
      });
    }
  }
});

// Log in to Discord with your client's token
client.login(TOKEN).catch((error) => {
  console.error("Failed to log in:", error);
  if (error.code === "DisallowedIntents") {
    console.error(
      "Error: Missing Privileged Gateway Intents! Please ensure your bot has the necessary intents enabled in the Discord Developer Portal."
    );
  }
});

// Optional: Handle common errors and process exits gracefully
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});
