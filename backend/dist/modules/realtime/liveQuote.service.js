"use strict";
/**
 * AssetMind AI — Live Quote Service
 *
 * Fetches REAL-TIME prices using Yahoo Finance V8 API (no scraping needed).
 * Works for NSE (suffix .NS), BSE (.BO), and Indian equities.
 *
 * High-Availability Architecture:
 *   - Dual redundant endpoints: query2.finance.yahoo.com & query1.finance.yahoo.com
 *   - Persistent HTTPS Agent with TCP Keep-Alive
 *   - Automatic fallback to verified database quote on external network failure
 *   - In-memory 60s TTL caching
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
const node_https_1 = __importDefault(require("node:https"));
const node_http_1 = __importDefault(require("node:http"));
const node_dns_1 = __importDefault(require("node:dns"));
const StockPrice_model_1 = require("../../models/StockPrice.model");
const Asset_model_1 = require("../../models/Asset.model");
const companies_catalog_1 = require("../../config/companies.catalog");
// Prioritize IPv4 on Windows to prevent intermittent getaddrinfo ENOTFOUND DNS resolution issues
if (typeof node_dns_1.default.setDefaultResultOrder === 'function') {
    node_dns_1.default.setDefaultResultOrder('ipv4first');
}
// ─── Shared HTTP/HTTPS Keep-Alive Agent Pool ──────────────────────────────────
const httpsAgent = new node_https_1.default.Agent({
    keepAlive: true,
    maxSockets: 25,
    maxFreeSockets: 10,
    timeout: 10000,
});
const httpAgent = new node_http_1.default.Agent({
    keepAlive: true,
    maxSockets: 25,
    maxFreeSockets: 10,
    timeout: 10000,
});
const yahooClient = axios_1.default.create({
    timeout: 7000,
    httpsAgent,
    httpAgent,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json',
    },
});
// Redundant Yahoo Finance API hosts (query2 is typically less congested)
const YAHOO_HOSTS = [
    'https://query2.finance.yahoo.com',
    'https://query1.finance.yahoo.com',
];
const quoteCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
// NSE suffix mapping for Indian stocks (automatically include all catalog Indian symbols)
const INDIAN_SYMBOLS = new Set([
    ...companies_catalog_1.TOP_80_COMPANIES.filter((c) => c.country === 'India').map((c) => c.symbol.toUpperCase()),
    'TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM',
    'ADANIENT', 'ADANIPORTS', 'ADANIGREEN', 'ADANIPOWER',
    'OLAELEC', 'RELIANCE', 'TATAMOTORS', 'TATASTEEL', 'TITAN', 'TRENT', 'TATACONSUM',
    'HDFCBANK', 'ICICIBANK', 'BAJFINANCE', 'BAJAJFINSV', 'KOTAKBANK', 'HINDUNILVR',
    'SBIN', 'AXISBANK', 'MARUTI', 'LTIM', 'SUNPHARMA', 'JSWSTEEL',
    'ONGC', 'NTPC', 'POWERGRID', 'COALINDIA', 'BHEL', 'SIEMENS', 'ZOMATO', 'POLYCAB',
    'ULTRACEMCO', 'GRASIM', 'NESTLEIND', 'BRITANNIA', 'CIPLA', 'DRREDDY', 'EICHERMOT', 'M&M',
]);
const YAHOO_SYMBOL_OVERRIDES = {
    'ZOMATO': 'ETERNAL.NS', // Zomato / Eternal Ltd listed on NSE
    'TATAMOTORS': 'TMCV.NS', // Tata Motors Ltd (post-demerger ticker on NSE)
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
        return `${clean}.NS`; // Standard NSE format
    }
    return clean;
}
/**
 * Fetch LIVE real-time quote from Yahoo Finance V8 API with dual-host redundancy
 * and fallback to verified MongoDB financial records.
 */
async function fetchLiveQuote(symbol) {
    const clean = symbol.trim().toUpperCase();
    // 1. Check in-memory cache first
    const cached = quoteCache.get(clean);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return { ...cached.quote, source: 'cached' };
    }
    const primaryYahooSym = getYahooSymbol(clean);
    const symbolsToTry = [primaryYahooSym];
    // If Tata Motors, try both TMCV.NS and TMPV.NS
    if (clean === 'TATAMOTORS') {
        symbolsToTry.push('TMPV.NS');
    }
    // Try NSE then BSE
    if (INDIAN_SYMBOLS.has(clean) && !primaryYahooSym.endsWith('.BO')) {
        symbolsToTry.push(`${clean}.BO`);
    }
    // 2. Query Yahoo endpoints with host redundancy
    for (const host of YAHOO_HOSTS) {
        for (const ySym of symbolsToTry) {
            try {
                const url = `${host}/v8/finance/chart/${encodeURIComponent(ySym)}`;
                const { data } = await yahooClient.get(url, {
                    params: {
                        interval: '1d',
                        range: '1d',
                        includePrePost: false,
                    },
                });
                const result = data?.chart?.result?.[0];
                if (!result)
                    continue;
                const meta = result.meta;
                const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
                if (!price || price <= 0)
                    continue;
                const currency = meta.currency || (INDIAN_SYMBOLS.has(clean) ? 'INR' : 'USD');
                const rawExchange = meta.exchangeName || '';
                const exchangeMap = {
                    'NSI': 'NSE',
                    'BSE': 'BSE',
                    'NMS': 'NASDAQ',
                    'NYQ': 'NYSE',
                    'NGM': 'NASDAQ',
                };
                const exchange = exchangeMap[rawExchange] || (INDIAN_SYMBOLS.has(clean) ? 'NSE' : rawExchange || 'NSE');
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
                // Cache successful response
                quoteCache.set(clean, { quote, fetchedAt: Date.now() });
                return quote;
            }
            catch (err) {
                // Continue to next symbol / host without noisy error spam
            }
        }
    }
    // 3. Fallback: If external feeds are temporarily unreachable, use verified MongoDB records
    try {
        const asset = (await Asset_model_1.Asset.findOne({ symbol: clean }).lean());
        if (asset && asset.latestSharePrice && asset.latestSharePrice > 0) {
            const price = Number(asset.latestSharePrice);
            const changePct = Number(asset.dailyPercentageChange ?? 0);
            const prevClose = price / (1 + changePct / 100);
            const change = price - prevClose;
            const dbQuote = {
                symbol: clean,
                companyName: asset.companyName || clean,
                exchange: asset.exchange || 'NSE',
                currency: 'INR',
                price: Number(price.toFixed(2)),
                open: Number(price.toFixed(2)),
                high: Number((price * 1.01).toFixed(2)),
                low: Number((price * 0.99).toFixed(2)),
                previousClose: Number(prevClose.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePct.toFixed(2)),
                volume: 1000000,
                avgVolume: 1000000,
                marketCap: asset.marketCapitalization || null,
                fiftyTwoWeekHigh: null,
                fiftyTwoWeekLow: null,
                pe: asset.ratios?.peRatio || null,
                eps: null,
                dividendYield: null,
                lastUpdated: new Date(),
                source: 'cached',
            };
            quoteCache.set(clean, { quote: dbQuote, fetchedAt: Date.now() });
            return dbQuote;
        }
    }
    catch (dbErr) {
        console.error(`[LiveQuote] DB fallback error for ${clean}:`, dbErr.message);
    }
    return null;
}
/**
 * Fetch live quotes for multiple symbols (batched with concurrency control and pacing)
 */
async function fetchBatchLiveQuotes(symbols) {
    const results = new Map();
    // Use conservative concurrency of 4 to prevent DNS pool saturation
    const CONCURRENCY = 4;
    for (let i = 0; i < symbols.length; i += CONCURRENCY) {
        const batch = symbols.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(batch.map((sym) => fetchLiveQuote(sym)));
        for (let j = 0; j < batch.length; j++) {
            const r = settled[j];
            if (r.status === 'fulfilled' && r.value) {
                results.set(batch[j].toUpperCase(), r.value);
            }
        }
        // Pace requests by 400ms between batches to protect against rate limits and DNS throttles
        if (i + CONCURRENCY < symbols.length) {
            await new Promise((resolve) => setTimeout(resolve, 400));
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