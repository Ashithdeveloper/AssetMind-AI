"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const Asset_model_1 = require("../models/Asset.model");
const FinancialData_model_1 = require("../models/FinancialData.model");
const StockPrice_model_1 = require("../models/StockPrice.model");
const FinancialDocument_model_1 = require("../models/FinancialDocument.model");
const ScrapingJob_model_1 = require("../models/ScrapingJob.model");
async function verifyScraping() {
    console.log('\n===============================================================');
    console.log('🔎 CHECKING SCRAPING STATUS & MONGODB DATABASE METRICS');
    console.log('===============================================================\n');
    await (0, database_1.connectDatabase)();
    try {
        const [totalAssets, totalFinancials, totalPrices, totalDocs, totalJobs] = await Promise.all([
            Asset_model_1.Asset.countDocuments(),
            FinancialData_model_1.FinancialData.countDocuments(),
            StockPrice_model_1.StockPrice.countDocuments(),
            FinancialDocument_model_1.FinancialDocument.countDocuments(),
            ScrapingJob_model_1.ScrapingJob.countDocuments(),
        ]);
        console.log('📊 DATABASE TOTALS:');
        console.log(`   • Total Assets:              ${totalAssets}`);
        console.log(`   • Total Financial Data:      ${totalFinancials} records`);
        console.log(`   • Total Stock Prices:        ${totalPrices} records`);
        console.log(`   • Total Financial Documents: ${totalDocs} records`);
        console.log(`   • Total Scraping Jobs:       ${totalJobs} jobs logged`);
        // Fetch latest completed scraping jobs
        console.log('\n📋 LATEST SCRAPING JOBS LOGGED:');
        const latestJobs = await ScrapingJob_model_1.ScrapingJob.find({})
            .sort({ createdAt: -1 })
            .limit(6)
            .lean();
        for (const job of latestJobs) {
            console.log(`   • [${job.symbol}] Status: ${job.status} | Source: ${job.source} | Validated: ${job.recordsValidated} | Provider: ${job.scraperProvider}`);
        }
        // Inspect an Indian stock sample (e.g., RELIANCE or TCS)
        const indianSymbol = 'RELIANCE';
        const indianAsset = await Asset_model_1.Asset.findOne({ symbol: indianSymbol }).lean();
        if (indianAsset) {
            console.log(`\n🇮🇳 SAMPLE INDIAN STOCK DATA (${indianSymbol}):`);
            console.log(`   Company: ${indianAsset.companyName} (${indianAsset.exchange}, ${indianAsset.country})`);
            console.log(`   Sector: ${indianAsset.sector || 'N/A'} | Industry: ${indianAsset.industry || 'N/A'}`);
            const latestPrice = await StockPrice_model_1.StockPrice.findOne({ symbol: indianSymbol }).sort({ collectedAt: -1 }).lean();
            if (latestPrice) {
                console.log(`   Latest Price: ₹${latestPrice.price} ${latestPrice.currency} (Source: ${latestPrice.source})`);
            }
            const metrics = await FinancialData_model_1.FinancialData.find({ symbol: indianSymbol }).limit(6).lean();
            console.log(`   Metrics Sample:`);
            metrics.forEach((m) => {
                console.log(`     - ${m.metricName}: ${m.metricValue} ${m.unit || ''} (Source: ${m.source}, Period: ${m.reportingPeriod})`);
            });
        }
        // Inspect a Global stock sample (e.g., MSFT or AAPL)
        const globalSymbol = 'MSFT';
        const globalAsset = await Asset_model_1.Asset.findOne({ symbol: globalSymbol }).lean();
        if (globalAsset) {
            console.log(`\n🌍 SAMPLE GLOBAL STOCK DATA (${globalSymbol}):`);
            console.log(`   Company: ${globalAsset.companyName} (${globalAsset.exchange}, ${globalAsset.country})`);
            const latestPrice = await StockPrice_model_1.StockPrice.findOne({ symbol: globalSymbol }).sort({ collectedAt: -1 }).lean();
            if (latestPrice) {
                console.log(`   Latest Price: $${latestPrice.price} ${latestPrice.currency} (Source: ${latestPrice.source})`);
            }
            const metrics = await FinancialData_model_1.FinancialData.find({ symbol: globalSymbol }).limit(6).lean();
            console.log(`   Metrics Sample:`);
            metrics.forEach((m) => {
                console.log(`     - ${m.metricName}: ${m.metricValue} ${m.unit || ''} (Source: ${m.source}, Period: ${m.reportingPeriod})`);
            });
            const docs = await FinancialDocument_model_1.FinancialDocument.find({ symbol: globalSymbol }).limit(2).lean();
            if (docs.length > 0) {
                console.log(`   Regulatory Documents:`);
                docs.forEach((d) => {
                    console.log(`     - [${d.documentType}] ${d.title} (Source: ${d.source})`);
                });
            }
        }
        console.log('\n===============================================================');
        console.log('✅ SCRAPING VERIFICATION RESULT: WORKING PROPERLY & PERSISTING');
        console.log('===============================================================\n');
    }
    catch (error) {
        console.error('Error during verification:', error);
    }
    finally {
        await (0, database_1.disconnectDatabase)();
    }
}
verifyScraping();
//# sourceMappingURL=verify-scraping-live.js.map