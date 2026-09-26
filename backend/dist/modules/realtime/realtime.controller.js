"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealTimeController = void 0;
const liveQuote_service_1 = require("./liveQuote.service");
const news_service_1 = require("./news.service");
const liveRefresh_scheduler_1 = require("./liveRefresh.scheduler");
const apiResponse_1 = require("../../utils/apiResponse");
const MARKET_INDICES = ['^NSEI', '^BSESN', '^NSEBANK'];
class RealTimeController {
    /**
     * GET /api/realtime/:symbol/quote
     * Returns live real-time quote for a symbol
     */
    static async getLiveQuote(req, res, next) {
        try {
            const { symbol } = req.params;
            const clean = String(symbol || '').trim().toUpperCase();
            // Check in-memory first
            let quote = (0, liveRefresh_scheduler_1.getLatestQuote)(clean);
            // Fetch fresh if not in cache
            if (!quote) {
                quote = (await (0, liveQuote_service_1.fetchLiveQuote)(clean)) ?? undefined;
            }
            if (!quote) {
                throw new apiResponse_1.AppError(`Live quote unavailable for ${clean}`, 404, 'QUOTE_NOT_FOUND');
            }
            (0, apiResponse_1.sendSuccess)(res, quote, `Live quote for ${clean}`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/realtime/:symbol/news
     * Returns recent news articles for a company symbol
     */
    static async getSymbolNews(req, res, next) {
        try {
            const { symbol } = req.params;
            const companyName = req.query.name;
            const clean = String(symbol || '').trim().toUpperCase();
            if (!clean)
                throw new apiResponse_1.AppError('Symbol is required', 400, 'SYMBOL_REQUIRED');
            const articles = await (0, news_service_1.fetchNewsForSymbol)(clean, companyName);
            (0, apiResponse_1.sendSuccess)(res, {
                symbol: clean,
                totalArticles: articles.length,
                articles,
                lastFetched: new Date().toISOString(),
            }, `News for ${clean} retrieved (${articles.length} articles)`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/realtime/:symbol/news-analysis
     * AI-powered synthesis of all recent news for a company
     */
    static async getCompanyNewsAnalysis(req, res, next) {
        try {
            const { symbol } = req.params;
            const companyName = req.query.name;
            const clean = String(symbol || '').trim().toUpperCase();
            if (!clean)
                throw new apiResponse_1.AppError('Symbol is required', 400, 'SYMBOL_REQUIRED');
            const analysis = await (0, news_service_1.analyzeCompanyNews)(clean, companyName);
            (0, apiResponse_1.sendSuccess)(res, analysis, `AI news analysis for ${clean} completed successfully`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/realtime/:symbol/full
     * Combined: live quote + news for analysis context
     */
    static async getFullRealtime(req, res, next) {
        try {
            const { symbol } = req.params;
            const companyName = req.query.name;
            const clean = String(symbol || '').trim().toUpperCase();
            if (!clean)
                throw new apiResponse_1.AppError('Symbol is required', 400, 'SYMBOL_REQUIRED');
            const [quote, articles] = await Promise.allSettled([
                (async () => {
                    let q = (0, liveRefresh_scheduler_1.getLatestQuote)(clean);
                    if (!q)
                        q = (await (0, liveQuote_service_1.fetchLiveQuote)(clean)) ?? undefined;
                    return q;
                })(),
                (0, news_service_1.fetchNewsForSymbol)(clean, companyName),
            ]);
            const liveQuote = quote.status === 'fulfilled' ? quote.value : null;
            const news = articles.status === 'fulfilled' ? articles.value : [];
            (0, apiResponse_1.sendSuccess)(res, {
                symbol: clean,
                quote: liveQuote,
                news: {
                    totalArticles: news.length,
                    articles: news,
                },
                lastFetched: new Date().toISOString(),
            }, `Full real-time data for ${clean}`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/realtime/market/news
     * Indian market-wide news
     */
    static async getMarketNews(req, res, next) {
        try {
            const articles = await (0, news_service_1.fetchMarketNews)();
            (0, apiResponse_1.sendSuccess)(res, {
                totalArticles: articles.length,
                articles,
                lastFetched: new Date().toISOString(),
                sources: ['Economic Times', 'Mint', 'Google News'],
            }, `Indian market news (${articles.length} articles)`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/realtime/market/indices
     * Live Nifty 50, Sensex, Bank Nifty
     */
    static async getMarketIndices(req, res, next) {
        try {
            const indexQuotes = await Promise.allSettled(MARKET_INDICES.map(async (idx) => {
                const q = await (0, liveQuote_service_1.fetchLiveQuote)(idx);
                if (!q)
                    return null;
                return {
                    index: idx === '^NSEI' ? 'NIFTY 50' : idx === '^BSESN' ? 'SENSEX' : 'BANK NIFTY',
                    symbol: idx,
                    value: q.price,
                    change: q.change,
                    changePercent: q.changePercent,
                    lastUpdated: q.lastUpdated,
                };
            }));
            const indices = indexQuotes
                .filter((r) => r.status === 'fulfilled' && r.value)
                .map((r) => r.value);
            (0, apiResponse_1.sendSuccess)(res, { indices, lastFetched: new Date().toISOString() }, 'Live market indices', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/realtime/quotes/snapshot
     * All cached in-memory live quotes
     */
    static async getQuoteSnapshot(req, res, next) {
        try {
            const all = (0, liveRefresh_scheduler_1.getAllLatestQuotes)();
            const quotes = Array.from(all.values());
            (0, apiResponse_1.sendSuccess)(res, {
                totalSymbols: quotes.length,
                quotes,
                lastFetched: new Date().toISOString(),
            }, `Snapshot of ${quotes.length} live quotes`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/realtime/refresh
     * Manually trigger a single-symbol quote refresh
     */
    static async triggerRefresh(req, res, next) {
        try {
            const symbol = String(req.body?.symbol || req.query.symbol || '').trim();
            if (!symbol)
                throw new apiResponse_1.AppError('Symbol required in body or query', 400, 'SYMBOL_REQUIRED');
            const clean = symbol.trim().toUpperCase();
            const quote = await (0, liveQuote_service_1.fetchLiveQuote)(clean);
            if (!quote) {
                throw new apiResponse_1.AppError(`Could not refresh quote for ${clean}`, 503, 'REFRESH_FAILED');
            }
            (0, apiResponse_1.sendSuccess)(res, quote, `Quote refreshed for ${clean}`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/realtime/stream/:symbol
     * Server-Sent Events (SSE) live price stream for a symbol
     */
    static async streamQuote(req, res) {
        const { symbol } = req.params;
        const clean = String(symbol || '').trim().toUpperCase();
        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();
        // Send initial quote
        const sendQuote = (q) => {
            const payload = JSON.stringify({ type: 'quote', data: q, ts: new Date().toISOString() });
            res.write(`data: ${payload}\n\n`);
        };
        // Initial state
        const initial = (0, liveRefresh_scheduler_1.getLatestQuote)(clean);
        if (initial)
            sendQuote(initial);
        // Listen for updates from refresh scheduler
        const onUpdate = (quotes) => {
            const found = quotes.find((q) => q.symbol === clean);
            if (found)
                sendQuote(found);
        };
        liveRefresh_scheduler_1.priceEventBus.on('quotes-updated', onUpdate);
        // Heartbeat every 30s to keep connection alive
        const heartbeat = setInterval(() => {
            res.write(`: heartbeat\n\n`);
        }, 30000);
        // Clean up on client disconnect
        req.on('close', () => {
            clearInterval(heartbeat);
            liveRefresh_scheduler_1.priceEventBus.off('quotes-updated', onUpdate);
            res.end();
        });
    }
}
exports.RealTimeController = RealTimeController;
//# sourceMappingURL=realtime.controller.js.map