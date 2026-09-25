"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const company_service_1 = require("../modules/companies/company.service");
const buyAnalysis_service_1 = require("../modules/analysis/buyAnalysis.service");
const sellAnalysis_service_1 = require("../modules/analysis/sellAnalysis.service");
const assert_1 = __importDefault(require("assert"));
async function testIndianCompanies() {
    console.log('\n===============================================================');
    console.log('🇮🇳 TESTING INDIAN EQUITIES API & ANALYSIS FLOWS');
    console.log('===============================================================\n');
    await (0, database_1.connectDatabase)();
    try {
        // 1. Explore Indian Companies
        console.log('--- 1. Testing Explore Filter: country=India ---');
        const indiaExplore = await company_service_1.CompanyService.getExploreCompanies({ country: 'India', limit: 20 });
        (0, assert_1.default)(indiaExplore.totalCompanies > 0, 'Indian companies exist in explore response');
        console.log(`  ✅ [PASS] Found ${indiaExplore.totalCompanies} Indian companies across ${indiaExplore.sectorsCount} sectors`);
        const hasTata = indiaExplore.companies.some((c) => c.companyName.toLowerCase().includes('tata') || c.symbol.startsWith('TATA'));
        (0, assert_1.default)(hasTata, 'Explore list contains Tata companies');
        console.log('  ✅ [PASS] Tata companies found in explore response');
        // 2. Search for "Tata"
        console.log('\n--- 2. Testing Company Search: "Tata" ---');
        const searchTata = await company_service_1.CompanyService.searchCompanies('Tata');
        (0, assert_1.default)(searchTata.total > 0, 'Search for "Tata" returns results');
        console.log(`  ✅ [PASS] Found ${searchTata.total} companies matching "Tata":`);
        searchTata.companies.forEach((c) => {
            console.log(`     • ${c.symbol.padEnd(12)} : ${c.companyName} (${c.currency} ${c.latestPrice})`);
        });
        // 3. Search for "Ola"
        console.log('\n--- 3. Testing Company Search: "Ola" ---');
        const searchOla = await company_service_1.CompanyService.searchCompanies('Ola');
        (0, assert_1.default)(searchOla.total > 0, 'Search for "Ola" returns results');
        console.log(`  ✅ [PASS] Found ${searchOla.total} companies matching "Ola":`);
        searchOla.companies.forEach((c) => {
            console.log(`     • ${c.symbol.padEnd(12)} : ${c.companyName}`);
        });
        // 4. Test TCS Profile & Currency
        console.log('\n--- 4. Testing Profile for TCS ---');
        const tcsProfile = await company_service_1.CompanyService.getCompanyProfile('TCS');
        (0, assert_1.default)(tcsProfile.symbol === 'TCS', 'Symbol is TCS');
        (0, assert_1.default)(tcsProfile.country === 'India', 'Country is India');
        (0, assert_1.default)(tcsProfile.currency === 'INR', 'Currency is INR');
        (0, assert_1.default)(tcsProfile.latestSharePrice !== null && tcsProfile.latestSharePrice > 0, 'Live/latest price exists');
        console.log(`  ✅ [PASS] TCS Profile: ${tcsProfile.companyName} | ${tcsProfile.currency} ${tcsProfile.latestSharePrice} (${tcsProfile.dailyPercentageChange}%) | Sector: ${tcsProfile.sector}`);
        // 5. Test TCS Price History
        console.log('\n--- 5. Testing Price History for TCS (1M) ---');
        const tcsHistory = await company_service_1.CompanyService.getPriceHistory('TCS', '1M');
        (0, assert_1.default)(tcsHistory.data.length > 0, 'Price history points exist');
        (0, assert_1.default)(tcsHistory.currency === 'INR', 'Currency is INR');
        console.log(`  ✅ [PASS] TCS Price History: ${tcsHistory.data.length} bars | Currency: ${tcsHistory.currency}`);
        // 6. Test TCS Financials
        console.log('\n--- 6. Testing Financial Metrics for TCS ---');
        const tcsFinancials = await company_service_1.CompanyService.getFinancialMetrics('TCS');
        (0, assert_1.default)(tcsFinancials.freeCashFlow.value !== null, 'Free Cash Flow is computed');
        (0, assert_1.default)(tcsFinancials.returnOnEquity.value !== null, 'ROE is computed');
        (0, assert_1.default)(tcsFinancials.debtToEquity.value !== null, 'Debt-to-Equity is computed');
        (0, assert_1.default)(tcsFinancials.profitability.netProfitMargin.value !== null, 'Net profit margin is computed');
        console.log(`  ✅ [PASS] TCS Financials:`);
        console.log(`     • Revenue:           ₹${tcsFinancials.profitability.revenue.value?.toLocaleString()}`);
        console.log(`     • Net Income:         ₹${tcsFinancials.profitability.netIncome.value?.toLocaleString()}`);
        console.log(`     • Free Cash Flow:     ₹${tcsFinancials.freeCashFlow.value?.toLocaleString()}`);
        console.log(`     • Return on Equity:   ${tcsFinancials.returnOnEquity.value}%`);
        console.log(`     • Debt to Equity:     ${tcsFinancials.debtToEquity.value}x`);
        console.log(`     • Net Margin:         ${tcsFinancials.profitability.netProfitMargin.value}%`);
        // 7. Test Buy Analysis for TCS
        console.log('\n--- 7. Testing Buy Analysis for TCS ---');
        const buyReport = await buyAnalysis_service_1.BuyAnalysisService.generateBuyAnalysis('TCS');
        (0, assert_1.default)(buyReport.analysisType === 'BUY', 'Analysis type is BUY');
        (0, assert_1.default)(buyReport.reportMarkdown.length > 100, 'Report contains markdown');
        console.log(`  ✅ [PASS] TCS Buy Report Generated: ID ${buyReport.reportId} | Sections: ${Object.keys(buyReport.sections).length}`);
        // 8. Test Sell Analysis for TCS
        console.log('\n--- 8. Testing Sell Analysis for TCS ---');
        const sellReport = await sellAnalysis_service_1.SellAnalysisService.generateSellAnalysis('TCS', {
            purchasePrice: 3200,
            quantity: 15,
            investmentDate: '2024-01-10',
        });
        (0, assert_1.default)(sellReport.analysisType === 'SELL', 'Analysis type is SELL');
        (0, assert_1.default)(sellReport.reportMarkdown.length > 100, 'Report contains markdown');
        console.log(`  ✅ [PASS] TCS Sell Report Generated: ID ${sellReport.reportId}`);
        console.log('\n===============================================================');
        console.log('🎉 ALL INDIAN COMPANIES ENDPOINTS & ANALYSES VERIFIED!');
        console.log('===============================================================\n');
    }
    finally {
        await (0, database_1.disconnectDatabase)();
    }
}
testIndianCompanies().catch((err) => {
    console.error('❌ Indian company test failed:', err);
    process.exit(1);
});
//# sourceMappingURL=test-indian-companies.js.map