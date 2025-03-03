import express from 'express';
import fs from 'fs';
import ws from 'ws';
import expressWs from 'express-ws';
import {job} from './keep_alive.js';
import {OpenAIOperations} from './openai_operations.js';
import {TwitchBot} from './twitch_bot.js';

// Safe Search Service
import { checkSafeSearch } from "./safeSearch.js";

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
// Start keep alive cron job
job.start();
console.log(process.env);

// Setup express app
const app = express();
const expressWsInstance = expressWs(app);

// Set the view engine to ejs
app.set('view engine', 'ejs');

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
const COOLDOWN_DURATION = parseInt(process.env.COOLDOWN_DURATION, 10); // Cooldown duration in seconds

if (!OPENAI_API_KEY) {
    console.error('No OPENAI_API_KEY found. Please set it as an environment variable.');
}

const commandNames = COMMAND_NAME.split(',').map(cmd => cmd.trim().toLowerCase());
const channels = CHANNELS.split(',').map(channel => channel.trim());
const maxLength = 399;
let fileContext = 'You are a helpful Twitch Chatbot.';
let lastUserMessage = '';
let lastResponseTime = 0; // Track the last response time

// Setup Twitch bot
console.log('Channels: ', channels);
const bot = new TwitchBot(TWITCH_USER, TWITCH_AUTH, channels, OPENAI_API_KEY, ENABLE_TTS);

// Setup OpenAI operations
fileContext = fs.readFileSync('./file_context.txt', 'utf8');
const openaiOps = new OpenAIOperations(fileContext, OPENAI_API_KEY, MODEL_NAME, HISTORY_LENGTH);

// Setup Twitch bot callbacks
bot.onConnected((addr, port) => {
    console.log(`* Connected to ${addr}:${port}`);
    channels.forEach(channel => {
        console.log(`* Joining ${channel}`);
        console.log(`* Saying hello in ${channel}`);
    });
});

bot.onDisconnected(reason => {
    console.log(`Disconnected: ${reason}`);
});

// Connect bot
bot.connect(
    () => {
        console.log('Bot connected!');
    },
    error => {
        console.error('Bot couldn\'t connect!', error);
    }
);

bot.onMessage(async (channel, user, message, self) => {
    if (self) return;

    const currentTime = Date.now();
    const elapsedTime = (currentTime - lastResponseTime) / 1000; // Time in seconds

    if (ENABLE_CHANNEL_POINTS === 'true' && user['msg-id'] === 'highlighted-message') {
        console.log(`Highlighted message: ${message}`);
        if (elapsedTime < COOLDOWN_DURATION) {
            bot.say(channel, `Cooldown active. Please wait ${COOLDOWN_DURATION - elapsedTime.toFixed(1)} seconds before sending another message.`);
            return;
        }
        lastResponseTime = currentTime; // Update the last response time

        const response = await openaiOps.make_openai_call(message);
        bot.say(channel, response);
    }

    const command = commandNames.find(cmd => message.toLowerCase().startsWith(cmd));
    if (command) {
        if (elapsedTime < COOLDOWN_DURATION) {
            bot.say(channel, `Cooldown active. Please wait ${COOLDOWN_DURATION - elapsedTime.toFixed(1)} seconds before sending another message.`);
            return;
        }
        lastResponseTime = currentTime; // Update the last response time

        let text = message.slice(command.length).trim();
        if (SEND_USERNAME === 'true') {
            text = `Message from user ${user.username}: ${text}`;
        }

        const response = await openaiOps.make_openai_call(text);
        if (response.length > maxLength) {
            const messages = response.match(new RegExp(`.{1,${maxLength}}`, 'g'));
            messages.forEach((msg, index) => {
                setTimeout(() => {
                    bot.say(channel, msg);
                }, 1000 * index);
            });
        } else {
            bot.say(channel, response);
        }

        if (ENABLE_TTS === 'true') {
            try {
                const ttsAudioUrl = await bot.sayTTS(channel, response, user['userstate']);
                notifyFileChange(ttsAudioUrl);
            } catch (error) {
                console.error('TTS Error:', error);
            }
        }
    }
});

app.ws('/check-for-updates', (ws, req) => {
    ws.on('message', message => {
        // Handle WebSocket messages (if needed)
    });
});

const messages = [{role: 'system', content: 'You are a helpful Twitch Chatbot.'}];
console.log('GPT_MODE:', GPT_MODE);
console.log('History length:', HISTORY_LENGTH);
console.log('OpenAI API Key:', OPENAI_API_KEY);
console.log('Model Name:', MODEL_NAME);

app.use(express.json({extended: true, limit: '1mb'}));
app.use('/public', express.static('public'));

app.all('/', (req, res) => {
    console.log('Received a request!');
    res.render('pages/index');
});

if (GPT_MODE === 'CHAT') {
    fs.readFile('./file_context.txt', 'utf8', (err, data) => {
        if (err) throw err;
        console.log('Reading context file and adding it as system-level message for the agent.');
        messages[0].content = data;
    });
} else {
    fs.readFile('./file_context.txt', 'utf8', (err, data) => {
        if (err) throw err;
        console.log('Reading context file and adding it in front of user prompts:');
        fileContext = data;
    });
}

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

const server = app.listen(3000, () => {
    console.log('Server running on port 3000');
});

const wss = expressWsInstance.getWss();
wss.on('connection', ws => {
    ws.on('message', message => {
        // Handle client messages (if needed)
    });
});

function notifyFileChange() {
    wss.clients.forEach(client => {
        if (client.readyState === ws.OPEN) {
            client.send(JSON.stringify({updated: true}));
        }
    });
}
const verifiedUsersFile = 'verified_users.json';
let verifiedUsers = {};

// Load verified users from file safely
if (fs.existsSync(verifiedUsersFile)) {
    try {
        const fileData = fs.readFileSync(verifiedUsersFile, 'utf8');
        verifiedUsers = fileData.trim() ? JSON.parse(fileData) : {}; // Handle empty file
    } catch (error) {
        console.error("Error parsing verified_users.json:", error);
        verifiedUsers = {}; // Reset to prevent crashing
    }
} else {
    // Create the file if it doesn't exist
    fs.writeFileSync(verifiedUsersFile, JSON.stringify({}, null, 2));
}
function saveVerifiedUsers() {
    try {
        fs.writeFileSync(verifiedUsersFile, JSON.stringify(verifiedUsers, null, 2));
    } catch (error) {
        console.error("Failed to save verified users:", error);
    }
}


function handleMessage(username, message) {
    if (message === "!agree") {
        verifiedUsers[username] = true;
        saveVerifiedUsers();
        return `${username}, you are now verified to use the chatbot!`;
    }

    if (!verifiedUsers[username]) {
        return "You must type !agree after reading the rules to use the bot.";
    }

    return `Processing command: ${message}`;
}
bot.onMessage(async (channel, user, message, self) => {
    if (self) return;

    console.log(`Message received: ${message} from ${user.username}`); // Debugging

    if (message.toLowerCase().startsWith("!apply")) {
        bot.say(channel, `${user.username}, your application has been received!`);
    }
});
import './discord_bot.js';
