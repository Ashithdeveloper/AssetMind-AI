import * as cheerio from 'cheerio';
import { BaseAdapter } from './base.adapter';
import { SourceAdapter, SourceInfo } from './source.adapter.interface';
import { RawStockData, RawFinancialMetric } from '../scrapers/scraper.interface';

export class MorningstarAdapter extends BaseAdapter implements SourceAdapter {
  public readonly id = 'morningstar';
  public readonly name = 'Morningstar';
  public readonly baseUrl = 'https://www.morningstar.com';
  public readonly supportedMetrics = [
    'marketCap',
    'peRatio',
    'forwardPe',
    'priceToBook',
    'priceToSales',
    'dividendYield',
    'fairValueEstimate',
  ];

  public getInfo(): SourceInfo {
    return {
      id: this.id,
      name: this.name,
      baseUrl: this.baseUrl,
      supportedMetrics: this.supportedMetrics,
      supportedScrapers: ['playwright', 'scrapingbee'],
      description: 'Morningstar quantitative analysis, valuation ratios, price to book/sales, and fair value estimates.',
    };
  }

  public buildUrl(symbol: string): string {
    const cleanSym = symbol.trim().toLowerCase();
    // Default to NASDAQ or NYSE format
    return `https://www.morningstar.com/stocks/xnas/${cleanSym}/quote`;
  }

  public getWaitForSelector(): string {
    return '.mdc-security-header, [data-testid="last-price"], .sal-component-quote';
  }

  public async extractData(
    html: string,
    symbol: string,
    sourceUrl: string,
    scraperProvider: 'playwright' | 'scrapingbee'
  ): Promise<RawStockData> {
    const $ = cheerio.load(html);
    const cleanSym = symbol.trim().toUpperCase();

    let companyName = $('h1, .mdc-security-header__name').first().text().trim() || cleanSym;

    let currentPrice: number | undefined;
    const priceText = $('[data-testid="last-price"], .mdc-security-header__price, .sal-dp-value').first().text().trim();
    if (priceText) {
      const parsed = this.parseNumericValue(priceText);
      if (parsed) currentPrice = parsed.value;
    }

    const metrics: RawFinancialMetric[] = [];
    const metricMapping: Record<string, string> = {
      'Market Cap': 'marketCap',
      'Price/Earnings': 'peRatio',
      'Forward P/E': 'forwardPe',
      'Price/Book': 'priceToBook',
      'Price/Sales': 'priceToSales',
      'Dividend Yield': 'dividendYield',
      'Fair Value': 'fairValueEstimate',
    };

    $('tr, div.dp-pair').each((_, elem) => {
      const label = $(elem).find('.dp-label, th, td').first().text().trim();
      const val = $(elem).find('.dp-value, td').last().text().trim();

      for (const [key, metricKey] of Object.entries(metricMapping)) {
        if (label.toLowerCase().includes(key.toLowerCase()) && val && label !== val) {
          const m = this.createMetric(metricKey, val, 'USD', 'TTM');
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
