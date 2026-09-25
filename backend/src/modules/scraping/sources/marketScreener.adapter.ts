import * as cheerio from 'cheerio';
import { BaseAdapter } from './base.adapter';
import { SourceAdapter, SourceInfo } from './source.adapter.interface';
import { RawStockData, RawFinancialMetric } from '../scrapers/scraper.interface';

/**
 * MarketScreener uses its own ID-based URL format.
 * For common stocks we have the known URL slugs.
 */
const MARKETSCREENER_SLUG: Record<string, string> = {
  'AAPL': 'APPLE-INC-4849',
  'MSFT': 'MICROSOFT-CORPORATION-4835',
  'GOOGL': 'ALPHABET-INC-24203026',
  'AMZN': 'AMAZON-COM-INC-6435',
  'NVDA': 'NVIDIA-CORPORATION-5765',
  'META': 'META-PLATFORMS-INC-43082543',
  'TSLA': 'TESLA-INC-6344549',
  'JPM': 'JPMORGAN-CHASE-CO-4833',
  'V': 'VISA-INC-6495',
  'WMT': 'WALMART-INC-4831',
  'RELIANCE': 'RELIANCE-INDUSTRIES-LTD-9064637',
  'TCS': 'TATA-CONSULTANCY-SERVICES-9058945',
  'INFY': 'INFOSYS-LIMITED-9058972',
};

export class MarketScreenerAdapter extends BaseAdapter implements SourceAdapter {
  public readonly id = 'marketscreener';
  public readonly name = 'MarketScreener';
  public readonly baseUrl = 'https://www.marketscreener.com';
  public readonly supportedMetrics = [
    'marketCap',
    'peRatio',
    'yield',
    'netIncome',
    'revenue',
    'operatingIncome',
    'eps',
    'freeCashFlow',
  ];

  public getInfo(): SourceInfo {
    return {
      id: this.id,
      name: this.name,
      baseUrl: this.baseUrl,
      supportedMetrics: this.supportedMetrics,
      supportedScrapers: ['playwright', 'scrapingbee'],
      description: 'Global equity quotes, valuation consensus, financial analysis, and company profile.',
    };
  }

  public buildUrl(symbol: string): string {
    const upper = symbol.trim().toUpperCase();
    const slug = MARKETSCREENER_SLUG[upper];
    if (slug) {
      return `https://www.marketscreener.com/quote/stock/${slug}/`;
    }
    // Fallback: use search page to find the stock
    return `https://www.marketscreener.com/search/?q=${encodeURIComponent(upper)}`;
  }

  public getWaitForSelector(): string {
    return '.price, table, h1, .fsp-price';
  }

  public async extractData(
    html: string,
    symbol: string,
    sourceUrl: string,
    scraperProvider: 'playwright' | 'scrapingbee'
  ): Promise<RawStockData> {
    const $ = cheerio.load(html);
    const cleanSym = symbol.trim().toUpperCase();

    // Check for bot block
    const titleText = $('title').text().toLowerCase();
    if (titleText.includes('moment') || titleText.includes('blocked')) {
      return {
        symbol: cleanSym,
        source: this.id,
        sourceUrl,
        scraperProvider,
        collectedAt: new Date(),
        companyInfo: { symbol: cleanSym, companyName: cleanSym },
        financialMetrics: [],
        rawMetadata: { error: 'BOT_BLOCKED' },
      };
    }

    const companyName = $('h1').first().text().replace(/\s+/g, ' ').trim() || cleanSym;

    let currentPrice: number | undefined;
    const priceText = $('.fsp-price, .elem_quot, [data-field="price"], .text-3xl').first().text().trim();
    if (priceText) {
      const parsed = this.parseNumericValue(priceText);
      if (parsed) currentPrice = parsed.value;
    }

    const metrics: RawFinancialMetric[] = [];
    const metricMapping: Record<string, string> = {
      'Capitalization': 'marketCap',
      'Market Cap': 'marketCap',
      'P/E ratio': 'peRatio',
      'PER': 'peRatio',
      'Yield': 'dividendYield',
      'Net Debt': 'netDebt',
      'EPS': 'eps',
      'Sales': 'revenue',
      'Operating Income': 'operatingIncome',
      'Net Income': 'netIncome',
    };

    $('table tr').each((_, row) => {
      const tds = $(row).find('td, th');
      if (tds.length < 2) return;

      const label = $(tds[0]).text().trim();
      const val = $(tds[tds.length - 1]).text().trim();

      if (!label || !val || label === val) return;

      for (const [key, metricKey] of Object.entries(metricMapping)) {
        if (label.toLowerCase().includes(key.toLowerCase())) {
          const m = this.createMetric(metricKey, val, 'USD', 'TTM');
          if (m && !metrics.find((x) => x.metricName === metricKey)) {
            metrics.push(m);
          }
          break;
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
