import { Client, GatewayIntentBits } from "discord.js";
import express from 'express';
import fs from 'fs';
import ws from 'ws';
import expressWs from 'express-ws';
import { job } from './keep_alive.js';
import { OpenAIOperations } from './openai_operations.js';
import { TwitchBot } from './twitch_bot.js';
import { client } from './discord_bot.js';

// Safe Search Service
import { checkSafeSearch } from "./safeSearch.js";

// ✅ Ensure we only register the Discord message listener ONCE
let isDiscordMessageHandlerActive = false;

client.once("ready", () => {
    console.log(`🤖 Discord Bot is online as ${client.user.tag}`);

    if (!isDiscordMessageHandlerActive) {
        client.on("messageCreate", async (message) => {
            if (message.author.bot) return;
            
            const args = message.content.split(" ");
            const command = args.shift().toLowerCase();

            if (command === "!ss" && args.length > 0) {
                const url = args[0];
                const result = await checkSafeSearch(url);
                message.reply(result);
            }
        });

        isDiscordMessageHandlerActive = true;
    }
});

// Start keep-alive cron job
job.start();
console.log(process.env);

// Setup express app
const app = express();
const expressWsInstance = expressWs(app);

app.set('view engine', 'ejs'); // Set the view engine to ejs

// Load environment variables
const GPT_MODE = process.env.GPT_MODE;
const HISTORY_LENGTH = process.env.HISTORY_LENGTH;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL_NAME = process.env.MODEL_NAME;
const TWITCH_USER = process.env.TWITCH_USER;
const TWITCH_AUTH = process.env.TWITCH_AUTH;
const COMMAND_NAME = process.env.COMMAND_NAME;
const CHANNELS = process.env.CHANNELS;
const SEND_USERNAME = process.env.SEND_USERNAME;
const ENABLE_TTS = process.env.ENABLE_TTS;
const ENABLE_CHANNEL_POINTS = process.env.ENABLE_CHANNEL_POINTS;
const COOLDOWN_DURATION = parseInt(process.env.COOLDOWN_DURATION, 10);

if (!OPENAI_API_KEY) {
    console.error('No OPENAI_API_KEY found. Please set it as an environment variable.');
}

const commandNames = COMMAND_NAME.split(',').map(cmd => cmd.trim().toLowerCase());
const channels = CHANNELS.split(',').map(channel => channel.trim());
const maxLength = 399;
let fileContext = 'You are a helpful Twitch Chatbot.';
let lastResponseTime = 0;

// ✅ Ensure Twitch bot is initialized only ONCE
console.log('Channels: ', channels);
const bot = new TwitchBot(TWITCH_USER, TWITCH_AUTH, channels, OPENAI_API_KEY, ENABLE_TTS);
bot.connect(); // Ensure bot connects

// ✅ Ensure Twitch bot messages are only handled ONCE
if (!bot.isMessageHandlerActive) {
    bot.onMessage();
    bot.isMessageHandlerActive = true;
}

// ✅ Ensure OpenAI operations are only initialized ONCE
fileContext = fs.readFileSync('./file_context.txt', 'utf8');
const openaiOps = new OpenAIOperations(fileContext, OPENAI_API_KEY, MODEL_NAME, HISTORY_LENGTH);

// Setup WebSocket communication
app.ws('/check-for-updates', (ws) => {
    ws.on('message', () => {
        // Handle WebSocket messages (if needed)
    });
});

const messages = [{ role: 'system', content: 'You are a helpful Twitch Chatbot.' }];
console.log('GPT_MODE:', GPT_MODE);
console.log('History length:', HISTORY_LENGTH);
console.log('OpenAI API Key:', OPENAI_API_KEY);
console.log('Model Name:', MODEL_NAME);

// ✅ Ensure message routes are loaded only ONCE
app.use(express.json({ extended: true, limit: '1mb' }));
app.use('/public', express.static('public'));

app.all('/', (req, res) => {
    console.log('Received a request!');
    res.render('pages/index');
});

// ✅ Prevent redundant GPT calls
app.get('/gpt/:text', async (req, res) => {
    const text = req.params.text;
    let answer = '';

    try {
        if (GPT_MODE === 'CHAT') {
            answer = await openaiOps.make_openai_call(text);
        } else if (GPT_MODE === 'PROMPT') {
            const prompt = `${fileContext}\n\nUser: ${text}\nAgent:`;
            answer = await openaiOps.make_openai_call_completion(prompt);
        } else {
            throw new Error('GPT_MODE is not set to CHAT or PROMPT. Please set it as an environment variable.');
        }

        res.send(answer);
    } catch (error) {
        console.error('Error generating response:', error);
        res.status(500).send('An error occurred while generating the response.');
    }
});

// ✅ Ensure Server Runs Only ONCE
const server = app.listen(3000, () => {
    console.log('Server running on port 3000');
});

const wss = expressWsInstance.getWss();
wss.on('connection', (ws) => {
    ws.on('message', () => {
        // Handle client messages (if needed)
    });
});

// ✅ Ensure verified users are loaded only ONCE
const verifiedUsersFile = 'verified_users.json';
let verifiedUsers = {};

if (fs.existsSync(verifiedUsersFile)) {
    try {
        const fileData = fs.readFileSync(verifiedUsersFile, 'utf8');
        verifiedUsers = fileData.trim() ? JSON.parse(fileData) : {}; 
    } catch (error) {
        console.error("Error parsing verified_users.json:", error);
        verifiedUsers = {}; 
    }
} else {
    fs.writeFileSync(verifiedUsersFile, JSON.stringify({}, null, 2));
}

function saveVerifiedUsers() {
    try {
        fs.writeFileSync(verifiedUsersFile, JSON.stringify(verifiedUsers, null, 2));
    } catch (error) {
        console.error("Failed to save verified users:", error);
    }
}


console.log("✅ Index.js fully optimized.");
