class Logger {
    constructor() {
        this.debugWebhook = null;
    }

    info(message, context = {}) {
        this.log('INFO', message, context);
    }

    error(message, error, context = {}) {
        this.log('ERROR', message, {
            ...context,
            error: error?.message || error,
            stack: error?.stack
        });
    }

    debug(message, context = {}) {
        this.log('DEBUG', message, context);
    }

    async log(level, message, context = {}) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`, context);
    }
}

module.exports = new Logger();