"use strict";
/**
 * AssetMind AI — Live Quote Service
 *
 * Fetches REAL-TIME prices using Yahoo Finance V8 API (no scraping needed).
 * Works for NSE (suffix .NS), BSE (.BO), and global symbols.
 *
 * API endpoint: https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}
 * Rate limits: ~2000 req/hour unauthenticated. We use in-memory cache to stay safe.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLiveQuote = fetchLiveQuote;
exports.fetchBatchLiveQuotes = fetchBatchLiveQuotes;
exports.persistLiveQuote = persistLiveQuote;
exports.clearQuoteCache = clearQuoteCache;
exports.getCachedQuotes = getCachedQuotes;
const axios_1 = __importDefault(require("axios"));
const StockPrice_model_1 = require("../../models/StockPrice.model");
const Asset_model_1 = require("../../models/Asset.model");
const companies_catalog_1 = require("../../config/companies.catalog");
const quoteCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds — refresh every 1 min max
// NSE suffix mapping for Indian stocks (automatically include all catalog Indian symbols)
const INDIAN_SYMBOLS = new Set([
    ...companies_catalog_1.TOP_80_COMPANIES.filter((c) => c.country === 'India').map((c) => c.symbol.toUpperCase()),
    'TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM',
    'ADANIENT', 'ADANIPORTS', 'ADANIGREEN', 'ADANIPOWER',
    'OLAELEC', 'RELIANCE', 'TATAMOTORS', 'TATASTEEL', 'TITAN', 'TRENT', 'TATACONSUM',
    'HDFCBANK', 'ICICIBANK', 'BAJFINANCE', 'BAJAJFINSV', 'KOTAKBANK', 'HINDUNILVR',
    'SBIN', 'AXISBANK', 'MARUTI', 'LTIM', 'SUNPHARMA', 'JSWSTEEL',
    'ONGC', 'NTPC', 'POWERGRID', 'COALINDIA', 'BHEL', 'SIEMENS', 'ZOMATO', 'POLYCAB',
]);
const YAHOO_SYMBOL_OVERRIDES = {
    'TATAMOTORS': 'TMPV.NS', // Tata Motors Passenger Vehicles
    'ZOMATO': 'ETERNAL.NS', // Zomato / Eternal Ltd
};
function getYahooSymbol(symbol) {
    const clean = symbol.trim().toUpperCase();
    if (YAHOO_SYMBOL_OVERRIDES[clean]) {
        return YAHOO_SYMBOL_OVERRIDES[clean];
    }
    if (clean.endsWith('.NS') || clean.endsWith('.BO')) {
        return clean;
    }
    if (INDIAN_SYMBOLS.has(clean)) {
        return `${clean}.NS`; // NSE format
    }
    return clean;
}
/**
 * Fetch LIVE real-time quote from Yahoo Finance V8 API
 */
async function fetchLiveQuote(symbol) {
    const clean = symbol.trim().toUpperCase();
    // Check cache first
    const cached = quoteCache.get(clean);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return { ...cached.quote, source: 'cached' };
    }
    const yahooSym = getYahooSymbol(clean);
    try {
        // Yahoo Finance V8 Chart API — free, no auth required, real-time
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}`;
        const { data } = await axios_1.default.get(url, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AssetMindBot/2.0)',
                Accept: 'application/json',
            },
            params: {
                interval: '1d',
                range: '1d',
                includePrePost: false,
            },
        });
        const result = data?.chart?.result?.[0];
        if (!result) {
            console.warn(`[LiveQuote] No result from Yahoo V8 for ${yahooSym}`);
            return null;
        }
        const meta = result.meta;
        const currency = meta.currency || (INDIAN_SYMBOLS.has(clean) ? 'INR' : 'USD');
        const exchange = meta.exchangeName || (INDIAN_SYMBOLS.has(clean) ? 'NSE' : 'NASDAQ');
        const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
        const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change = price - previousClose;
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
        const quote = {
            symbol: clean,
            companyName: meta.longName || meta.shortName || clean,
            exchange,
            currency,
            price: Number(price.toFixed(2)),
            open: Number((meta.regularMarketOpen ?? price).toFixed(2)),
            high: Number((meta.regularMarketDayHigh ?? price).toFixed(2)),
            low: Number((meta.regularMarketDayLow ?? price).toFixed(2)),
            previousClose: Number(previousClose.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            volume: meta.regularMarketVolume ?? 0,
            avgVolume: meta.averageDailyVolume10Day ?? 0,
            marketCap: meta.marketCap ?? null,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
            pe: meta.trailingPE ?? null,
            eps: meta.epsTrailingTwelveMonths ?? null,
            dividendYield: meta.dividendYield ? meta.dividendYield * 100 : null,
            lastUpdated: new Date(),
            source: 'yahoo-finance-v8',
        };
        // Save to cache
        quoteCache.set(clean, { quote, fetchedAt: Date.now() });
        console.log(`[LiveQuote] ✅ ${clean}: ₹${price} (${changePercent.toFixed(2)}%)`);
        return quote;
    }
    catch (err) {
        console.error(`[LiveQuote] ⚠️ Failed to fetch ${yahooSym}: ${err.message}`);
        // Try alternate suffix .BO (BSE) as fallback for Indian stocks
        if (INDIAN_SYMBOLS.has(clean) && yahooSym.endsWith('.NS')) {
            try {
                const bseUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${clean}.BO`;
                const { data } = await axios_1.default.get(bseUrl, {
                    timeout: 8000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AssetMindBot/2.0)' },
                    params: { interval: '1d', range: '1d' },
                });
                const res = data?.chart?.result?.[0];
                if (res) {
                    const m = res.meta;
                    const p = m.regularMarketPrice ?? 0;
                    const pc = m.chartPreviousClose ?? p;
                    const ch = p - pc;
                    const chPct = pc > 0 ? (ch / pc) * 100 : 0;
                    const fallbackQuote = {
                        symbol: clean,
                        companyName: m.longName || m.shortName || clean,
                        exchange: 'BSE',
                        currency: 'INR',
                        price: Number(p.toFixed(2)),
                        open: Number((m.regularMarketOpen ?? p).toFixed(2)),
                        high: Number((m.regularMarketDayHigh ?? p).toFixed(2)),
                        low: Number((m.regularMarketDayLow ?? p).toFixed(2)),
                        previousClose: Number(pc.toFixed(2)),
                        change: Number(ch.toFixed(2)),
                        changePercent: Number(chPct.toFixed(2)),
                        volume: m.regularMarketVolume ?? 0,
                        avgVolume: m.averageDailyVolume10Day ?? 0,
                        marketCap: m.marketCap ?? null,
                        fiftyTwoWeekHigh: m.fiftyTwoWeekHigh ?? null,
                        fiftyTwoWeekLow: m.fiftyTwoWeekLow ?? null,
                        pe: m.trailingPE ?? null,
                        eps: m.epsTrailingTwelveMonths ?? null,
                        dividendYield: m.dividendYield ? m.dividendYield * 100 : null,
                        lastUpdated: new Date(),
                        source: 'yahoo-finance-v8',
                    };
                    quoteCache.set(clean, { quote: fallbackQuote, fetchedAt: Date.now() });
                    return fallbackQuote;
                }
            }
            catch {
                // BSE also failed
            }
        }
        return null;
    }
}
/**
 * Fetch live quotes for multiple symbols (batched)
 */
async function fetchBatchLiveQuotes(symbols) {
    const results = new Map();
    // Run in parallel with concurrency limit of 5
    const CONCURRENCY = 5;
    for (let i = 0; i < symbols.length; i += CONCURRENCY) {
        const batch = symbols.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(batch.map(fetchLiveQuote));
        for (let j = 0; j < batch.length; j++) {
            const r = settled[j];
            if (r.status === 'fulfilled' && r.value) {
                results.set(batch[j].toUpperCase(), r.value);
            }
        }
        // Throttle between batches to avoid rate limits
        if (i + CONCURRENCY < symbols.length) {
            await new Promise((r) => setTimeout(r, 300));
        }
    }
    return results;
}
/**
 * Persist live quote to MongoDB StockPrice collection
 */
async function persistLiveQuote(quote) {
    try {
        const asset = await Asset_model_1.Asset.findOne({ symbol: quote.symbol }).lean();
        if (!asset)
            return;
        await StockPrice_model_1.StockPrice.findOneAndUpdate({
            assetId: asset._id,
            symbol: quote.symbol,
            priceTimestamp: { $gte: new Date(Date.now() - 60 * 1000) }, // upsert within last minute
        }, {
            $set: {
                assetId: asset._id,
                symbol: quote.symbol,
                price: quote.price,
                currency: quote.currency,
                change: quote.change,
                changePercent: quote.changePercent,
                open: quote.open,
                high: quote.high,
                low: quote.low,
                volume: quote.volume,
                previousClose: quote.previousClose,
                source: quote.source,
                priceTimestamp: quote.lastUpdated,
            },
        }, { upsert: true });
    }
    catch (err) {
        console.error(`[LiveQuote] Persist error for ${quote.symbol}:`, err.message);
    }
}
/**
 * Clear the in-memory quote cache
 */
function clearQuoteCache() {
    quoteCache.clear();
}
/**
 * Get all cached quotes
 */
function getCachedQuotes() {
    const out = new Map();
    for (const [sym, entry] of quoteCache.entries()) {
        out.set(sym, entry.quote);
    }
    return out;
}
//# sourceMappingURL=liveQuote.service.js.map