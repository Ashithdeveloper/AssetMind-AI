import * as cheerio from 'cheerio';
import { RawFinancialMetric } from '../scrapers/scraper.interface';

export abstract class BaseAdapter {
  /**
   * Parse financial value strings into raw numeric values.
   * Handles: 3.45T, 185.2B, 45.6M, 12.3K, percentages like 15.4%, currency signs, commas, parentheses for negative.
   */
  public parseNumericValue(raw: string | number | null | undefined): { value: number; unit?: string } | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') {
      return isNaN(raw) ? null : { value: raw, unit: 'raw' };
    }

    let cleaned = raw.trim();
    if (!cleaned || cleaned === '-' || cleaned === 'N/A' || cleaned === 'n/a' || cleaned === 'NaN') {
      return null;
    }

    // Check for negative in parentheses: (123.45) => -123.45
    let isNegative = false;
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      isNegative = true;
      cleaned = cleaned.substring(1, cleaned.length - 1);
    } else if (cleaned.startsWith('-')) {
      isNegative = true;
      cleaned = cleaned.substring(1);
    } else if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    // Remove currency symbols and non-numeric prefix characters
    cleaned = cleaned.replace(/[$€£₹¥%,\s]/g, '');

    // Check for suffix multipliers: T, B, M, K
    let multiplier = 1;
    let unit = 'raw';
    const lastChar = cleaned.slice(-1).toUpperCase();

    if (lastChar === 'T') {
      multiplier = 1e12;
      unit = 'billions';
      cleaned = cleaned.slice(0, -1);
    } else if (lastChar === 'B') {
      multiplier = 1e9;
      unit = 'billions';
      cleaned = cleaned.slice(0, -1);
    } else if (lastChar === 'M') {
      multiplier = 1e6;
      unit = 'millions';
      cleaned = cleaned.slice(0, -1);
    } else if (lastChar === 'K') {
      multiplier = 1e3;
      unit = 'thousands';
      cleaned = cleaned.slice(0, -1);
    } else if (raw.includes('%')) {
      unit = 'percentage';
    }

    const parsedNum = parseFloat(cleaned);
    if (isNaN(parsedNum)) return null;

    const finalValue = (parsedNum * multiplier) * (isNegative ? -1 : 1);
    return { value: finalValue, unit };
  }

  /**
   * Helper to extract JSON-LD structured data from HTML
   */
  public extractJsonLd($: cheerio.CheerioAPI): any[] {
    const results: any[] = [];
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const text = $(elem).text().trim();
        if (text) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            results.push(...parsed);
          } else {
            results.push(parsed);
          }
        }
      } catch {
        // ignore parse error for specific script tag
      }
    });
    return results;
  }

  /**
   * Helper to create a RawFinancialMetric record
   */
  public createMetric(
    metricName: string,
    rawVal: string | number | null | undefined,
    currency = 'USD',
    reportingPeriod = 'TTM',
    metadata?: Record<string, any>
  ): RawFinancialMetric | null {
    const parsed = this.parseNumericValue(rawVal);
    if (!parsed) return null;

    return {
      metricName,
      metricValue: parsed.value,
      currency,
      unit: parsed.unit || 'raw',
      reportingPeriod,
      dataTimestamp: new Date(),
      metadata,
    };
  }
}
