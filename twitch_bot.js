import * as tmi from 'tmi.js';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { checkSafeSearch } from './safeSearch.js'; // Keep if you still want the !ss command

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

    // Track last time each user used a command (for cooldowns)
    this.lastCommandTimestamps = {};

    // Prevent multiple message listeners
    this.isMessageHandlerActive = false;
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
    // Guard: only attach once
    if (this.isMessageHandlerActive) return;
    this.isMessageHandlerActive = true;

    // Remove any existing listeners
    this.client.removeAllListeners("message");

    // 5-minute cooldown in milliseconds
    const COOLDOWN_MS = 5 * 60 * 1000;

    this.client.on("message", async (channel, user, message, self) => {
      if (self) return; // Ignore the bot's own messages
      if (user.username.toLowerCase() === this.botUsername.toLowerCase()) return; // Ignore if somehow from the bot

      const args = message.split(" ");
      const command = args.shift().toLowerCase();

      // Skip cooldown if user is "Eccdri"
      if (user.username.toLowerCase() !== 'eccdri') {
        const now = Date.now();
        const lastUsed = this.lastCommandTimestamps[user.username] || 0;
        if (now - lastUsed < COOLDOWN_MS) {
          // Still on cooldown; optionally send a reminder or do nothing
          this.say(channel, `@${user.username}, please wait 5 minutes between commands.`);
          return;
        }
        // Record the new usage time
        this.lastCommandTimestamps[user.username] = now;
      }
      // 2) "!ss" (SafeSearch command)
      if (command === "!ss" && args.length > 0) {
        const url = args[0];
        const result = await checkSafeSearch(url);
        this.say(channel, `@${user.username}, ${result}`);
        return;
      }

      // Add any other commands here, e.g. !hello, !ping, etc.
    });
  }
}
