import * as cheerio from 'cheerio';
import { BaseAdapter } from './base.adapter';
import { SourceAdapter, SourceInfo } from './source.adapter.interface';
import { RawStockData, RawFinancialMetric } from '../scrapers/scraper.interface';

export class StockMarketCapAdapter extends BaseAdapter implements SourceAdapter {
  public readonly id = 'stockmarketcap';
  public readonly name = 'StockMarketCap';
  public readonly baseUrl = 'https://get.stockmarketcap.io';
  public readonly supportedMetrics = [
    'marketCap',
    'peRatio',
    'revenue',
    'eps',
    'sharesOutstanding',
  ];

  public getInfo(): SourceInfo {
    return {
      id: this.id,
      name: this.name,
      baseUrl: this.baseUrl,
      supportedMetrics: this.supportedMetrics,
      supportedScrapers: ['playwright', 'scrapingbee'],
      description: 'Stock market capitalization, outstanding shares, and valuation intelligence.',
    };
  }

  public buildUrl(symbol: string): string {
    const cleanSym = symbol.trim().toLowerCase();
    return `https://get.stockmarketcap.io/stocks/${cleanSym}`;
  }

  public getWaitForSelector(): string {
    return '.market-cap, .stock-details, table';
  }

  public async extractData(
    html: string,
    symbol: string,
    sourceUrl: string,
    scraperProvider: 'playwright' | 'scrapingbee'
  ): Promise<RawStockData> {
    const $ = cheerio.load(html);
    const cleanSym = symbol.trim().toUpperCase();

    let companyName = $('h1').first().text().replace(/\s+/g, ' ').trim() || cleanSym;

    let currentPrice: number | undefined;
    const priceText = $('.stock-price, .price, [data-price]').first().text().trim();
    if (priceText) {
      const parsed = this.parseNumericValue(priceText);
      if (parsed) currentPrice = parsed.value;
    }

    const metrics: RawFinancialMetric[] = [];
    const metricMapping: Record<string, string> = {
      'Market Cap': 'marketCap',
      'P/E Ratio': 'peRatio',
      'Revenue': 'revenue',
      'EPS': 'eps',
      'Shares Outstanding': 'sharesOutstanding',
    };

    $('table tr, .stat-row').each((_, elem) => {
      const label = $(elem).find('td, th, .stat-title').first().text().trim();
      const val = $(elem).find('td, .stat-value').last().text().trim();

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
