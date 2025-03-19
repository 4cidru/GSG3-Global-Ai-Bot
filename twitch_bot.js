// Import dependencies
import tmi from 'tmi.js';
import { promises as fsPromises } from 'fs';
import { checkSafeSearch } from "./safeSearch.js"; 
import { checkGoogleSheet } from './google_sheets.js'; // Google Sheets Verification
import { checkSafeSearch } from "./safeSearch.js"; // Import SafeSearch function

export class TwitchBot {
    constructor(bot_username, oauth_token, channels, openai_api_key, enable_tts) {
        this.channels = channels;
        this.client = new tmi.Client({
            connection: { reconnect: true, secure: true },
            identity: { username: bot_username, password: oauth_token },
            channels: this.channels
        });
        this.enable_tts = enable_tts;
        this.verifiedUsersFile = 'verified_users.json';
        this.verifiedUsers = this.loadVerifiedUsers();

    }

    loadVerifiedUsers() {
        try {
            const data = fs.readFileSync(this.verifiedUsersFile, 'utf8');
            return JSON.parse(data) || {};
        } catch (error) {
            console.error("❌ Error loading verified users:", error);
            return {};
        }
    }

    async saveVerifiedUsers() {
        try {
            await fsPromises.writeFile(this.verifiedUsersFile, JSON.stringify(this.verifiedUsers, null, 2));
        } catch (error) {
            console.error("❌ Failed to save verified users:", error);
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

    say(channel, message) {
        (async () => {
            try {
                await this.client.say(channel, message);
            } catch (error) {
                console.error("❌ Error sending message:", error);
            }
        })();
    }


    // 🔥 Handles Messages & Commands

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
            if (self) return;

            const args = message.split(" ");
            const command = args.shift().toLowerCase();

            // ✅ SafeSearch Check
            if (command === "!ss" && args.length > 0) {
                const url = args[0];
                const result = await checkSafeSearch(url);
                this.say(channel, `@${user.username}, ${result}`);
            }

            if (command === "!verify") {
                if (this.verifiedUsers[user.username]) {
                    this.say(channel, `@${user.username}, you are already verified! ✅`);
                } else {
                    const isVerified = await checkGoogleSheet(user.username);
                    if (isVerified) {
                        this.verifiedUsers[user.username] = true;
                        await this.saveVerifiedUsers();
                        this.say(channel, `@${user.username}, you have been verified! ✅`);
                    } else {
                        this.say(channel, `@${user.username}, you are not on the verified list. Apply here: https://forms.gle/APRUMtHBQSgbpHuKA`);
                    }
                }
            }

            if (command === "!apply") {
                this.say(channel, `@${user.username}, apply for verification here: https://forms.gle/APRUMtHBQSgbpHuKA`);
            }

            // Deny unverified users from using commands
            if (message.startsWith("!") && command !== "!verify" && !this.verifiedUsers[user.username]) {
                this.say(channel, `@${user.username}, you must verify first! Use !verify ✅`);
                return;
            }
        });
    }
}
