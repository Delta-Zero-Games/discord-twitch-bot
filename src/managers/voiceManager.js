const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    StreamType
} = require('@discordjs/voice');
const { Readable, Transform } = require('stream');
const { CONFIG } = require('../config/config');

/**
 * Transform stream to convert mono s16le PCM to stereo s16le PCM.
 * Discord voice expects stereo audio. This transform duplicates each sample.
 */
class MonoToStereo extends Transform {
    constructor() {
        super();
        this.leftover = null; // Store leftover bytes from previous chunk
    }

    _transform(chunk, encoding, callback) {
        // If we have leftover data, prepend it
        if (this.leftover) {
            chunk = Buffer.concat([this.leftover, chunk]);
            this.leftover = null;
        }

        // If chunk length is not a multiple of 2, we have an incomplete sample at the end
        const sampleableLength = chunk.length - (chunk.length % 2);

        // If there's an incomplete sample byte at the end, store it for next time
        if (sampleableLength < chunk.length) {
            this.leftover = chunk.slice(sampleableLength);
            chunk = chunk.slice(0, sampleableLength);
        }

        // Now 'chunk' should have a length divisible by 2
        // Convert mono (s16le) samples to stereo by duplicating each sample
        const sampleCount = chunk.length / 2;
        const outBuffer = Buffer.alloc(chunk.length * 2);

        for (let i = 0; i < sampleCount; i++) {
            const sample = chunk.readInt16LE(i * 2);
            // Write the sample twice (left and right)
            outBuffer.writeInt16LE(sample, i * 4);
            outBuffer.writeInt16LE(sample, i * 4 + 2);
        }

        this.push(outBuffer);
        callback();
    }

    _flush(callback) {
        // If there's leftover data at flush time, just ignore it or handle as needed
        this.leftover = null;
        callback();
    }
}

class VoiceManager {
    constructor(client) {
        this.client = client;
        this.connection = null;
        this.player = createAudioPlayer();
        this.player.setMaxListeners(20);
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

    async connectToChannel(channelId) {
        try {
            const channel = await this.client.channels.fetch(channelId);

            if (!channel) {
                throw new Error('Voice channel not found');
            }

            if (!channel.isVoiceBased()) {
                throw new Error('Specified channel is not a voice channel');
            }

            await this.joinChannel(channel);
        } catch (error) {
            console.error('Error connecting to voice channel:', error);
            throw error;
        }
    }

    async joinChannel(channel) {
        try {
            // If already in this channel and ready, no need to rejoin
            if (this.currentChannel?.id === channel.id && this.connection?.state.status === VoiceConnectionStatus.Ready) {
                return;
            }

            // If connected to a different channel, destroy that connection first
            if (this.connection && this.currentChannel?.id !== channel.id) {
                this.connection.destroy();
            }

            this.connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false
            });

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

            await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
            console.log(`Joined voice channel: ${channel.name}`);

        } catch (error) {
            console.error('Error joining voice channel:', error);
            this.disconnect();
            throw error;
        }
    }

    /**
     * Play TTS audio as raw s16le PCM at 48 kHz.
     * If audio is mono, we convert it to stereo using MonoToStereo.
     * @param {Readable|Buffer} audioData - s16le PCM at 48kHz, mono
     */
    async playTTS(audioData) {
        try {
            if (!this.connection) {
                throw new Error('Not connected to a voice channel');
            }

            let audioStream;
            if (Buffer.isBuffer(audioData)) {
                audioStream = Readable.from(audioData);
            } else {
                audioStream = audioData;
            }

            // Convert mono to stereo before playing
            const stereoTransform = new MonoToStereo();
            const stereoStream = audioStream.pipe(stereoTransform);

            const resource = createAudioResource(stereoStream, {
                inputType: StreamType.Raw,
                inlineVolume: true
            });

            // If currently speaking, wait until it's done
            while (this.speaking) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.speaking = true;
            this.player.play(resource);

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
