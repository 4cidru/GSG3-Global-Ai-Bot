const tmi = require('tmi.js');
const { checkSafeSearch } = require('./safeSearch.js');
const { OpenAIOperations } = require('./openai_operations.js');
const OBSWebSocket = require('obs-websocket-js');
const fs = require('fs');
const path = require('path');

// Update this to your exact media folder on Windows
const mediaFolder = 'E:\\Now Watching';

// OBS WebSocket connection
const obs = new OBSWebSocket();

obs.connect({
  address: 'localhost:4444',
  password: 'reira11!.bridge11!'
}).then(() => {
  console.log('✅ Connected to OBS WebSocket');
}).catch(err => {
  console.error('❌ Failed to connect to OBS:', err);
});

class TwitchBot {
  constructor(bot_username, oauth_token, channels, openai_api_key, enable_tts) {
    this.botUsername = bot_username;
    this.channels = channels;
    this.client = new tmi.Client({
      connection: { reconnect: true, secure: true },
      identity: { username: bot_username, password: oauth_token },
      channels: this.channels
    });
    this.enable_tts = enable_tts;

    this.openaiOps = new OpenAIOperations(
      'You are a helpful Twitch Chatbot.',
      openai_api_key,
      'gpt-3.5-turbo',
      10
    );

    this.lastCommandTimestamps = {};
    this.isMessageHandlerActive = false;
  }

  connect() {
    (async () => {
      try {
        await this.client.connect();
        console.log("✅ Twitch bot connected successfully.");

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

    const COOLDOWN_MS = 5 * 60 * 1000;

    this.client.on("message", async (channel, user, message, self) => {
      if (self) return;

      console.log(`[${channel}] <${user.username}>: ${message}`);

      if (!message.startsWith('!')) return;

      const isEccdri = (user.username.toLowerCase() === 'eccdri');
      if (!isEccdri) {
        const now = Date.now();
        const lastUsed = this.lastCommandTimestamps[user.username] || 0;
        if (now - lastUsed < COOLDOWN_MS) {
          this.say(channel, `@${user.username}, please wait 5 minutes between commands.`);
          return;
        }
        this.lastCommandTimestamps[user.username] = now;
      }

      const args = message.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!apply') {
        this.say(channel, `@${user.username}, apply here: https://forms.gle/ohr8dJKGyDMNSYKd6`);
        return;
      }

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

      // === !play command ===
      if (command === '!play' && args.length > 0) {
        const mediaName = args[0];
        const possibleExtensions = ['.mp4', '.webm', '.mp3', '.gif'];
        let foundPath = null;

        for (const ext of possibleExtensions) {
          const tryPath = path.join(mediaFolder, mediaName + ext);
          if (fs.existsSync(tryPath)) {
            foundPath = tryPath;
            break;
          }
        }

        if (!foundPath) {
          this.say(channel, `@${user.username}, file "${mediaName}" not found.`);
          return;
        }

        try {
          await obs.send('SetSourceSettings', {
            sourceName: 'TriggeredMedia',
            sourceSettings: {
              local_file: foundPath
            }
          });

          await obs.send('SetSceneItemRender', {
            source: 'TriggeredMedia',
            render: true
          });

          this.say(channel, `@${user.username} triggered: ${mediaName}`);
          console.log(`🎬 Playing: ${foundPath}`);
        } catch (err) {
          console.error('🔴 OBS error:', err);
          this.say(channel, `@${user.username}, failed to trigger media playback.`);
        }

        return;
      }

      // === Fallback to GPT ===
      const userPrompt = message.slice(1);
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

export { TwitchBot };
