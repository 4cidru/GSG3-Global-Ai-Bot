export class TwitchBot {
  constructor(bot_username, oauth_token, channels, openai_api_key, enable_tts) {
    this.botUsername = process.env.TWITCH_USER; // Store the bot's username for reference
    this.channels = channels;
    import * as tmi from 'tmi.js';({
      connection: { reconnect: true, secure: true },
      identity: { username: process.env.TWITCH_USER, password: oauth_token },
      channels: this.channels
    });
    this.enable_tts = enable_tts;
    this.verifiedUsersFile = 'verified_users.json';
    this.verifiedUsers = this.loadVerifiedUsers();

    // New: Store the last time a verification reminder was sent per user.
    this.verificationReminderTimestamps = {};

    this.isMessageHandlerActive = false; // Prevent multiple handlers
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
    // Remove existing handlers before adding a new one
    this.client.removeAllListeners("message");

    // Define a cooldown period (in milliseconds)
    const REMINDER_COOLDOWN = 60000; // 60 seconds

    this.client.on("message", async (channel, user, message, self) => {
      // Ignore messages flagged as self
      if (self) return;

      // Explicitly ignore messages from the bot's own username
      if (user.username.toLowerCase() === this.botUsername.toLowerCase()) return;

      const args = message.split(" ");
      const command = args.shift().toLowerCase();

      // Standardize username format
      const cleanUsername = user.username.replace(/^@/, "").trim().toLowerCase();
      console.log(`💬 Received command: ${command} from ${cleanUsername}`);

      // For unverified users, only allow !verify and !apply commands.
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
        return; // Stop processing further
      }

      // Handle SafeSearch command (for verified users)
      if (command === "!ss" && args.length > 0) {
        const url = args[0];
        const result = await checkSafeSearch(url);
        this.say(channel, `@${user.username}, ${result}`);
        return;
      }

      // Handle Verify command
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
        return;
      }

      // Handle Apply command
      if (command === "!apply") {
        this.say(channel, `@${user.username}, apply for verification here: https://forms.gle/ohr8dJKGyDMNSYKd6`);
        return;
      }
    });
  }
}
