import * as tmi from 'tmi.js';
import { checkSafeSearch } from './safeSearch.js'; // If you still want the !ss command

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

    // Store last command usage time for cooldown
    this.lastCommandTimestamps = {};

    // Prevent re-attaching the message listener multiple times
    this.isMessageHandlerActive = false;
  }

  // Connect to Twitch
  connect() {
    (async () => {
      try {
        await this.client.connect();
        console.log("✅ Twitch bot connected successfully.");

        // Minimal debug: log when connected and joined
        this.client.on('connected', (addr, port) => {
          console.log(`✅ Connected to ${addr}:${port}`);
        });
        this.client.on('join', (channel, username, self) => {
          if (self) {
            console.log(`✅ Joined channel: ${channel}`);
          }
        });
      } catch (error) {
        console.error("❌ Error connecting Twitch bot:", error);
      }
    })();
  }

  // Helper to send a message
  say(channel, message) {
    (async () => {
      try {
        await this.client.say(channel, message);
      } catch (error) {
        console.error("❌ Error sending message:", error);
      }
    })();
  }

  // Attach the message listener (only once)
  onMessage() {
    if (this.isMessageHandlerActive) return;
    this.isMessageHandlerActive = true;

    this.client.removeAllListeners("message");

    // 5-minute cooldown (in ms)
    const COOLDOWN_MS = 5 * 60 * 1000;

    this.client.on("message", async (channel, user, message, self) => {
      // Ignore the bot's own messages
      if (self) return;

      // Basic log to see incoming messages
      console.log(`[${channel}] <${user.username}>: ${message}`);

      // Eccdri is exempt from cooldown
      const isEccdri = user.username.toLowerCase() === 'eccdri';

      if (!isEccdri) {
        const now = Date.now();
        const lastUsed = this.lastCommandTimestamps[user.username] || 0;
        if (now - lastUsed < COOLDOWN_MS) {
          // User still on cooldown
          this.say(channel, `@${user.username}, please wait 5 minutes between commands.`);
          return;
        }
        // Record new usage time
        this.lastCommandTimestamps[user.username] = now;
      }

      // Parse the command
      const args = message.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      // Example command: !apply
      if (command === "!apply") {
        this.say(channel, `@${user.username}, apply for verification here: https://forms.gle/ohr8dJKGyDMNSYKd6`);
        return;
      }

      // Example command: !ss (SafeSearch)
      if (command === "!ss" && args.length > 0) {
        const url = args[0];
        const result = await checkSafeSearch(url);
        this.say(channel, `@${user.username}, ${result}`);
        return;
      }

      // Add more commands here if needed
    });
  }
}
