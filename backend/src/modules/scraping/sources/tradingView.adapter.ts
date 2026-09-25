import * as cheerio from 'cheerio';
import { BaseAdapter } from './base.adapter';
import { SourceAdapter, SourceInfo } from './source.adapter.interface';
import { RawStockData, RawFinancialMetric } from '../scrapers/scraper.interface';

export class TradingViewAdapter extends BaseAdapter implements SourceAdapter {
  public readonly id = 'tradingview';
  public readonly name = 'TradingView';
  public readonly baseUrl = 'https://www.tradingview.com';
  public readonly supportedMetrics = [
    'marketCap',
    'peRatio',
    'eps',
    'dividendYield',
    'beta',
    'volume',
    'revenue',
    'netIncome',
  ];

  public getInfo(): SourceInfo {
    return {
      id: this.id,
      name: this.name,
      baseUrl: this.baseUrl,
      supportedMetrics: this.supportedMetrics,
      supportedScrapers: ['playwright', 'scrapingbee'],
      description: 'Technical and fundamental summary, market quotes, valuation metrics, and sector indicators.',
    };
  }

  public buildUrl(symbol: string): string {
    const cleanSym = encodeURIComponent(symbol.trim().toUpperCase());
    return `https://www.tradingview.com/symbols/${cleanSym}/`;
  }

  public getWaitForSelector(): string {
    return '.js-symbol-last, [class*="last-"], [class*="tv-category-header"]';
  }

  public async extractData(
    html: string,
    symbol: string,
    sourceUrl: string,
    scraperProvider: 'playwright' | 'scrapingbee'
  ): Promise<RawStockData> {
    const $ = cheerio.load(html);
    const cleanSym = symbol.trim().toUpperCase();

    // Company Name
    let companyName = $('h1').first().text().replace(/\s+/g, ' ').trim();
    if (!companyName) {
      companyName = cleanSym;
    }

    // Price
    let currentPrice: number | undefined;
    let changePercent: number | undefined;

    const priceText = $('span[class*="last-"], [data-field="price"], span[class*="priceWrapper"]').first().text().trim();
    if (priceText) {
      const parsed = this.parseNumericValue(priceText);
      if (parsed) currentPrice = parsed.value;
    }

    const changeText = $('span[class*="change-"], [data-field="change_percent"]').first().text().trim();
    if (changeText) {
      const parsed = this.parseNumericValue(changeText);
      if (parsed) changePercent = parsed.value;
    }

    // Key stats
    const metrics: RawFinancialMetric[] = [];
    const metricMapping: Record<string, string> = {
      'Market capitalization': 'marketCap',
      'Market cap': 'marketCap',
      'Price to earnings': 'peRatio',
      'P/E ratio': 'peRatio',
      'EPS': 'eps',
      'Dividend yield': 'dividendYield',
      'Beta': 'beta',
      'Volume': 'volume',
      'Revenue': 'revenue',
      'Net income': 'netIncome',
    };

    $('div[class*="keyStat-"], div[class*="item-"], tr').each((_, elem) => {
      const label = $(elem).find('[class*="title-"], [class*="label-"], td').first().text().trim();
      const val = $(elem).find('[class*="value-"], td').last().text().trim();

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
            changePercent,
            priceTimestamp: new Date(),
          }
        : undefined,
      financialMetrics: metrics,
    };
  }
}
