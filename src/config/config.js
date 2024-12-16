require('dotenv').config();

const CONFIG = {
    // Discord Configuration
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID,
        guildId: process.env.DISCORD_GUILD_ID,
        archiveChannelId: process.env.DISCORD_ARCHIVE_CHANNEL_ID,
        channels: {
            contextMemory: process.env.DISCORD_CONTEXT_MEMORY_CHANNEL,
            bitMessages: process.env.DISCORD_BIT_MESSAGES_CHANNEL,
            botCommands: process.env.DISCORD_BOT_COMMANDS_CHANNEL,
            voice: process.env.DISCORD_VOICE_CHANNEL_ID
        },
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
        minBitsForTTS: parseInt(process.env.MIN_BITS_FOR_TTS, 10) || 500
    },

    // Claude Configuration
    claude: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 1024,
        temperature: 0.3,
        memory: {
            maxContextTokens: parseInt(process.env.MAX_CONTEXT_TOKENS, 10) || 20000,
            maxContextAge: parseInt(process.env.MAX_CONTEXT_AGE, 10) || 86400000,
            cleanupInterval: parseInt(process.env.CONTEXT_CLEANUP_INTERVAL, 10) || 3600000
        }
    },

    // TTS Configuration
    tts: {
        credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        usePremiumVoice: false, // Toggle between Premium and standard voice
        options: {
            language: 'en-US',
            standardVoice: {
                name: 'en-US-Wavenet-C',
                speakingRate: 1.1,
                sampleRateHertz: 48000
            },
            premiumVoice: {
                name: 'en-US-Journey-F',
                model: 'premium', // Correct model type for Premium voices
                sampleRateHertz: 48000
            }
        }
    },

    // WebSocket Configuration
    websocket: {
        port: parseInt(process.env.WS_PORT, 10) || 3001,
        heartbeat: {
            interval: 30000,
            timeout: 10000
        }
    },

    // Queue Configuration
    queues: {
        tts: {
            maxSize: 100,
            timeout: 3600000
        },
        followers: {
            batchSize: 10,
            maxAge: 3600000
        },
        subscribers: {
            maxSize: 50,
            timeout: 7200000
        },
        gifts: {
            maxSize: 50,
            timeout: 7200000
        }
    },

    timeouts: {
        voiceConnection: 5000,
        ttsGeneration: 10000,
        claudeResponse: 15000,
        wsConnection: 5000
    },

    debug: {
        enabled: process.env.DEBUG_MODE === 'true',
        logLevel: process.env.DEBUG_LOG_LEVEL || 'info',
        saveResponses: process.env.SAVE_RESPONSES === 'true',
        logChannelId: process.env.DEBUG_LOG_CHANNEL
    }
};

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

module.exports = { CONFIG, validateConfig };