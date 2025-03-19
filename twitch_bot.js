// Import dependencies
import tmi from 'tmi.js';
import OpenAI from 'openai';
import { promises as fsPromises } from 'fs';
import { checkSafeSearch } from "./safeSearch.js"; // Import SafeSearch function
import fs from 'fs'; // Ensure file handling is available

// ✅ Define the verified users object & file path
const verifiedUsersFile = 'verified_users.json';
let verifiedUsers = {};

// ✅ Load verified users from file safely
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

// ✅ TwitchBot Class
export class TwitchBot {
    constructor(bot_username, oauth_token, channels, openai_api_key, enable_tts) {
        this.channels = channels;
        this.client = new tmi.Client({
            connection: {
                reconnect: true,
                secure: true
            },
            identity: {
                username: bot_username,
                password: oauth_token
            },
            channels: this.channels
        });
        this.openai = new OpenAI({ apiKey: openai_api_key });
        this.enable_tts = enable_tts;
    }

    addChannel(channel) {
        if (!this.channels.includes(channel)) {
            this.channels.push(channel);
            this.client.join(channel);
        }
    }

    connect() {
        (async () => {
            try {
                await this.client.connect();
                console.log("✅ Twitch bot connected successfully.");
            } catch (error) {
                console.error("❌ Error connecting Twitch bot:", error);
            }
        })();
    }

    disconnect() {
        (async () => {
            try {
                await this.client.disconnect();
                console.log("❌ Twitch bot disconnected.");
            } catch (error) {
                console.error("❌ Error disconnecting Twitch bot:", error);
            }
        })();
    }

    say(channel, message) {
        (async () => {
            try {
                await this.client.say(channel, message);
            } catch (error) {
                console.error("❌ Error sending message:", error);
            }
        })();
    }

    async sayTTS(channel, text, userstate) {
        if (this.enable_tts !== 'true') return;

        try {
            const mp3 = await this.openai.audio.speech.create({
                model: 'tts-1',
                voice: 'alloy',
                input: text,
            });

            const buffer = Buffer.from(await mp3.arrayBuffer());
            const filePath = './public/file.mp3';
            await fsPromises.writeFile(filePath, buffer);

            return filePath;
        } catch (error) {
            console.error("❌ Error in sayTTS:", error);
        }
    }

    // 🔥 SafeSearch Implementation for Twitch Chat
    onMessage() {
        this.client.on("message", async (channel, user, message, self) => {
            if (self) return; // Ignore bot messages

            const args = message.split(" ");
            const command = args.shift().toLowerCase();

            if (command === "!ss" && args.length > 0) {
                const url = args[0];
                const result = await checkSafeSearch(url);
                this.say(channel, `@${user.username}, ${result}`);
            }

            // ✅ Fix for Verified Users
            else if (!verifiedUsers[user.username]) {
                this.say(channel, `@${user.username}, you must type **!agree** after reading the rules.`);
            }
        });
    }

    onConnected(callback) {
        this.client.on('connected', callback);
    }

    onDisconnected(callback) {
        this.client.on('disconnected', callback);
    }

    // Ban, unban, whisper, clear, etc.
    ban(channel, username, reason) {
        (async () => {
            try {
                await this.client.ban(channel, username, reason);
            } catch (error) {
                console.error("❌ Error banning user:", error);
            }
        })();
    }

    unban(channel, username) {
        (async () => {
            try {
                await this.client.unban(channel, username);
            } catch (error) {
                console.error("❌ Error unbanning user:", error);
            }
        })();
    }
}
