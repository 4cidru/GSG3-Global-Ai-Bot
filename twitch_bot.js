import * as tmi from 'tmi.js';
import { promises as fsPromises } from 'fs';
import fs from 'fs';
import { checkGoogleSheet } from './google_sheets.js';
import { checkSafeSearch } from "./safeSearch.js";

export class TwitchBot {
  constructor(bot_username, oauth_token, channels, openai_api_key, enable_tts) {
    this.botUsername = bot_username;
    this.channels = channels;
    this.client = new tmi.Client({
      connection: { reconnect: true, secure: true },
      identity: { username: bot_username, password: oauth_token },
      channels: this.channels
    });
    this.enable_tts = enable_tts;
    this.verifiedUsersFile = 'verified_users.json';
    this.verifiedUsers = this.loadVerifiedUsers();
    this.verificationReminderTimestamps = {};
    this.isMessageHandlerActive = false;
  }

  loadVerifiedUsers() { ... }
  async saveVerifiedUsers() { ... }

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

  say(channel, message) { ... }

  onMessage() {
    // Guard: do not attach more than once
    if (this.isMessageHandlerActive) return;
    this.isMessageHandlerActive = true;

    // Clear existing listeners, if any
    this.client.removeAllListeners("message");

    const REMINDER_COOLDOWN = 60000; // 60 seconds

    this.client.on("message", async (channel, user, message, self) => {
      if (self) return;
      if (user.username.toLowerCase() === this.botUsername.toLowerCase()) return;

      const args = message.split(" ");
      const command = args.shift().toLowerCase();
      const cleanUsername = user.username.replace(/^@/, "").trim().toLowerCase();
      console.log(`💬 Received command: ${command} from ${cleanUsername}`);
      // Handle Apply command
      if (command === "!apply") {
        this.say(channel, `@${user.username}, apply for verification here: https://forms.gle/ohr8dJKGyDMNSYKd6`);
        return;
      }
    });
  }
}
