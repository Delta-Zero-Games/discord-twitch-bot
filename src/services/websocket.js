const WebSocket = require('ws');
const { CONFIG } = require('../config/config');

class WebSocketServer {
    constructor(queueManager, deltaManager) {
        this.server = null;
        this.clients = new Map(); // Map to store client connections
        this.queueManager = queueManager; // For managing all queues
        this.deltaManager = deltaManager; // For handling Delta's responses
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

                    case 'bits':
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

        // Handle disconnection
        ws.on('close', () => {
            this.clients.delete(clientId);
        });

        // Store client connection
        this.clients.set(clientId, ws);
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
                case 'bits':
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