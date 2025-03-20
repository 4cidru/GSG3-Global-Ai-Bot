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

// -----------------------------------------------------------------------------
//Parse environment variables & set defaults
// -----------------------------------------------------------------------------
if (!OPENAI_API_KEY) {
    console.error('No OPENAI_API_KEY found. Please set it as an environment variable.');
}

const commandNames = COMMAND_NAME
  ? COMMAND_NAME.split(',').map(cmd => cmd.trim().toLowerCase())
  : [];

// Convert CHANNELS string to array
const channels = CHANNELS
  ? CHANNELS.split(',').map(channel => channel.trim())
  : [];

const maxLength = 399;
let fileContext = 'You are a helpful Twitch Chatbot.';
let lastResponseTime = 0;

console.log('Channels: ', channels);

// -----------------------------------------------------------------------------
//  Instantiate and Configure the Twitch Bot (ONE TIME)
// -----------------------------------------------------------------------------
const bot = new TwitchBot(TWITCH_USER, TWITCH_OAUTH, channels, OPENAI_API_KEY, ENABLE_TTS);
bot.connect();
bot.onMessage();

// -----------------------------------------------------------------------------
//  Instantiate and Configure the Discord Bot (ONE TIME)
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// 6) Keep-Alive Cron Job
// -----------------------------------------------------------------------------
job.start();
console.log('Keep-alive job started.');

// -----------------------------------------------------------------------------
// 7) Setup Express + WebSockets
// -----------------------------------------------------------------------------
const app = express();
const expressWsInstance = expressWs(app);

app.set('view engine', 'ejs');
app.use(express.json({ extended: true, limit: '1mb' }));
app.use('/public', express.static('public'));

// -----------------------------------------------------------------------------
// 8) Load/OpenAI Operations
// -----------------------------------------------------------------------------
fileContext = fs.readFileSync('./file_context.txt', 'utf8');
const openaiOps = new OpenAIOperations(fileContext, OPENAI_API_KEY, MODEL_NAME, HISTORY_LENGTH);

const messages = [{ role: 'system', content: 'You are a helpful Twitch Chatbot.' }];

// -----------------------------------------------------------------------------
//  Express Routes
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
// 10) WebSocket Handling
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
// 11) Start the Server (ONE TIME)
// -----------------------------------------------------------------------------
const server = app.listen(3000, () => {
    console.log('Server running on port 3000');
});

console.log("✅ Index.js fully optimized.");
