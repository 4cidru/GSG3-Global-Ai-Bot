import { Client, GatewayIntentBits } from "discord.js";
import express from 'express';
import fs from 'fs';
import ws from 'ws';
import expressWs from 'express-ws';
import { job } from './keep_alive.js';
import { OpenAIOperations } from './openai_operations.js';
import { client } from './discord_bot.js';
import { checkSafeSearch } from "./safeSearch.js";
import { TwitchBot } from './twitch_bot.js';

// -----------------------------------------------------------------------------
// 1) Load environment variables
// -----------------------------------------------------------------------------
const GPT_MODE = process.env.GPT_MODE;
const HISTORY_LENGTH = process.env.HISTORY_LENGTH;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL_NAME = process.env.MODEL_NAME;

// Twitch credentials & config
const TWITCH_USER = process.env.TWITCH_USER;
const TWITCH_OAUTH = process.env.TWITCH_OAUTH;
const CHANNELS = process.env.CHANNELS;
const ENABLE_TTS = process.env.ENABLE_TTS;
const ENABLE_CHANNEL_POINTS = process.env.ENABLE_CHANNEL_POINTS;
const COMMAND_NAME = process.env.COMMAND_NAME;
const COOLDOWN_DURATION = parseInt(process.env.COOLDOWN_DURATION, 10) || 0;

// Discord client config is already handled in ./discord_bot.js
// Just be sure the client is not re-instantiated.

// -----------------------------------------------------------------------------
// 2) Parse environment variables & set defaults
// -----------------------------------------------------------------------------
if (!OPENAI_API_KEY) {
    console.error('No OPENAI_API_KEY found. Please set it as an environment variable.');
}

const commandNames = COMMAND_NAME
  ? COMMAND_NAME.split(',').map(cmd => cmd.trim().toLowerCase())
  : [];

// IMPORTANT: Convert CHANNELS string into an array
const channels = CHANNELS
  ? CHANNELS.split(',').map(channel => channel.trim())
  : [];

const maxLength = 399;
let fileContext = 'You are a helpful Twitch Chatbot.';
let lastResponseTime = 0;

// -----------------------------------------------------------------------------
// 3) Instantiate and Configure the Twitch Bot (ONE TIME)
// -----------------------------------------------------------------------------
console.log('Channels: ', channels);

// Pass `channels` (the array) to the TwitchBot, not the raw `CHANNELS` string
const bot = new TwitchBot(TWITCH_USER, TWITCH_OAUTH, channels, OPENAI_API_KEY, ENABLE_TTS);

// Connect and attach the message handler once
bot.connect();
bot.onMessage();

// -----------------------------------------------------------------------------
// 4) Instantiate and Configure the Discord Bot (ONE TIME)
// -----------------------------------------------------------------------------
let isDiscordMessageHandlerActive = false;

client.once("ready", () => {
    console.log(`🤖 Discord Bot is online as ${client.user.tag}`);

    // Only attach the Discord message handler once
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

// -----------------------------------------------------------------------------
// 5) Keep-Alive Cron Job
// -----------------------------------------------------------------------------
job.start();
console.log('Keep-alive job started.');

// -----------------------------------------------------------------------------
// 6) Setup Express + WebSockets
// -----------------------------------------------------------------------------
const app = express();
const expressWsInstance = expressWs(app);

app.set('view engine', 'ejs'); // Set the view engine to ejs
app.use(express.json({ extended: true, limit: '1mb' }));
app.use('/public', express.static('public'));

// -----------------------------------------------------------------------------
// 7) Load/OpenAI Operations
// -----------------------------------------------------------------------------
fileContext = fs.readFileSync('./file_context.txt', 'utf8');
const openaiOps = new OpenAIOperations(fileContext, OPENAI_API_KEY, MODEL_NAME, HISTORY_LENGTH);

const messages = [{ role: 'system', content: 'You are a helpful Twitch Chatbot.' }];

// -----------------------------------------------------------------------------
// 8) Express Routes
// -----------------------------------------------------------------------------
app.all('/', (req, res) => {
    console.log('Received a request!');
    res.render('pages/index');
});

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

// -----------------------------------------------------------------------------
// 9) WebSocket Handling
// -----------------------------------------------------------------------------
app.ws('/check-for-updates', (ws) => {
    ws.on('message', () => {
        // Handle WebSocket messages (if needed)
    });
});

const wss = expressWsInstance.getWss();
wss.on('connection', (ws) => {
    ws.on('message', () => {
        // Handle client messages (if needed)
    });
});

// -----------------------------------------------------------------------------
// 10) Start the Server (ONE TIME)
// -----------------------------------------------------------------------------
const server = app.listen(3000, () => {
    console.log('Server running on port 3000');
});

console.log("✅ Index.js fully optimized.");
