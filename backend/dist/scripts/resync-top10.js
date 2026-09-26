"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const screenerExtraction_service_1 = require("../modules/scraping/services/screenerExtraction.service");
const company_service_1 = require("../modules/companies/company.service");
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
    await mongoose_1.default.connect(mongoUri);
    for (const sym of TOP_10) {
        console.log(`\n===============================================================`);
        console.log(`[Resyncing] ${sym}...`);
        try {
            // Force scrape with the new parser
            const scraped = await screenerExtraction_service_1.ScreenerExtractionService.scrapeCompany(sym, { force: true });
            console.log(`  -> Scraped: ${scraped.companyName}`);
            console.log(`  -> Market Cap (Cr): ${scraped.marketCapCr}`);
            console.log(`  -> FCF (Cr): ${scraped.metrics.freeCashFlowCr}`);
            console.log(`  -> ROE (%): ${scraped.metrics.roe}`);
            console.log(`  -> D/E: ${scraped.metrics.debtToEquity}`);
            // Verify what getFinancialMetrics returns
            const metrics = await company_service_1.CompanyService.getFinancialMetrics(sym);
            console.log(`  -> getFinancialMetrics:`, {
                fcf: metrics.freeCashFlow,
                roe: metrics.returnOnEquity.value,
                debtToEquity: metrics.debtToEquity.value,
                pe: metrics.valuation.peRatio?.value,
                quality: metrics.dataQuality,
            });
        }
        catch (err) {
            console.error(`  ✗ Error resyncing ${sym}:`, err.message);
        }
    }
    await mongoose_1.default.disconnect();
    console.log(`\nAll 10 companies resynced successfully!`);
}
resync().catch((e) => {
    console.error('Fatal resync error:', e);
    process.exit(1);
});
//# sourceMappingURL=resync-top10.js.map