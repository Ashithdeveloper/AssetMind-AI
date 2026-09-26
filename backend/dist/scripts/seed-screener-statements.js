"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const screenerExtraction_service_1 = require("../modules/scraping/services/screenerExtraction.service");
async function seedStatements() {
    console.log('=== SCRAPING TOP INDIAN COMPANIES FROM SCREENER.IN ===');
    await (0, database_1.connectDatabase)();
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
            const data = await screenerExtraction_service_1.ScreenerExtractionService.scrapeCompany(sym, { force: true });
            console.log(`  ✔️ ${sym}: ${data.companyName} | Price: ₹${data.currentPrice} | Mcap: ₹${data.marketCapCr} Cr | Quarters: ${data.statements.quarters.rows.length} rows | P&L: ${data.statements.profitLoss.rows.length} rows`);
            success++;
            // Polite delay between requests
            await new Promise((r) => setTimeout(r, 600));
        }
        catch (err) {
            console.error(`  ❌ ${sym} failed:`, err.message);
            failed++;
        }
    }
    console.log(`\nCompleted! Success: ${success}, Failed: ${failed}`);
    await (0, database_1.disconnectDatabase)();
}
seedStatements().catch(console.error);
//# sourceMappingURL=seed-screener-statements.js.map