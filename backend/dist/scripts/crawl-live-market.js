"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const marketDiscovery_service_1 = require("../modules/scraping/discovery/marketDiscovery.service");
const scraping_service_1 = require("../modules/scraping/scraping.service");
const Asset_model_1 = require("../models/Asset.model");
async function crawlLiveMarket() {
    console.log('\n===============================================================');
    console.log('🌐 ASSETMIND AI: DYNAMIC LIVE SOURCE WEBSITE CRAWLER');
    console.log('   (Extracts companies directly from Screener.in & Global Sources)');
    console.log('===============================================================\n');
    await (0, database_1.connectDatabase)();
    try {
        // 1. Live Web Discovery
        console.log('🔍 Step 1: Crawling live source websites for top companies...');
        const discovered = await marketDiscovery_service_1.MarketDiscoveryService.discoverLiveCompanies({
            region: 'all',
            limit: 80,
        });
        console.log(`✔️ Discovered ${discovered.length} companies directly from live web listings:`);
        const indianList = discovered.filter((d) => d.country === 'India');
        const globalList = discovered.filter((d) => d.country !== 'India');
        console.log(`   • 🇮🇳 Indian Companies (${indianList.length}): ${indianList.map((d) => d.symbol).join(', ')}`);
        console.log(`   • 🌍 Global Companies (${globalList.length}): ${globalList.map((d) => d.symbol).join(', ')}`);
        // 2. Scrape live financial data for discovered companies
        console.log('\n🚀 Step 2: Extracting, validating & storing financial data for discovered companies...');
        let success = 0;
        let failed = 0;
        for (let i = 0; i < discovered.length; i++) {
            const comp = discovered[i];
            console.log(`\n[${i + 1}/${discovered.length}] [${comp.country.toUpperCase()}] Scraping ${comp.symbol} (${comp.name}) via ${comp.discoverySource}...`);
            const sources = comp.country === 'India'
                ? ['screener-in', 'yahoo-finance']
                : ['yahoo-finance', 'stockanalysis', 'sec-edgar'];
            try {
                const job = await scraping_service_1.ScrapingService.triggerScrape({
                    symbol: comp.symbol,
                    sources,
                    scraperProvider: 'playwright',
                });
                console.log(`   ✔️ Status: ${job.status} | Collected: ${job.recordsCollected} | Validated: ${job.recordsValidated}`);
                success++;
            }
            catch (err) {
                console.warn(`   ⚠️ Warning: Could not scrape ${comp.symbol}: ${err.message || err}`);
                failed++;
            }
        }
        console.log('\n===============================================================');
        console.log('🎉 LIVE SOURCE DISCOVERY & SCRAPING COMPLETE!');
        console.log(`📊 Total Assets Stored in MongoDB: ${await Asset_model_1.Asset.countDocuments()}`);
        console.log(`📊 Successfully Scraped: ${success} | Failed: ${failed}`);
        console.log('===============================================================\n');
    }
    catch (error) {
        console.error('❌ Crawl error:', error);
    }
    finally {
        await (0, database_1.disconnectDatabase)();
    }
}
crawlLiveMarket();
//# sourceMappingURL=crawl-live-market.js.map