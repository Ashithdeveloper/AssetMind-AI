import { connectDatabase, disconnectDatabase } from '../config/database';
import { Asset } from '../models/Asset.model';
import { StockPrice } from '../models/StockPrice.model';
import { FinancialData } from '../models/FinancialData.model';
import { FinancialDocument } from '../models/FinancialDocument.model';
import { PriceHistory } from '../models/PriceHistory.model';
import { AnalysisReport } from '../models/AnalysisReport.model';
import { FinancialMetrics } from '../models/FinancialMetrics.model';

async function removeGlobalCompanies() {
  console.log('\n===============================================================');
  console.log('🗑️  PURGING USD & GLOBAL COMPANIES (KEEPING ONLY INDIAN EQUITIES)');
  console.log('===============================================================\n');

  await connectDatabase();

  try {
    // Find all non-Indian companies
    const nonIndianAssets = await Asset.find({ country: { $ne: 'India' } }).lean();
    const nonIndianIds = nonIndianAssets.map((a) => a._id);
    const nonIndianSymbols = nonIndianAssets.map((a) => a.symbol);

    console.log(`Found ${nonIndianSymbols.length} non-Indian companies to remove:`);
    console.log(nonIndianSymbols.join(', '));

    const [delAssets, delPrices, delFinancials, delDocs, delHistory, delReports, delMetrics] = await Promise.all([
      Asset.deleteMany({ country: { $ne: 'India' } }),
      StockPrice.deleteMany({
        $or: [{ assetId: { $in: nonIndianIds } }, { symbol: { $in: nonIndianSymbols } }],
      }),
      FinancialData.deleteMany({
        $or: [{ assetId: { $in: nonIndianIds } }, { symbol: { $in: nonIndianSymbols } }],
      }),
      FinancialDocument.deleteMany({
        $or: [{ assetId: { $in: nonIndianIds } }, { symbol: { $in: nonIndianSymbols } }],
      }),
      PriceHistory.deleteMany({
        $or: [{ companyId: { $in: nonIndianIds } }, { symbol: { $in: nonIndianSymbols } }],
      }),
      AnalysisReport.deleteMany({
        $or: [{ companyId: { $in: nonIndianIds } }, { symbol: { $in: nonIndianSymbols } }],
      }),
      FinancialMetrics.deleteMany({
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

    const remainingAssets = await Asset.countDocuments();
    const remainingIndian = await Asset.countDocuments({ country: 'India' });
    const sectors = await Asset.distinct('sector');

    console.log('\n📊 Database Status After Purge:');
    console.log(`   • Remaining Assets:           ${remainingAssets} (100% Indian Equities)`);
    console.log(`   • Indian Assets:              ${remainingIndian}`);
    console.log(`   • Sectors Present:            ${sectors.length} (${sectors.join(', ')})`);
    console.log('===============================================================\n');
  } finally {
    await disconnectDatabase();
  }
}

removeGlobalCompanies().catch((err) => {
  console.error('Purge error:', err);
  process.exit(1);
});
