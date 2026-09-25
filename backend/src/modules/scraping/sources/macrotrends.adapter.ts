import * as cheerio from 'cheerio';
import { BaseAdapter } from './base.adapter';
import { SourceAdapter, SourceInfo } from './source.adapter.interface';
import { RawStockData, RawFinancialMetric } from '../scrapers/scraper.interface';

/**
 * Macrotrends requires company-name slugs in URLs.
 * Also protected by Cloudflare, which may block headless browsers.
 */
const MACROTRENDS_SLUG: Record<string, string> = {
  'AAPL': 'apple',
  'MSFT': 'microsoft',
  'GOOGL': 'alphabet',
  'GOOG': 'alphabet',
  'AMZN': 'amazon',
  'NVDA': 'nvidia',
  'META': 'meta-platforms',
  'TSLA': 'tesla',
  'JPM': 'jpmorgan-chase',
  'V': 'visa',
  'WMT': 'walmart',
  'MA': 'mastercard',
  'UNH': 'unitedhealth-group',
  'XOM': 'exxon-mobil',
  'JNJ': 'johnson-johnson',
  'PG': 'procter-gamble',
  'HD': 'home-depot',
  'AVGO': 'broadcom',
  'NFLX': 'netflix',
  'ADBE': 'adobe',
  'AMD': 'amd',
  'INTC': 'intel',
  'DIS': 'walt-disney',
  'CSCO': 'cisco',
  'ORCL': 'oracle',
  'BA': 'boeing',
  'GE': 'general-electric',
  'IBM': 'ibm',
  'KO': 'coca-cola',
  'PEP': 'pepsico',
  'CRM': 'salesforce',
  'LLY': 'eli-lilly',
  'ABBV': 'abbvie',
  'MRK': 'merck',
  'CVX': 'chevron',
  'COST': 'costco',
};

export class MacrotrendsAdapter extends BaseAdapter implements SourceAdapter {
  public readonly id = 'macrotrends';
  public readonly name = 'Macrotrends';
  public readonly baseUrl = 'https://www.macrotrends.net';
  public readonly supportedMetrics = [
    'marketCap',
    'peRatio',
    'revenue',
    'netIncome',
    'freeCashFlow',
    'operatingIncome',
    'eps',
    'roe',
    'profitMargin',
  ];

  public getInfo(): SourceInfo {
    return {
      id: this.id,
      name: this.name,
      baseUrl: this.baseUrl,
      supportedMetrics: this.supportedMetrics,
      supportedScrapers: ['playwright', 'scrapingbee'],
      description: 'Long-term historical financial trends, ratios, and fundamental metrics. Note: may be blocked by Cloudflare.',
    };
  }

  public buildUrl(symbol: string): string {
    const upper = symbol.trim().toUpperCase();
    const slug = MACROTRENDS_SLUG[upper] || symbol.trim().toLowerCase();
    return `https://www.macrotrends.net/stocks/charts/${upper}/${slug}/financial-statements`;
  }

  public getWaitForSelector(): string {
    return '#style-1, table.historical_data_table, .jqsfield, h2';
  }

  public async extractData(
    html: string,
    symbol: string,
    sourceUrl: string,
    scraperProvider: 'playwright' | 'scrapingbee'
  ): Promise<RawStockData> {
    const $ = cheerio.load(html);
    const cleanSym = symbol.trim().toUpperCase();

    // Check for Cloudflare challenge page
    const titleText = $('title').text().toLowerCase();
    const h2Text = $('h2').first().text().toLowerCase();
    if (titleText.includes('moment') || h2Text.includes('security verification') || h2Text.includes('challenge')) {
      console.log(`  ⚠️ [Macrotrends] Cloudflare challenge detected for ${cleanSym}. Returning empty result.`);
      return {
        symbol: cleanSym,
        source: this.id,
        sourceUrl,
        scraperProvider,
        collectedAt: new Date(),
        companyInfo: {
          symbol: cleanSym,
          companyName: cleanSym,
        },
        financialMetrics: [],
        rawMetadata: { error: 'CLOUDFLARE_BLOCKED', message: 'Macrotrends is protected by Cloudflare bot detection.' },
      };
    }

    const companyName = $('h2, h1').first().text().replace(/Financial Statements.*$/i, '').trim() || cleanSym;

    let currentPrice: number | undefined;
    const priceMatch = html.match(/current stock price as of [^:]+:\s*\$?([\d,.]+)/i) ||
      html.match(/Price:\s*\$?([\d,.]+)/i);
    if (priceMatch && priceMatch[1]) {
      const parsed = this.parseNumericValue(priceMatch[1]);
      if (parsed) currentPrice = parsed.value;
    }

    const metrics: RawFinancialMetric[] = [];
    const metricMapping: Record<string, string> = {
      'Market Cap': 'marketCap',
      'PE Ratio': 'peRatio',
      'Revenue': 'revenue',
      'Net Income': 'netIncome',
      'Operating Income': 'operatingIncome',
      'EPS': 'eps',
      'ROE': 'roe',
      'Return on Equity': 'roe',
      'Profit Margin': 'profitMargin',
    };

    $('table.historical_data_table tr, table tr').each((_, row) => {
      const label = $(row).find('td, th').first().text().trim();
      const val = $(row).find('td').eq(1).text().trim() || $(row).find('td').last().text().trim();

      for (const [key, metricKey] of Object.entries(metricMapping)) {
        if (label.toLowerCase().includes(key.toLowerCase()) && val && label !== val) {
          const m = this.createMetric(metricKey, val, 'USD', 'ANNUAL');
          if (m && !metrics.find((x) => x.metricName === metricKey)) {
            metrics.push(m);
          }
        }
      }
    });

    return {
      symbol: cleanSym,
      source: this.id,
      sourceUrl,
      scraperProvider,
      collectedAt: new Date(),
      companyInfo: {
        symbol: cleanSym,
        companyName,
      },
      stockPrice: currentPrice
        ? {
            price: currentPrice,
            currency: 'USD',
            priceTimestamp: new Date(),
          }
        : undefined,
      financialMetrics: metrics,
    };
  }
}
