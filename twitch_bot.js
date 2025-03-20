import * as tmi from 'tmi.js';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
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
    this.verifiedUsersFile = 'verified_users.json';
    this.verifiedUsers = this.loadVerifiedUsers();
    this.verificationReminderTimestamps = {};
    this.isMessageHandlerActive = false;
  }

  /**
   * Loads verified users from a JSON file.
   * Returns an object with username keys set to true if verified.
   */
  loadVerifiedUsers() {
    try {
      const data = fs.readFileSync(this.verifiedUsersFile, 'utf8');
      // If the file is empty or whitespace, return an empty object
      return data.trim() ? JSON.parse(data) : {};
    } catch (error) {
      console.error("❌ Error loading verified users:", error);
      return {};
    }
  }

  /**
   * Saves the current verified users to a JSON file.
   */
  async saveVerifiedUsers() {
    try {
      await fsPromises.writeFile(
        this.verifiedUsersFile,
        JSON.stringify(this.verifiedUsers, null, 2)
      );
    } catch (error) {
      console.error("❌ Failed to save verified users:", error);
    }
  }

  /**
   * Connects the Twitch client.
   */
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

  /**
   * Sends a message to the Twitch channel.
   */
  say(channel, message) {
    (async () => {
      try {
        await this.client.say(channel, message);
      } catch (error) {
        console.error("❌ Error sending message:", error);
      }
    })();
  }

  /**
   * Attaches the message event listener, ensuring it is only attached once.
   */
  onMessage() {
    // Guard: do not attach more than once
    if (this.isMessageHandlerActive) return;
    this.isMessageHandlerActive = true;

    // Clear existing listeners, if any
    this.client.removeAllListeners("message");

    // Define a cooldown period (in milliseconds)
    const REMINDER_COOLDOWN = 60000; // 60 seconds

    this.client.on("message", async (channel, user, message, self) => {
      // Ignore messages flagged as self (bot’s own messages)
      if (self) return;

      // Ignore messages from the bot's own username
      if (user.username.toLowerCase() === this.botUsername.toLowerCase()) return;

      const args = message.split(" ");
      const command = args.shift().toLowerCase();
      const cleanUsername = user.username.replace(/^@/, "").trim().toLowerCase();

      console.log(`💬 Received command: ${command} from ${cleanUsername}`);

      // -----------------------------------------------------------------------
      // 1) Unverified user gating (unless they are using !verify or !apply)
      // -----------------------------------------------------------------------
      if (!this.verifiedUsers[cleanUsername] && command !== "!verify" && command !== "!apply") {
        const now = Date.now();

        // Check if a reminder was sent recently
        if (
          !this.verificationReminderTimestamps[cleanUsername] ||
          now - this.verificationReminderTimestamps[cleanUsername] > REMINDER_COOLDOWN
        ) {
          this.say(channel, `@${user.username}, you must verify first! Use !verify ✅`);
          this.verificationReminderTimestamps[cleanUsername] = now;
        }
        return;
      }

      // -----------------------------------------------------------------------
      // 2) Handle !apply command
      // -----------------------------------------------------------------------
      if (command === "!apply") {
        this.say(channel, `@${user.username}, apply for verification here: https://forms.gle/ohr8dJKGyDMNSYKd6`);
        return;
      }

      // -----------------------------------------------------------------------
      // 3) Handle !verify command
      // -----------------------------------------------------------------------
      if (command === "!verify") {
        // If the user is already verified, let them know
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
          this.say(
            channel,
            `@${user.username}, you are not on the verified list. Apply here: https://forms.gle/ohr8dJKGyDMNSYKd6`
          );
        }
        return;
      }

      // -----------------------------------------------------------------------
      // 4) Handle !ss (Safe Search) command (verified users only)
      // -----------------------------------------------------------------------
      if (command === "!ss" && args.length > 0) {
        const url = args[0];
        const result = await checkSafeSearch(url);
        this.say(channel, `@${user.username}, ${result}`);
        return;
      }

      // Add any additional commands here...
    });
  }
}
