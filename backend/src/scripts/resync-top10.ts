import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { ScreenerExtractionService } from '../modules/scraping/services/screenerExtraction.service';
import { CompanyService } from '../modules/companies/company.service';
import { FinancialMetrics } from '../models/FinancialMetrics.model';

const TOP_10 = [
  'RELIANCE',
  'TCS',
  'INFY',
  'HDFCBANK',
  'ICICIBANK',
  'TATAMOTORS',
  'ADANIENT',
  'WIPRO',
  'SBIN',
  'ITC',
];

async function resync() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/assetmind_ai';
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);

  for (const sym of TOP_10) {
    console.log(`\n===============================================================`);
    console.log(`[Resyncing] ${sym}...`);
    try {
      // Force scrape with the new parser
      const scraped = await ScreenerExtractionService.scrapeCompany(sym, { force: true });
      console.log(`  -> Scraped: ${scraped.companyName}`);
      console.log(`  -> Market Cap (Cr): ${scraped.marketCapCr}`);
      console.log(`  -> FCF (Cr): ${scraped.metrics.freeCashFlowCr}`);
      console.log(`  -> ROE (%): ${scraped.metrics.roe}`);
      console.log(`  -> D/E: ${scraped.metrics.debtToEquity}`);

      // Verify what getFinancialMetrics returns
      const metrics = await CompanyService.getFinancialMetrics(sym);
      console.log(`  -> getFinancialMetrics:`, {
        fcf: metrics.freeCashFlow,
        roe: metrics.returnOnEquity.value,
        debtToEquity: metrics.debtToEquity.value,
        pe: metrics.valuation.peRatio?.value,
        quality: metrics.dataQuality,
      });
    } catch (err: any) {
      console.error(`  ✗ Error resyncing ${sym}:`, err.message);
    }
  }

  await mongoose.disconnect();
  console.log(`\nAll 10 companies resynced successfully!`);
}

resync().catch((e) => {
  console.error('Fatal resync error:', e);
  process.exit(1);
});
