const tmi = require('tmi.js');
const { CONFIG } = require('../config/config');

class TwitchClient {
    constructor(queueManager, deltaManager) {
        this.queueManager = queueManager;
        this.deltaManager = deltaManager;
        this.client = null;
    }

    initialize() {
        this.client = new tmi.Client({
            options: { debug: false },
            identity: {
                username: CONFIG.twitch.channel,
                password: `oauth:${CONFIG.twitch.accessToken}`
            },
            channels: [CONFIG.twitch.channel]
        });

        this.setupEventHandlers();

        this.client.connect().catch(console.error);
    }

    isConnected() {
        return this.client && this.client.readyState() === 'OPEN';
    }

    setupEventHandlers() {
        // Handle bits with messages
        this.client.on('cheer', (channel, userstate, message) => {
            const bits = parseInt(userstate.bits);
            if (bits >= CONFIG.twitch.minBitsForTTS) {
                this.queueManager.addTTSMessage(
                    userstate.username,
                    bits,
                    message,
                    Date.now()
                );
            }
        });

        // Handle new subscribers and resubs
        this.client.on('subscription', (channel, username, method, message, userstate) => {
            // Ignore gifted subs, they're handled in subgift event
            if (!userstate['msg-param-gift']) {
                this.queueManager.addSubscriber(
                    username,
                    1, // First month
                    message || ''
                );
            }
        });

        this.client.on('resub', (channel, username, months, message, userstate, methods) => {
            // Ignore gifted subs
            if (!userstate['msg-param-gift']) {
                this.queueManager.addSubscriber(
                    username,
                    months,
                    message || ''
                );
            }
        });

        // Handle gifted subs
        this.client.on('subgift', (channel, username, streakMonths, recipient, methods, userstate) => {
            // Track the gifter
            const gifter = userstate['display-name'] || username;
            this.updateGifterCount(gifter);
        });

        // Handle multiple gifted subs
        this.client.on('submysterygift', (channel, username, numbOfSubs, methods, userstate) => {
            const gifter = userstate['display-name'] || username;
            this.queueManager.addGifter(gifter, numbOfSubs);
        });

        // Handle raids
        this.client.on('raided', (channel, username, viewers) => {
            this.handleRaid(username, viewers);
        });

        // Handle connection events
        this.client.on('connected', (addr, port) => {
            console.log(`Connected to Twitch at ${addr}:${port}`);
        });

        this.client.on('disconnected', (reason) => {
            console.log('Disconnected from Twitch:', reason);
            // Attempt to reconnect after delay
            setTimeout(() => {
                this.client.connect().catch(console.error);
            }, 5000);
        });
    }

    async handleRaid(username, viewers) {
        try {
            await this.deltaManager.processRaid(username, viewers);
        } catch (error) {
            console.error('Error handling raid:', error);
        }
    }

    updateGifterCount(gifter) {
        this.queueManager.addGifter(gifter, 1);
    }

    disconnect() {
        if (this.client) {
            this.client.disconnect();
        }
    }
}

module.exports = TwitchClient;
