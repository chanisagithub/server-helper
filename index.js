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
  PermissionsBitField 
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

async function applyPermissionPreset(guild, channelOrCategory, permString, createdOrFetchedRoles, errorLog) {
    if (!permString) return; 

    const everyoneRole = guild.roles.everyone;
    const overwrites = []; 

    // Parse "private: Role1, Role2, ..."
    const privateMatch = permString.match(/^private:\s*(.+)$/i);
    if (privateMatch) {
        const roleNames = privateMatch[1].split(',').map(name => name.trim().toLowerCase()); // Standardize to lowercase for lookup

        // Deny @everyone ViewChannel
        overwrites.push({
            id: everyoneRole.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
        });

        for (const roleName of roleNames) {
            const role = createdOrFetchedRoles.get(roleName.toLowerCase()) || // Check roles created in this run
                         guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase()); // Check existing roles
            
            if (role) {
                overwrites.push({
                    id: role.id,
                    allow: [PermissionsBitField.Flags.ViewChannel], // Allow specified roles to view
                    // For now, other permissions (SendMessages, Connect, etc.) will be default for these roles.
                    // We could expand this later to grant more comprehensive "access" permissions.
                });
            } else {
                const warningMsg = `Role "${roleName}" for private preset on "${channelOrCategory.name}" not found.`;
                console.warn(warningMsg);
                errorLog.push(`Perm Warning: ${warningMsg}`); // Add to user-facing error log
            }
        }
        console.log(`Prepared 'private' permissions for ${channelOrCategory.name} targeting roles: ${roleNames.join(', ')}`);
    }

    // TODO: Add parsing for other presets like [type: announcement; posters: ...] here later

    if (overwrites.length > 0) {
        try {
            // Get existing overwrites to merge, if channelOrCategory already has some
            const existingOverwrites = channelOrCategory.permissionOverwrites.cache.map(ov => ({
                id: ov.id,
                allow: ov.allow.bitfield,
                deny: ov.deny.bitfield,
                type: ov.type
            }));
            
            // Naive merge: new overwrites take precedence for the same ID.
            // A more sophisticated merge might be needed if presets conflict.
            const finalOverwrites = [...existingOverwrites];
            for (const newOverwrite of overwrites) {
                const existingIndex = finalOverwrites.findIndex(ov => ov.id === newOverwrite.id);
                if (existingIndex !== -1) {
                    // If an overwrite for this role/member already exists, replace it
                    finalOverwrites[existingIndex] = newOverwrite;
                } else {
                    finalOverwrites.push(newOverwrite);
                }
            }
            
            await channelOrCategory.permissionOverwrites.set(finalOverwrites, `Layout by bot: ${permString}`);
            console.log(`Applied permissions "${permString}" to ${channelOrCategory.name}`);
        } catch (permError) {
            const errorMsg = `Failed to apply permissions "${permString}" to "${channelOrCategory.name}"`;
            console.error(errorMsg + ":", permError);
            errorLog.push(`Perm Error: ${errorMsg} - ${permError.message}`);
        }
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
    } else if (commandName === 'layout_help') { 
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
                                   "  *(Replace RoleName1, etc., with actual role names. These roles should either exist on your server or be defined in the 'Roles Field' of the same setup.)*\n" +
                                   "- **Effect**:\n" +
                                   "     - `@everyone` will be **denied** permission to view.\n" +
                                   "     - The listed roles will be **granted** permission to view.\n" +
                                   "- **Category Example**: `Staff Discussion [private: Staff, Admin]`\n" +
                                   "- **Channel Example**: `  #important-updates [private: Members]`\n\n" +
                                   "*(More permission presets like 'announcement' channels might be added in the future!)*"
                        },
                        {
                            name: '2. Roles Field',
                            value: "In the **second input box**, list each role name you want to create, with each role on a new line. If you used role names in permission settings, ensure they are defined here or already exist on the server."
                        },
                        { // --- UPDATED EXAMPLE FIELD ---
                            name: '📝 Example for "Categories & Channels" field (with permissions):',
                            value: "```markdown\n" +
                                   "Community Hub\n" +
                                   "  # welcome\n" +
                                   "  # announcements\n" +
                                   "  * General Voice Chat [private: Members, VIP]\n" +
                                   "Staff Section [private: Staff, Admin]\n" +
                                   "  # mod-chat\n" +
                                   "  # admin-only-lounge\n" +
                                   "  * Staff Meeting VC\n" +
                                   "Project Alpha [private: Project Alpha Team, Staff]\n" +
                                   "  # design-discussion\n" +
                                   "  voice: Alpha Team Voice\n" +
                                   "Public Zone [private: @everyone]\n" + 
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
                                   "```"
                        }
                    )
                    .setFooter({ text: 'The bot will show a confirmation plan before creating anything.' });

                await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
            } catch (error) {
                console.error("Error handling /layout_help command:", error);
                await interaction.reply({ content: "Sorry, I couldn't display the help information right now.", ephemeral: true });
            }
        }
  }
  if (interaction.isModalSubmit()) {
              const layoutId = interaction.id; 
              const layoutIdForTimeout = layoutId; // This line should be correct

              setTimeout(() => {
                  // CORRECTED: Use layoutIdForTimeout consistently
                  if (pendingLayouts.has(layoutIdForTimeout)) { 
                      pendingLayouts.delete(layoutIdForTimeout);
                      console.log(`Pending layout ${layoutIdForTimeout} timed out and was removed.`);
                  } else {
                      console.log(`Timeout executed for layoutId ${layoutIdForTimeout}, but it was already processed or removed from pendingLayouts.`);
                  }
              }, 60000);
      
        if (interaction.customId === 'serverSetupModal_v2') {
            try {
                await interaction.deferReply({ ephemeral: true });

                const layoutDefinitionRaw = interaction.fields.getTextInputValue('layoutDefinition');
                const roleNamesRaw = interaction.fields.getTextInputValue('roleNames');

                const rolesToCreateFromInput = roleNamesRaw.split('\n').map(name => name.trim()).filter(name => name.length > 0);
                
                const layoutData = []; // Will store { name, channels: [{ name, type, permString }], permString }
                let currentCategoryData = null;
                const lines = layoutDefinitionRaw.split('\n').map(line => line.trimEnd());

                for (const line of lines) {
                    const originalLineTrimmed = line.trim(); // For channel name prefix parsing
                    if (originalLineTrimmed.length === 0) continue;

                    // --- UPDATED PARSING to extract permission string ---
                    let namePart = originalLineTrimmed;
                    let permString = null;
                    // Regex to capture (name part) and [permission string part]
                    // It handles spaces before the [ and makes the permission part optional
                    const permMatch = originalLineTrimmed.match(/^(.*?)\s*(\[(.*?)\])?$/);
                    if (permMatch) {
                        namePart = permMatch[1].trim(); // This is the name without the [perms]
                        if (permMatch[3]) { // permMatch[3] is the content inside brackets
                            permString = permMatch[3].trim();
                        }
                    }
                    // --- END OF UPDATED PARSING ---

                    if (line.startsWith('  ') || line.startsWith('\t')) { // Channel line
                        if (currentCategoryData) {
                            let channelName = namePart; // Use namePart for prefix checks
                            let channelType = ChannelType.GuildText;
                            
                            // Re-evaluate prefixes based on namePart (which has [perms] stripped)
                            if (namePart.startsWith('#')) {
                                channelName = namePart.substring(1).trim();
                            } else if (namePart.startsWith('*')) {
                                channelName = namePart.substring(1).trim();
                                channelType = ChannelType.GuildVoice;
                            } else if (namePart.toLowerCase().startsWith('v:')) {
                                channelName = namePart.substring(2).trim();
                                channelType = ChannelType.GuildVoice;
                            } else if (namePart.toLowerCase().startsWith('voice:')) {
                                channelName = namePart.substring(6).trim();
                                channelType = ChannelType.GuildVoice;
                            } else {
                                // If no prefix, it's the namePart itself, default to text
                                channelName = namePart;
                            }

                            if (channelName) { // Ensure channelName isn't empty after stripping
                                currentCategoryData.channels.push({ name: channelName, type: channelType, permString: permString });
                            }
                        }
                    } else { // Category line
                        // namePart already has [perms] stripped if they existed
                        currentCategoryData = { name: namePart, channels: [], permString: permString };
                        layoutData.push(currentCategoryData);
                    }
                }

                if (layoutData.length === 0 && rolesToCreateFromInput.length === 0) {
                    await interaction.editReply({ content: "ℹ️ Nothing to create. Please define categories/channels or roles.", ephemeral: true });
                    return;
                }
                
                
                // Store rolesToCreateFromInput instead of rolesToCreate (which was defined later)
                pendingLayouts.set(layoutId, { layoutData, rolesToCreate: rolesToCreateFromInput, originalInteractionId: interaction.id });

                                
                const confirmButton = new ButtonBuilder().setCustomId(`confirm_layout_${layoutId}`).setLabel('Confirm').setStyle(ButtonStyle.Success);
                const cancelButton = new ButtonBuilder().setCustomId(`cancel_layout_${layoutId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger);
                const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

                // --- BUILD CONFIRMATION EMBED (Needs update later to show planned perms) ---
                const confirmationEmbed = new EmbedBuilder()
                    .setColor(0x0099FF) 
                    .setTitle('Confirm Server Layout Plan')
                    .setDescription('Review items to be created. Permissions will be applied as specified.\n*(Detailed permission plan in embed coming soon)*')
                    .setTimestamp();

                await interaction.editReply({ embeds: [confirmationEmbed], components: [row], ephemeral: true });
                if (layoutData.length > 0) {
                    let categoriesFieldString = "";
                    layoutData.forEach(catDef => {
                        categoriesFieldString += `**${catDef.name}** ${catDef.permString ? `*[${catDef.permString}]*` : ''}\n`;
                        if (catDef.channels.length > 0) {
                            catDef.channels.forEach(chDef => {
                                let permSuffix = '';
                                if (chDef.permString) {
                                    permSuffix = '*[' + chDef.permString + ']*';
                                }
                                categoriesFieldString += `  ${chDef.type === ChannelType.GuildText ? '📝' : '🔊'} ${chDef.name} ${permSuffix}\n`;
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
                
                setTimeout(() => {
                if (pendingLayouts.has(layoutIdForTimeout)) {
                    pendingLayouts.delete(layoutIdForTimeout);
                    console.log(`Pending layout ${layoutIdForTimeout} timed out and was removed.`);
                } else {
                    console.log(`Timeout executed for layoutId ${layoutIdForTimeout}, but it was already processed or removed from pendingLayouts.`);
                }
            }, 60000);

            } catch (error) { 
                console.error("Modal submit processing error:", error);
            // ... (Your updated catch block logic that defines its OWN error embed) ...
            const errorProcessingEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⚠️ Error Processing Submission')
                // ... etc.
            await interaction.editReply({ embeds: [errorProcessingEmbed], components: [] }).catch(e => console.error("Failed to edit reply with error embed:", e));
        }
        }
    } else if (interaction.isButton()) {
        const buttonReceivedTime = Date.now();
        console.log(`[${new Date(buttonReceivedTime).toISOString()}] Button interaction received: ${interaction.customId}, User: ${interaction.user.tag}`);

        const [action, type, layoutId] = interaction.customId.split('_');

        if (type !== 'layout' || !pendingLayouts.has(layoutId)) {
            const checkFailedTime = Date.now();
            console.log(`[${new Date(checkFailedTime).toISOString()}] Button invalid/expired (pendingLayouts check for layoutId: ${layoutId}). User: ${interaction.user.tag}. Time taken for check: ${checkFailedTime - buttonReceivedTime}ms. Replying.`);
            try {
                await interaction.reply({ content: "This confirmation is no longer valid or has expired.", ephemeral: true });
            } catch (replyError) {
                console.error(`[${new Date().toISOString()}] Failed to send 'expired' reply for button ${interaction.customId}. User: ${interaction.user.tag}. Error:`, replyError);
            }
            return;
        }
        
        const beforeDeferTime = Date.now();
        const timeElapsedBeforeDefer = beforeDeferTime - buttonReceivedTime;
        console.log(`[${new Date(beforeDeferTime).toISOString()}] Attempting to deferUpdate for button: ${interaction.customId}. User: ${interaction.user.tag}. Time elapsed before defer call: ${timeElapsedBeforeDefer}ms`);

        try {
            await interaction.deferUpdate();
            const afterDeferTime = Date.now();
            console.log(`[${new Date(afterDeferTime).toISOString()}] deferUpdate SUCCEEDED for: ${interaction.customId}. User: ${interaction.user.tag}. Total time to defer: ${afterDeferTime - buttonReceivedTime}ms`);
        } catch (error) {
            const deferFailedTime = Date.now();
            console.error(`[${new Date(deferFailedTime).toISOString()}] deferUpdate FAILED for ${interaction.customId}. User: ${interaction.user.tag}. Time elapsed before failure: ${deferFailedTime - buttonReceivedTime}ms. Error:`, error);
            // If deferUpdate fails, we generally cannot interact further with THIS button interaction.
            // The user will see "This interaction failed" on their Discord client.
            return; // Stop further processing for this interaction.
        }

        // If deferUpdate succeeded, proceed:
        console.log(`[${new Date().toISOString()}] Defer successful. Processing action: ${action} for layoutId: ${layoutId}. User: ${interaction.user.tag}`);
        const { layoutData, rolesToCreate } = pendingLayouts.get(layoutId); // rolesToCreate is correct here
        pendingLayouts.delete(layoutId); 

        if (action === 'confirm') {
            // ... rest of your confirm logic (creating roles, categories, channels)
            // Ensure this part is also robust and has error handling.
            // For brevity, I'm not repeating the entire creation logic here, but it should follow.
            // Example of starting the confirm logic:
            await interaction.editReply({ content: '⚙️ Applying server layout... please wait.', embeds: [], components: [] });
            const guild = interaction.guild;
            if (!guild) { 
                console.error(`[${new Date().toISOString()}] Guild not found during confirm action for layoutId: ${layoutId}. User: ${interaction.user.tag}`);
                await interaction.followUp({ content: 'Error: Guild not found when trying to apply layout.', ephemeral: true }).catch(e => console.error("FollowUp error:", e));
                return;
            }

            let createdItemsLog = { categories: [], roles: [], channels: {} };
            let errorLog = [];
            let createdOrFetchedRoles = new Map();

            // --- STEP 1: Create All Roles ---
            if (rolesToCreate && rolesToCreate.length > 0) {
                for (const roleName of rolesToCreate) {
                    try {
                        const existingRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
                        if (existingRole) {
                            console.log(`Role "${roleName}" already exists. Using existing.`);
                            createdOrFetchedRoles.set(roleName.toLowerCase(), existingRole);
                        } else {
                            const createdRole = await guild.roles.create({ name: roleName, reason: `Layout by ${interaction.user.tag}` });
                            createdItemsLog.roles.push(createdRole.name); 
                            createdOrFetchedRoles.set(roleName.toLowerCase(), createdRole);
                            console.log(`Created role: ${createdRole.name}`);
                        }
                    } catch (rError) { 
                        errorLog.push(`Role "${roleName}": ${rError.message}`); 
                        console.error(`Fail creating role "${roleName}":`, rError.message);
                    }
                }
            }

            // --- STEP 2: Create Categories and their Channels, then Apply Permissions ---
            for (const categoryDef of layoutData) {
                let createdCategory = null;
                try {
                    let existingCategory = guild.channels.cache.find(c => c.name.toLowerCase() === categoryDef.name.toLowerCase() && c.type === ChannelType.GuildCategory);
                    if (existingCategory) {
                        createdCategory = existingCategory;
                        console.log(`Category "${categoryDef.name}" already exists. Using existing.`);
                    } else {
                        createdCategory = await guild.channels.create({ name: categoryDef.name, type: ChannelType.GuildCategory, reason: `Layout by ${interaction.user.tag}` });
                        createdItemsLog.categories.push(createdCategory.name);
                        console.log(`Created category: ${createdCategory.name}`);
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
                                console.log(`Channel "${channelDef.name}" in category "${createdCategory.name}" already exists. Using existing.`);
                            } else {
                                createdChannel = await guild.channels.create({ 
                                    name: channelDef.name, type: channelDef.type, parent: createdCategory.id, reason: `Layout by ${interaction.user.tag}` 
                                });
                                createdItemsLog.channels[createdCategory.name].push(`${channelDef.type === ChannelType.GuildText ? '📝' : '🔊'} ${createdChannel.name}`);
                                console.log(`  Created channel: ${createdChannel.name} in ${createdCategory.name}`);
                            }
                            if (createdChannel && channelDef.permString) {
                                await applyPermissionPreset(guild, createdChannel, channelDef.permString, createdOrFetchedRoles, errorLog);
                            }
                        } catch (chError) { 
                            errorLog.push(`Channel "${channelDef.name}" (in ${categoryDef.name}): ${chError.message}`); 
                            console.error(`Fail creating/finding channel "${channelDef.name}" in "${createdCategory.name}":`, chError.message);
                        }
                    }
                } catch (catError) { 
                    errorLog.push(`Category "${categoryDef.name}": ${catError.message}`); 
                    console.error(`Fail creating/finding category "${categoryDef.name}":`, catError.message);
                }
            }
            
            const resultEmbed = new EmbedBuilder() /* ... build your result embed ... */ ;
            resultEmbed.setColor(errorLog.length > 0 ? 0xFF0000 : 0x00FF00)
                .setTitle('Server Layout Update Complete!')
                .setTimestamp();
            // (Populate fields as before)
            // ...
            if (createdItemsLog.categories.length > 0 || Object.values(createdItemsLog.channels).some(chArr => chArr.length > 0)) { /* ... */ }
            if (createdItemsLog.roles.length > 0) { /* ... */ }
            if (errorLog.length > 0) { /* ... */ }
            if (!resultEmbed.data.fields && !resultEmbed.data.description) { /* ... */ }


            await interaction.editReply({ content: null, embeds: [resultEmbed], components: [] });

        } else if (action === 'cancel') {
            console.log(`[${new Date().toISOString()}] Cancel action chosen for layoutId: ${layoutId}. User: ${interaction.user.tag}`);
            await interaction.editReply({ content: '❌ Server layout creation cancelled by user.', embeds: [], components: [] });
        }
    }
    // ... (process.on unhandledRejection) ...

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
