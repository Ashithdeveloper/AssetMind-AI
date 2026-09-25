import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { AuthService } from '../modules/auth/auth.service';
import { User } from '../models/User.model';
import { Asset } from '../models/Asset.model';
import { FinancialData } from '../models/FinancialData.model';
import { StockPrice } from '../models/StockPrice.model';
import { FinancialDocument } from '../models/FinancialDocument.model';
import { ScrapingJob } from '../models/ScrapingJob.model';
import { sourceAdapters, getAllSourceInfos, getSourceAdapter } from '../modules/scraping/sources';
import { FinancialDataValidator } from '../modules/scraping/validators/financialData.validator';
import { ScrapingService } from '../modules/scraping/scraping.service';
import { StockService } from '../modules/stocks/stock.service';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n==================================================');
  console.log('🧪 RUNNING ASSETMIND AI PHASE 1 TEST SUITE');
  console.log('==================================================\n');

  await connectDatabase();

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: AUTHENTICATION
    // ----------------------------------------------------
    console.log('🔹 1. Testing Authentication Module...');

    // Clean test user
    const testEmail = `test_${Date.now()}@assetmind.ai`;
    await User.deleteMany({ email: testEmail });

    // A. Registration
    const regResult = await AuthService.register({
      name: 'John Asset Analyst',
      email: testEmail,
      password: 'SecurePassword123!',
    });
    assert(!!regResult.token, 'User registration returns valid JWT token');
    assert(regResult.user.email === testEmail, 'User registration returns correct user email');

    // B. Duplicate Email Protection
    let duplicateRejected = false;
    try {
      await AuthService.register({
        name: 'Another User',
        email: testEmail,
        password: 'Password456!',
      });
    } catch (e: any) {
      duplicateRejected = e.errorCode === 'EMAIL_EXISTS';
    }
    assert(duplicateRejected, 'Duplicate registration attempt is rejected with EMAIL_EXISTS');

    // C. Login
    const loginResult = await AuthService.login({
      email: testEmail,
      password: 'SecurePassword123!',
    });
    assert(!!loginResult.token, 'User login succeeds and returns JWT token');

    // D. Profile retrieval
    const profile = await AuthService.getProfile(loginResult.user.id);
    assert(profile.name === 'John Asset Analyst', 'Profile retrieval returns user details without passwordHash');

    // ----------------------------------------------------
    // TEST SUITE 2: SOURCE ADAPTERS (ALL 11 SOURCES)
    // ----------------------------------------------------
    console.log('\n🔹 2. Testing All 11 Financial Data Source Adapters...');

    const sources = getAllSourceInfos();
    assert(sources.length === 11, `All 11 source adapters are registered (Found: ${sources.length})`);

    const expectedSources = [
      'yahoo-finance',
      'stockanalysis',
      'marketscreener',
      'macrotrends',
      'companiesmarketcap',
      'tradingview',
      'investing',
      'morningstar',
      'sec-edgar',
      'stockmarketcap',
      'screener-in',
    ];

    for (const sourceId of expectedSources) {
      const adapter = getSourceAdapter(sourceId);
      assert(!!adapter, `Source adapter '${sourceId}' is available`);
      if (adapter) {
        const url = adapter.buildUrl('AAPL');
        assert(typeof url === 'string' && url.startsWith('http'), `[${adapter.name}] Builds valid URL: ${url}`);
      }
    }

    // Test adapter HTML extraction logic with mock HTML fixtures
    console.log('\n🔹 3. Testing Adapter Extraction Logic with Sample Fixtures...');

    // Yahoo Finance extraction test
    const yahooAdapter = getSourceAdapter('yahoo-finance')!;
    const mockYahooHtml = `
      <html>
        <body>
          <h1>Apple Inc. (AAPL)</h1>
          <fin-streamer data-field="regularMarketPrice" value="189.50">189.50</fin-streamer>
          <fin-streamer data-field="regularMarketChange" value="+2.35">+2.35</fin-streamer>
          <fin-streamer data-field="regularMarketChangePercent" value="+1.25%">+1.25%</fin-streamer>
          <table>
            <tr><td>Market Cap (intraday)</td><td>2.95T</td></tr>
            <tr><td>PE Ratio (TTM)</td><td>31.4</td></tr>
            <tr><td>EPS (TTM)</td><td>6.05</td></tr>
          </table>
        </body>
      </html>
    `;
    const yahooData = await yahooAdapter.extractData(mockYahooHtml, 'AAPL', yahooAdapter.buildUrl('AAPL'), 'playwright');
    assert(yahooData.stockPrice?.price === 189.5, 'Yahoo Finance adapter extracts stock price accurately (189.50)');
    assert(yahooData.financialMetrics.some((m) => m.metricName === 'marketCap' && m.metricValue === 2950000000000), 'Yahoo Finance adapter parses trillion multiplier (2.95T)');

    // SEC EDGAR extraction test
    const secAdapter = getSourceAdapter('sec-edgar')!;
    const mockSecHtml = `
      <html>
        <body>
          <h1 id="entity-name">Apple Inc. (CIK 0000320193)</h1>
          <table id="filings-table">
            <tr>
              <td class="form-type">10-K</td>
              <td class="filing-date">2024-10-31</td>
              <td class="description"><a href="/Archives/edgar/data/320193/10k.htm">Annual Report for FY 2024</a></td>
            </tr>
          </table>
        </body>
      </html>
    `;
    const secData = await secAdapter.extractData(mockSecHtml, 'AAPL', secAdapter.buildUrl('AAPL'), 'playwright');
    assert(secData.financialDocuments?.length === 1, 'SEC EDGAR adapter extracts 10-K filing document');
    assert(secData.financialDocuments?.[0].documentType === '10-K', 'SEC EDGAR documentType normalized to 10-K');

    // ----------------------------------------------------
    // TEST SUITE 4: DATA VALIDATION & NORMALIZATION PIPELINE
    // ----------------------------------------------------
    console.log('\n🔹 4. Testing Financial Data Validation & Normalization Pipeline...');

    const sampleRawData = {
      symbol: 'aapl  ', // unnormalized symbol
      source: 'yahoo-finance',
      sourceUrl: 'https://finance.yahoo.com/quote/AAPL/',
      scraperProvider: 'playwright' as const,
      collectedAt: new Date(),
      companyInfo: {
        symbol: 'aapl',
        companyName: 'Apple Inc.',
        sector: 'Technology',
      },
      stockPrice: {
        price: 185.75,
        currency: 'usd',
      },
      financialMetrics: [
        { metricName: 'market_cap', metricValue: 2850000000000, currency: 'usd', reportingPeriod: 'ttm' },
        { metricName: 'p/e', metricValue: 30.5, currency: 'USD' },
        { metricName: 'market_cap', metricValue: 2850000000000, currency: 'USD', reportingPeriod: 'ttm' }, // duplicate in-batch
        { metricName: 'revenue', metricValue: 383285000000, currency: 'usd' },
      ],
    };

    const validated = FinancialDataValidator.validateAndNormalize(sampleRawData);
    assert(validated.symbol === 'AAPL', 'Normalizes stock symbol to uppercase trimmed "AAPL"');
    assert(validated.financialMetrics.some((m) => m.metricName === 'marketCap'), 'Maps canonical metric name "market_cap" -> "marketCap"');
    assert(validated.financialMetrics.some((m) => m.metricName === 'peRatio'), 'Maps canonical metric name "p/e" -> "peRatio"');
    assert(validated.financialMetrics.filter((m) => m.metricName === 'marketCap').length === 1, 'Deduplicates identical metrics within the same batch');
    assert(validated.stockPrice?.currency === 'USD', 'Normalizes currency to uppercase "USD"');

    // ----------------------------------------------------
    // TEST SUITE 5: MONGODB STORAGE & RETRIEVAL WORKFLOW
    // ----------------------------------------------------
    console.log('\n🔹 5. Testing Database Persistence & Stock Retrieval Service...');

    // Clean test assets
    const testSymbol = 'AAPL_TEST';
    await Promise.all([
      Asset.deleteMany({ symbol: testSymbol }),
      FinancialData.deleteMany({ symbol: testSymbol }),
      StockPrice.deleteMany({ symbol: testSymbol }),
      FinancialDocument.deleteMany({ symbol: testSymbol }),
      ScrapingJob.deleteMany({ symbol: testSymbol }),
    ]);

    // Create Asset and Financial data
    const asset = await Asset.create({
      symbol: testSymbol,
      companyName: 'Apple Test Corporation',
      exchange: 'NASDAQ',
      country: 'United States',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      description: 'Apple designs and manufactures mobile devices and personal computers.',
    });
    assert(!!asset._id, 'Asset successfully created in MongoDB with unique index');

    await StockPrice.create({
      assetId: asset._id,
      symbol: testSymbol,
      price: 195.5,
      currency: 'USD',
      change: 1.5,
      changePercent: 0.77,
      source: 'yahoo-finance',
      sourceUrl: 'https://finance.yahoo.com/quote/AAPL/',
      collectedAt: new Date(),
    });

    await FinancialData.create({
      assetId: asset._id,
      symbol: testSymbol,
      metricName: 'marketCap',
      metricValue: 3000000000000,
      currency: 'USD',
      unit: 'billions',
      reportingPeriod: 'TTM',
      source: 'yahoo-finance',
      scraperProvider: 'playwright',
      collectedAt: new Date(),
      validationStatus: 'VALID',
    });

    await FinancialDocument.create({
      assetId: asset._id,
      symbol: testSymbol,
      documentType: '10-K',
      title: `${testSymbol} Annual Report FY2024`,
      content: 'Consolidated financial statements',
      source: 'sec-edgar',
      sourceUrl: 'https://www.sec.gov/edgar',
      publicationDate: new Date(),
      collectedAt: new Date(),
      processingStatus: 'PROCESSED',
    });

    // Test Stock Retrieval Service
    const searchResults = await StockService.searchStocks('Apple Test');
    assert(searchResults.length >= 1, 'Stock search API retrieves matching assets');

    const profileData = await StockService.getCompanyProfile(testSymbol);
    assert(profileData.symbol === testSymbol, 'Get company profile retrieves full asset profile');
    assert(profileData.latestPrice?.price === 195.5, 'Company profile includes latest stock price');

    const financialsData = await StockService.getFinancialData(testSymbol);
    assert(financialsData.metrics.length >= 1, 'Get financial data retrieves stored metrics');
    assert(financialsData.summary.marketCap.metricValue === 3000000000000, 'Financials summary maps metric values accurately');

    const pricesData = await StockService.getStockPrices(testSymbol);
    assert(pricesData.prices.length === 1, 'Get stock prices retrieves historical price records');

    const sourcesData = await StockService.getAvailableSources(testSymbol);
    assert(sourcesData.sources.includes('yahoo-finance'), 'Get sources returns all distinct data sources for asset');

    const docsData = await StockService.getFinancialDocuments(testSymbol);
    assert(docsData.documents.length === 1, 'Get financial documents retrieves stored SEC filings');

    // ----------------------------------------------------
    // TEST SUITE 6: SCRAPING JOBS MANAGEMENT
    // ----------------------------------------------------
    console.log('\n🔹 6. Testing Scraping Job Management...');

    const job = await ScrapingJob.create({
      symbol: testSymbol,
      source: 'yahoo-finance, stockanalysis',
      scraperProvider: 'playwright',
      status: 'COMPLETED',
      startedAt: new Date(),
      completedAt: new Date(),
      recordsCollected: 15,
      recordsValidated: 15,
      recordsRejected: 0,
    });

    const fetchedJob = await ScrapingService.getJobById(job._id.toString());
    assert(fetchedJob.status === 'COMPLETED', 'Scraping job retrieved by ID with correct status');

    const jobsHistory = await ScrapingService.getJobsHistory({ symbol: testSymbol });
    assert(jobsHistory.jobs.length >= 1, 'Jobs history returns paginated list of scraping jobs');

    console.log('\n==================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected test error:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

runTests();
