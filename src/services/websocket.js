const WebSocket = require('ws');
const { CONFIG } = require('../config/config');

class WebSocketServer {
    constructor(queueManager, deltaManager) {
        this.server = null;
        this.clients = new Map(); // Map to store client connections
        this.queueManager = queueManager; // For managing all queues
        this.deltaManager = deltaManager; // For handling Delta's responses
        this.voiceManager = null;
    }

    initialize() {
        this.server = new WebSocket.Server({ 
            port: CONFIG.websocket.port 
        });

        this.server.on('connection', this.handleConnection.bind(this));
        console.log(`WebSocket server started on port ${CONFIG.websocket.port}`);
    }

    isActive() {
        return this.server !== null && this.server.clients.size > 0;
    }

    setVoiceManager(voiceManager) {
        this.voiceManager = voiceManager;
        console.log('Voice manager set successfully');
    }

    handleConnection(ws) {
        // Generate client ID
        const clientId = Date.now().toString();
        
        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data);
                
                switch(message.type) {
                    case 'transcript':
                        // Handle transcribed message
                        await this.handleTranscript({
                            username: message.username,
                            content: message.content,
                            timestamp: message.timestamp
                        });
                        break;

                    case 'request_metrics':
                        // Send current metrics
                        this.sendToClient(ws, {
                            type: 'metrics_update',
                            metrics: await this.getQueueMetrics()
                        });
                        break;

                    case 'bot_control':
                        await this.handleBotControl(message.action, ws);
                        break;

                    case 'tts':
                    case 'follows':
                    case 'subs':
                    case 'gifts':
                        // Handle queue check actions
                        await this.handleQueueCheck(message.type);
                        break;
                }
            } catch (error) {
                console.error('Error handling message:', error);
                this.sendToClient(ws, {
                    type: 'error',
                    message: 'Error processing message'
                });
            }
        });

        // Send initial bot status
        if (this.voiceManager) {
            this.sendBotStatus(ws);
        }

        // Handle disconnection
        ws.on('close', () => {
            this.clients.delete(clientId);
        });

        // Store client connection
        this.clients.set(clientId, ws);
    }

    async handleBotControl(action, ws) {
        if (!this.voiceManager) {
            this.sendToClient(ws, {
                type: 'error',
                message: 'Voice manager not initialized'
            });
            return;
        }

        try {
            const channelId = process.env.DISCORD_VOICE_CHANNEL_ID;
            
            if (action === 'connect') {
                await this.voiceManager.connectToChannel(channelId);
            } else if (action === 'disconnect') {
                this.voiceManager.disconnect();
            }

            // Broadcast status to all clients
            this.broadcastBotStatus();

        } catch (error) {
            console.error('Error handling bot control:', error);
            this.sendToClient(ws, {
                type: 'error',
                message: `Failed to ${action} bot: ${error.message}`
            });
        }
    }

    sendBotStatus(ws) {
        if (this.voiceManager) {
            this.sendToClient(ws, {
                type: 'bot_status',
                connected: this.voiceManager.isConnected()
            });
        }
    }

    broadcastBotStatus() {
        if (this.voiceManager) {
            const status = {
                type: 'bot_status',
                connected: this.voiceManager.isConnected()
            };

            this.clients.forEach(ws => {
                this.sendToClient(ws, status);
            });
        }
    }

    async handleTranscript(message) {
        try {
            // Process transcript with Delta
            const response = await this.deltaManager.processMessage(
                message.username,
                message.content,
                message.timestamp
            );

            // Broadcast updated metrics after processing
            await this.broadcastMetrics();
        } catch (error) {
            console.error('Error processing transcript:', error);
        }
    }

    async handleQueueCheck(type) {
        try {
            switch(type) {
                case 'tts':
                    await this.processNextTTSMessage();
                    break;
                case 'follows':
                    await this.announceNewFollowers();
                    break;
                case 'subs':
                    await this.processNextSubscriber();
                    break;
                case 'gifts':
                    await this.processNextGifter();
                    break;
            }
            // Broadcast updated metrics after processing
            await this.broadcastMetrics();
        } catch (error) {
            console.error(`Error handling queue check for ${type}:`, error);
        }
    }

    async processNextTTSMessage() {
        const message = await this.queueManager.getNextTTSMessage();
        if (message) {
            await this.deltaManager.processBitMessage(
                message.username,
                message.bits,
                message.content,
                message.timestamp
            );
            // Delta will handle the TTS and Discord channel logging
        }
    }

    async announceNewFollowers() {
        const { count, timeElapsed } = await this.queueManager.getAndClearFollowers();
        if (count > 0) {
            await this.deltaManager.processFollowers(count, timeElapsed);
        }
    }

    async processNextSubscriber() {
        const sub = await this.queueManager.getNextSubscriber();
        if (sub) {
            await this.deltaManager.processSubscriber(
                sub.username,
                sub.months,
                sub.message
            );
        }
    }

    async processNextGifter() {
        const gifter = await this.queueManager.getNextGifter();
        if (gifter) {
            await this.deltaManager.processGifter(
                gifter.username,
                gifter.giftCount
            );
        }
    }

    async getQueueMetrics() {
        return {
            tts_in_queue: await this.queueManager.getTTSQueueCount(),
            new_followers_count: await this.queueManager.getFollowerCount(),
            new_subs_count: await this.queueManager.getSubscriberCount(),
            new_giver_count: await this.queueManager.getGifterCount()
        };
    }

    async broadcastMetrics() {
        const metrics = await this.getQueueMetrics();
        const message = {
            type: 'metrics_update',
            metrics: metrics
        };

        this.clients.forEach(ws => {
            this.sendToClient(ws, message);
        });
    }

    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    shutdown() {
        this.clients.forEach(ws => {
            this.sendToClient(ws, {
                type: 'shutdown',
                message: 'Server shutting down'
            });
            ws.close();
        });

        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = WebSocketServer;