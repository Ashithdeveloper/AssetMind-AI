"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketScreenerAdapter = void 0;
const cheerio = __importStar(require("cheerio"));
const base_adapter_1 = require("./base.adapter");
/**
 * MarketScreener uses its own ID-based URL format.
 * For common stocks we have the known URL slugs.
 */
const MARKETSCREENER_SLUG = {
    'AAPL': 'APPLE-INC-4849',
    'MSFT': 'MICROSOFT-CORPORATION-4835',
    'GOOGL': 'ALPHABET-INC-24203026',
    'AMZN': 'AMAZON-COM-INC-6435',
    'NVDA': 'NVIDIA-CORPORATION-5765',
    'META': 'META-PLATFORMS-INC-43082543',
    'TSLA': 'TESLA-INC-6344549',
    'JPM': 'JPMORGAN-CHASE-CO-4833',
    'V': 'VISA-INC-6495',
    'WMT': 'WALMART-INC-4831',
    'RELIANCE': 'RELIANCE-INDUSTRIES-LTD-9064637',
    'TCS': 'TATA-CONSULTANCY-SERVICES-9058945',
    'INFY': 'INFOSYS-LIMITED-9058972',
};
class MarketScreenerAdapter extends base_adapter_1.BaseAdapter {
    id = 'marketscreener';
    name = 'MarketScreener';
    baseUrl = 'https://www.marketscreener.com';
    supportedMetrics = [
        'marketCap',
        'peRatio',
        'yield',
        'netIncome',
        'revenue',
        'operatingIncome',
        'eps',
        'freeCashFlow',
    ];
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            baseUrl: this.baseUrl,
            supportedMetrics: this.supportedMetrics,
            supportedScrapers: ['playwright', 'scrapingbee'],
            description: 'Global equity quotes, valuation consensus, financial analysis, and company profile.',
        };
    }
    buildUrl(symbol) {
        const upper = symbol.trim().toUpperCase();
        const slug = MARKETSCREENER_SLUG[upper];
        if (slug) {
            return `https://www.marketscreener.com/quote/stock/${slug}/`;
        }
        // Fallback: use search page to find the stock
        return `https://www.marketscreener.com/search/?q=${encodeURIComponent(upper)}`;
    }
    getWaitForSelector() {
        return '.price, table, h1, .fsp-price';
    }
    async extractData(html, symbol, sourceUrl, scraperProvider) {
        const $ = cheerio.load(html);
        const cleanSym = symbol.trim().toUpperCase();
        // Check for bot block
        const titleText = $('title').text().toLowerCase();
        if (titleText.includes('moment') || titleText.includes('blocked')) {
            return {
                symbol: cleanSym,
                source: this.id,
                sourceUrl,
                scraperProvider,
                collectedAt: new Date(),
                companyInfo: { symbol: cleanSym, companyName: cleanSym },
                financialMetrics: [],
                rawMetadata: { error: 'BOT_BLOCKED' },
            };
        }
        const companyName = $('h1').first().text().replace(/\s+/g, ' ').trim() || cleanSym;
        let currentPrice;
        const priceText = $('.fsp-price, .elem_quot, [data-field="price"], .text-3xl').first().text().trim();
        if (priceText) {
            const parsed = this.parseNumericValue(priceText);
            if (parsed)
                currentPrice = parsed.value;
        }
        const metrics = [];
        const metricMapping = {
            'Capitalization': 'marketCap',
            'Market Cap': 'marketCap',
            'P/E ratio': 'peRatio',
            'PER': 'peRatio',
            'Yield': 'dividendYield',
            'Net Debt': 'netDebt',
            'EPS': 'eps',
            'Sales': 'revenue',
            'Operating Income': 'operatingIncome',
            'Net Income': 'netIncome',
        };
        $('table tr').each((_, row) => {
            const tds = $(row).find('td, th');
            if (tds.length < 2)
                return;
            const label = $(tds[0]).text().trim();
            const val = $(tds[tds.length - 1]).text().trim();
            if (!label || !val || label === val)
                return;
            for (const [key, metricKey] of Object.entries(metricMapping)) {
                if (label.toLowerCase().includes(key.toLowerCase())) {
                    const m = this.createMetric(metricKey, val, 'USD', 'TTM');
                    if (m && !metrics.find((x) => x.metricName === metricKey)) {
                        metrics.push(m);
                    }
                    break;
                }
            }
        });
        return {
            symbol: cleanSym,
            source: this.id,
            sourceUrl,
            scraperProvider,
            collectedAt: new Date(),
            companyInfo: {
                symbol: cleanSym,
                companyName,
            },
            stockPrice: currentPrice
                ? {
                    price: currentPrice,
                    currency: 'USD',
                    priceTimestamp: new Date(),
                }
                : undefined,
            financialMetrics: metrics,
        };
    }
}
exports.MarketScreenerAdapter = MarketScreenerAdapter;
//# sourceMappingURL=marketScreener.adapter.js.map