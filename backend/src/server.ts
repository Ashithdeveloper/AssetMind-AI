import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { ScrapingScheduler } from './modules/scraping/scraping.scheduler';
import { startLivePriceRefresh, stopLivePriceRefresh } from './modules/realtime/liveRefresh.scheduler';

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDatabase();

    // 2. Create express app
    const app = createApp();

    // 3. Start listening
    const server = app.listen(env.PORT, () => {
      console.log(`==================================================`);
      console.log(`🚀 AssetMind AI Backend v3.0.0 is running!`);
      console.log(`📡 URL: http://localhost:${env.PORT}`);
      console.log(`🛡️  Environment: ${env.NODE_ENV}`);
      console.log(`🔌 Scraper Provider: ${env.SCRAPER_PROVIDER}`);
      console.log(`📦 MongoDB: ${env.MONGODB_URI}`);
      console.log(`🔄 Auto Scraping: ${env.AUTO_SCRAPE_ENABLED ? `Enabled (Every ${env.AUTO_SCRAPE_INTERVAL_HOURS}h)` : 'Disabled'}`);
      console.log(`⚡ Live Price Refresh: Every 60s via Yahoo Finance V8 API`);
      console.log(`📰 Financial News: Real-time RSS (Yahoo, Google, ET, Mint)`);
      console.log(`==================================================`);
    });

    // 4. Start background automated scraper scheduler (Immediate on startup + Every 4 hours)
    ScrapingScheduler.start();

    // 5. Start live real-time price refresh every 60 seconds
    startLivePriceRefresh(60);

    // Graceful Shutdown
    const handleShutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      ScrapingScheduler.stop();
      stopLivePriceRefresh();
      server.close(async () => {
        await disconnectDatabase();
        console.log('[Server] Process terminated cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (error) {
    console.error('[Server] Critical startup error:', error);
    process.exit(1);
  }
};

startServer();
