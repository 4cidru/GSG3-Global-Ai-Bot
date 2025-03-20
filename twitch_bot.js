import * as tmi from 'tmi.js';
import { checkGoogleSheet } from './google_sheets.js';
import { checkSafeSearch } from './safeSearch.js';

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

    // Tracks when we last reminded an unverified user
    this.verificationReminderTimestamps = {};

    // Ensures we only attach the onMessage listener once
    this.isMessageHandlerActive = false;
  }

  // Connect to Twitch
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

  // Send a message to chat
  say(channel, message) {
    (async () => {
      try {
        await this.client.say(channel, message);
      } catch (error) {
        console.error("❌ Error sending message:", error);
      }
    })();
  }

  // Attach the message event listener (only once)
  onMessage() {
    // Guard: do not attach more than once
    if (this.isMessageHandlerActive) return;
    this.isMessageHandlerActive = true;

    // Remove any existing listeners, just in case
    this.client.removeAllListeners('message');

    const REMINDER_COOLDOWN = 60000; // 60 seconds

    this.client.on('message', async (channel, user, message, self) => {
      // Ignore bot's own messages
      if (self) return;

      // Ignore messages from the bot's own username
      if (user.username.toLowerCase() === this.botUsername.toLowerCase()) return;

      const args = message.split(' ');
      const command = args.shift().toLowerCase();
      const cleanUsername = user.username.replace(/^@/, '').trim().toLowerCase();

      console.log(`💬 Received command: ${command} from ${cleanUsername}`);

      // For unverified users, only allow "!verify" and "!apply" commands
      if (command !== '!verify' && command !== '!apply') {
        const isVerified = await checkGoogleSheet(cleanUsername);
        if (!isVerified) {
          // Rate-limit repeated reminders
          const now = Date.now();
          if (
            !this.verificationReminderTimestamps[cleanUsername] ||
            now - this.verificationReminderTimestamps[cleanUsername] > REMINDER_COOLDOWN
          ) {
            this.say(channel, `@${user.username}, you must verify first! Use !verify ✅`);
            this.verificationReminderTimestamps[cleanUsername] = now;
          }
          return; // Stop processing further
        }
      }

      // Handle !apply command
      if (command === '!apply') {
        this.say(channel, `@${user.username}, apply for verification here: https://forms.gle/ohr8dJKGyDMNSYKd6`);
        return;
      }

      // Handle !verify command
      if (command === '!verify') {
        console.log(`🔍 Checking Google Sheets for ${cleanUsername}...`);
        const isVerified = await checkGoogleSheet(cleanUsername);

        if (isVerified) {
          console.log(`✅ ${cleanUsername} is verified in Google Sheets.`);
          this.say(channel, `@${user.username}, you have been verified! ✅`);
        } else {
          console.log(`❌ ${cleanUsername} NOT found in Google Sheets.`);
          this.say(channel, `@${user.username}, you are not on the verified list. Apply here: https://forms.gle/ohr8dJKGyDMNSYKd6`);
        }
        return;
      }

      // Handle !ss (SafeSearch) command (only if user is verified)
      if (command === '!ss' && args.length > 0) {
        const url = args[0];
        const result = await checkSafeSearch(url);
        this.say(channel, `@${user.username}, ${result}`);
        return;
      }

      // Add any other commands for verified users here
    });
  }
}
