import * as cheerio from 'cheerio';
import { BaseAdapter } from './base.adapter';
import { SourceAdapter, SourceInfo } from './source.adapter.interface';
import { RawStockData, RawFinancialMetric } from '../scrapers/scraper.interface';

export class StockAnalysisAdapter extends BaseAdapter implements SourceAdapter {
  public readonly id = 'stockanalysis';
  public readonly name = 'StockAnalysis';
  public readonly baseUrl = 'https://stockanalysis.com';
  public readonly supportedMetrics = [
    'marketCap',
    'enterpriseValue',
    'revenue',
    'netIncome',
    'operatingIncome',
    'peRatio',
    'forwardPe',
    'priceToBook',
    'priceToSales',
    'eps',
    'freeCashFlow',
    'operatingCashFlow',
    'grossMargin',
    'operatingMargin',
    'profitMargin',
    'roe',
    'roce',
    'debtToEquity',
    'dividendYield',
    'beta',
    'sharesOutstanding',
    'targetPrice',
  ];

  public getInfo(): SourceInfo {
    return {
      id: this.id,
      name: this.name,
      baseUrl: this.baseUrl,
      supportedMetrics: this.supportedMetrics,
      supportedScrapers: ['playwright', 'scrapingbee'],
      description: '[US Equities Only - Inactive for Indian Stock Market] In-depth stock overview and financial statements.',
    };
  }

  public buildUrl(symbol: string): string {
    const cleanSym = symbol.trim().toLowerCase();
    return `https://stockanalysis.com/stocks/${cleanSym}/`;
  }

  public getWaitForSelector(): string {
    return '.text-4xl, [data-test="price"], table, .grid';
  }

  /**
   * Extract only the primary value from a cell like "4.90T +29.8%" or "$328.22 (-2.29%)"
   * Returns the first numeric token (the actual metric value, not the % change).
   */
  private extractPrimaryValue(raw: string): string {
    const trimmed = raw.trim();
    // Match a leading numeric pattern optionally with $, commas, decimals, and suffix T/B/M/K
    const match = trimmed.match(/^[\$]?\s*[\-\+]?[\d,]+\.?\d*\s*[TBMK]?/i);
    if (match) {
      return match[0].trim();
    }
    // If the cell has multiple tokens separated by spaces, take the first
    const tokens = trimmed.split(/\s+/);
    return tokens[0] || trimmed;
  }

  public async extractData(
    html: string,
    symbol: string,
    sourceUrl: string,
    scraperProvider: 'playwright' | 'scrapingbee'
  ): Promise<RawStockData> {
    const $ = cheerio.load(html);
    const cleanSym = symbol.trim().toUpperCase();

    // 1. Company Name
    let companyName = $('h1').first().text().trim();
    if (companyName.includes('(')) {
      companyName = companyName.split('(')[0].trim();
    }

    // 2. Sector, Industry & Exchange
    let sector: string | undefined;
    let industry: string | undefined;
    let exchange: string | undefined;

    $('a[href*="/stocks/sector/"]').each((_, el) => {
      sector = $(el).text().trim();
    });
    $('a[href*="/stocks/industry/"]').each((_, el) => {
      industry = $(el).text().trim();
    });
    $('a[href*="/stocks/exchange/"]').each((_, el) => {
      exchange = $(el).text().trim().toUpperCase();
    });

    // Also check for "NASDAQ:" or "NYSE:" in the page header
    if (!exchange) {
      const hdrText = $('h1').parent().text();
      if (/NASDAQ/i.test(hdrText)) exchange = 'NASDAQ';
      else if (/NYSE/i.test(hdrText)) exchange = 'NYSE';
    }

    // 3. Description
    const description =
      $('div[data-test="overview-description"], p.text-base, p.text-sm')
        .first()
        .text()
        .trim() || undefined;

    // 4. Current Price & Changes
    let currentPrice: number | undefined;
    let priceChange: number | undefined;
    let percentChange: number | undefined;

    // Primary price from prominent text-4xl element
    const priceText = $('.text-4xl.font-bold, [data-test="price"]').first().text().trim();
    if (priceText) {
      const parsed = this.parseNumericValue(priceText);
      if (parsed) currentPrice = parsed.value;
    }

    // 5. Extract Financial Metrics from table rows
    const metrics: RawFinancialMetric[] = [];
    const metricMapping: Record<string, string> = {
      'Market Cap': 'marketCap',
      'Enterprise Value': 'enterpriseValue',
      'Revenue (ttm)': 'revenue',
      'Revenue': 'revenue',
      'Net Income (ttm)': 'netIncome',
      'Net Income': 'netIncome',
      'Operating Income': 'operatingIncome',
      'PE Ratio': 'peRatio',
      'Forward PE': 'forwardPe',
      'Price / Book': 'priceToBook',
      'Price / Sales': 'priceToSales',
      'EPS (ttm)': 'eps',
      'EPS': 'eps',
      'Free Cash Flow': 'freeCashFlow',
      'Operating Cash Flow': 'operatingCashFlow',
      'Gross Margin': 'grossMargin',
      'Operating Margin': 'operatingMargin',
      'Profit Margin': 'profitMargin',
      'Return on Equity': 'roe',
      'ROE': 'roe',
      'Return on Capital': 'roce',
      'Debt / Equity': 'debtToEquity',
      'Dividend': 'dividendYield',
      'Dividend Yield': 'dividendYield',
      'Beta': 'beta',
      'Shares Out': 'sharesOutstanding',
      'Shares Outstanding': 'sharesOutstanding',
      'Price Target': 'targetPrice',
      'Volume': 'volume',
      'Open': 'openPrice',
      'Previous Close': 'previousClose',
    };

    // StockAnalysis uses <tr> with two <td> cells: label in first, value in second.
    // The value cell may contain both value and % change like "4.90T +29.8%"
    $('tr').each((_, row) => {
      const tds = $(row).find('td');
      if (tds.length < 2) return;

      const label = $(tds[0]).text().trim();
      const rawValue = $(tds[1]).text().trim();

      if (!label || !rawValue) return;

      for (const [key, metricKey] of Object.entries(metricMapping)) {
        if (label === key || label.toLowerCase() === key.toLowerCase()) {
          // Extract only the primary numeric value, stripping appended % changes
          const cleanValue = this.extractPrimaryValue(rawValue);
          const m = this.createMetric(metricKey, cleanValue, 'INR', 'TTM');
          if (m && !metrics.find((x) => x.metricName === metricKey)) {
            metrics.push(m);
          }
          break;
        }
      }
    });

    // Check JSON-LD fallback for company metadata
    const jsonLds = this.extractJsonLd($);
    for (const item of jsonLds) {
      if (item['@type'] === 'Corporation' || item['@type'] === 'Organization') {
        if (item.name && (!companyName || companyName === cleanSym)) companyName = item.name;
      }
    }

    return {
      symbol: cleanSym,
      source: this.id,
      sourceUrl,
      scraperProvider,
      collectedAt: new Date(),
      companyInfo: {
        symbol: cleanSym,
        companyName: companyName || cleanSym,
        exchange: exchange && exchange !== 'NASDAQ' && exchange !== 'NYSE' ? exchange : 'NSE',
        country: 'India',
        sector,
        industry,
        description,
      },
      stockPrice: currentPrice
        ? {
            price: currentPrice,
            currency: 'INR',
            change: priceChange,
            changePercent: percentChange,
            priceTimestamp: new Date(),
          }
        : undefined,
      financialMetrics: metrics,
    };
  }
}
