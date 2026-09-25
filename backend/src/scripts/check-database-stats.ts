import { connectDatabase, disconnectDatabase } from '../config/database';
import { Asset } from '../models/Asset.model';
import { FinancialData } from '../models/FinancialData.model';
import { StockPrice } from '../models/StockPrice.model';
import { FinancialDocument } from '../models/FinancialDocument.model';
import { ScrapingJob } from '../models/ScrapingJob.model';
import { User } from '../models/User.model';

async function checkDatabaseStats() {
  await connectDatabase();

  const [users, assets, financials, prices, docs, jobs] = await Promise.all([
    User.countDocuments(),
    Asset.countDocuments(),
    FinancialData.countDocuments(),
    StockPrice.countDocuments(),
    FinancialDocument.countDocuments(),
    ScrapingJob.countDocuments(),
  ]);

  const [indianAssets, globalAssets] = await Promise.all([
    Asset.countDocuments({ country: 'India' }),
    Asset.countDocuments({ country: { $ne: 'India' } }),
  ]);

  const sources = await FinancialData.distinct('source');
  const symbols = await FinancialData.distinct('symbol');

  // Breakdown of top metrics
  const topMetrics = await FinancialData.aggregate([
    { $group: { _id: '$metricName', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);

  // Breakdown of job statuses
  const jobStatuses = await ScrapingJob.aggregate([
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

  await disconnectDatabase();
}

checkDatabaseStats().catch((err) => {
  console.error('Error fetching database stats:', err);
  process.exit(1);
});
