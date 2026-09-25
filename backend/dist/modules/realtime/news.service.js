"use strict";
/**
 * AssetMind AI — Financial News Service
 *
 * Fetches REAL financial news for Indian and global equities from:
 *   1. Yahoo Finance News RSS feed (per symbol, free, no API key)
 *   2. Google News RSS (fallback, broad coverage)
 *   3. Economic Times Markets RSS
 *   4. MoneyControl RSS
 *
 * Performs keyword-based sentiment scoring and caches results for 5 minutes.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchNewsForSymbol = fetchNewsForSymbol;
exports.fetchMarketNews = fetchMarketNews;
exports.fetchMultiSymbolNews = fetchMultiSymbolNews;
exports.clearNewsCache = clearNewsCache;
const rss_parser_1 = __importDefault(require("rss-parser"));
const parser = new rss_parser_1.default({
    timeout: 8000,
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['media:thumbnail', 'mediaThumbnail'],
            ['enclosure', 'enclosure'],
        ],
    },
});
// ─── News Cache ───────────────────────────────────────────────────────────────
const newsCache = new Map();
const NEWS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
// ─── Sentiment Keywords ───────────────────────────────────────────────────────
const POSITIVE_WORDS = new Set([
    'profit', 'growth', 'surge', 'rally', 'gain', 'record', 'beat', 'strong',
    'rise', 'rises', 'up', 'positive', 'upgrade', 'buy', 'bullish', 'opportunity',
    'acquisition', 'expansion', 'partnership', 'deal', 'dividend', 'buyback',
    'outperform', 'exceed', 'breakthrough', 'launch', 'win', 'award', 'approved',
]);
const NEGATIVE_WORDS = new Set([
    'loss', 'decline', 'fall', 'drop', 'miss', 'cut', 'weak', 'concern',
    'risk', 'fraud', 'probe', 'investigation', 'sell', 'bearish', 'downgrade',
    'debt', 'bankruptcy', 'default', 'lawsuit', 'penalty', 'fine', 'delay',
    'layoff', 'restructure', 'downfall', 'plunge', 'crash', 'slump', 'warning',
]);
function scoreSentiment(text) {
    const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    for (const w of words) {
        if (POSITIVE_WORDS.has(w))
            positiveCount++;
        if (NEGATIVE_WORDS.has(w))
            negativeCount++;
    }
    const score = (positiveCount - negativeCount) / Math.max(words.length, 1);
    if (score > 0.01)
        return { sentiment: 'positive', score };
    if (score < -0.01)
        return { sentiment: 'negative', score };
    return { sentiment: 'neutral', score: 0 };
}
function slugId(url) {
    return Buffer.from(url).toString('base64').slice(0, 24);
}
function extractImageUrl(item) {
    return (item.enclosure?.url ||
        item.mediaContent?.['$']?.url ||
        item.mediaThumbnail?.['$']?.url ||
        undefined);
}
/**
 * Fetch news from Yahoo Finance RSS for a specific symbol
 */
async function fetchYahooNewsRss(symbol) {
    const yahooSym = symbol.endsWith('.NS') || symbol.endsWith('.BO') ? symbol : `${symbol}.NS`;
    try {
        const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(yahooSym)}&region=IN&lang=en-IN`;
        const feed = await parser.parseURL(rssUrl);
        return (feed.items || []).slice(0, 10).map((item) => {
            const title = item.title || '';
            const summary = item.contentSnippet || item.summary || item.content || '';
            const fullText = `${title} ${summary}`;
            const { sentiment, score } = scoreSentiment(fullText);
            return {
                id: slugId(item.link || title),
                title: title.replace(/<[^>]+>/g, '').trim(),
                summary: summary.replace(/<[^>]+>/g, '').trim(),
                url: item.link || '',
                source: 'Yahoo Finance',
                publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
                symbols: [symbol],
                sentiment,
                relevanceScore: Math.abs(score) * 100,
                imageUrl: extractImageUrl(item),
            };
        });
    }
    catch (err) {
        console.warn(`[News] Yahoo RSS failed for ${symbol}: ${err.message}`);
        return [];
    }
}
/**
 * Fetch news from Google News RSS (covers ET, BSE, NSE, Moneycontrol etc.)
 */
async function fetchGoogleNewsRss(query, maxItems = 8) {
    try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' stock India')}&hl=en-IN&gl=IN&ceid=IN:en`;
        const feed = await parser.parseURL(rssUrl);
        return (feed.items || []).slice(0, maxItems).map((item) => {
            const title = item.title || '';
            const summary = item.contentSnippet || '';
            const { sentiment, score } = scoreSentiment(`${title} ${summary}`);
            // Google News source is usually "Source - Google News", extract source
            const sourceParts = title.split(' - ');
            const newsSource = sourceParts.length > 1 ? sourceParts.pop() : 'Google News';
            const cleanTitle = sourceParts.join(' - ');
            return {
                id: slugId(item.link || title),
                title: cleanTitle.replace(/<[^>]+>/g, '').trim() || title,
                summary: summary.replace(/<[^>]+>/g, '').trim(),
                url: item.link || '',
                source: newsSource,
                publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
                symbols: [query.toUpperCase()],
                sentiment,
                relevanceScore: Math.abs(score) * 80,
                imageUrl: extractImageUrl(item),
            };
        });
    }
    catch (err) {
        console.warn(`[News] Google News RSS failed for "${query}": ${err.message}`);
        return [];
    }
}
/**
 * Fetch Economic Times markets RSS
 */
async function fetchETMarketsRss() {
    try {
        const feed = await parser.parseURL('https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms');
        return (feed.items || []).slice(0, 6).map((item) => {
            const title = item.title || '';
            const summary = item.contentSnippet || '';
            const { sentiment, score } = scoreSentiment(`${title} ${summary}`);
            return {
                id: slugId(item.link || title),
                title: title.replace(/<[^>]+>/g, '').trim(),
                summary: summary.replace(/<[^>]+>/g, '').trim(),
                url: item.link || '',
                source: 'Economic Times',
                publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
                symbols: [],
                sentiment,
                relevanceScore: 50 + Math.abs(score) * 50,
                imageUrl: extractImageUrl(item),
            };
        });
    }
    catch (err) {
        console.warn(`[News] ET Markets RSS failed: ${err.message}`);
        return [];
    }
}
/**
 * Fetch Mint Markets RSS
 */
async function fetchMintMarketsRss() {
    try {
        const feed = await parser.parseURL('https://www.livemint.com/rss/markets');
        return (feed.items || []).slice(0, 5).map((item) => {
            const title = item.title || '';
            const summary = item.contentSnippet || '';
            const { sentiment, score } = scoreSentiment(`${title} ${summary}`);
            return {
                id: slugId(item.link || title),
                title: title.replace(/<[^>]+>/g, '').trim(),
                summary: summary.replace(/<[^>]+>/g, '').trim(),
                url: item.link || '',
                source: 'Mint',
                publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
                symbols: [],
                sentiment,
                relevanceScore: 45 + Math.abs(score) * 45,
                imageUrl: extractImageUrl(item),
            };
        });
    }
    catch (err) {
        console.warn(`[News] Mint RSS failed: ${err.message}`);
        return [];
    }
}
/**
 * Deduplicate news articles by URL / ID
 */
function deduplicateNews(articles) {
    const seen = new Set();
    return articles.filter((a) => {
        const key = a.url || a.id;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
/**
 * PUBLIC: Fetch all financial news for a specific stock symbol
 */
async function fetchNewsForSymbol(symbol, companyName) {
    const cleanSym = symbol.trim().toUpperCase();
    const cacheKey = `sym:${cleanSym}`;
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < NEWS_CACHE_TTL_MS) {
        return cached.articles;
    }
    // Company short name for search (e.g., "TCS" → "Tata Consultancy" or "TCS")
    const searchQuery = companyName ? `${cleanSym} ${companyName}` : cleanSym;
    const [yahooNews, googleNews] = await Promise.allSettled([
        fetchYahooNewsRss(cleanSym),
        fetchGoogleNewsRss(searchQuery),
    ]);
    const all = [
        ...(yahooNews.status === 'fulfilled' ? yahooNews.value : []),
        ...(googleNews.status === 'fulfilled' ? googleNews.value : []),
    ];
    const deduped = deduplicateNews(all).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    const result = deduped.slice(0, 15);
    newsCache.set(cacheKey, { articles: result, fetchedAt: Date.now() });
    return result;
}
/**
 * PUBLIC: Fetch broad Indian market news (not symbol-specific)
 */
async function fetchMarketNews() {
    const cacheKey = 'market:india';
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < NEWS_CACHE_TTL_MS) {
        return cached.articles;
    }
    const [etNews, mintNews, googleMarket] = await Promise.allSettled([
        fetchETMarketsRss(),
        fetchMintMarketsRss(),
        fetchGoogleNewsRss('Indian stock market NSE Sensex Nifty'),
    ]);
    const all = [
        ...(etNews.status === 'fulfilled' ? etNews.value : []),
        ...(mintNews.status === 'fulfilled' ? mintNews.value : []),
        ...(googleMarket.status === 'fulfilled' ? googleMarket.value : []),
    ];
    const deduped = deduplicateNews(all).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    const result = deduped.slice(0, 20);
    newsCache.set(cacheKey, { articles: result, fetchedAt: Date.now() });
    return result;
}
/**
 * PUBLIC: Fetch news for multiple symbols (for Explore Home feed)
 */
async function fetchMultiSymbolNews(symbols) {
    const cacheKey = `multi:${symbols.slice(0, 5).join(',')}`;
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < NEWS_CACHE_TTL_MS) {
        return cached.articles;
    }
    // Fetch top 3 symbols in parallel + market news
    const top3 = symbols.slice(0, 3);
    const newsPromises = top3.map((sym) => fetchYahooNewsRss(sym));
    newsPromises.push(fetchGoogleNewsRss('Indian stocks Nifty Sensex investment'));
    const settled = await Promise.allSettled(newsPromises);
    const all = [];
    for (const r of settled) {
        if (r.status === 'fulfilled')
            all.push(...r.value);
    }
    const deduped = deduplicateNews(all).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    const result = deduped.slice(0, 20);
    newsCache.set(cacheKey, { articles: result, fetchedAt: Date.now() });
    return result;
}
/**
 * Clear news cache
 */
function clearNewsCache() {
    newsCache.clear();
}
//# sourceMappingURL=news.service.js.map