const { CartesiaClient } = require('@cartesia/cartesia-js');
const fs = require('fs');
const { CONFIG } = require('./config/config'); // Adjust the relative path if needed

async function generateWavFromText(text) {
    // Initialize the WebSocket for WAV output using your config values
    const cartesia = new CartesiaClient({
        apiKey: CONFIG.sonic.apiKey
    });

    const websocket = cartesia.tts.websocket({
        container: "raw",
        encoding: "pcm_s16le",
        sampleRate: 48000 // Adjust if your config or needs differ
    });

    try {
        await websocket.connect();
        console.log("Connected to Cartesia TTS WebSocket");

        // Send TTS request using values from CONFIG
        const response = await websocket.send({
            modelId: "sonic-preview", // If you have a different model ID in CONFIG, use it here
            voice: {
                mode: "id",
                id: CONFIG.sonic.voiceId
            },
            transcript: text
        });

        const filePath = 'test_output.wav';
        const writeStream = fs.createWriteStream(filePath);

        response.on('message', (chunk) => {
            writeStream.write(chunk);
        });

        response.on('end', () => {
            writeStream.end();
            console.log(`WAV file saved as ${filePath}`);
            websocket.disconnect();
            console.log("WebSocket disconnected");
        });

        response.on('error', (err) => {
            console.error('Error receiving WAV data:', err);
            writeStream.end();
            websocket.disconnect();
        });

    } catch (error) {
        console.error('Failed to generate WAV:', error);
    }
}

// Usage: node test_tts_wav.js "Your text here"
const inputText = process.argv.slice(2).join(" ") || "Hello, world!";
generateWavFromText(inputText);
