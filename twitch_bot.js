import * as tmi from 'tmi.js';
import { checkSafeSearch } from './safeSearch.js';
import { OpenAIOperations } from './openai_operations.js'; // Ensure this exists

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

    // Create your OpenAI helper class
    // Adjust parameters as needed (model name, history length, etc.)
    this.openaiOps = new OpenAIOperations(
      'You are a helpful Twitch Chatbot.', // system prompt
      openai_api_key,                     // API key
      'gpt-3.5-turbo',                    // model name
      10                                  // history length or your preference
    );

    // Store the last command usage timestamps for cooldown
    this.lastCommandTimestamps = {};

    // Prevent multiple message listeners
    this.isMessageHandlerActive = false;
  }

  connect() {
    (async () => {
      try {
        await this.client.connect();
        console.log("✅ Twitch bot connected successfully.");

        // Minimal debug logs
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
    if (this.isMessageHandlerActive) return;
    this.isMessageHandlerActive = true;

    this.client.removeAllListeners("message");

    // 5-minute cooldown in milliseconds
    const COOLDOWN_MS = 5 * 60 * 1000;

    this.client.on("message", async (channel, user, message, self) => {
      // Ignore the bot’s own messages
      if (self) return;

      console.log(`[${channel}] <${user.username}>: ${message}`);

      // Only proceed if message starts with "!"
      if (!message.startsWith('!')) return;

      // Eccdri is exempt from cooldown
      const isEccdri = (user.username.toLowerCase() === 'eccdri');
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
      if (command === '!apply') {
        this.say(channel, `@${user.username}, apply here: https://forms.gle/ohr8dJKGyDMNSYKd6`);
        return;
      }

      // Example command: !ss (SafeSearch)
      if (command === '!ss' && args.length > 0) {
        const url = args[0];
        try {
          const result = await checkSafeSearch(url);
          this.say(channel, `@${user.username}, ${result}`);
        } catch (error) {
          console.error("Error in safeSearch:", error);
          this.say(channel, `@${user.username}, an error occurred with safeSearch.`);
        }
        return;
      }

      // Fallback: any other !command => GPT response
      // (e.g., user typed "!hello" or "!gpt Hello there")
      const userPrompt = message.slice(1); // remove the leading "!"
      try {
        const gptResponse = await this.openaiOps.make_openai_call(userPrompt);
        this.say(channel, `@${user.username}, ${gptResponse}`);
      } catch (error) {
        console.error("Error generating GPT response:", error);
        this.say(channel, `@${user.username}, sorry, I encountered an error with GPT.`);
      }
    });
  }
}
