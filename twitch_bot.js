// Import dependencies
import tmi from 'tmi.js';
import { promises as fsPromises } from 'fs';
const { checkGoogleSheet } = require('./google_sheets.js'); // ✅ Correct CommonJS import
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
        console.error("❌ Error parsing verified_users.json:", error);
        verifiedUsers = {}; 
    }
} else {
    fs.writeFileSync(verifiedUsersFile, JSON.stringify({}, null, 2));
}

// ✅ Save verified users safely
async function saveVerifiedUsers() {
    try {
        await fsPromises.writeFile(verifiedUsersFile, JSON.stringify(verifiedUsers, null, 2));
    } catch (error) {
        console.error("❌ Failed to save verified users:", error);
    }
}

// ✅ TwitchBot Class
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

        this.isMessageHandlerActive = false; // ✅ Prevent multiple handlers
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

    onMessage() {
        // ✅ Remove existing handlers before adding a new one
        this.client.removeAllListeners("message");

        this.client.on("message", async (channel, user, message, self) => {
            if (self) return;

            const args = message.split(" ");
            const command = args.shift().toLowerCase();

            // ✅ Standardize username format
            const cleanUsername = user.username.replace(/^@/, "").trim().toLowerCase();
            console.log(`💬 Received command: ${command} from ${cleanUsername}`);

            // ✅ Prevent Multiple Messages: Only allow !verify & !apply for unverified users
            if (!this.verifiedUsers[cleanUsername] && command !== "!verify" && command !== "!apply") {
                this.say(channel, `@${user.username}, you must verify first! Use !verify ✅`);
                return; // ✅ Stops further processing
            }

            // ✅ SafeSearch Command (Only Verified Users)
            if (command === "!ss" && args.length > 0) {
                const url = args[0];
                const result = await checkSafeSearch(url);
                this.say(channel, `@${user.username}, ${result}`);
                return; // ✅ Prevents multiple messages
            }

            // ✅ Verify Command (Check Google Sheets)
            if (command === "!verify") {
                if (this.verifiedUsers[cleanUsername]) {
                    this.say(channel, `@${user.username}, you are already verified! ✅`);
                    return;
                }

                console.log(`🔍 Checking Google Sheets for ${cleanUsername}...`);
                const isVerified = await checkGoogleSheet(cleanUsername);
                
                if (isVerified) {
                    console.log(`✅ ${cleanUsername} is verified in Google Sheets.`);
                    this.verifiedUsers[cleanUsername] = true;
                    await this.saveVerifiedUsers();
                    this.say(channel, `@${user.username}, you have been verified! ✅`);
                } else {
                    console.log(`❌ ${cleanUsername} NOT found in Google Sheets.`);
                    this.say(channel, `@${user.username}, you are not on the verified list. Apply here: https://forms.gle/ohr8dJKGyDMNSYKd6`);
                }
                return; // ✅ Stops further processing
            }

            // ✅ Apply Command (Prevent Echo)
            if (command === "!apply") {
                this.say(channel, `@${user.username}, apply for verification here: https://forms.gle/ohr8dJKGyDMNSYKd6`);
                return; // ✅ Prevents multiple messages
            }
        });
    }
} 
