const logger = require('./logger');

class ErrorHandler {
    constructor(bot) {
        this.bot = bot;
        this.setupErrorHandlers();
    }

    setupErrorHandlers() {
        // Handle Discord client errors
        this.bot.client.on('error', error => {
            logger.error('Discord client error:', error);
            this.attemptRecovery('discord');
        });

        // Handle voice connection errors
        this.bot.voiceManager.player.on('error', error => {
            logger.error('Voice player error:', error);
            this.attemptRecovery('voice');
        });

        // Handle WebSocket errors
        this.bot.wsServer.server.on('error', error => {
            logger.error('WebSocket server error:', error);
            this.attemptRecovery('websocket');
        });

        // Handle Twitch client errors
        this.bot.twitchClient.client.on('error', error => {
            logger.error('Twitch client error:', error);
            this.attemptRecovery('twitch');
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', error => {
            logger.error('Uncaught exception:', error);
            this.handleCriticalError(error);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', error => {
            logger.error('Unhandled promise rejection:', error);
            this.handleCriticalError(error);
        });
    }

    async attemptRecovery(service) {
        logger.info(`Attempting recovery for ${service} service`);

        switch(service) {
            case 'discord':
                await this.recoverDiscordConnection();
                break;
            case 'voice':
                await this.recoverVoiceConnection();
                break;
            case 'websocket':
                await this.recoverWebSocketServer();
                break;
            case 'twitch':
                await this.recoverTwitchConnection();
                break;
        }
    }

    async recoverDiscordConnection() {
        try {
            if (!this.bot.client.isReady()) {
                logger.info('Attempting to reconnect Discord client...');
                await this.bot.client.login(CONFIG.discord.token);
            }
        } catch (error) {
            logger.error('Failed to recover Discord connection:', error);
        }
    }

    async recoverVoiceConnection() {
        try {
            const currentChannel = this.bot.voiceManager.getCurrentChannel();
            if (currentChannel) {
                logger.info('Attempting to reconnect to voice channel...');
                await this.bot.voiceManager.joinChannel(currentChannel);
            }
        } catch (error) {
            logger.error('Failed to recover voice connection:', error);
        }
    }

    async recoverWebSocketServer() {
        try {
            logger.info('Attempting to restart WebSocket server...');
            this.bot.wsServer.shutdown();
            this.bot.wsServer.initialize();
        } catch (error) {
            logger.error('Failed to recover WebSocket server:', error);
        }
    }

    async recoverTwitchConnection() {
        try {
            logger.info('Attempting to reconnect Twitch client...');
            await this.bot.twitchClient.reconnect();
        } catch (error) {
            logger.error('Failed to recover Twitch connection:', error);
        }
    }

    handleCriticalError(error) {
        logger.error('Critical error occurred:', error);
        
        // Attempt graceful shutdown
        this.initiateGracefulShutdown();
    }

    async initiateGracefulShutdown() {
        logger.info('Initiating graceful shutdown...');
        
        try {
            // Disconnect from voice
            await this.bot.voiceManager.disconnect();
            
            // Close WebSocket connections
            this.bot.wsServer.shutdown();
            
            // Disconnect Twitch client
            this.bot.twitchClient.disconnect();
            
            // Destroy Discord client
            this.bot.client.destroy();
            
            logger.info('Graceful shutdown completed');
            
            // Exit with error code
            process.exit(1);
        } catch (shutdownError) {
            logger.error('Error during shutdown:', shutdownError);
            process.exit(1);
        }
    }
}

module.exports = ErrorHandler;