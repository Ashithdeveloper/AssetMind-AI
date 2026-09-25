"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const Asset_model_1 = require("../models/Asset.model");
const FinancialData_model_1 = require("../models/FinancialData.model");
const StockPrice_model_1 = require("../models/StockPrice.model");
const FinancialDocument_model_1 = require("../models/FinancialDocument.model");
const ScrapingJob_model_1 = require("../models/ScrapingJob.model");
const User_model_1 = require("../models/User.model");
async function checkDatabaseStats() {
    await (0, database_1.connectDatabase)();
    const [users, assets, financials, prices, docs, jobs] = await Promise.all([
        User_model_1.User.countDocuments(),
        Asset_model_1.Asset.countDocuments(),
        FinancialData_model_1.FinancialData.countDocuments(),
        StockPrice_model_1.StockPrice.countDocuments(),
        FinancialDocument_model_1.FinancialDocument.countDocuments(),
        ScrapingJob_model_1.ScrapingJob.countDocuments(),
    ]);
    const [indianAssets, globalAssets] = await Promise.all([
        Asset_model_1.Asset.countDocuments({ country: 'India' }),
        Asset_model_1.Asset.countDocuments({ country: { $ne: 'India' } }),
    ]);
    const sources = await FinancialData_model_1.FinancialData.distinct('source');
    const symbols = await FinancialData_model_1.FinancialData.distinct('symbol');
    // Breakdown of top metrics
    const topMetrics = await FinancialData_model_1.FinancialData.aggregate([
        { $group: { _id: '$metricName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
    ]);
    // Breakdown of job statuses
    const jobStatuses = await ScrapingJob_model_1.ScrapingJob.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);
    console.log('\n===============================================================');
    console.log('📊 ASSETMIND AI: CURRENT DATABASE INVENTORY & RECORD COUNTS');
    console.log('===============================================================');
    console.log(`👥 Users Registered:              ${users}`);
    console.log(`🏢 Total Asset Companies:         ${assets}`);
    console.log(`   • 🇮🇳 Indian Companies:         ${indianAssets}`);
    console.log(`   • 🌍 Global Companies:         ${globalAssets}`);
    console.log(`📈 Total Stock Price Records:     ${prices}`);
    console.log(`💹 Total Financial Data Records:  ${financials}`);
    console.log(`📑 Total Financial Documents:     ${docs}`);
    console.log(`⚙️  Total Scraping Jobs Logged:    ${jobs}`);
    console.log(`📌 Unique Companies with Data:    ${symbols.length}`);
    console.log(`🌐 Data Sources Present:          ${sources.join(', ')}`);
    console.log('\n📈 Top Financial Metrics Stored:');
    topMetrics.forEach((m) => {
        console.log(`   • ${m._id.padEnd(20)} : ${m.count} records`);
    });
    console.log('\n📋 Scraping Job Status Breakdown:');
    jobStatuses.forEach((j) => {
        console.log(`   • ${j._id.padEnd(20)} : ${j.count} jobs`);
    });
    console.log('===============================================================\n');
    await (0, database_1.disconnectDatabase)();
}
checkDatabaseStats().catch((err) => {
    console.error('Error fetching database stats:', err);
    process.exit(1);
});
//# sourceMappingURL=check-database-stats.js.map