const { CartesiaClient } = require('@cartesia/cartesia-js');
const { Readable } = require('stream');
const { CONFIG } = require('../config/config');

class SonicTTSClient {
    constructor() {
        this.cartesia = new CartesiaClient({
            apiKey: CONFIG.sonic.apiKey
        });
        this.websocket = null;
        this.contextId = null;
    }

    async initialize() {
        try {
            // Initialize WebSocket with raw PCM format for direct streaming
            this.websocket = this.cartesia.tts.websocket({
                container: "raw",
                encoding: "pcm_s16le",
                sampleRate: 48000  // Match Discord's sample rate
            });

            await this.websocket.connect();
            console.log('Connected to Sonic TTS WebSocket');
        } catch (error) {
            console.error('Failed to initialize Sonic TTS:', error);
            throw error;
        }
    }

    async streamTTS(text, isInitial = true) {
        try {
            if (!this.websocket) {
                await this.initialize();
            }
    
            // Generate a new context ID for each conversation if initial
            if (isInitial) {
                this.contextId = `ctx_${Date.now()}`;
            }
    
            const options = {
                contextId: this.contextId,
                modelId: "sonic-preview",
                voice: {
                    mode: "id",
                    id: CONFIG.sonic.voiceId
                },
                transcript: text
            };
    
            // Always use send() for each TTS request
            const response = await this.websocket.send(options);
    
            // Create a readable stream for the audio data
            const audioStream = new Readable({ read() {} });
    
            // Use the for-await-of loop to read raw audio messages
            (async () => {
                try {
                    for await (const message of response.events("message")) {
                        // message is a Buffer of PCM audio
                        audioStream.push(message);
                    }
                } catch (err) {
                    console.error('Error reading audio messages:', err);
                    audioStream.destroy(err);
                    return;
                }
                // When done, signal end of stream
                audioStream.push(null);
            })();
    
            return audioStream;
    
        } catch (error) {
            console.error('Error in Sonic TTS stream:', error);
            throw error;
        }
    }co            

    async disconnect() {
        if (this.websocket) {
            await this.websocket.disconnect();
            this.websocket = null;
        }
    }
}

module.exports = SonicTTSClient;