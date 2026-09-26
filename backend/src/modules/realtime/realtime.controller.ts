/**
 * AssetMind AI — Real-Time Controller
 *
 * REST endpoints:
 *   GET  /api/realtime/:symbol/quote          → Live price quote (cached 60s)
 *   GET  /api/realtime/:symbol/news           → News for a symbol
 *   GET  /api/realtime/:symbol/full           → Quote + News combined
 *   GET  /api/realtime/market/news            → Broad Indian market news
 *   GET  /api/realtime/market/indices         → Nifty 50, Sensex live
 *   POST /api/realtime/refresh                → Manually trigger refresh cycle
 *   GET  /api/realtime/quotes/snapshot        → All cached in-memory quotes
 *   GET  /api/realtime/stream/:symbol         → SSE live price stream
 */

import { Request, Response, NextFunction } from 'express';
import { fetchLiveQuote } from './liveQuote.service';
import { fetchNewsForSymbol, fetchMarketNews, analyzeCompanyNews } from './news.service';
import { getAllLatestQuotes, getLatestQuote, priceEventBus } from './liveRefresh.scheduler';
import { sendSuccess, AppError } from '../../utils/apiResponse';

const MARKET_INDICES = ['^NSEI', '^BSESN', '^NSEBANK'];

export class RealTimeController {
  /**
   * GET /api/realtime/:symbol/quote
   * Returns live real-time quote for a symbol
   */
  static async getLiveQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { symbol } = req.params;
      const clean = String(symbol || '').trim().toUpperCase();

      // Check in-memory first
      let quote = getLatestQuote(clean);

      // Fetch fresh if not in cache
      if (!quote) {
        quote = (await fetchLiveQuote(clean)) ?? undefined;
      }

      if (!quote) {
        throw new AppError(`Live quote unavailable for ${clean}`, 404, 'QUOTE_NOT_FOUND');
      }

      sendSuccess(res, quote, `Live quote for ${clean}`, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/realtime/:symbol/news
   * Returns recent news articles for a company symbol
   */
  static async getSymbolNews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { symbol } = req.params;
      const companyName = req.query.name as string | undefined;
      const clean = String(symbol || '').trim().toUpperCase();
      if (!clean) throw new AppError('Symbol is required', 400, 'SYMBOL_REQUIRED');

      const articles = await fetchNewsForSymbol(clean, companyName);

      sendSuccess(
        res,
        {
          symbol: clean,
          totalArticles: articles.length,
          articles,
          lastFetched: new Date().toISOString(),
        },
        `News for ${clean} retrieved (${articles.length} articles)`,
        200
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/realtime/:symbol/news-analysis
   * AI-powered synthesis of all recent news for a company
   */
  static async getCompanyNewsAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { symbol } = req.params;
      const companyName = req.query.name as string | undefined;
      const clean = String(symbol || '').trim().toUpperCase();
      if (!clean) throw new AppError('Symbol is required', 400, 'SYMBOL_REQUIRED');

      const analysis = await analyzeCompanyNews(clean, companyName);

      sendSuccess(
        res,
        analysis,
        `AI news analysis for ${clean} completed successfully`,
        200
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/realtime/:symbol/full
   * Combined: live quote + news for analysis context
   */
  static async getFullRealtime(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { symbol } = req.params;
      const companyName = req.query.name as string | undefined;
      const clean = String(symbol || '').trim().toUpperCase();
      if (!clean) throw new AppError('Symbol is required', 400, 'SYMBOL_REQUIRED');

      const [quote, articles] = await Promise.allSettled([
        (async () => {
          let q = getLatestQuote(clean);
          if (!q) q = (await fetchLiveQuote(clean)) ?? undefined;
          return q;
        })(),
        fetchNewsForSymbol(clean, companyName),
      ]);

      const liveQuote = quote.status === 'fulfilled' ? quote.value : null;
      const news = articles.status === 'fulfilled' ? articles.value : [];

      sendSuccess(
        res,
        {
          symbol: clean,
          quote: liveQuote,
          news: {
            totalArticles: news.length,
            articles: news,
          },
          lastFetched: new Date().toISOString(),
        },
        `Full real-time data for ${clean}`,
        200
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/realtime/market/news
   * Indian market-wide news
   */
  static async getMarketNews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const articles = await fetchMarketNews();

      sendSuccess(
        res,
        {
          totalArticles: articles.length,
          articles,
          lastFetched: new Date().toISOString(),
          sources: ['Economic Times', 'Mint', 'Google News'],
        },
        `Indian market news (${articles.length} articles)`,
        200
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/realtime/market/indices
   * Live Nifty 50, Sensex, Bank Nifty
   */
  static async getMarketIndices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const indexQuotes = await Promise.allSettled(
        MARKET_INDICES.map(async (idx) => {
          const q = await fetchLiveQuote(idx);
          if (!q) return null;
          return {
            index: idx === '^NSEI' ? 'NIFTY 50' : idx === '^BSESN' ? 'SENSEX' : 'BANK NIFTY',
            symbol: idx,
            value: q.price,
            change: q.change,
            changePercent: q.changePercent,
            lastUpdated: q.lastUpdated,
          };
        })
      );

      const indices = indexQuotes
        .filter((r) => r.status === 'fulfilled' && r.value)
        .map((r) => (r as any).value);

      sendSuccess(res, { indices, lastFetched: new Date().toISOString() }, 'Live market indices', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/realtime/quotes/snapshot
   * All cached in-memory live quotes
   */
  static async getQuoteSnapshot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const all = getAllLatestQuotes();
      const quotes = Array.from(all.values());

      sendSuccess(
        res,
        {
          totalSymbols: quotes.length,
          quotes,
          lastFetched: new Date().toISOString(),
        },
        `Snapshot of ${quotes.length} live quotes`,
        200
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/realtime/refresh
   * Manually trigger a single-symbol quote refresh
   */
  static async triggerRefresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.body?.symbol || req.query.symbol || '').trim();
      if (!symbol) throw new AppError('Symbol required in body or query', 400, 'SYMBOL_REQUIRED');

      const clean = symbol.trim().toUpperCase();
      const quote = await fetchLiveQuote(clean);

      if (!quote) {
        throw new AppError(`Could not refresh quote for ${clean}`, 503, 'REFRESH_FAILED');
      }

      sendSuccess(res, quote, `Quote refreshed for ${clean}`, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/realtime/stream/:symbol
   * Server-Sent Events (SSE) live price stream for a symbol
   */
  static async streamQuote(req: Request, res: Response): Promise<void> {
    const { symbol } = req.params;
    const clean = String(symbol || '').trim().toUpperCase();

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Send initial quote
    const sendQuote = (q: any) => {
      const payload = JSON.stringify({ type: 'quote', data: q, ts: new Date().toISOString() });
      res.write(`data: ${payload}\n\n`);
    };

    // Initial state
    const initial = getLatestQuote(clean);
    if (initial) sendQuote(initial);

    // Listen for updates from refresh scheduler
    const onUpdate = (quotes: any[]) => {
      const found = quotes.find((q) => q.symbol === clean);
      if (found) sendQuote(found);
    };

    priceEventBus.on('quotes-updated', onUpdate);

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      priceEventBus.off('quotes-updated', onUpdate);
      res.end();
    });
  }
}
