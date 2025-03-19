// Import dependencies
import tmi from 'tmi.js';
import OpenAI from 'openai';
import { promises as fsPromises } from 'fs';
import { checkSafeSearch } from "./safeSearch.js"; // Import SafeSearch function

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
        this.messageListenerAttached = false; // Prevent multiple listeners
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
                this.onMessage(); // Attach message listener ONCE after connection
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

    // 🔥 SafeSearch + OpenAI Integration
    onMessage() {
        if (this.messageListenerAttached) return; // Prevent duplicate listeners
        this.messageListenerAttached = true;

        this.client.on("message", async (channel, user, message, self) => {
            if (self) return; // Ignore bot messages

            const args = message.split(" ");
            const command = args.shift().toLowerCase();

            // ✅ SafeSearch Check
            if (command === "!ss" && args.length > 0) {
                const url = args[0];
                const result = await checkSafeSearch(url);
                this.say(channel, `@${user.username}, ${result}`);
            }

            // ✅ OpenAI Chatbot
            else if (message.startsWith("#")) {
                const query = message.slice(1).trim();
                if (!query) return;

                try {
                    const response = await this.openai.chat.completions.create({
                        model: "gpt-4",
                        messages: [{ role: "user", content: query }],
                        max_tokens: 100,
                    });

                    this.say(channel, response.choices[0].message.content);
                } catch (error) {
                    console.error("❌ OpenAI API Error:", error);
                    this.say(channel, "⚠️ Error processing your request.");
                }
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
