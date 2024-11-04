const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { CONFIG, validateConfig } = require('./src/config/config');
const WebSocketServer = require('./src/services/websocket');
const QueueManager = require('./src/managers/queueManager');
const DeltaManager = require('./src/managers/deltaManager');
const VoiceManager = require('./src/managers/voiceManager');
const StateManager = require('./src/managers/stateManager');
const TwitchClient = require('./src/services/twitch');
const HealthMonitor = require('./src/utils/healthMonitor');
const path = require('path');
const fs = require('fs');

let ErrorHandler;  // Declare it at the top but initialize later

class DeltaBot {
    constructor() {
        // Initialize Discord client with needed intents
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages
            ]
        });

        // Initialize collections
        this.commands = new Collection();

        // Initialize managers
        this.queueManager = new QueueManager();
        this.voiceManager = new VoiceManager(this.client);
        this.deltaManager = new DeltaManager(this.voiceManager);

        // Initialize WebSocket server with null voiceManager
        this.wsServer = new WebSocketServer(this.queueManager, this.deltaManager);

        // Initialize state manager
        this.stateManager = new StateManager();

        // Placeholders for components that will be initialized later
        this.errorHandler = null;  // Initialize after bot is ready
        this.healthMonitor = null; // Initialize after bot is ready
        this.twitchClient = null;  // Initialize after bot is ready
    }

    async init() {
        try {
            // Load previous state
            const savedState = await this.stateManager.loadState();
            if (savedState) {
                // Restore queues
                this.queueManager.restoreFromState(savedState.queues);
            }

            // Validate config
            validateConfig();

            // Load commands
            await this.loadCommands();

            // Set up event handlers
            this.setupEventHandlers();

            // Login to Discord
            await this.client.login(CONFIG.discord.token);

            // Initialize WebSocket server and other components after bot is ready
            this.client.once('ready', () => {
                // Set the voice manager in WebSocket server after client is ready
                this.wsServer.setVoiceManager(this.voiceManager);
                
                this.wsServer.initialize();
                this.twitchClient = new TwitchClient(this.queueManager, this.deltaManager);
                this.twitchClient.initialize();
                this.healthMonitor = new HealthMonitor(this);

                // Initialize ErrorHandler after everything is ready
                ErrorHandler = require('./src/utils/errorHandler');  // Require here to avoid circular dependency issues
                this.errorHandler = new ErrorHandler(this);

                console.log(`${this.client.user.tag} is online!`);
            });

        } catch (error) {
            console.error('Error initializing bot:', error);
            process.exit(1);
        }
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, 'src', 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                this.commands.set(command.data.name, command);
            }
        }
    }

    setupEventHandlers() {
        // Handle interactions (commands)
        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;

            const command = this.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, this);
            } catch (error) {
                console.error(error);
                const response = {
                    content: 'There was an error executing this command.',
                    ephemeral: true
                };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(response);
                } else {
                    await interaction.reply(response);
                }
            }
        });

        // Add shutdown handling
        process.on('SIGINT', async () => {
            console.log('Shutting down...');
            if (this.wsServer) {
                this.wsServer.shutdown();
            }
            if (this.twitchClient) {
                this.twitchClient.disconnect();
            }
            await this.voiceManager.disconnect();
            this.client.destroy();
            process.exit(0);
        });
    }
}

// Start the bot
const bot = new DeltaBot();
bot.init();
