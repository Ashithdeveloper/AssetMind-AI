import { connectDatabase, disconnectDatabase } from '../config/database';
import { CompanyService } from '../modules/companies/company.service';
import { BuyAnalysisService } from '../modules/analysis/buyAnalysis.service';
import { SellAnalysisService } from '../modules/analysis/sellAnalysis.service';
import assert from 'assert';

async function testIndianCompanies() {
  console.log('\n===============================================================');
  console.log('🇮🇳 TESTING INDIAN EQUITIES API & ANALYSIS FLOWS');
  console.log('===============================================================\n');

  await connectDatabase();

  try {
    // 1. Explore Indian Companies
    console.log('--- 1. Testing Explore Filter: country=India ---');
    const indiaExplore = await CompanyService.getExploreCompanies({ country: 'India', limit: 20 });
    assert(indiaExplore.totalCompanies > 0, 'Indian companies exist in explore response');
    console.log(`  ✅ [PASS] Found ${indiaExplore.totalCompanies} Indian companies across ${indiaExplore.sectorsCount} sectors`);

    const hasTata = indiaExplore.companies.some(
      (c) => c.companyName.toLowerCase().includes('tata') || c.symbol.startsWith('TATA')
    );
    assert(hasTata, 'Explore list contains Tata companies');
    console.log('  ✅ [PASS] Tata companies found in explore response');

    // 2. Search for "Tata"
    console.log('\n--- 2. Testing Company Search: "Tata" ---');
    const searchTata = await CompanyService.searchCompanies('Tata');
    assert(searchTata.total > 0, 'Search for "Tata" returns results');
    console.log(`  ✅ [PASS] Found ${searchTata.total} companies matching "Tata":`);
    searchTata.companies.forEach((c) => {
      console.log(`     • ${c.symbol.padEnd(12)} : ${c.companyName} (${c.currency} ${c.latestPrice})`);
    });

    // 3. Search for "Ola"
    console.log('\n--- 3. Testing Company Search: "Ola" ---');
    const searchOla = await CompanyService.searchCompanies('Ola');
    assert(searchOla.total > 0, 'Search for "Ola" returns results');
    console.log(`  ✅ [PASS] Found ${searchOla.total} companies matching "Ola":`);
    searchOla.companies.forEach((c) => {
      console.log(`     • ${c.symbol.padEnd(12)} : ${c.companyName}`);
    });

    // 4. Test TCS Profile & Currency
    console.log('\n--- 4. Testing Profile for TCS ---');
    const tcsProfile = await CompanyService.getCompanyProfile('TCS');
    assert(tcsProfile.symbol === 'TCS', 'Symbol is TCS');
    assert(tcsProfile.country === 'India', 'Country is India');
    assert(tcsProfile.currency === 'INR', 'Currency is INR');
    assert(tcsProfile.latestSharePrice !== null && tcsProfile.latestSharePrice > 0, 'Live/latest price exists');
    console.log(`  ✅ [PASS] TCS Profile: ${tcsProfile.companyName} | ${tcsProfile.currency} ${tcsProfile.latestSharePrice} (${tcsProfile.dailyPercentageChange}%) | Sector: ${tcsProfile.sector}`);

    // 5. Test TCS Price History
    console.log('\n--- 5. Testing Price History for TCS (1M) ---');
    const tcsHistory = await CompanyService.getPriceHistory('TCS', '1M');
    assert(tcsHistory.data.length > 0, 'Price history points exist');
    assert(tcsHistory.currency === 'INR', 'Currency is INR');
    console.log(`  ✅ [PASS] TCS Price History: ${tcsHistory.data.length} bars | Currency: ${tcsHistory.currency}`);

    // 6. Test TCS Financials
    console.log('\n--- 6. Testing Financial Metrics for TCS ---');
    const tcsFinancials = await CompanyService.getFinancialMetrics('TCS');
    assert(tcsFinancials.freeCashFlow.value !== null, 'Free Cash Flow is computed');
    assert(tcsFinancials.returnOnEquity.value !== null, 'ROE is computed');
    assert(tcsFinancials.debtToEquity.value !== null, 'Debt-to-Equity is computed');
    assert(tcsFinancials.profitability.netProfitMargin.value !== null, 'Net profit margin is computed');
    console.log(`  ✅ [PASS] TCS Financials:`);
    console.log(`     • Revenue:           ₹${tcsFinancials.profitability.revenue.value?.toLocaleString()}`);
    console.log(`     • Net Income:         ₹${tcsFinancials.profitability.netIncome.value?.toLocaleString()}`);
    console.log(`     • Free Cash Flow:     ₹${tcsFinancials.freeCashFlow.value?.toLocaleString()}`);
    console.log(`     • Return on Equity:   ${tcsFinancials.returnOnEquity.value}%`);
    console.log(`     • Debt to Equity:     ${tcsFinancials.debtToEquity.value}x`);
    console.log(`     • Net Margin:         ${tcsFinancials.profitability.netProfitMargin.value}%`);

    // 7. Test Buy Analysis for TCS
    console.log('\n--- 7. Testing Buy Analysis for TCS ---');
    const buyReport = await BuyAnalysisService.generateBuyAnalysis('TCS');
    assert(buyReport.analysisType === 'BUY', 'Analysis type is BUY');
    assert(buyReport.reportMarkdown.length > 100, 'Report contains markdown');
    console.log(`  ✅ [PASS] TCS Buy Report Generated: ID ${buyReport.reportId} | Sections: ${Object.keys(buyReport.sections).length}`);

    // 8. Test Sell Analysis for TCS
    console.log('\n--- 8. Testing Sell Analysis for TCS ---');
    const sellReport = await SellAnalysisService.generateSellAnalysis('TCS', {
      purchasePrice: 3200,
      quantity: 15,
      investmentDate: '2024-01-10',
    });
    assert(sellReport.analysisType === 'SELL', 'Analysis type is SELL');
    assert(sellReport.reportMarkdown.length > 100, 'Report contains markdown');
    console.log(`  ✅ [PASS] TCS Sell Report Generated: ID ${sellReport.reportId}`);

    console.log('\n===============================================================');
    console.log('🎉 ALL INDIAN COMPANIES ENDPOINTS & ANALYSES VERIFIED!');
    console.log('===============================================================\n');
  } finally {
    await disconnectDatabase();
  }
}

testIndianCompanies().catch((err) => {
  console.error('❌ Indian company test failed:', err);
  process.exit(1);
});
