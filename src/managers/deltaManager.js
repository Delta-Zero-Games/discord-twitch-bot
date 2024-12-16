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

        setInterval(() => this.cleanupConversationHistory(), 
            CONFIG.claude.memory.cleanupInterval
        );
    }

    async processMessage(username, content, timestamp) {
        try {
            const response = await this.streamClaudeResponse('base_ssml', null, {
                username,
                content,
                timestamp
            });

            this.addToConversationHistory('user', username, content, timestamp);
            this.addToConversationHistory('assistant', 'Delta', response, Date.now());

            return response;
        } catch (error) {
            console.error('Error processing message:', error);
            throw error;
        }
    }

    async streamClaudeResponse(baseType, contextType, contextData) {
        try {
            // Choose prompt type based on voice configuration
            const promptType = CONFIG.tts.usePremiumVoice ? 'base_plain' : 'base_ssml';
            const systemPrompt = getSystemPrompt(promptType);
    
            if (!systemPrompt) {
                throw new Error('Generated system prompt is empty');
            }
    
            const contextMessage = getContextMessage(contextType, contextData);
            let messages = getConversationHistoryMessages(this.getRecentConversationHistory());
    
            if (contextMessage) {
                messages.push({ role: 'user', content: contextMessage });
            }
    
            if (contextData.content) {
                messages.push({ role: 'user', content: contextData.content });
            }
    
            const stream = await this.claude.messages.create({
                model: CONFIG.claude.model,
                max_tokens: CONFIG.claude.maxTokens,
                system: systemPrompt,
                messages: messages,
                stream: true
            });
    
            let fullResponse = '';
            let currentSentence = '';
            let ttsPromise = Promise.resolve();
    
            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                    const text = chunk.delta.text;
                    fullResponse += text;
                    currentSentence += text;
    
                    // For premium voice, process on sentence boundaries
                    if (CONFIG.tts.usePremiumVoice) {
                        if (/[.!?;]\s*$/.test(currentSentence)) {
                            const sentence = currentSentence.trim();
                            currentSentence = '';
                            if (sentence) {
                                ttsPromise = ttsPromise.then(() => this.speakResponse(sentence));
                            }
                        }
                    } else {
                        // For standard voice, process on SSML boundaries
                        if (currentSentence.includes('</speak>')) {
                            const ssmlEnd = currentSentence.indexOf('</speak>') + 8;
                            const ssml = currentSentence.substring(0, ssmlEnd);
                            currentSentence = currentSentence.substring(ssmlEnd);
    
                            if (ssml.trim()) {
                                ttsPromise = ttsPromise.then(() => this.speakResponse(ssml));
                            }
                        }
                    }
                }
            }
    
            // Handle any remaining text
            if (currentSentence.trim()) {
                await ttsPromise;
                await this.speakResponse(currentSentence.trim());
            }
    
            return fullResponse;
        } catch (error) {
            console.error('Error in streamClaudeResponse:', error);
            throw error;
        }
    }
    
    async speakResponse(text) {
        try {
            if (!this.voiceManager.isConnected()) {
                return;
            }
    
            while (this.speaking) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
    
            this.speaking = true;
    
            const voiceConfig = CONFIG.tts.usePremiumVoice ? 
                CONFIG.tts.options.premiumVoice : 
                CONFIG.tts.options.standardVoice;
    
            const request = {
                voice: {
                    languageCode: CONFIG.tts.options.language,
                    name: voiceConfig.name
                },
                audioConfig: {
                    audioEncoding: 'OGG_OPUS',
                    sampleRateHertz: voiceConfig.sampleRateHertz
                }
            };
    
            // Set input based on voice type
            if (CONFIG.tts.usePremiumVoice) {
                request.input = { text: text };  // Plain text for premium voice
            } else {
                request.input = { ssml: text };  // SSML for standard voice
                request.audioConfig.speakingRate = voiceConfig.speakingRate;
            }
    
            const [response] = await this.ttsClient.synthesizeSpeech(request);
            const audioBuffer = Buffer.from(response.audioContent, 'base64');
            await this.voiceManager.playTTS(audioBuffer);
    
        } catch (error) {
            console.error('Error generating/playing speech:', error);
            throw error;
        } finally {
            this.speaking = false;
        }
    }

    async processBitMessage(username, bits, message, timestamp) {
        try {
            const response = await this.getClaudeResponse('base_ssml', 'bit_donation', {
                username,
                bits,
                message,
                timestamp
            });

            this.addToConversationHistory('user', username, message, timestamp);
            this.addToConversationHistory('assistant', 'Delta', response, Date.now());

            await this.speakResponse(response);
            return response;
        } catch (error) {
            console.error('Error processing bit message:', error);
            throw error;
        }
    }

    async processFollowers(count, timeElapsed) {
        try {
            const response = await this.getClaudeResponse('base_ssml', 'follower_announcement', {
                count,
                time: `${timeElapsed} minutes`
            });

            await this.speakResponse(response);
            return response;
        } catch (error) {
            console.error('Error processing followers:', error);
            throw error;
        }
    }

    async processSubscriber(username, months, message = '') {
        try {
            const response = await this.getClaudeResponse('base_ssml', 'subscriber_announcement', {
                username,
                months,
                message
            });

            await this.speakResponse(response);
            return response;
        } catch (error) {
            console.error('Error processing subscriber:', error);
            throw error;
        }
    }

    async processGifter(username, giftCount) {
        try {
            const response = await this.getClaudeResponse('base_ssml', 'gifted_subs', {
                username,
                count: giftCount
            });

            await this.speakResponse(response);
            return response;
        } catch (error) {
            console.error('Error processing gifter:', error);
            throw error;
        }
    }

    async processRaid(username, viewers) {
        try {
            const response = await this.getClaudeResponse('base_ssml', 'raid_announcement', {
                username,
                count: viewers
            });

            await this.speakResponse(response);
            return response;
        } catch (error) {
            console.error('Error processing raid:', error);
            throw error;
        }
    }

    async getClaudeResponse(baseType, contextType, contextData) {
        try {
            const systemPrompt = getSystemPrompt(baseType);
            if (!systemPrompt) {
                throw new Error('Generated system prompt is empty');
            }

            const contextMessage = getContextMessage(contextType, contextData);
            let messages = getConversationHistoryMessages(this.getRecentConversationHistory());

            if (contextMessage) {
                messages.push({ role: 'user', content: contextMessage });
            }

            if (contextData.content) {
                messages.push({ role: 'user', content: contextData.content });
            }

            const response = await this.claude.messages.create({
                model: CONFIG.claude.model,
                max_tokens: CONFIG.claude.maxTokens,
                system: systemPrompt,
                messages: messages
            });

            if (!response || !response.content || response.content.length === 0) {
                throw new Error('Claude API response is empty or invalid');
            }

            return response.content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('');

        } catch (error) {
            console.error('Error getting Claude response:', error);
            throw error;
        }
    }

    addToConversationHistory(role, username, content, timestamp) {
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
        return this.conversationHistory
            .filter(msg => msg.timestamp > cutoff)
            .slice(-20);
    }

    cleanupConversationHistory() {
        const cutoff = Date.now() - CONFIG.claude.memory.maxContextAge;
        this.conversationHistory = this.conversationHistory.filter(
            msg => msg.timestamp > cutoff
        );
    }
}

module.exports = DeltaManager;