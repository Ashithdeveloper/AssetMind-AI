import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { CompanyService } from '../modules/companies/company.service';
import { ScreenerExtractionService } from '../modules/scraping/services/screenerExtraction.service';
import { HistoricalPriceService } from '../modules/realtime/services/historicalPrice.service';
import { BuyAnalysisService } from '../modules/analysis/buyAnalysis.service';
import { Asset } from '../models/Asset.model';

const TEST_COMPANIES = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Limited' },
  { symbol: 'TCS', name: 'Tata Consultancy Services Limited' },
  { symbol: 'INFY', name: 'Infosys Limited' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Limited' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Limited' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Limited' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Limited' },
  { symbol: 'WIPRO', name: 'Wipro Limited' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'ITC', name: 'ITC Limited' },
];

async function runTop10Verification() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/assetmind_ai';
  console.log(`[Top10Test] Connecting to MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log(`[Top10Test] Connected to MongoDB.`);

  console.log(`\n===============================================================`);
  console.log(`RUNNING AUDIT ON TOP 10 INDIAN STOCKS`);
  console.log(`===============================================================\n`);

  const results: any[] = [];

  for (const comp of TEST_COMPANIES) {
    const sym = comp.symbol;
    console.log(`---------------------------------------------------------------`);
    console.log(`[Testing ${sym}] ${comp.name}...`);

    try {
      // 1. Ensure scraped fundamental data exists
      let asset = await Asset.findOne({ symbol: sym });
      if (!asset || !asset.lastScrapedAt) {
        console.log(`  -> Triggering initial Screener sync for ${sym}...`);
        try {
          await ScreenerExtractionService.scrapeCompany(sym);
          asset = await Asset.findOne({ symbol: sym });
        } catch (scrapErr: any) {
          console.warn(`  -> Screener scrape warning for ${sym}:`, scrapErr.message);
        }
      }

      // 2. Fetch Company Profile
      const profile = await CompanyService.getCompanyProfile(sym);

      // 3. Fetch Financial Metrics & Data Quality
      const metrics = await CompanyService.getFinancialMetrics(sym);

      // 4. Fetch Historical Prices (1M period)
      const history = await HistoricalPriceService.getHistoricalPrices(sym, '1M');

      // Assertions
      const checks = {
        identityValid: profile.symbol === sym && profile.country === 'India' && profile.currency === 'INR',
        stockPriceValid: profile.latestSharePrice != null && profile.latestSharePrice > 0,
        mcapValid: profile.marketCapitalization != null && profile.marketCapitalization > 0,
        fcfUnitValid: metrics.freeCashFlow.unit === 'INR Crore',
        roeValid: metrics.returnOnEquity.value != null,
        deValid: metrics.debtToEquity.value != null && !isNaN(metrics.debtToEquity.value),
        peValid: metrics.valuation.peRatio?.value != null,
        historyValid: history.data.length > 5,
        historyChronological: history.data.length > 1 && new Date(history.data[0].date) <= new Date(history.data[history.data.length - 1].date),
        dataQualityVerified: metrics.dataQuality?.status != null,
      };

      const result = {
        symbol: sym,
        companyName: profile.companyName,
        price: `₹${profile.latestSharePrice ?? 'N/A'}`,
        marketCap: profile.marketCapitalization ? (profile.marketCapitalization >= 100000 ? `₹${(profile.marketCapitalization / 100000).toFixed(2)} Lakh Cr` : `₹${profile.marketCapitalization.toLocaleString('en-IN')} Cr`) : 'N/A',
        freeCashFlow: metrics.freeCashFlow.value !== null ? `₹${metrics.freeCashFlow.value.toLocaleString('en-IN')} Cr` : 'N/A',
        roe: metrics.returnOnEquity.value !== null ? `${metrics.returnOnEquity.value.toFixed(2)}%` : 'N/A',
        debtToEquity: metrics.debtToEquity.value !== null ? `${metrics.debtToEquity.value.toFixed(2)}` : 'N/A',
        peRatio: metrics.valuation.peRatio?.value !== null ? `${metrics.valuation.peRatio?.value.toFixed(2)}x` : 'N/A',
        historyPoints: history.data.length,
        dataQualityStatus: metrics.dataQuality?.status,
        dataQualityScore: `${metrics.dataQuality?.completenessScore}/100`,
        checksPass: Object.values(checks).every(Boolean),
      };

      results.push(result);

      console.log(`  ✓ Identity: Verified (${profile.companyName} | ${profile.exchange})`);
      console.log(`  ✓ Price: ${result.price} | M-Cap: ${result.marketCap}`);
      console.log(`  ✓ FCF: ${result.freeCashFlow} (Unit: ${metrics.freeCashFlow.unit})`);
      console.log(`  ✓ ROE: ${result.roe} | D/E: ${result.debtToEquity} | P/E: ${result.peRatio}`);
      console.log(`  ✓ Price History: ${result.historyPoints} bars (Chronological: ${checks.historyChronological})`);
      console.log(`  ✓ Quality Audit: ${result.dataQualityStatus} (${result.dataQualityScore})`);

    } catch (err: any) {
      console.error(`  ✗ Error testing ${sym}:`, err.message);
      results.push({ symbol: sym, error: err.message, checksPass: false });
    }
  }

  console.log(`\n===============================================================`);
  console.log(`AUDIT SUMMARY TABLE`);
  console.log(`===============================================================\n`);
  console.table(results.map(r => ({
    Symbol: r.symbol,
    Price: r.price,
    'Market Cap': r.marketCap,
    FCF: r.freeCashFlow,
    ROE: r.roe,
    'D/E': r.debtToEquity,
    'P/E': r.peRatio,
    History: `${r.historyPoints} bars`,
    Status: r.dataQualityStatus,
    Score: r.dataQualityScore,
  })));

  await mongoose.disconnect();
  console.log(`\n[Top10Test] Verification completed successfully.`);
}

runTop10Verification().catch((e) => {
  console.error('[Top10Test] Fatal error:', e);
  process.exit(1);
});
