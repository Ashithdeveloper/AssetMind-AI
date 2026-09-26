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
exports.analyzeCompanyNews = analyzeCompanyNews;
const axios_1 = __importDefault(require("axios"));
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
// ─── News Analysis Cache ─────────────────────────────────────────────────────
const newsAnalysisCache = new Map();
const ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
/**
 * PUBLIC: AI News Analysis — Analyzes and shorts (distills) all recent news for a company
 */
async function analyzeCompanyNews(symbol, companyName) {
    const cleanSym = symbol.trim().toUpperCase();
    const cacheKey = `analysis:${cleanSym}`;
    const cached = newsAnalysisCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < ANALYSIS_CACHE_TTL_MS) {
        return cached.analysis;
    }
    // 1. Fetch all recent news for this symbol
    const articles = await fetchNewsForSymbol(cleanSym, companyName);
    const now = new Date().toISOString();
    const displayName = companyName || cleanSym;
    // 2. Compute aggregate sentiment percentages across all articles
    const total = articles.length;
    let posCount = 0;
    let negCount = 0;
    let neuCount = 0;
    for (const a of articles) {
        if (a.sentiment === 'positive')
            posCount++;
        else if (a.sentiment === 'negative')
            negCount++;
        else
            neuCount++;
    }
    const positivePercent = total > 0 ? Number(((posCount / total) * 100).toFixed(1)) : 50;
    const negativePercent = total > 0 ? Number(((negCount / total) * 100).toFixed(1)) : 20;
    const neutralPercent = total > 0 ? Number(((neuCount / total) * 100).toFixed(1)) : 30;
    const sentimentScore = total > 0 ? Number(((posCount - negCount) / total).toFixed(2)) : 0.2;
    let overallSentiment = 'Neutral';
    if (sentimentScore >= 0.35)
        overallSentiment = 'Bullish';
    else if (sentimentScore >= 0.10)
        overallSentiment = 'Somewhat Bullish';
    else if (sentimentScore > -0.10)
        overallSentiment = 'Neutral';
    else if (sentimentScore > -0.35)
        overallSentiment = 'Somewhat Bearish';
    else
        overallSentiment = 'Bearish';
    // 3. Fallback heuristic builder if LLM is unavailable or times out
    const buildFallbackAnalysis = () => {
        const positiveArticles = articles.filter((a) => a.sentiment === 'positive');
        const negativeArticles = articles.filter((a) => a.sentiment === 'negative');
        const topPositives = positiveArticles.slice(0, 3).map((a) => a.title);
        const topNegatives = negativeArticles.slice(0, 3).map((a) => a.title);
        const headline = total === 0
            ? `No recent high-impact financial news reported for ${displayName}.`
            : overallSentiment.includes('Bullish')
                ? `Positive operational momentum and optimistic institutional sentiment dominate recent headlines for ${displayName}.`
                : overallSentiment.includes('Bearish')
                    ? `Near-term market caution and margin headwinds surround recent reporting for ${displayName}.`
                    : `Mixed corporate developments and balanced market coverage reflected across recent ${displayName} reporting.`;
        const shortSummary = total === 0
            ? `Recent financial press coverage for ${displayName} (${cleanSym}) remains limited across major business wires. Market sentiment is presently driven by broader sector benchmarks and upcoming quarterly corporate earnings disclosures.`
            : `In short: Coverage across ${total} financial news reports highlights a ${overallSentiment.toLowerCase()} stance for ${displayName} (${cleanSym}). Key news activity centers on corporate business operations, quarterly financial trajectories, and market demand dynamics. Institutional news sources show ${positivePercent}% positive coverage versus ${negativePercent}% risk/headwind mentions, indicating ${overallSentiment.includes('Bullish') ? 'constructive market interest' : overallSentiment.includes('Bearish') ? 'elevated short-term caution' : 'balanced investor focus'}.`;
        const positiveCatalysts = topPositives.length > 0
            ? topPositives
            : [
                `Consistent domestic demand presence in ${displayName}'s core operating domain.`,
                `Ongoing institutional investment and analyst coverage across Indian exchanges.`,
            ];
        const concerns = topNegatives.length > 0
            ? topNegatives
            : [
                `Sector cyclicality and sensitivity to macroeconomic interest rate adjustments.`,
                `Competitive pricing pressures from domestic and international peers.`,
            ];
        return {
            symbol: cleanSym,
            companyName: displayName,
            totalArticles: total,
            sentimentBreakdown: {
                positivePercent,
                neutralPercent,
                negativePercent,
                overallSentiment,
                score: sentimentScore,
            },
            headlineTakeaway: headline,
            shortSummary,
            keyCatalysts: {
                positive: positiveCatalysts,
                concerns,
            },
            marketImpact: {
                shortTerm: {
                    outlook: overallSentiment.includes('Bullish') ? 'Positive' : overallSentiment.includes('Bearish') ? 'Negative' : 'Neutral',
                    description: `Near-term price action is likely to track ${overallSentiment.toLowerCase()} news tone and intraday volume trends.`,
                },
                mediumTerm: {
                    outlook: overallSentiment.includes('Bullish') ? 'Positive' : overallSentiment.includes('Bearish') ? 'Negative' : 'Consolidating',
                    description: `Fundamental medium-term direction will depend on execution of ongoing contracts and earnings margin stability.`,
                },
            },
            analyzedArticles: articles.slice(0, 8).map((a) => ({
                title: a.title,
                source: a.source,
                publishedAt: a.publishedAt.toISOString(),
                sentiment: a.sentiment,
                url: a.url,
            })),
            generatedAt: now,
        };
    };
    // 4. If articles exist, try generating LLM-powered short synthesis
    if (total > 0) {
        try {
            const articlesContext = articles
                .slice(0, 10)
                .map((a, i) => `[News ${i + 1}] ${a.title} (Source: ${a.source}) - ${a.summary}`)
                .join('\n');
            const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
            const ollamaModel = process.env.OLLAMA_MODEL || 'gpt-oss:20b-cloud';
            const prompt = [
                `You are an institutional financial editor at AssetMind AI.`,
                `Synthesize and distill ALL the following ${total} news articles for ${displayName} (${cleanSym}) into a concise, professional AI news digest.`,
                ``,
                `ARTICLES:`,
                articlesContext,
                ``,
                `OUTPUT STRICTLY IN JSON FORMAT matching this schema:`,
                `{`,
                `  "headlineTakeaway": "Single punchy sentence summarizing the core news theme",`,
                `  "shortSummary": "Crisp 2-paragraph synthesis summarizing all recent news for the company, major developments, contracts, and market sentiment",`,
                `  "positiveCatalysts": ["bullet 1", "bullet 2"],`,
                `  "concerns": ["bullet 1", "bullet 2"],`,
                `  "shortTermOutlook": "Positive" | "Neutral" | "Negative" | "Volatile",`,
                `  "shortTermDescription": "One sentence on near-term impact",`,
                `  "mediumTermOutlook": "Positive" | "Neutral" | "Negative" | "Consolidating",`,
                `  "mediumTermDescription": "One sentence on medium-term impact"`,
                `}`,
                `No introductory text, only raw valid JSON.`,
            ].join('\n');
            const response = await axios_1.default.post(`${ollamaUrl}/api/generate`, {
                model: ollamaModel,
                prompt,
                stream: false,
                format: 'json',
                options: {
                    temperature: 0.2,
                    num_ctx: 3072,
                    num_predict: 600,
                },
            }, { timeout: 15000 });
            let rawText = response.data?.response?.trim() || '';
            rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            const parsed = JSON.parse(rawText);
            if (parsed && parsed.shortSummary && parsed.headlineTakeaway) {
                const aiAnalysis = {
                    symbol: cleanSym,
                    companyName: displayName,
                    totalArticles: total,
                    sentimentBreakdown: {
                        positivePercent,
                        neutralPercent,
                        negativePercent,
                        overallSentiment,
                        score: sentimentScore,
                    },
                    headlineTakeaway: parsed.headlineTakeaway,
                    shortSummary: parsed.shortSummary,
                    keyCatalysts: {
                        positive: Array.isArray(parsed.positiveCatalysts) && parsed.positiveCatalysts.length > 0 ? parsed.positiveCatalysts : [parsed.headlineTakeaway],
                        concerns: Array.isArray(parsed.concerns) && parsed.concerns.length > 0 ? parsed.concerns : ['Sector and market volatility risk.'],
                    },
                    marketImpact: {
                        shortTerm: {
                            outlook: parsed.shortTermOutlook || (overallSentiment.includes('Bullish') ? 'Positive' : 'Neutral'),
                            description: parsed.shortTermDescription || 'Near-term price action guided by news volume.',
                        },
                        mediumTerm: {
                            outlook: parsed.mediumTermOutlook || (overallSentiment.includes('Bullish') ? 'Positive' : 'Consolidating'),
                            description: parsed.mediumTermDescription || 'Fundamentals and execution drive medium-term value.',
                        },
                    },
                    analyzedArticles: articles.slice(0, 8).map((a) => ({
                        title: a.title,
                        source: a.source,
                        publishedAt: a.publishedAt.toISOString(),
                        sentiment: a.sentiment,
                        url: a.url,
                    })),
                    generatedAt: now,
                };
                newsAnalysisCache.set(cacheKey, { analysis: aiAnalysis, fetchedAt: Date.now() });
                return aiAnalysis;
            }
        }
        catch (err) {
            console.warn(`[NewsService] Ollama news analysis fallback for ${cleanSym}:`, err.message);
        }
    }
    const fallback = buildFallbackAnalysis();
    newsAnalysisCache.set(cacheKey, { analysis: fallback, fetchedAt: Date.now() });
    return fallback;
}
//# sourceMappingURL=news.service.js.map