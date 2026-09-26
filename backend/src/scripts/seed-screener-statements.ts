import { connectDatabase, disconnectDatabase } from '../config/database';
import { ScreenerExtractionService } from '../modules/scraping/services/screenerExtraction.service';
import { Asset } from '../models/Asset.model';

async function seedStatements() {
  console.log('=== SCRAPING TOP INDIAN COMPANIES FROM SCREENER.IN ===');
  await connectDatabase();

  const topIndianSymbols = [
    'RELIANCE',
    'TCS',
    'HDFCBANK',
    'INFY',
    'ICICIBANK',
    'BHARTIARTL',
    'SBIN',
    'ITC',
    'HINDUNILVR',
    'LT',
    'TATAMOTORS',
    'TATASTEEL',
    'WIPRO',
    'MARUTI',
    'TITAN',
    'BAJFINANCE',
    'KOTAKBANK',
    'AXISBANK',
    'ASIANPAINT',
    'ZOMATO',
  ];

  console.log(`Starting Screener.in extraction for ${topIndianSymbols.length} top companies...`);

  let success = 0;
  let failed = 0;

  for (const sym of topIndianSymbols) {
    try {
      console.log(`Fetching ${sym} from Screener.in...`);
      const data = await ScreenerExtractionService.scrapeCompany(sym, { force: true });
      console.log(`  ✔️ ${sym}: ${data.companyName} | Price: ₹${data.currentPrice} | Mcap: ₹${data.marketCapCr} Cr | Quarters: ${data.statements.quarters.rows.length} rows | P&L: ${data.statements.profitLoss.rows.length} rows`);
      success++;
      // Polite delay between requests
      await new Promise((r) => setTimeout(r, 600));
    } catch (err: any) {
      console.error(`  ❌ ${sym} failed:`, err.message);
      failed++;
    }
  }

  console.log(`\nCompleted! Success: ${success}, Failed: ${failed}`);
  await disconnectDatabase();
}

seedStatements().catch(console.error);
