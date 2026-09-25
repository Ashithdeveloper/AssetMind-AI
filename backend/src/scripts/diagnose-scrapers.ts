import { connectDatabase, disconnectDatabase } from '../config/database';
import { getScraper } from '../modules/scraping/scrapers';
import { getSourceAdapter, sourceAdapters } from '../modules/scraping/sources';

/**
 * Diagnostic tool: Scrapes a real stock from each source adapter
 * and displays exactly what raw data was extracted.
 */
async function diagnoseScrapers() {
  console.log('\n================================================================');
  console.log('🔬 ASSETMIND AI: SCRAPER DIAGNOSTIC - REAL DATA VERIFICATION');
  console.log('================================================================\n');

  await connectDatabase();

  const testSymbol = 'AAPL';
  const scraper = getScraper('playwright');

  // -------------------------------------------------------
  // TEST 1: Yahoo Finance (US Stock)
  // -------------------------------------------------------
  console.log('─────────────────────────────────────────────');
  console.log(`🔹 SOURCE 1: Yahoo Finance (${testSymbol})`);
  console.log('─────────────────────────────────────────────');
  try {
    const adapter = getSourceAdapter('yahoo-finance')!;
    const url = adapter.buildUrl(testSymbol);
    console.log(`   URL: ${url}`);
    const html = await scraper.fetchHtml(url, adapter.getWaitForSelector?.());
    console.log(`   HTML size: ${html.length} chars`);
    const data = await adapter.extractData(html, testSymbol, url, 'playwright');

    console.log(`   ✅ Company: ${data.companyInfo?.companyName}`);
    console.log(`   ✅ Exchange: ${data.companyInfo?.exchange || 'N/A'}`);
    console.log(`   ✅ Stock Price: ${data.stockPrice?.price ?? 'NOT FOUND'} ${data.stockPrice?.currency || ''}`);
    console.log(`   ✅ Change: ${data.stockPrice?.change ?? 'N/A'} (${data.stockPrice?.changePercent ?? 'N/A'}%)`);
    console.log(`   ✅ Metrics extracted: ${data.financialMetrics.length}`);
    data.financialMetrics.forEach((m) => {
      console.log(`      • ${m.metricName}: ${m.metricValue} ${m.unit || ''}`);
    });
  } catch (err: any) {
    console.log(`   ❌ FAILED: ${err.message}`);
  }

  // -------------------------------------------------------
  // TEST 2: StockAnalysis (US Stock)
  // -------------------------------------------------------
  console.log('\n─────────────────────────────────────────────');
  console.log(`🔹 SOURCE 2: StockAnalysis (${testSymbol})`);
  console.log('─────────────────────────────────────────────');
  try {
    const adapter = getSourceAdapter('stockanalysis')!;
    const url = adapter.buildUrl(testSymbol);
    console.log(`   URL: ${url}`);
    const html = await scraper.fetchHtml(url, adapter.getWaitForSelector?.());
    console.log(`   HTML size: ${html.length} chars`);
    const data = await adapter.extractData(html, testSymbol, url, 'playwright');

    console.log(`   ✅ Company: ${data.companyInfo?.companyName}`);
    console.log(`   ✅ Sector: ${data.companyInfo?.sector || 'N/A'} | Industry: ${data.companyInfo?.industry || 'N/A'}`);
    console.log(`   ✅ Stock Price: ${data.stockPrice?.price ?? 'NOT FOUND'} ${data.stockPrice?.currency || ''}`);
    console.log(`   ✅ Metrics extracted: ${data.financialMetrics.length}`);
    data.financialMetrics.forEach((m) => {
      console.log(`      • ${m.metricName}: ${m.metricValue} ${m.unit || ''}`);
    });
  } catch (err: any) {
    console.log(`   ❌ FAILED: ${err.message}`);
  }

  // -------------------------------------------------------
  // TEST 3: SEC EDGAR (US Company Filings)
  // -------------------------------------------------------
  console.log('\n─────────────────────────────────────────────');
  console.log(`🔹 SOURCE 3: SEC EDGAR (${testSymbol})`);
  console.log('─────────────────────────────────────────────');
  try {
    const adapter = getSourceAdapter('sec-edgar')!;
    const url = adapter.buildUrl(testSymbol);
    console.log(`   URL: ${url}`);
    const html = await scraper.fetchHtml(url, adapter.getWaitForSelector?.());
    console.log(`   HTML size: ${html.length} chars`);
    const data = await adapter.extractData(html, testSymbol, url, 'playwright');

    console.log(`   ✅ Company: ${data.companyInfo?.companyName}`);
    console.log(`   ✅ Documents extracted: ${data.financialDocuments?.length || 0}`);
    data.financialDocuments?.forEach((d) => {
      console.log(`      • [${d.documentType}] ${d.title}`);
    });
  } catch (err: any) {
    console.log(`   ❌ FAILED: ${err.message}`);
  }

  // -------------------------------------------------------
  // TEST 4: CompaniesMarketCap (Global Rankings)
  // -------------------------------------------------------
  console.log('\n─────────────────────────────────────────────');
  console.log(`🔹 SOURCE 4: CompaniesMarketCap (${testSymbol})`);
  console.log('─────────────────────────────────────────────');
  try {
    const adapter = getSourceAdapter('companiesmarketcap')!;
    const url = adapter.buildUrl(testSymbol);
    console.log(`   URL: ${url}`);
    const html = await scraper.fetchHtml(url, adapter.getWaitForSelector?.());
    console.log(`   HTML size: ${html.length} chars`);
    const data = await adapter.extractData(html, testSymbol, url, 'playwright');

    console.log(`   ✅ Company: ${data.companyInfo?.companyName}`);
    console.log(`   ✅ Stock Price: ${data.stockPrice?.price ?? 'NOT FOUND'} ${data.stockPrice?.currency || ''}`);
    console.log(`   ✅ Metrics extracted: ${data.financialMetrics.length}`);
    data.financialMetrics.forEach((m) => {
      console.log(`      • ${m.metricName}: ${m.metricValue} ${m.unit || ''}`);
    });
  } catch (err: any) {
    console.log(`   ❌ FAILED: ${err.message}`);
  }

  // -------------------------------------------------------
  // TEST 5: Screener.in (Indian Stock - RELIANCE)
  // -------------------------------------------------------
  const indianSymbol = 'RELIANCE';
  console.log('\n─────────────────────────────────────────────');
  console.log(`🔹 SOURCE 5: Screener.in (${indianSymbol})`);
  console.log('─────────────────────────────────────────────');
  try {
    const adapter = getSourceAdapter('screener-in')!;
    const url = adapter.buildUrl(indianSymbol);
    console.log(`   URL: ${url}`);
    const html = await scraper.fetchHtml(url, adapter.getWaitForSelector?.());
    console.log(`   HTML size: ${html.length} chars`);
    const data = await adapter.extractData(html, indianSymbol, url, 'playwright');

    console.log(`   ✅ Company: ${data.companyInfo?.companyName}`);
    console.log(`   ✅ Stock Price: ${data.stockPrice?.price ?? 'NOT FOUND'} ${data.stockPrice?.currency || ''}`);
    console.log(`   ✅ Metrics extracted: ${data.financialMetrics.length}`);
    data.financialMetrics.forEach((m) => {
      console.log(`      • ${m.metricName}: ${m.metricValue} ${m.unit || ''} (${m.currency})`);
    });
  } catch (err: any) {
    console.log(`   ❌ FAILED: ${err.message}`);
  }

  // -------------------------------------------------------
  // TEST 6: Macrotrends
  // -------------------------------------------------------
  console.log('\n─────────────────────────────────────────────');
  console.log(`🔹 SOURCE 6: Macrotrends (${testSymbol})`);
  console.log('─────────────────────────────────────────────');
  try {
    const adapter = getSourceAdapter('macrotrends')!;
    const url = adapter.buildUrl(testSymbol);
    console.log(`   URL: ${url}`);
    const html = await scraper.fetchHtml(url, adapter.getWaitForSelector?.());
    console.log(`   HTML size: ${html.length} chars`);
    const data = await adapter.extractData(html, testSymbol, url, 'playwright');

    console.log(`   ✅ Company: ${data.companyInfo?.companyName}`);
    console.log(`   ✅ Stock Price: ${data.stockPrice?.price ?? 'NOT FOUND'}`);
    console.log(`   ✅ Metrics extracted: ${data.financialMetrics.length}`);
    data.financialMetrics.forEach((m) => {
      console.log(`      • ${m.metricName}: ${m.metricValue} ${m.unit || ''}`);
    });
  } catch (err: any) {
    console.log(`   ❌ FAILED: ${err.message}`);
  }

  // -------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------
  console.log('\n================================================================');
  console.log('📋 DIAGNOSTIC SUMMARY');
  console.log('================================================================');
  console.log('Run "npm run dev" to start the server with automated 4-hour cycle.');
  console.log('================================================================\n');

  // Close playwright browser
  const pw = getScraper('playwright') as any;
  if (pw.close) await pw.close();

  await disconnectDatabase();
}

diagnoseScrapers().catch((err) => {
  console.error('Fatal diagnostic error:', err);
  process.exit(1);
});
