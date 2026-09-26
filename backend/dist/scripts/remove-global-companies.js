"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const Asset_model_1 = require("../models/Asset.model");
const StockPrice_model_1 = require("../models/StockPrice.model");
const FinancialData_model_1 = require("../models/FinancialData.model");
const FinancialDocument_model_1 = require("../models/FinancialDocument.model");
const PriceHistory_model_1 = require("../models/PriceHistory.model");
const AnalysisReport_model_1 = require("../models/AnalysisReport.model");
const FinancialMetrics_model_1 = require("../models/FinancialMetrics.model");
async function removeGlobalCompanies() {
    console.log('\n===============================================================');
    console.log('🗑️  PURGING USD & GLOBAL COMPANIES (KEEPING ONLY INDIAN EQUITIES)');
    console.log('===============================================================\n');
    await (0, database_1.connectDatabase)();
    try {
        // Find all non-Indian companies
        const nonIndianAssets = await Asset_model_1.Asset.find({ country: { $ne: 'India' } }).lean();
        const nonIndianIds = nonIndianAssets.map((a) => a._id);
        const nonIndianSymbols = nonIndianAssets.map((a) => a.symbol);
        console.log(`Found ${nonIndianSymbols.length} non-Indian companies to remove:`);
        console.log(nonIndianSymbols.join(', '));
        const [delAssets, delPrices, delFinancials, delDocs, delHistory, delReports, delMetrics] = await Promise.all([
            Asset_model_1.Asset.deleteMany({ country: { $ne: 'India' } }),
            StockPrice_model_1.StockPrice.deleteMany({
                $or: [{ assetId: { $in: nonIndianIds } }, { symbol: { $in: nonIndianSymbols } }],
            }),
            FinancialData_model_1.FinancialData.deleteMany({
                $or: [{ assetId: { $in: nonIndianIds } }, { symbol: { $in: nonIndianSymbols } }],
            }),
            FinancialDocument_model_1.FinancialDocument.deleteMany({
                $or: [{ assetId: { $in: nonIndianIds } }, { symbol: { $in: nonIndianSymbols } }],
            }),
            PriceHistory_model_1.PriceHistory.deleteMany({
                $or: [{ companyId: { $in: nonIndianIds } }, { symbol: { $in: nonIndianSymbols } }],
            }),
            AnalysisReport_model_1.AnalysisReport.deleteMany({
                $or: [{ companyId: { $in: nonIndianIds } }, { symbol: { $in: nonIndianSymbols } }],
            }),
            FinancialMetrics_model_1.FinancialMetrics.deleteMany({
                $or: [{ companyId: { $in: nonIndianIds } }, { symbol: { $in: nonIndianSymbols } }],
            }),
        ]);
        console.log('\n✔️ Purge summary:');
        console.log(`   • Assets removed:             ${delAssets.deletedCount}`);
        console.log(`   • Stock prices removed:       ${delPrices.deletedCount}`);
        console.log(`   • Financial data removed:     ${delFinancials.deletedCount}`);
        console.log(`   • Documents removed:          ${delDocs.deletedCount}`);
        console.log(`   • Price history removed:      ${delHistory.deletedCount}`);
        console.log(`   • Analysis reports removed:   ${delReports.deletedCount}`);
        console.log(`   • Financial metrics removed:  ${delMetrics.deletedCount}`);
        const remainingAssets = await Asset_model_1.Asset.countDocuments();
        const remainingIndian = await Asset_model_1.Asset.countDocuments({ country: 'India' });
        const sectors = await Asset_model_1.Asset.distinct('sector');
        console.log('\n📊 Database Status After Purge:');
        console.log(`   • Remaining Assets:           ${remainingAssets} (100% Indian Equities)`);
        console.log(`   • Indian Assets:              ${remainingIndian}`);
        console.log(`   • Sectors Present:            ${sectors.length} (${sectors.join(', ')})`);
        console.log('===============================================================\n');
    }
    finally {
        await (0, database_1.disconnectDatabase)();
    }
}
removeGlobalCompanies().catch((err) => {
    console.error('Purge error:', err);
    process.exit(1);
});
//# sourceMappingURL=remove-global-companies.js.map