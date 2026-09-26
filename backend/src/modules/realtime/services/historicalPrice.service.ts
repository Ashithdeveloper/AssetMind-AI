import axios from 'axios';
import mongoose from 'mongoose';
import { PriceHistory } from '../../../models/PriceHistory.model';
import { Asset } from '../../../models/Asset.model';

export interface HistoricalBar {
  date: string;
  timestamp?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalPriceResult {
  symbol: string;
  period: string;
  currency: string;
  exchange: string;
  source: string;
  lastUpdated: string;
  data: HistoricalBar[];
}

// In-memory short TTL cache to avoid spamming Yahoo Finance
const priceHistoryCache = new Map<string, { result: HistoricalPriceResult; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache for real-time charts

export class HistoricalPriceService {
  /**
   * Fetches real historical price records for Indian companies from Yahoo Finance V8 API
   * Periods supported: 1D, 1W, 1M, 3M, 6M, 1Y
   */
  public static async getHistoricalPrices(
    symbol: string,
    period: string = '1M',
    assetId?: mongoose.Types.ObjectId
  ): Promise<HistoricalPriceResult> {
    const cleanSym = symbol.trim().toUpperCase().replace(/\.NS$|\.BO$/i, '');
    const validPeriods = ['1D', '1W', '1M', '3M', '6M', '1Y'];
    const p = validPeriods.includes(period.toUpperCase()) ? period.toUpperCase() : '1M';
    const cacheKey = `${cleanSym}_${p}`;

    const cached = priceHistoryCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.result;
    }

    // Map UI periods to Yahoo Finance range & interval
    const configMap: Record<string, { range: string; interval: string }> = {
      '1D': { range: '1d', interval: '5m' },
      '1W': { range: '5d', interval: '15m' },
      '1M': { range: '1mo', interval: '1d' },
      '3M': { range: '3mo', interval: '1d' },
      '6M': { range: '6mo', interval: '1d' },
      '1Y': { range: '1y', interval: '1d' },
    };

    const { range, interval } = configMap[p] || { range: '1mo', interval: '1d' };

    let bars: HistoricalBar[] = [];
    let exchange = 'NSE';
    let currency = 'INR';
    const source = 'Yahoo Finance (NSE Market Data)';
    let lastUpdated = new Date().toISOString();

    // 1. Attempt Yahoo Finance V8 Chart API (.NS first, then .BO fallback)
    const symbolsToTry = [`${cleanSym}.NS`, `${cleanSym}.BO`];
    if (cleanSym === 'TATAMOTORS') {
      symbolsToTry.unshift('TMCV.NS', 'TMPV.NS'); // Tata Motors demerged listings
    }
    if (cleanSym === 'ZOMATO') {
      symbolsToTry.unshift('ETERNAL.NS'); // Zomato listed parent
    }

    const YAHOO_HOSTS = ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com'];

    hostLoop: for (const host of YAHOO_HOSTS) {
      for (const ySym of symbolsToTry) {
        try {
          const url = `${host}/v8/finance/chart/${encodeURIComponent(ySym)}`;
          const res = await axios.get(url, {
            timeout: 8000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'application/json',
            },
            params: {
              range,
              interval,
              includePrePost: false,
            },
          });

          const result = res.data?.chart?.result?.[0];
          if (!result) continue;

        const meta = result.meta;
        currency = meta.currency || 'INR';
        exchange = meta.exchangeName === 'BSE' ? 'BSE' : 'NSE';

        const timestamps: number[] = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0];
        if (!quotes || timestamps.length === 0) continue;

        const opens: (number | null)[] = quotes.open || [];
        const highs: (number | null)[] = quotes.high || [];
        const lows: (number | null)[] = quotes.low || [];
        const closes: (number | null)[] = quotes.close || [];
        const volumes: (number | null)[] = quotes.volume || [];

        // Parse and validate bars
        const parsedBars: HistoricalBar[] = [];
        const seenDates = new Set<string>();

        for (let i = 0; i < timestamps.length; i++) {
          const t = timestamps[i];
          const c = closes[i];
          if (c === null || c === undefined || isNaN(c)) continue; // skip null bars (market holidays/halt)

          const o = opens[i] ?? c;
          const h = highs[i] ?? Math.max(o, c);
          const l = lows[i] ?? Math.min(o, c);
          const v = volumes[i] ?? 0;

          const dateObj = new Date(t * 1000);
          // Format date: for intraday (1D, 1W), show date with time in IST, for daily show YYYY-MM-DD
          let dateStr: string;
          if (p === '1D') {
            dateStr = dateObj.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: 'Asia/Kolkata',
            });
          } else if (p === '1W') {
            const dayPart = dateObj.toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
              timeZone: 'Asia/Kolkata',
            });
            const timePart = dateObj.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: 'Asia/Kolkata',
            });
            dateStr = `${dayPart} ${timePart}`;
          } else {
            dateStr = dateObj.toISOString().split('T')[0];
          }

          if (seenDates.has(dateStr)) continue; // remove duplicate timestamps
          seenDates.add(dateStr);

          parsedBars.push({
            date: dateStr,
            timestamp: t * 1000,
            open: Number(o.toFixed(2)),
            high: Number(h.toFixed(2)),
            low: Number(l.toFixed(2)),
            close: Number(c.toFixed(2)),
            volume: v,
          });
        }

        if (parsedBars.length > 0) {
          bars = parsedBars;
          lastUpdated = new Date(timestamps[timestamps.length - 1] * 1000).toISOString();
          break hostLoop; // successfully retrieved from this host and symbol
        }
      } catch (err: any) {
        // Continue to next symbol / host
      }
    }
  }

    // 2. If online fetch succeeded, asynchronously save daily bars into MongoDB PriceHistory
    if (bars.length > 0 && assetId && (p === '1M' || p === '3M' || p === '1Y')) {
      this.persistPriceHistory(cleanSym, assetId, bars, currency, exchange).catch((e) =>
        console.warn(`[HistoricalPriceService] DB persist warning:`, e.message)
      );
    }

    // 3. Fallback: If network failed completely, load stored records from MongoDB PriceHistory
    if (bars.length === 0) {
      const dbBars = await PriceHistory.find({ symbol: cleanSym })
        .sort({ date: 1 })
        .limit(p === '1Y' ? 250 : p === '6M' ? 130 : 30)
        .lean();

      if (dbBars.length > 0) {
        bars = dbBars.map((b) => ({
          date: b.dateString || new Date(b.date).toISOString().split('T')[0],
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume,
        }));
      }
    }

    const result: HistoricalPriceResult = {
      symbol: cleanSym,
      period: p,
      currency,
      exchange,
      source,
      lastUpdated,
      data: bars,
    };

    priceHistoryCache.set(cacheKey, { result, fetchedAt: Date.now() });
    return result;
  }

  /**
   * Persists historical bars into MongoDB PriceHistory with deduplication
   */
  private static async persistPriceHistory(
    symbol: string,
    companyId: mongoose.Types.ObjectId,
    bars: HistoricalBar[],
    currency: string,
    exchange: string
  ): Promise<void> {
    const ops = bars
      .filter((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.date))
      .map((b) => ({
        updateOne: {
          filter: { symbol, dateString: b.date },
          update: {
            $set: {
              companyId,
              symbol,
              date: new Date(b.date),
              dateString: b.date,
              open: b.open,
              high: b.high,
              low: b.low,
              close: b.close,
              volume: b.volume,
              currency,
              exchange,
              source: 'Yahoo Finance (NSE)',
            },
          },
          upsert: true,
        },
      }));

    if (ops.length > 0) {
      await PriceHistory.bulkWrite(ops, { ordered: false });
    }
  }
}
