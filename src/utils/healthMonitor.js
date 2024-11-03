const logger = require('./logger');

class HealthMonitor {
    constructor(bot) {
        this.bot = bot;
        this.checkInterval = 60000; // Check every minute
        this.metrics = {
            uptime: 0,
            lastRestart: Date.now(),
            commandsProcessed: 0,
            messagesProcessed: 0,
            errors: 0,
            voiceTime: 0,
            lastHealthCheck: null
        };

        this.startMonitoring();
    }

    startMonitoring() {
        setInterval(() => this.checkHealth(), this.checkInterval);
    }

    async checkHealth() {
        try {
            const status = {
                timestamp: Date.now(),
                discordConnected: this.bot.client.isReady(),
                voiceConnected: this.bot.voiceManager.isConnected(),
                twitchConnected: this.bot.twitchClient.isConnected(),
                wsServerActive: this.bot.wsServer.isActive(),
                memoryUsage: process.memoryUsage(),
                metrics: this.metrics
            };
    
            // Log health status
            logger.debug('Health check', status);
    
            // Check for issues
            if (!status.discordConnected) {
                logger.error('Discord disconnected', { status });
                await this.bot.errorHandler.attemptRecovery('discord');
            }
    
            if (!status.twitchConnected) {
                logger.error('Twitch disconnected', { status });
                await this.bot.errorHandler.attemptRecovery('twitch');
            }
    
            this.metrics.lastHealthCheck = Date.now();
            await this.saveState();
    
        } catch (error) {
            logger.error('Health check failed:', error);
            this.metrics.errors++;
        }
    }

    incrementMetric(metric) {
        if (metric in this.metrics) {
            this.metrics[metric]++;
        }
    }

    async saveState() {
        await this.bot.stateManager.saveState({
            metrics: this.metrics,
            queues: {
                tts: this.bot.queueManager.ttsQueue,
                followers: this.bot.queueManager.followers,
                subscribers: this.bot.queueManager.subscribers,
                gifters: this.bot.queueManager.gifters
            }
        });
    }
}

module.exports = HealthMonitor;