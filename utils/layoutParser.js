const { ChannelType } = require('discord.js');

function parseLayout(layoutDefinitionRaw) {
    const layoutData = [];
    let currentCategoryData = null;
    const lines = layoutDefinitionRaw.split('\n').map(line => line.trimEnd());

    for (const line of lines) {
        const originalLineTrimmed = line.trim();
        if (originalLineTrimmed.length === 0) continue;

        let namePart = originalLineTrimmed;
        let permString = null;
        const permMatch = originalLineTrimmed.match(/^(.*?)\s*(\[(.*?)\])?$/);
        if (permMatch) {
            namePart = permMatch[1].trim();
            if (permMatch[3]) {
                permString = permMatch[3].trim();
            }
        }

        if (line.startsWith('  ') || line.startsWith('\t')) {
            if (currentCategoryData) {
                let channelName = namePart;
                let channelType = ChannelType.GuildText;

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
                    channelName = namePart;
                }

                if (channelName) {
                    currentCategoryData.channels.push({ name: channelName, type: channelType, permString: permString });
                }
            }
        } else {
            currentCategoryData = { name: namePart, channels: [], permString: permString };
            layoutData.push(currentCategoryData);
        }
    }
    return layoutData;
}

module.exports = { parseLayout };
