require('dotenv').config();

const CONFIG = {
    // Discord Configuration
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID,
        guildId: process.env.DISCORD_GUILD_ID,
        archiveChannelId: process.env.DISCORD_ARCHIVE_CHANNEL_ID,
        // Channels for different purposes
        channels: {
            contextMemory: process.env.DISCORD_CONTEXT_MEMORY_CHANNEL,
            bitMessages: process.env.DISCORD_BIT_MESSAGES_CHANNEL,
            botCommands: process.env.DISCORD_BOT_COMMANDS_CHANNEL
        },
        // Default voice settings
        voice: {
            selfDeaf: false,
            selfMute: false
        }
    },

    // Twitch Configuration
    twitch: {
        clientId: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_CLIENT_SECRET,
        accessToken: process.env.TWITCH_ACCESS_TOKEN,
        refreshToken: process.env.TWITCH_REFRESH_TOKEN,
        channel: process.env.TWITCH_CHANNEL,
        // Threshold for TTS queue
        minBitsForTTS: parseInt(process.env.MIN_BITS_FOR_TTS, 10) || 500
    },

    // Claude Configuration
    claude: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-haiku-20240307',
        maxTokens: 1024,
        // Memory settings
        memory: {
            maxContextTokens: parseInt(process.env.MAX_CONTEXT_TOKENS, 10) || 20000,
            maxContextAge: parseInt(process.env.MAX_CONTEXT_AGE, 10) || 86400000, // 24 hours in ms
            cleanupInterval: parseInt(process.env.CONTEXT_CLEANUP_INTERVAL, 10) || 3600000 // 1 hour in ms
        }
    },

    // Google Cloud TTS Configuration
    tts: {
        credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        options: {
            language: 'en-US',
            voice: 'en-US-Wavenet-C',
            speakingRate: 1.0,
            pitch: 0,
            sampleRateHertz: 48000
        }
    },

    // WebSocket Configuration for Whisper Client
    websocket: {
        port: parseInt(process.env.WS_PORT, 10) || 3001,
        heartbeat: {
            interval: 30000, // 30 seconds
            timeout: 10000   // 10 seconds
        }
    },

    // Queue Configuration
    queues: {
        tts: {
            maxSize: 100,
            timeout: 3600000 // 1 hour in ms
        },
        followers: {
            batchSize: 10,
            maxAge: 3600000  // 1 hour in ms
        },
        subscribers: {
            maxSize: 50,
            timeout: 7200000 // 2 hours in ms
        },
        gifts: {
            maxSize: 50,
            timeout: 7200000 // 2 hours in ms
        }
    },

    // Response Timeouts
    timeouts: {
        voiceConnection: 5000,    // 5 seconds
        ttsGeneration: 10000,     // 10 seconds
        claudeResponse: 15000,    // 15 seconds
        wsConnection: 5000        // 5 seconds
    },

    // Development/Debug Options
    debug: {
        enabled: process.env.DEBUG_MODE === 'true',
        logLevel: process.env.DEBUG_LOG_LEVEL || 'info',
        saveResponses: process.env.SAVE_RESPONSES === 'true',
        logChannelId: process.env.DEBUG_LOG_CHANNEL
    }
};

// Validation function for required environment variables
const validateConfig = () => {
    const required = [
        'DISCORD_TOKEN',
        'DISCORD_CLIENT_ID',
        'DISCORD_GUILD_ID',
        'DISCORD_CONTEXT_MEMORY_CHANNEL',
        'DISCORD_BIT_MESSAGES_CHANNEL',
        'TWITCH_CLIENT_ID',
        'TWITCH_CLIENT_SECRET',
        'TWITCH_CHANNEL',
        'ANTHROPIC_API_KEY',
        'GOOGLE_APPLICATION_CREDENTIALS'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return true;
};

module.exports = {
    CONFIG,
    validateConfig
};