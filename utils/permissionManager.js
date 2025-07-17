const { PermissionsBitField } = require('discord.js');

async function applyPermissionPreset(guild, channelOrCategory, permString, createdOrFetchedRoles, errorLog) {
    if (!permString) return;

    const everyoneRole = guild.roles.everyone;
    const overwrites = [];

    const privateMatch = permString.match(/^private:\s*(.+)$/i);
    const announcementMatch = permString.match(/^announcement:\s*(.+)$/i);

    if (privateMatch) {
        const roleNames = privateMatch[1].split(',').map(name => name.trim().toLowerCase());

        overwrites.push({
            id: everyoneRole.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
        });

        for (const roleName of roleNames) {
            const role = createdOrFetchedRoles.get(roleName.toLowerCase()) ||
                         guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

            if (role) {
                overwrites.push({
                    id: role.id,
                    allow: [PermissionsBitField.Flags.ViewChannel],
                });
            } else {
                const warningMsg = `Role "${roleName}" for private preset on "${channelOrCategory.name}" not found.`;
                console.warn(warningMsg);
                errorLog.push(`Perm Warning: ${warningMsg}`);
            }
        }
        console.log(`Prepared 'private' permissions for ${channelOrCategory.name} targeting roles: ${roleNames.join(', ')}`);
    } else if (announcementMatch) {
        const roleNames = announcementMatch[1].split(',').map(name => name.trim().toLowerCase());
        const posterRoles = [];

        for (const roleName of roleNames) {
            const role = createdOrFetchedRoles.get(roleName.toLowerCase()) ||
                         guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
            if (role) {
                posterRoles.push(role);
            } else {
                const warningMsg = `Role "${roleName}" for announcement preset on "${channelOrCategory.name}" not found.`;
                console.warn(warningMsg);
                errorLog.push(`Perm Warning: ${warningMsg}`);
            }
        }

        overwrites.push({
            id: everyoneRole.id,
            allow: [PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ViewChannel],
            deny: [PermissionsBitField.Flags.SendMessages],
        });

        for (const role of posterRoles) {
            overwrites.push({
                id: role.id,
                allow: [PermissionsBitField.Flags.SendMessages],
            });
        }
        console.log(`Prepared 'announcement' permissions for ${channelOrCategory.name} targeting roles: ${roleNames.join(', ')}`);
    }

    if (overwrites.length > 0) {
        try {
            const existingOverwrites = channelOrCategory.permissionOverwrites.cache.map(ov => ({
                id: ov.id,
                allow: ov.allow.bitfield,
                deny: ov.deny.bitfield,
                type: ov.type
            }));

            const finalOverwrites = [...existingOverwrites];
            for (const newOverwrite of overwrites) {
                const existingIndex = finalOverwrites.findIndex(ov => ov.id === newOverwrite.id);
                if (existingIndex !== -1) {
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

module.exports = { applyPermissionPreset };
