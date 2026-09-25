import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { createApp } from '../app';
import { Server } from 'http';
import axios from 'axios';

const PORT = 5003;
const BASE_URL = `http://localhost:${PORT}/api`;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/assetmind_ai';

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${testName}${detail ? ` -> ${detail}` : ''}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('🧪 ASSETMIND AI: EXPLORE HOME & BUY/SELL ANALYSIS TEST SUITE');
  console.log('===============================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log(`[Database] Connected to MongoDB: ${MONGODB_URI}`);

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => {
      console.log(`[Server] Live test server listening on port ${PORT}`);
      resolve(s);
    });
  });

  try {
    // -------------------------------------------------------------
    // 1. FEATURE: Company Exploration API (GET /api/companies/explore)
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing GET /api/companies/explore ---');
    const exploreRes = await axios.get(`${BASE_URL}/companies/explore?page=1&limit=10`);
    assert(exploreRes.status === 200, 'Explore endpoint returns HTTP 200');
    assert(exploreRes.data.success === true, 'Response success is true');
    assert(exploreRes.data.data.sectors.length > 0, 'Returns companies grouped by sector', `Sectors count: ${exploreRes.data.data.sectors.length}`);
    assert(exploreRes.data.data.companies.length > 0, 'Returns paginated flat companies list', `Count: ${exploreRes.data.data.companies.length}`);

    const sampleComp = exploreRes.data.data.companies[0];
    assert(!!sampleComp.companyName, 'Contains company name', sampleComp.companyName);
    assert(!!sampleComp.symbol, 'Contains stock symbol', sampleComp.symbol);
    assert(!!sampleComp.exchange, 'Contains exchange', sampleComp.exchange);
    assert(!!sampleComp.sector, 'Contains sector', sampleComp.sector);
    assert(!!sampleComp.logoUrl, 'Contains logo URL', sampleComp.logoUrl);
    assert(typeof sampleComp.latestSharePrice === 'number', 'Contains latest share price', String(sampleComp.latestSharePrice));
    assert(typeof sampleComp.dailyPercentageChange === 'number', 'Contains daily percentage change', `${sampleComp.dailyPercentageChange}%`);

    // Test Sector Filter
    console.log('\n--- Testing Sector Filter (sector=Technology) ---');
    const techRes = await axios.get(`${BASE_URL}/companies/explore?sector=Technology`);
    const allTech = techRes.data.data.companies.every((c: any) => c.sector.toLowerCase() === 'technology');
    assert(allTech, 'All returned companies belong to Technology sector');

    // Test Sort by Market Cap Desc
    console.log('\n--- Testing Sorting by Market Cap ---');
    const sortRes = await axios.get(`${BASE_URL}/companies/explore?sortBy=marketCap&order=desc&limit=5`);
    const topCap = sortRes.data.data.companies;
    assert(topCap.length >= 2, 'Returns sorted companies');
    console.log(`  Top company by cap: ${topCap[0].symbol} ($${topCap[0].marketCapitalization?.toLocaleString()})`);

    // -------------------------------------------------------------
    // 2. FEATURE: Company Search (GET /api/companies/search?q=)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing GET /api/companies/search ---');
    const searchRes = await axios.get(`${BASE_URL}/companies/search?q=Tata`);
    assert(searchRes.data.data.companies.length > 0, 'Search by name "Tata" returns results');
    assert(searchRes.data.data.companies.some((c: any) => c.symbol === 'TCS'), 'Found TCS for "Tata" query');

    const symbolSearchRes = await axios.get(`${BASE_URL}/companies/search?q=INFY`);
    assert(symbolSearchRes.data.data.companies.some((c: any) => c.symbol === 'INFY'), 'Found INFY by ticker symbol');

    // -------------------------------------------------------------
    // 3. FEATURE: Company Profile (GET /api/companies/:symbol)
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing GET /api/companies/:symbol ---');
    const profileRes = await axios.get(`${BASE_URL}/companies/TCS`);
    const prof = profileRes.data.data;
    assert(prof.symbol === 'TCS', 'Profile symbol is TCS');
    assert(prof.companyName.includes('Tata'), 'Profile companyName includes Tata');
    assert(!!prof.sector, 'Profile includes sector', prof.sector);
    assert(!!prof.website, 'Profile includes website', prof.website);
    assert(!!prof.latestReportingPeriod, 'Profile includes latest reporting period', prof.latestReportingPeriod);

    // -------------------------------------------------------------
    // 4. FEATURE: Historical Share Price (GET /api/companies/:symbol/price-history)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing GET /api/companies/:symbol/price-history ---');
    const historyRes = await axios.get(`${BASE_URL}/companies/TCS/price-history?period=1M`);
    assert(historyRes.data.data.symbol === 'TCS', 'History symbol is TCS');
    assert(historyRes.data.data.period === '1M', 'History period is 1M');
    assert(historyRes.data.data.data.length > 0, 'Contains chronological daily price points', `Points count: ${historyRes.data.data.data.length}`);

    const bar = historyRes.data.data.data[0];
    assert(!!bar.date, 'Bar contains date', bar.date);
    assert(typeof bar.open === 'number', 'Bar contains open');
    assert(typeof bar.high === 'number', 'Bar contains high');
    assert(typeof bar.low === 'number', 'Bar contains low');
    assert(typeof bar.close === 'number', 'Bar contains close');
    assert(typeof bar.volume === 'number', 'Bar contains volume');

    // -------------------------------------------------------------
    // 5. FEATURE: Financial Metrics (GET /api/companies/:symbol/financials)
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing GET /api/companies/:symbol/financials ---');
    const finRes = await axios.get(`${BASE_URL}/companies/TCS/financials`);
    const fin = finRes.data.data;
    assert(fin.symbol === 'TCS', 'Financial metrics symbol is TCS');
    assert('freeCashFlow' in fin, 'Contains Free Cash Flow metric');
    assert('returnOnEquity' in fin, 'Contains Return on Equity (ROE)');
    assert('debtToEquity' in fin, 'Contains Debt-to-Equity');
    assert('profitability' in fin, 'Contains Profitability margins');
    assert('valuation' in fin, 'Contains Valuation multiples');
    assert('riskAnalysisInputs' in fin, 'Contains Risk Analysis inputs');

    console.log(`  FCF: ${fin.freeCashFlow.value ?? 'N/A'} (${fin.freeCashFlow.explanation})`);
    console.log(`  ROE: ${fin.returnOnEquity.value ?? 'N/A'}% (${fin.returnOnEquity.explanation})`);
    console.log(`  Debt-to-Equity: ${fin.debtToEquity.value ?? 'N/A'}x (${fin.debtToEquity.explanation})`);

    // -------------------------------------------------------------
    // 6. FEATURE: Buy Analysis (POST /api/analysis/:symbol/buy)
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing POST /api/analysis/:symbol/buy ---');
    const buyRes = await axios.post(`${BASE_URL}/analysis/TCS/buy`);
    assert(buyRes.status === 201, 'Buy analysis returns HTTP 201');
    assert(buyRes.data.data.symbol === 'TCS', 'Buy analysis symbol is TCS');
    assert(buyRes.data.data.analysisType === 'BUY', 'Analysis type is BUY');
    assert(!!buyRes.data.data.reportMarkdown, 'Generated markdown report');
    assert(buyRes.data.data.sourceReferences.length > 0, 'Includes source references');
    assert(!!buyRes.data.data.reportId, 'Saved report in MongoDB with ID', buyRes.data.data.reportId);

    // -------------------------------------------------------------
    // 7. FEATURE: Sell Analysis (POST /api/analysis/:symbol/sell)
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing POST /api/analysis/:symbol/sell ---');
    const sellRes = await axios.post(`${BASE_URL}/analysis/TCS/sell`, {
      purchasePrice: 2000,
      quantity: 50,
      investmentDate: '2024-01-15',
      portfolioValue: 100000,
    });
    assert(sellRes.status === 201, 'Sell analysis returns HTTP 201');
    assert(sellRes.data.data.symbol === 'TCS', 'Sell analysis symbol is TCS');
    assert(sellRes.data.data.analysisType === 'SELL', 'Analysis type is SELL');
    assert(!!sellRes.data.data.personalInvestmentAnalysis, 'Includes personal investment mistake / profit-loss analysis');
    assert(sellRes.data.data.personalInvestmentAnalysis.unrealizedPnl !== undefined, 'Calculated unrealized P&L');
    console.log(`  Investor P&L: ₹${sellRes.data.data.personalInvestmentAnalysis.unrealizedPnl} (${sellRes.data.data.personalInvestmentAnalysis.returnPercent}%)`);

    // -------------------------------------------------------------
    // 8. FEATURE: Historical Reports (GET /api/analysis/reports)
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing GET /api/analysis/reports ---');
    const reportsRes = await axios.get(`${BASE_URL}/analysis/reports?symbol=TCS`);
    assert(reportsRes.data.data.count >= 2, 'Retrieved stored reports from MongoDB', `Count: ${reportsRes.data.data.count}`);

    console.log('\n===============================================================');
    console.log(`🎉 ALL ${passed}/${total} TEST SUITE ASSERTIONS PASSED!`);
    console.log('===============================================================\n');
  } finally {
    server.close();
    await mongoose.disconnect();
    console.log('[Server & Database] Shutdown cleanly.');
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test suite failed:', err.response?.data || err.message);
  process.exit(1);
});
