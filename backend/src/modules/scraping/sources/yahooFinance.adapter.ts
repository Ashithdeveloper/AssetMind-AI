import * as cheerio from 'cheerio';
import { BaseAdapter } from './base.adapter';
import { SourceAdapter, SourceInfo } from './source.adapter.interface';
import { RawStockData, RawFinancialMetric } from '../scrapers/scraper.interface';

export class YahooFinanceAdapter extends BaseAdapter implements SourceAdapter {
  public readonly id = 'yahoo-finance';
  public readonly name = 'Yahoo Finance';
  public readonly baseUrl = 'https://finance.yahoo.com';
  public readonly supportedMetrics = [
    'marketCap',
    'enterpriseValue',
    'peRatio',
    'forwardPe',
    'priceToBook',
    'priceToSales',
    'eps',
    'beta',
    'dividendYield',
    'previousClose',
    'openPrice',
    'dayRangeLow',
    'dayRangeHigh',
    'yearRangeLow',
    'yearRangeHigh',
    'volume',
    'avgVolume',
    'revenue',
    'netIncome',
    'operatingIncome',
    'operatingCashFlow',
    'freeCashFlow',
    'totalAssets',
    'totalLiabilities',
    'totalEquity',
    'roe',
    'profitMargin',
    'operatingMargin',
    'debtToEquity',
  ];

  public getInfo(): SourceInfo {
    return {
      id: this.id,
      name: this.name,
      baseUrl: this.baseUrl,
      supportedMetrics: this.supportedMetrics,
      supportedScrapers: ['playwright', 'scrapingbee'],
      description: 'Comprehensive real-time quotes, valuation ratios, income/balance statements, and company profile.',
    };
  }

  public buildUrl(symbol: string): string {
    const cleanSym = encodeURIComponent(symbol.trim().toUpperCase());
    return `https://finance.yahoo.com/quote/${cleanSym}/`;
  }

  public getWaitForSelector(): string {
    return '[data-testid="qsp-price"], [data-testid="quote-hdr"], fin-streamer';
  }

  public async extractData(
    html: string,
    symbol: string,
    sourceUrl: string,
    scraperProvider: 'playwright' | 'scrapingbee'
  ): Promise<RawStockData> {
    const $ = cheerio.load(html);
    const cleanSym = symbol.trim().toUpperCase();

    // 1. Company Information
    // Use data-testid="quote-title" first (e.g. "Apple Inc. (AAPL)")
    let companyName = $('[data-testid="quote-title"]').first().text().trim();
    if (companyName.includes('(')) {
      companyName = companyName.split('(')[0].trim();
    }

    // Fallback: second h1 tag (first is "Yahoo Finance" site header)
    if (!companyName) {
      const allH1: string[] = [];
      $('h1').each((_, el) => {
        allH1.push($(el).text().trim());
      });
      for (const h1Text of allH1) {
        if (h1Text !== 'Yahoo Finance' && h1Text.length > 1) {
          companyName = h1Text.includes('(') ? h1Text.split('(')[0].trim() : h1Text;
          break;
        }
      }
    }

    // Fallback: title tag
    if (!companyName) {
      const titleText = $('title').text();
      if (titleText.includes('(')) {
        companyName = titleText.split('(')[0].trim();
      }
    }

    if (!companyName) companyName = cleanSym;

    let sector: string | undefined;
    let industry: string | undefined;
    let country: string | undefined = 'United States';
    let exchange: string | undefined;
    let description: string | undefined;

    // Exchange from quote header
    const hdrText = $('[data-testid="quote-hdr"]').first().text();
    if (hdrText) {
      if (/nasdaq/i.test(hdrText)) exchange = 'NASDAQ';
      else if (/nyse/i.test(hdrText)) exchange = 'NYSE';
      else if (/nse/i.test(hdrText)) exchange = 'NSE';
      else if (/bse/i.test(hdrText)) exchange = 'BSE';
    }

    // 2. Stock Price — Use data-testid="qsp-price" which gives the accurate stock price
    let currentPrice: number | undefined;
    let priceChange: number | undefined;
    let percentChange: number | undefined;

    const qspPrice = $('[data-testid="qsp-price"]').first().text().trim();
    if (qspPrice) {
      const parsed = this.parseNumericValue(qspPrice);
      if (parsed) currentPrice = parsed.value;
    }

    // Fallback to fin-streamer only if qsp-price not found
    if (!currentPrice) {
      const priceSection = $('section[data-testid="quote-price"], [data-testid="price-statistic"]');
      let finPrice = priceSection.find('fin-streamer[data-field="regularMarketPrice"]').first();
      if (!finPrice.length) {
        finPrice = $('fin-streamer[data-field="regularMarketPrice"]').first();
      }
      const val = finPrice.attr('value') || finPrice.text();
      if (val) {
        const parsed = this.parseNumericValue(val);
        if (parsed) currentPrice = parsed.value;
      }
    }

    // Price change from data-testid or fin-streamer
    const changeText = $('[data-testid="qsp-price-change"]').first().text().trim();
    if (changeText) {
      const parsed = this.parseNumericValue(changeText);
      if (parsed) priceChange = parsed.value;
    } else {
      const finChange = $('fin-streamer[data-field="regularMarketChange"]').first();
      const val = finChange.attr('value') || finChange.text();
      if (val) {
        const parsed = this.parseNumericValue(val);
        if (parsed) priceChange = parsed.value;
      }
    }

    const changePctText = $('[data-testid="qsp-price-change-percent"]').first().text().trim();
    if (changePctText) {
      const cleaned = changePctText.replace(/[()]/g, '');
      const parsed = this.parseNumericValue(cleaned);
      if (parsed) percentChange = parsed.value;
    } else {
      const finPct = $('fin-streamer[data-field="regularMarketChangePercent"]').first();
      const val = finPct.attr('value') || finPct.text();
      if (val) {
        const cleaned = val.replace(/[()]/g, '');
        const parsed = this.parseNumericValue(cleaned);
        if (parsed) percentChange = parsed.value;
      }
    }

    // 3. Metrics parsing from key stats tables
    const metrics: RawFinancialMetric[] = [];
    const metricMapping: Record<string, string> = {
      'Market Cap (intraday)': 'marketCap',
      'Market Cap': 'marketCap',
      'Enterprise Value': 'enterpriseValue',
      'PE Ratio (TTM)': 'peRatio',
      'Forward P/E': 'forwardPe',
      'Price/Book': 'priceToBook',
      'Price/Sales': 'priceToSales',
      'PEG Ratio': 'pegRatio',
      'EPS (TTM)': 'eps',
      'Beta (5Y Monthly)': 'beta',
      'Beta': 'beta',
      'Forward Dividend & Yield': 'dividendYield',
      'Dividend Yield': 'dividendYield',
      'Previous Close': 'previousClose',
      'Open': 'openPrice',
      'Volume': 'volume',
      'Avg. Volume': 'avgVolume',
      '52 Week Range': 'fiftyTwoWeekRange',
      'Day\'s Range': 'dayRange',
      '1y Target Est': 'targetPrice',
      'Revenue': 'revenue',
      'Net Income': 'netIncome',
      'Operating Cash Flow': 'operatingCashFlow',
      'Levered Free Cash Flow': 'freeCashFlow',
      'Return on Equity': 'roe',
      'Profit Margin': 'profitMargin',
      'Operating Margin': 'operatingMargin',
      'Total Debt/Equity': 'debtToEquity',
    };

    // Parse table rows (most Yahoo stats are in <li> or <tr> with label-value pairs)
    $('li, tr').each((_, elem) => {
      const children = $(elem).children();
      if (children.length < 2) return;

      const label = $(children[0]).text().trim();
      const value = $(children[children.length - 1]).text().trim();

      if (!label || !value || label === value) return;

      for (const [key, metricKey] of Object.entries(metricMapping)) {
        if (label === key || label.startsWith(key)) {
          const m = this.createMetric(metricKey, value, 'USD', 'TTM');
          if (m && !metrics.find((x) => x.metricName === metricKey)) {
            metrics.push(m);
          }
          break;
        }
      }
    });

    // 4. JSON-LD structured data
    const jsonLds = this.extractJsonLd($);
    for (const item of jsonLds) {
      if (item['@type'] === 'Corporation' || item['@type'] === 'Organization') {
        if (item.name && (!companyName || companyName === cleanSym)) companyName = item.name;
        if (item.description && !description) description = item.description;
        if (item.address?.addressCountry && !country) country = item.address.addressCountry;
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
        exchange: exchange || 'NASDAQ',
        country: country || 'United States',
        sector,
        industry,
        description,
      },
      stockPrice: currentPrice
        ? {
            price: currentPrice,
            currency: 'USD',
            change: priceChange,
            changePercent: percentChange,
            priceTimestamp: new Date(),
          }
        : undefined,
      financialMetrics: metrics,
    };
  }
}
