const assert = require('assert');
const { parseLayout } = require('../utils/layoutParser');
const { ChannelType } = require('discord.js');

// Test case 1: Basic layout
const layout1 = `
Community Hub
  # welcome
  # announcements
  * General Voice Chat
`;
const expected1 = [
    {
        name: 'Community Hub',
        permString: null,
        channels: [
            { name: 'welcome', type: ChannelType.GuildText, permString: null },
            { name: 'announcements', type: ChannelType.GuildText, permString: null },
            { name: 'General Voice Chat', type: ChannelType.GuildVoice, permString: null },
        ],
    },
];
assert.deepStrictEqual(parseLayout(layout1), expected1, 'Test Case 1 Failed');

// Test case 2: Layout with permissions
const layout2 = `
Staff Section [private: Staff, Admin]
  # mod-chat
  # admin-only-lounge [private: Admin]
`;
const expected2 = [
    {
        name: 'Staff Section',
        permString: 'private: Staff, Admin',
        channels: [
            { name: 'mod-chat', type: ChannelType.GuildText, permString: null },
            { name: 'admin-only-lounge', type: ChannelType.GuildText, permString: 'private: Admin' },
        ],
    },
];
assert.deepStrictEqual(parseLayout(layout2), expected2, 'Test Case 2 Failed');

// Test case 3: Layout with different voice channel prefixes
const layout3 = `
Voice Channels
  v: Lobby
  voice: Gaming
  * Music
`;
const expected3 = [
    {
        name: 'Voice Channels',
        permString: null,
        channels: [
            { name: 'Lobby', type: ChannelType.GuildVoice, permString: null },
            { name: 'Gaming', type: ChannelType.GuildVoice, permString: null },
            { name: 'Music', type: ChannelType.GuildVoice, permString: null },
        ],
    },
];
assert.deepStrictEqual(parseLayout(layout3), expected3, 'Test Case 3 Failed');

console.log('All layout parser tests passed!');
