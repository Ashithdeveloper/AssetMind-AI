"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const database_1 = require("./config/database");
const scraping_scheduler_1 = require("./modules/scraping/scraping.scheduler");
const liveRefresh_scheduler_1 = require("./modules/realtime/liveRefresh.scheduler");
const startServer = async () => {
    try {
        // 1. Connect to MongoDB
        await (0, database_1.connectDatabase)();
        // 2. Create express app
        const app = (0, app_1.createApp)();
        // 3. Start listening
        const server = app.listen(env_1.env.PORT, () => {
            console.log(`==================================================`);
            console.log(`🚀 AssetMind AI Backend v3.0.0 is running!`);
            console.log(`📡 URL: http://localhost:${env_1.env.PORT}`);
            console.log(`🛡️  Environment: ${env_1.env.NODE_ENV}`);
            console.log(`🔌 Scraper Provider: ${env_1.env.SCRAPER_PROVIDER}`);
            console.log(`📦 MongoDB: ${env_1.env.MONGODB_URI}`);
            console.log(`🔄 Auto Scraping: ${env_1.env.AUTO_SCRAPE_ENABLED ? `Enabled (Every ${env_1.env.AUTO_SCRAPE_INTERVAL_HOURS}h)` : 'Disabled'}`);
            console.log(`⚡ Live Price Refresh: Every 60s via Yahoo Finance V8 API`);
            console.log(`📰 Financial News: Real-time RSS (Yahoo, Google, ET, Mint)`);
            console.log(`==================================================`);
        });
        // 4. Start background automated scraper scheduler (Immediate on startup + Every 4 hours)
        scraping_scheduler_1.ScrapingScheduler.start();
        // 5. Start live real-time price refresh every 60 seconds
        (0, liveRefresh_scheduler_1.startLivePriceRefresh)(60);
        // Graceful Shutdown
        const handleShutdown = async (signal) => {
            console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
            scraping_scheduler_1.ScrapingScheduler.stop();
            (0, liveRefresh_scheduler_1.stopLivePriceRefresh)();
            server.close(async () => {
                await (0, database_1.disconnectDatabase)();
                console.log('[Server] Process terminated cleanly.');
                process.exit(0);
            });
        };
        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    }
    catch (error) {
        console.error('[Server] Critical startup error:', error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=server.js.map