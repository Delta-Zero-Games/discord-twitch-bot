const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class StateManager {
    constructor() {
        this.statePath = path.join(__dirname, '../../data/state.json');
        this.lockFile = path.join(__dirname, '../../data/state.lock');
    }

    async saveState(state) {
        try {
            // Ensure directory exists
            await fs.mkdir(path.dirname(this.statePath), { recursive: true });

            // Check for lock
            if (await this.isLocked()) {
                logger.debug('State file is locked, skipping save');
                return;
            }

            // Create lock
            await this.lock();

            // Save state
            await fs.writeFile(
                this.statePath,
                JSON.stringify(state, null, 2)
            );

            // Release lock
            await this.unlock();

        } catch (error) {
            logger.error('Failed to save state:', error);
            await this.unlock();
        }
    }

    async loadState() {
        try {
            const data = await fs.readFile(this.statePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error('Failed to load state:', error);
            }
            return null;
        }
    }

    async isLocked() {
        try {
            await fs.access(this.lockFile);
            return true;
        } catch {
            return false;
        }
    }

    async lock() {
        try {
            await fs.writeFile(this.lockFile, Date.now().toString());
        } catch (error) {
            logger.error('Failed to create lock file:', error);
        }
    }

    async unlock() {
        try {
            await fs.unlink(this.lockFile);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error('Failed to remove lock file:', error);
            }
        }
    }
}

module.exports = StateManager;