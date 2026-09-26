"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenerService = void 0;
const axios_1 = __importDefault(require("axios"));
const Asset_model_1 = require("../../models/Asset.model");
const FinancialMetrics_model_1 = require("../../models/FinancialMetrics.model");
const StockPrice_model_1 = require("../../models/StockPrice.model");
const screenerExtraction_service_1 = require("../scraping/services/screenerExtraction.service");
const liveQuote_service_1 = require("../realtime/liveQuote.service");
const apiResponse_1 = require("../../utils/apiResponse");
class ScreenerService {
    static SCREENER_SEARCH_URL = 'https://www.screener.in/api/company/search/';
    /**
     * Search Screener.in live by company name or stock symbol,
     * cross-referencing with local MongoDB to indicate whether it has been scraped.
     */
    static async searchScreener(query) {
        const cleanQuery = query.trim();
        if (!cleanQuery) {
            return {
                query: '',
                total: 0,
                source: 'Screener.in Live API',
                results: [],
            };
        }
        let items = [];
        try {
            const response = await axios_1.default.get(this.SCREENER_SEARCH_URL, {
                params: { q: cleanQuery },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    Accept: 'application/json',
                },
                timeout: 10000,
            });
            if (Array.isArray(response.data)) {
                items = response.data;
            }
        }
        catch (err) {
            console.warn(`[ScreenerService] Screener.in live search failed for "${cleanQuery}":`, err.message);
        }
        // Process and enrich each search item
        const results = await Promise.all(items.map(async (item) => {
            // Extract symbol/slug from url: /company/SUZLON/consolidated/ or /company/SUZLON/
            const match = item.url.match(/\/company\/([^/]+)/i);
            const slug = match ? match[1].toUpperCase() : item.name.toUpperCase();
            const cleanSymbol = slug.replace(/\.NS$|\.BO$/i, '');
            // Check if exists in MongoDB
            const asset = await Asset_model_1.Asset.findOne({
                $or: [
                    { symbol: cleanSymbol },
                    { nseSymbol: cleanSymbol },
                    { bseCode: cleanSymbol },
                ],
            }).lean();
            if (asset) {
                // In database: enrich with metrics and price
                const latestPriceDoc = await StockPrice_model_1.StockPrice.findOne({ assetId: asset._id })
                    .sort({ priceTimestamp: -1 })
                    .lean();
                const fm = await FinancialMetrics_model_1.FinancialMetrics.findOne({ symbol: cleanSymbol }).lean();
                return {
                    id: item.id,
                    name: asset.companyName || item.name,
                    symbol: asset.symbol,
                    slug,
                    url: item.url,
                    isScraped: true,
                    marketCap: asset.marketCapitalization || null,
                    latestPrice: latestPriceDoc?.price ?? asset.currentPrice ?? null,
                    changePercent: latestPriceDoc?.changePercent ?? null,
                    sector: asset.sector || null,
                    pe: fm?.valuation?.peRatio?.value ?? null,
                    bseCode: asset.bseCode || null,
                    nseSymbol: asset.nseSymbol || asset.symbol,
                };
            }
            // Not yet scraped into database
            return {
                id: item.id,
                name: item.name,
                symbol: cleanSymbol,
                slug,
                url: item.url,
                isScraped: false,
                marketCap: null,
                latestPrice: null,
                changePercent: null,
                sector: null,
                pe: null,
                bseCode: null,
                nseSymbol: cleanSymbol,
            };
        }));
        return {
            query: cleanQuery,
            total: results.length,
            source: 'Screener.in Live API',
            results,
        };
    }
    /**
     * Scrape a company on-demand from Screener.in using its slug or symbol,
     * persist statements & metrics to DB, and return formatted analysis overview.
     */
    static async scrapeAndGetCompany(slugOrSymbol, force = false) {
        const cleanSym = slugOrSymbol.trim().toUpperCase().replace(/\.NS$|\.BO$/i, '');
        if (!cleanSym) {
            throw new apiResponse_1.AppError('Company symbol or slug is required', 400, 'INVALID_INPUT');
        }
        // Perform live scrape
        const scrapedData = await screenerExtraction_service_1.ScreenerExtractionService.scrapeCompany(cleanSym, { force });
        // Retrieve saved Asset document
        const asset = await Asset_model_1.Asset.findOne({ symbol: cleanSym }).lean();
        if (!asset) {
            throw new apiResponse_1.AppError(`Failed to save or find scraped asset for ${cleanSym}`, 500, 'SCRAPE_SAVE_FAILED');
        }
        // Try fetching live quote for fresh market info
        let liveQuote = null;
        try {
            liveQuote = await (0, liveQuote_service_1.fetchLiveQuote)(cleanSym);
        }
        catch {
            // Non-blocking
        }
        const metrics = await FinancialMetrics_model_1.FinancialMetrics.findOne({ symbol: cleanSym }).lean();
        return {
            message: `Successfully scraped ${asset.companyName} from Screener.in`,
            company: {
                id: asset._id.toString(),
                companyName: asset.companyName,
                symbol: asset.symbol,
                nseSymbol: asset.nseSymbol || asset.symbol,
                bseCode: asset.bseCode,
                exchange: asset.exchange || 'NSE',
                country: 'India',
                sector: asset.sector || 'General',
                industry: asset.industry || 'General',
                website: asset.website,
                description: asset.description,
                marketCap: asset.marketCapitalization ?? (liveQuote?.marketCap ? Math.round(liveQuote.marketCap / 1e7) : scrapedData.marketCapCr),
                latestPrice: liveQuote?.price ?? scrapedData.currentPrice ?? asset.currentPrice ?? null,
                changePercent: liveQuote?.changePercent ?? null,
                pe: metrics?.valuation?.peRatio?.value ?? scrapedData.metrics?.peRatio ?? null,
                roe: metrics?.roe?.value ?? scrapedData.metrics?.roe ?? null,
                roce: scrapedData.metrics?.roce ?? null,
                bookValue: scrapedData.metrics?.bookValue ?? null,
                dividendYield: scrapedData.metrics?.dividendYield ?? null,
                source: 'Screener.in (Audited Financials)',
                scrapedAt: new Date().toISOString(),
            },
        };
    }
}
exports.ScreenerService = ScreenerService;
//# sourceMappingURL=screener.service.js.map