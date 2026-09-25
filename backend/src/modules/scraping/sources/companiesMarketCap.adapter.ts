import * as cheerio from 'cheerio';
import { BaseAdapter } from './base.adapter';
import { SourceAdapter, SourceInfo } from './source.adapter.interface';
import { RawStockData, RawFinancialMetric } from '../scrapers/scraper.interface';

/**
 * CompaniesMarketCap uses company-name slugs in URLs, not ticker symbols.
 * This adapter includes a lookup for common companies.
 * For unknown symbols, it falls back to the symbol as the slug.
 */
const SYMBOL_TO_SLUG: Record<string, string> = {
  'AAPL': 'apple',
  'MSFT': 'microsoft',
  'GOOGL': 'alphabet-google',
  'GOOG': 'alphabet-google',
  'AMZN': 'amazon',
  'NVDA': 'nvidia',
  'META': 'meta-platforms',
  'TSLA': 'tesla',
  'BRK.B': 'berkshire-hathaway',
  'BRK.A': 'berkshire-hathaway',
  'TSM': 'tsmc',
  'V': 'visa',
  'JPM': 'jpmorgan-chase',
  'WMT': 'walmart',
  'MA': 'mastercard',
  'UNH': 'unitedhealth-group',
  'XOM': 'exxon-mobil',
  'JNJ': 'johnson-johnson',
  'PG': 'procter-gamble',
  'HD': 'home-depot',
  'AVGO': 'broadcom',
  'COST': 'costco',
  'ABBV': 'abbvie',
  'KO': 'coca-cola',
  'CRM': 'salesforce',
  'MRK': 'merck',
  'PEP': 'pepsico',
  'CVX': 'chevron',
  'NFLX': 'netflix',
  'LLY': 'eli-lilly',
  'ADBE': 'adobe',
  'AMD': 'amd',
  'INTC': 'intel',
  'DIS': 'walt-disney',
  'CSCO': 'cisco',
  'ORCL': 'oracle',
  'ACN': 'accenture',
  'QCOM': 'qualcomm',
  'TXN': 'texas-instruments',
  'IBM': 'ibm',
  'BA': 'boeing',
  'GE': 'general-electric',
  'RELIANCE': 'reliance-industries',
  'TCS': 'tata-consultancy-services',
  'INFY': 'infosys',
  'HDFCBANK': 'hdfc-bank',
  'ICICIBANK': 'icici-bank',
  'HINDUNILVR': 'hindustan-unilever',
  'ITC': 'itc',
  'SBIN': 'state-bank-india',
  'BHARTIARTL': 'bharti-airtel',
  'LT': 'larsen-toubro',
  'WIPRO': 'wipro',
  'MARUTI': 'maruti-suzuki',
  'ASIANPAINT': 'asian-paints',
  'TITAN': 'titan-company',
  'BAJFINANCE': 'bajaj-finance',
  'HCLTECH': 'hcl-technologies',
  'SUNPHARMA': 'sun-pharmaceutical',
  'TATAMOTORS': 'tata-motors',
  'TATASTEEL': 'tata-steel',
  'ADANIENT': 'adani-enterprises',
  'POWERGRID': 'power-grid-corporation',
  'NTPC': 'ntpc',
  'ULTRACEMCO': 'ultratech-cement',
  'KOTAKBANK': 'kotak-mahindra-bank',
  'AXISBANK': 'axis-bank',
  'BABA': 'alibaba',
  'TCEHY': 'tencent',
  '9988.HK': 'alibaba',
  '0700.HK': 'tencent',
  'SAP': 'sap',
  'ASML': 'asml',
  'NVO': 'novo-nordisk',
  'SHEL': 'shell',
  'TM': 'toyota',
  'SONY': 'sony',
  'SAMSUNG': 'samsung',
  'NESN': 'nestle',
};

export class CompaniesMarketCapAdapter extends BaseAdapter implements SourceAdapter {
  public readonly id = 'companiesmarketcap';
  public readonly name = 'CompaniesMarketCap';
  public readonly baseUrl = 'https://companiesmarketcap.com';
  public readonly supportedMetrics = [
    'marketCap',
    'revenue',
    'peRatio',
    'operatingMargin',
    'eps',
    'ranking',
  ];

  public getInfo(): SourceInfo {
    return {
      id: this.id,
      name: this.name,
      baseUrl: this.baseUrl,
      supportedMetrics: this.supportedMetrics,
      supportedScrapers: ['playwright', 'scrapingbee'],
      description: 'Global market capitalization rankings, historical revenue, and valuation ranking.',
    };
  }

  public buildUrl(symbol: string): string {
    const upperSym = symbol.trim().toUpperCase();
    // Use slug lookup; fallback to lowercase symbol
    const slug = SYMBOL_TO_SLUG[upperSym] || symbol.trim().toLowerCase();
    return `https://companiesmarketcap.com/${slug}/marketcap/`;
  }

  public getWaitForSelector(): string {
    return '.info-box, .company-name, h1';
  }

  public async extractData(
    html: string,
    symbol: string,
    sourceUrl: string,
    scraperProvider: 'playwright' | 'scrapingbee'
  ): Promise<RawStockData> {
    const $ = cheerio.load(html);
    const cleanSym = symbol.trim().toUpperCase();

    // Check for 404 page
    const title = $('title').text().trim();
    if (title.toLowerCase().includes('404') || title.toLowerCase().includes('not found')) {
      return this.emptyResult(cleanSym, sourceUrl, scraperProvider);
    }

    // Company name from .company-name or h1
    let companyName = $('.company-name').first().text().trim();
    if (!companyName) {
      const h1 = $('h1').first().text().trim();
      companyName = h1.replace(/Market Cap.*$/i, '').replace(/market capitalization.*$/i, '').trim() || cleanSym;
    }

    // Extract from info-box elements (the real working structure)
    let currentPrice: number | undefined;
    let marketCap: number | undefined;
    let ranking: number | undefined;
    const metrics: RawFinancialMetric[] = [];

    $('.info-box').each((_, box) => {
      const fullText = $(box).text().replace(/\s+/g, ' ').trim();

      if (/marketcap/i.test(fullText)) {
        // e.g. "$4.902 TMarketcap"
        const match = fullText.match(/\$?([\d,.]+)\s*([TBMK])/i);
        if (match) {
          const parsed = this.parseNumericValue(`${match[1]}${match[2]}`);
          if (parsed) {
            marketCap = parsed.value;
            metrics.push({
              metricName: 'marketCap',
              metricValue: parsed.value,
              currency: 'USD',
              unit: parsed.unit || 'billions',
              reportingPeriod: 'CURRENT',
              dataTimestamp: new Date(),
            });
          }
        }
      } else if (/share price/i.test(fullText)) {
        // e.g. "$335.92Share price"
        const match = fullText.match(/\$?([\d,.]+)/);
        if (match) {
          const parsed = this.parseNumericValue(match[1]);
          if (parsed) currentPrice = parsed.value;
        }
      } else if (/rank/i.test(fullText)) {
        // e.g. "#2Rank"
        const match = fullText.match(/#?(\d+)/);
        if (match) {
          ranking = parseInt(match[1], 10);
          metrics.push({
            metricName: 'ranking',
            metricValue: ranking,
            unit: 'raw',
            reportingPeriod: 'CURRENT',
            dataTimestamp: new Date(),
          });
        }
      } else if (/country/i.test(fullText)) {
        // e.g. "United StatesCountry"
        // Country info captured but not stored as metric
      }
    });

    // Extract country from info-box
    let country: string | undefined;
    $('.info-box').each((_, box) => {
      const txt = $(box).text().replace(/\s+/g, ' ').trim();
      if (/country/i.test(txt)) {
        country = txt.replace(/country/i, '').trim();
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
        country,
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

  private emptyResult(symbol: string, sourceUrl: string, scraperProvider: 'playwright' | 'scrapingbee'): RawStockData {
    return {
      symbol,
      source: this.id,
      sourceUrl,
      scraperProvider,
      collectedAt: new Date(),
      companyInfo: { symbol, companyName: symbol },
      financialMetrics: [],
    };
  }
}
