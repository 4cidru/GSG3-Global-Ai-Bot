import {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    Collection,
    SlashCommandBuilder
} from 'discord.js';
import dotenv from 'dotenv';
import { OpenAIOperations } from './openai_operations.js';
import { checkSafeSearch } from "./safeSearch.js";

dotenv.config();

// Initialize the Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
});

client.once('ready', async () => {
    console.log(`🤖 Discord Bot is online as ${client.user.tag}`);

    if (!process.env.GUILD_ID) {
        console.error("❌ GUILD_ID is missing in environment variables.");
        return;
    }

    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
        console.error("❌ Guild not found!");
        return;
    }

    try {
        await guild.commands.set([
            new SlashCommandBuilder()
                .setName('votekick')
                .setDescription('Creates a vote to kick a member.'),

            new SlashCommandBuilder()
                .setName('clear')
                .setDescription('Clears the last 50 messages from a specified user.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user whose messages you want to clear')
                        .setRequired(true)
                )
        ]);

        console.log("✅ Slash commands `/votekick` and `/clear` registered.");
    } catch (error) {
        console.error("❌ Error registering slash commands:", error);
    }
});

// Load Environment Variables
const supportChannelId = process.env.SUPPORT_CHANNEL_ID;
const ownerRoleId = process.env.OWNER_ROLE_ID;
const managerRoleId = process.env.MANAGER_ROLE_ID;
const adminRoleId = process.env.ADMIN_ROLE_ID;
const acknowledgedUsers = new Set();
const activePolls = new Collection();
const openaiOps = new OpenAIOperations(
    'You are a helpful Discord chatbot.',
    process.env.OPENAI_API_KEY,
    process.env.MODEL_NAME,
    process.env.HISTORY_LENGTH
);

    // 🔹 OpenAI Chat Response
    if (content.startsWith('%')) {
        const userMessage = content.substring(1).trim();
        if (!userMessage) return message.reply('Please provide a message after `%`.');

        try {
            const response = await openaiOps.make_openai_call(userMessage);
            await message.reply(response);
        } catch (error) {
            console.error('OpenAI API Error:', error);
            await message.reply('⚠️ Error processing your request.');
        }
    }

    // 🔹 AI Support for "support" Channel
    if (message.channel.id === supportChannelId) {
        console.log(`💬 Support message detected from ${message.author.username}: ${message.content}`);

        let roleToMention = null;
        if (message.content.includes("shop")) {
            roleToMention = `<@&${ownerRoleId}> or <@&${managerRoleId}>`;
        } else if (message.content.includes("discord") || message.content.includes("game")) {
            roleToMention = `<@&${adminRoleId}>`;
        }

        if (!acknowledgedUsers.has(message.author.id)) {
            acknowledgedUsers.add(message.author.id);
            await message.reply(`👋 Hi ${message.author.username}, a staff member will assist you shortly.`);
        }

        try {
            const aiResponse = await openaiOps.askAI(message.content);
            let reply = `${aiResponse}`;
            if (roleToMention) reply += `\n\n🔔 Notifying: ${roleToMention}`;
            await message.channel.send(reply);
        } catch (error) {
            console.error("AI Support Error:", error);
        }
    }
});

// 📊 Handle Slash Commands & Poll Button Clicks
client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
        if (interaction.commandName === 'votekick') {
            await interaction.reply({ content: "🗳️ Creating a kick poll...", ephemeral: true });

            const channel = interaction.channel;
            if (!channel) return interaction.followUp({ content: "❌ Could not access the channel.", ephemeral: true });

            sendPoll(channel);
        }

        if (interaction.commandName === 'clear') {
            const targetUser = interaction.options.getUser('user');
            if (!targetUser) {
                return interaction.reply({ content: "❌ You must mention a user!", ephemeral: true });
            }

            const channel = interaction.channel;
            if (!channel) {
                return interaction.reply({ content: "❌ Could not access the channel.", ephemeral: true });
            }

            try {
                const messages = await channel.messages.fetch({ limit: 100 });
                const userMessages = messages.filter(msg => msg.author.id === targetUser.id).first(50);

                if (userMessages.length === 0) {
                    return interaction.reply({ content: `⚠️ No messages found from ${targetUser.username}.`, ephemeral: true });
                }

                await channel.bulkDelete(userMessages, true);
                await interaction.reply({ content: `✅ Deleted ${userMessages.length} messages from ${targetUser.username}.` });
            } catch (error) {
                console.error("Clear command error:", error);
                await interaction.reply({ content: "❌ Error deleting messages.", ephemeral: true });
            }
        }
    }
});

// 🚀 Login the bot
client.login(process.env.DISCORD_BOT_TOKEN);
export { client };

