const { 
    joinVoiceChannel, 
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    demuxProbe,
    StreamType // Added StreamType
} = require('@discordjs/voice');
const { Readable } = require('stream');
const { CONFIG } = require('../config/config');

class VoiceManager {
    constructor(client) {
        this.client = client;
        this.connection = null;
        this.player = createAudioPlayer();
        this.currentChannel = null;
        this.speaking = false;

        // Handle player state changes
        this.player.on('stateChange', (oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                this.speaking = false;
            }
        });

        this.player.on('error', error => {
            console.error('Error:', error);
            this.speaking = false;
        });
    }

    async joinChannel(channel) {
        try {
            // If already in this channel, don't rejoin
            if (this.currentChannel?.id === channel.id && this.connection?.state.status === VoiceConnectionStatus.Ready) {
                return;
            }

            // Disconnect from current channel if in a different one
            if (this.connection && this.currentChannel?.id !== channel.id) {
                this.connection.destroy();
            }

            // Join new channel
            this.connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false
            });

            // Subscribe player to connection
            this.connection.subscribe(this.player);
            this.currentChannel = channel;

            // Handle connection errors
            this.connection.on('error', async (error) => {
                console.error('Voice connection error:', error);
                try {
                    await this.reconnect();
                } catch (e) {
                    console.error('Reconnection failed:', e);
                    this.disconnect();
                }
            });

            // Wait for connection to be ready
            await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
            console.log(`Joined voice channel: ${channel.name}`);

        } catch (error) {
            console.error('Error joining voice channel:', error);
            this.disconnect();
            throw error;
        }
    }

    async playTTS(audioBuffer) {
        try {
            if (!this.connection) {
                throw new Error('Not connected to a voice channel');
            }
    
            // Wait for any current speech to finish
            while (this.speaking) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
    
            this.speaking = true;
    
            // Create a Readable stream from the audio buffer
            const audioStream = Readable.from(audioBuffer);
    
            // Create resource from audio stream
            const resource = createAudioResource(audioStream, {
                inputType: StreamType.OggOpus, // Correct inputType for OGG Opus stream
                inlineVolume: true
            });
    
            // Play audio
            this.player.play(resource);
    
            // Wait for playback to complete
            return new Promise((resolve, reject) => {
                this.player.once(AudioPlayerStatus.Idle, () => {
                    this.speaking = false;
                    resolve();
                });
    
                this.player.once('error', error => {
                    this.speaking = false;
                    console.error('Voice player error:', error);
                    reject(error);
                });
            });
    
        } catch (error) {
            this.speaking = false;
            console.error('Error playing TTS:', error);
            throw error;
        }
    }    

    async reconnect() {
        if (this.currentChannel) {
            await this.joinChannel(this.currentChannel);
        }
    }

    disconnect() {
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
        this.currentChannel = null;
        this.speaking = false;
    }

    isConnected() {
        return this.connection?.state.status === VoiceConnectionStatus.Ready;
    }

    getCurrentChannel() {
        return this.currentChannel;
    }
}

module.exports = VoiceManager;