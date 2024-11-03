const { CONFIG } = require('../config/config');

class QueueManager {
    constructor() {
        this.ttsQueue = [];        // For bit donations with messages
        this.followers = [];       // New followers
        this.subscribers = [];     // New subscribers
        this.gifters = [];         // Sub gifters
        this.lastFollowerCheck = Date.now();
    }

    // TTS Queue Methods (Bit Donations)
    addTTSMessage(username, bits, message, timestamp) {
        this.ttsQueue.push({
            username,
            bits,
            message,
            timestamp: new Date(timestamp).getTime()
        });
    }

    getNextTTSMessage() {
        return this.ttsQueue.shift() || null;
    }

    getTTSQueueCount() {
        return this.ttsQueue.length;
    }

    // Follower Methods
    addFollower(username, timestamp) {
        this.followers.push({
            username,
            timestamp: new Date(timestamp).getTime()
        });
    }

    getAndClearFollowers() {
        const now = Date.now();
        const count = this.followers.length;
        const timeElapsed = Math.floor((now - this.lastFollowerCheck) / 60000); // Convert to minutes
        
        // Clear the queue
        this.followers = [];
        this.lastFollowerCheck = now;

        return {
            count,
            timeElapsed
        };
    }

    getFollowerCount() {
        return this.followers.length;
    }

    // Subscriber Methods
    addSubscriber(username, months, message = '') {
        this.subscribers.push({
            username,
            months,
            message,
            timestamp: Date.now()
        });
    }

    getNextSubscriber() {
        return this.subscribers.shift() || null;
    }

    getSubscriberCount() {
        return this.subscribers.length;
    }

    // Gifter Methods
    addGifter(username, giftCount) {
        this.gifters.push({
            username,
            giftCount,
            timestamp: Date.now()
        });
    }

    getNextGifter() {
        return this.gifters.shift() || null;
    }

    getGifterCount() {
        return this.gifters.length;
    }

    // Queue Cleanup Methods
    cleanupOldItems() {
        const now = Date.now();
        const maxAge = CONFIG.queues.timeout;

        // Clean TTS queue
        this.ttsQueue = this.ttsQueue.filter(item => 
            (now - item.timestamp) < maxAge
        );

        // Clean subscriber queue
        this.subscribers = this.subscribers.filter(item => 
            (now - item.timestamp) < maxAge
        );

        // Clean gifter queue
        this.gifters = this.gifters.filter(item => 
            (now - item.timestamp) < maxAge
        );

        // Note: Followers don't need cleanup as they're batch processed
    }

    restoreFromState(queues) {
        if (queues) {
            this.ttsQueue = queues.tts || [];
            this.followers = queues.followers || [];
            this.subscribers = queues.subscribers || [];
            this.gifters = queues.gifters || [];
        }
    }

    // Get all metrics for WebSocket clients
    getMetrics() {
        return {
            tts_in_queue: this.getTTSQueueCount(),
            new_followers_count: this.getFollowerCount(),
            new_subs_count: this.getSubscriberCount(),
            new_giver_count: this.getGifterCount()
        };
    }
}

module.exports = QueueManager;