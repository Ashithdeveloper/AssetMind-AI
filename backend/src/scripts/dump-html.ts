import { getScraper } from '../modules/scraping/scrapers';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Saves raw HTML from each source to analyze DOM structure
 */
async function dumpHtml() {
  const scraper = getScraper('playwright');
  const outDir = path.resolve(process.cwd(), 'html_dumps');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const pages = [
    { name: 'yahoo_aapl', url: 'https://finance.yahoo.com/quote/AAPL/' },
    { name: 'stockanalysis_aapl', url: 'https://stockanalysis.com/stocks/aapl/' },
    { name: 'companiesmarketcap_aapl', url: 'https://companiesmarketcap.com/aapl/marketcap/' },
    { name: 'companiesmarketcap_apple', url: 'https://companiesmarketcap.com/apple/marketcap/' },
    { name: 'macrotrends_aapl', url: 'https://www.macrotrends.net/stocks/charts/AAPL/apple/financial-statements' },
  ];

  for (const p of pages) {
    console.log(`Fetching ${p.name}: ${p.url}`);
    try {
      const html = await scraper.fetchHtml(p.url);
      const filePath = path.join(outDir, `${p.name}.html`);
      fs.writeFileSync(filePath, html);
      console.log(`  Saved ${html.length} chars → ${filePath}`);
    } catch (err: any) {
      console.log(`  ERROR: ${err.message}`);
    }
  }

  const pw = scraper as any;
  if (pw.close) await pw.close();
  console.log('\nDone! Check html_dumps/ folder');
}

dumpHtml().catch(console.error);
