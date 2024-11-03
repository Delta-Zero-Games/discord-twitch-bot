const { CONFIG } = require('../config/config');
const { SYSTEM_PROMPTS, getSystemPrompt, getContextMessage, getConversationHistoryMessages } = require('../config/delta');
const { Anthropic } = require('@anthropic-ai/sdk');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

class DeltaManager {
    constructor(voiceManager) {
        console.log('Initializing DeltaManager');
        this.voiceManager = voiceManager;
        this.claude = new Anthropic({
            apiKey: CONFIG.claude.apiKey
        });
        this.ttsClient = new TextToSpeechClient();
        this.conversationHistory = [];
        this.speaking = false;

        // Start cleanup interval for conversation history
        setInterval(() => this.cleanupConversationHistory(), 
            CONFIG.claude.memory.cleanupInterval
        );
    }

    async processMessage(username, content, timestamp) {
        console.log(`processMessage called with username: ${username}, content: ${content}, timestamp: ${timestamp}`);
        try {
            console.log('Calling getClaudeResponse');
            // Get response from Claude
            const response = await this.getClaudeResponse('base_ssml', null, {
                username,
                content,
                timestamp
            });
            console.log('Received response from Claude:', response);

            // Add to conversation history
            console.log('Adding to conversation history');
            this.addToConversationHistory('user', username, content, timestamp);
            this.addToConversationHistory('assistant', 'Delta', response, Date.now());

            // Generate and play TTS
            console.log('Calling speakResponse');
            await this.speakResponse(response);
            console.log('Finished speakResponse');

            return response;
        } catch (error) {
            console.error('Error processing message:', error);
            throw error;
        }
    }

    async processBitMessage(username, bits, message, timestamp) {
        console.log(`processBitMessage called with username: ${username}, bits: ${bits}, message: ${message}, timestamp: ${timestamp}`);
        try {
            console.log('Calling getClaudeResponse for bit message');
            // Get response from Claude with bit donation context
            const response = await this.getClaudeResponse('base_ssml', 'bit_donation', {
                username,
                bits,
                message,
                timestamp
            });
            console.log('Received response from Claude:', response);

            // Add to conversation history
            console.log('Adding to conversation history');
            this.addToConversationHistory('user', username, message, timestamp);
            this.addToConversationHistory('assistant', 'Delta', response, Date.now());

            // Generate and play TTS
            console.log('Calling speakResponse');
            await this.speakResponse(response);
            console.log('Finished speakResponse');

            return response;
        } catch (error) {
            console.error('Error processing bit message:', error);
            throw error;
        }
    }

    async processFollowers(count, timeElapsed) {
        console.log(`processFollowers called with count: ${count}, timeElapsed: ${timeElapsed}`);
        try {
            console.log('Calling getClaudeResponse for followers');
            const response = await this.getClaudeResponse('base_ssml', 'follower_announcement', {
                count,
                time: `${timeElapsed} minutes`
            });
            console.log('Received response from Claude:', response);

            console.log('Calling speakResponse');
            await this.speakResponse(response);
            console.log('Finished speakResponse');
            return response;
        } catch (error) {
            console.error('Error processing followers:', error);
            throw error;
        }
    }

    async processSubscriber(username, months, message = '') {
        console.log(`processSubscriber called with username: ${username}, months: ${months}, message: ${message}`);
        try {
            console.log('Calling getClaudeResponse for subscriber');
            const response = await this.getClaudeResponse('base_ssml', 'subscriber_announcement', {
                username,
                months,
                message
            });
            console.log('Received response from Claude:', response);

            console.log('Calling speakResponse');
            await this.speakResponse(response);
            console.log('Finished speakResponse');
            return response;
        } catch (error) {
            console.error('Error processing subscriber:', error);
            throw error;
        }
    }

    async processGifter(username, giftCount) {
        console.log(`processGifter called with username: ${username}, giftCount: ${giftCount}`);
        try {
            console.log('Calling getClaudeResponse for gifter');
            const response = await this.getClaudeResponse('base_ssml', 'gifted_subs', {
                username,
                count: giftCount
            });
            console.log('Received response from Claude:', response);

            console.log('Calling speakResponse');
            await this.speakResponse(response);
            console.log('Finished speakResponse');
            return response;
        } catch (error) {
            console.error('Error processing gifter:', error);
            throw error;
        }
    }

    async processRaid(username, viewers) {
        console.log(`processRaid called with username: ${username}, viewers: ${viewers}`);
        try {
            console.log('Calling getClaudeResponse for raid');
            const response = await this.getClaudeResponse('base_ssml', 'raid_announcement', {
                username,
                count: viewers
            });
            console.log('Received response from Claude:', response);
        
            console.log('Calling speakResponse');
            await this.speakResponse(response);
            console.log('Finished speakResponse');
            return response;
        } catch (error) {
            console.error('Error processing raid:', error);
            throw error;
        }
    }

    async getClaudeResponse(baseType, contextType, contextData) {
        console.log(`getClaudeResponse called with baseType: ${baseType}, contextType: ${contextType}, contextData:`, contextData);
        try {
            // Generate system prompt
            const systemPrompt = getSystemPrompt(baseType);
            if (!systemPrompt || systemPrompt.trim().length === 0) {
                console.error('Generated system prompt is empty');
                throw new Error('Generated system prompt is empty');
            }
            console.log('Generated System Prompt:', systemPrompt);
    
            // Generate context message if available
            const contextMessage = getContextMessage(contextType, contextData);
            console.log('Generated Context Message:', contextMessage);
    
            // Prepare the messages array
            let messages = [];
    
            // Add conversation history messages
            const historyMessages = getConversationHistoryMessages(this.getRecentConversationHistory());
            console.log('History Messages:', historyMessages);
            messages = messages.concat(historyMessages);
    
            // Add context as a user message if available
            if (contextMessage && contextMessage.trim().length > 0) {
                messages.push({ role: 'user', content: contextMessage });
                console.log('Added context message to messages');
            }
    
            // Add the current user message to the conversation
            if (contextData.content) {
                messages.push({ role: 'user', content: contextData.content });
                console.log('Added user message to messages');
            }
    
            if (messages.length === 0) {
                console.error('Messages array is empty. No content to send.');
                throw new Error('Messages array is empty. No content to send.');
            }
    
            console.log('Final Messages Array:', messages);
    
            // Make the API request using messages.create
            console.log('Calling Claude API messages.create');
            const response = await this.claude.messages.create({
                model: CONFIG.claude.model,
                max_tokens: CONFIG.claude.maxTokens,
                system: systemPrompt,
                messages: messages
            });
            console.log('Received response from Claude API:', response);
    
            // Updated check for valid response
            if (!response || !response.content || response.content.length === 0) {
                throw new Error('Claude API response is empty or invalid');
            }
    
            // Extract the assistant's reply
            const assistantResponse = response.content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('');
            console.log('Assistant Response:', assistantResponse);
    
            return assistantResponse;
        } catch (error) {
            console.error('Error getting Claude response:', error);
            throw error;
        }
    }                    

    async speakResponse(text) {
        console.log('speakResponse called with text:', text);
        try {
            // Don't generate speech if not connected to voice
            if (!this.voiceManager.isConnected()) {
                console.log('Not connected to voice channel, skipping TTS');
                return;
            }
    
            // Wait if currently speaking
            while (this.speaking) {
                console.log('Currently speaking, waiting...');
                await new Promise(resolve => setTimeout(resolve, 100));
            }
    
            this.speaking = true;
            console.log('Set speaking to true');
    
            // Generate speech
            console.log('Calling TTS synthesizeSpeech');
            const [response] = await this.ttsClient.synthesizeSpeech({
                input: { ssml: text },
                voice: {
                    languageCode: CONFIG.tts.options.language,
                    name: CONFIG.tts.options.voice
                },
                audioConfig: {
                    audioEncoding: 'OGG_OPUS',
                    speakingRate: CONFIG.tts.options.speakingRate,
                    pitch: CONFIG.tts.options.pitch,
                    sampleRateHertz: CONFIG.tts.options.sampleRateHertz
                }
            });
            console.log('Received response from TTS');
    
            // Decode the Base64 audio content into a Buffer
            const audioBuffer = Buffer.from(response.audioContent, 'base64');
            console.log('Decoded audio content into Buffer');
    
            // Play through voice connection
            console.log('Calling voiceManager.playTTS');
            await this.voiceManager.playTTS(audioBuffer);
            console.log('Finished voiceManager.playTTS');
    
        } catch (error) {
            console.error('Error generating/playing speech:', error);
            throw error;
        } finally {
            this.speaking = false;
            console.log('Set speaking to false');
        }
    }        

    addToConversationHistory(role, username, content, timestamp) {
        console.log(`Adding to conversation history: role=${role}, username=${username}, content=${content}, timestamp=${timestamp}`);
        this.conversationHistory.push({
            role,
            username,
            content,
            timestamp: new Date(timestamp).getTime()
        });

        this.cleanupConversationHistory();
    }

    getRecentConversationHistory() {
        const cutoff = Date.now() - CONFIG.claude.memory.maxContextAge;
        const recentHistory = this.conversationHistory
            .filter(msg => msg.timestamp > cutoff)
            .slice(-20); // Limit to last 20 messages
        console.log('Retrieved recent conversation history:', recentHistory);
        return recentHistory;
    }

    cleanupConversationHistory() {
        const cutoff = Date.now() - CONFIG.claude.memory.maxContextAge;
        const beforeCleanupLength = this.conversationHistory.length;
        this.conversationHistory = this.conversationHistory.filter(
            msg => msg.timestamp > cutoff
        );
        console.log(`Cleaned up conversation history. Before: ${beforeCleanupLength}, After: ${this.conversationHistory.length}`);
    }
}

module.exports = DeltaManager;