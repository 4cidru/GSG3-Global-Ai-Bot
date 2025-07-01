import tmi from 'tmi.js';
import { checkSafeSearch } from './safeSearch.js';
import { OpenAIOperations } from './openai_operations.js';
import OBSWebSocket from 'obs-websocket-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Path helpers for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Media folder (customize for your system)
const mediaFolder = 'E:\\Now Watching';

const obs = new OBSWebSocket();
obs.connect({
  address: 'localhost:4444',
  password: 'reira11!.bridge11!'
}).then(() => {
  console.log('✅ Connected to OBS WebSocket');
}).catch(err => {
  console.error('❌ Failed to connect to OBS:', err);
});

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
    this.client.connect()
      .then(() => console.log("✅ Twitch bot connected successfully."))
      .catch(err => console.error("❌ Twitch bot connection failed:", err));

    this.client.on('connected', (addr, port) => {
      console.log(`✅ Connected to ${addr}:${port}`);
    });

    this.client.on('join', (channel, username, self) => {
      if (self) {
        console.log(`✅ Joined channel: ${channel}`);
      }
    });
  }

  say(channel, message) {
    this.client.say(channel, message).catch(err => {
      console.error("❌ Error sending message:", err);
    });
  }

  onMessage() {
    if (this.isMessageHandlerActive) return;
    this.isMessageHandlerActive = true;

    const COOLDOWN_MS = 5 * 60 * 1000;

    this.client.on("message", async (channel, user, message, self) => {
      if (self) return;
      console.log(`[${channel}] <${user.username}>: ${message}`);
      if (!message.startsWith('!')) return;

      const isEccdri = user.username.toLowerCase() === 'eccdri';
      const now = Date.now();
      const lastUsed = this.lastCommandTimestamps[user.username] || 0;

      if (!isEccdri && (now - lastUsed < COOLDOWN_MS)) {
        this.say(channel, `@${user.username}, please wait 5 minutes between commands.`);
        return;
      }

      this.lastCommandTimestamps[user.username] = now;

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
        } catch (err) {
          console.error("SafeSearch error:", err);
          this.say(channel, `@${user.username}, error during safe search.`);
        }
        return;
      }

      if (command === '!play' && args.length > 0) {
        const mediaName = args[0];
        const extensions = ['.mp4', '.webm', '.mp3', '.gif'];
        let fileToPlay = null;

        for (const ext of extensions) {
          const filePath = path.join(mediaFolder, mediaName + ext);
          if (fs.existsSync(filePath)) {
            fileToPlay = filePath;
            break;
          }
        }

        if (!fileToPlay) {
          this.say(channel, `@${user.username}, "${mediaName}" not found.`);
          return;
        }

        try {
          await obs.send('SetSourceSettings', {
            sourceName: 'TriggeredMedia',
            sourceSettings: { local_file: fileToPlay }
          });

          await obs.send('SetSceneItemRender', {
            source: 'TriggeredMedia',
            render: true
          });

          this.say(channel, `@${user.username} triggered: ${mediaName}`);
          console.log(`🎬 Playing: ${fileToPlay}`);
        } catch (err) {
          console.error("OBS error:", err);
          this.say(channel, `@${user.username}, media failed to play.`);
        }

        return;
      }

      // Fallback: GPT
      try {
        const gptResponse = await this.openaiOps.make_openai_call(message.slice(1));
        this.say(channel, `@${user.username}, ${gptResponse}`);
      } catch (error) {
        console.error("GPT Error:", error);
        this.say(channel, `@${user.username}, GPT failed.`);
      }
    });
  }
}
