import * as cheerio from 'cheerio';
import { BaseAdapter } from './base.adapter';
import { SourceAdapter, SourceInfo } from './source.adapter.interface';
import { RawStockData, RawFinancialMetric } from '../scrapers/scraper.interface';

export class ScreenerInAdapter extends BaseAdapter implements SourceAdapter {
  public readonly id = 'screener-in';
  public readonly name = 'Screener.in';
  public readonly baseUrl = 'https://www.screener.in';
  public readonly supportedMetrics = [
    'marketCap',
    'currentPrice',
    'highPrice',
    'lowPrice',
    'peRatio',
    'bookValue',
    'dividendYield',
    'roce',
    'roe',
    'faceValue',
    'revenue',
    'netIncome',
    'operatingProfit',
    'operatingMargin',
    'eps',
    'totalAssets',
    'borrowings',
    'operatingCashFlow',
  ];

  public getInfo(): SourceInfo {
    return {
      id: this.id,
      name: this.name,
      baseUrl: this.baseUrl,
      supportedMetrics: this.supportedMetrics,
      supportedScrapers: ['playwright', 'scrapingbee'],
      description: 'Comprehensive Indian equity fundamentals, top ratios, balance sheet, cash flows, and company analysis.',
    };
  }

  public buildUrl(symbol: string): string {
    const cleanSym = encodeURIComponent(symbol.trim().toUpperCase().replace(/\.NS$|\.BO$/i, ''));
    return `https://www.screener.in/company/${cleanSym}/consolidated/`;
  }

  public getWaitForSelector(): string {
    return '#top-ratios, #ratios, .company-ratios, h1';
  }

  public async extractData(
    html: string,
    symbol: string,
    sourceUrl: string,
    scraperProvider: 'playwright' | 'scrapingbee'
  ): Promise<RawStockData> {
    const $ = cheerio.load(html);
    const cleanSym = symbol.trim().toUpperCase().replace(/\.NS$|\.BO$/i, '');

    // 1. Company Name & Description
    let companyName = $('h1.h2, h1, .show-from-tablet-landscape h1').first().text().replace(/\s+/g, ' ').trim();
    if (!companyName) {
      companyName = cleanSym;
    }

    const description = $('.about p, .company-profile p, #about p').first().text().trim() || undefined;

    // Sector & Industry from peer section or links
    let sector: string | undefined;
    let industry: string | undefined;
    $('#peers a[href*="/explore/"]').each((i, el) => {
      if (i === 0) sector = $(el).text().trim();
      if (i === 1) industry = $(el).text().trim();
    });

    let currentPrice: number | undefined;

    // 2. Top Ratios Parsing
    const metrics: RawFinancialMetric[] = [];
    const metricMapping: Record<string, string> = {
      'Market Cap': 'marketCap',
      'Current Price': 'currentPrice',
      'Stock P/E': 'peRatio',
      'P/E': 'peRatio',
      'Book Value': 'bookValue',
      'Dividend Yield': 'dividendYield',
      'ROCE': 'roce',
      'ROE': 'roe',
      'Face Value': 'faceValue',
      'Sales': 'revenue',
      'Revenue': 'revenue',
      'Operating Profit': 'operatingProfit',
      'OPM %': 'operatingMargin',
      'Net Profit': 'netIncome',
      'EPS': 'eps',
      'Total Assets': 'totalAssets',
      'Borrowings': 'borrowings',
      'Cash from Operating Activity': 'operatingCashFlow',
    };

    $('#top-ratios li, ul.top-ratios li, #ratios li, tr').each((_, elem) => {
      const label = $(elem).find('.name, td, th').first().text().trim();
      const val = $(elem).find('.value, .number, td').last().text().trim();

      for (const [key, metricKey] of Object.entries(metricMapping)) {
        if (label.toLowerCase().includes(key.toLowerCase()) && val) {
          if (metricKey === 'currentPrice') {
            const parsed = this.parseNumericValue(val);
            if (parsed) currentPrice = parsed.value;
          }
          // Note: Screener.in values are in Crores (Cr = 1e7) for absolute numbers or raw percentage/ratio
          const m = this.createMetric(metricKey, val, 'INR', 'TTM');
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
        exchange: 'NSE',
        country: 'India',
        sector,
        industry,
        description,
      },
      stockPrice: currentPrice
        ? {
            price: currentPrice,
            currency: 'INR',
            priceTimestamp: new Date(),
          }
        : undefined,
      financialMetrics: metrics,
    };
  }
}
