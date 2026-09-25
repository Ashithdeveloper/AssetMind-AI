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
exports.MorningstarAdapter = void 0;
const cheerio = __importStar(require("cheerio"));
const base_adapter_1 = require("./base.adapter");
class MorningstarAdapter extends base_adapter_1.BaseAdapter {
    id = 'morningstar';
    name = 'Morningstar';
    baseUrl = 'https://www.morningstar.com';
    supportedMetrics = [
        'marketCap',
        'peRatio',
        'forwardPe',
        'priceToBook',
        'priceToSales',
        'dividendYield',
        'fairValueEstimate',
    ];
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            baseUrl: this.baseUrl,
            supportedMetrics: this.supportedMetrics,
            supportedScrapers: ['playwright', 'scrapingbee'],
            description: 'Morningstar quantitative analysis, valuation ratios, price to book/sales, and fair value estimates.',
        };
    }
    buildUrl(symbol) {
        const cleanSym = symbol.trim().toLowerCase();
        // Default to NASDAQ or NYSE format
        return `https://www.morningstar.com/stocks/xnas/${cleanSym}/quote`;
    }
    getWaitForSelector() {
        return '.mdc-security-header, [data-testid="last-price"], .sal-component-quote';
    }
    async extractData(html, symbol, sourceUrl, scraperProvider) {
        const $ = cheerio.load(html);
        const cleanSym = symbol.trim().toUpperCase();
        let companyName = $('h1, .mdc-security-header__name').first().text().trim() || cleanSym;
        let currentPrice;
        const priceText = $('[data-testid="last-price"], .mdc-security-header__price, .sal-dp-value').first().text().trim();
        if (priceText) {
            const parsed = this.parseNumericValue(priceText);
            if (parsed)
                currentPrice = parsed.value;
        }
        const metrics = [];
        const metricMapping = {
            'Market Cap': 'marketCap',
            'Price/Earnings': 'peRatio',
            'Forward P/E': 'forwardPe',
            'Price/Book': 'priceToBook',
            'Price/Sales': 'priceToSales',
            'Dividend Yield': 'dividendYield',
            'Fair Value': 'fairValueEstimate',
        };
        $('tr, div.dp-pair').each((_, elem) => {
            const label = $(elem).find('.dp-label, th, td').first().text().trim();
            const val = $(elem).find('.dp-value, td').last().text().trim();
            for (const [key, metricKey] of Object.entries(metricMapping)) {
                if (label.toLowerCase().includes(key.toLowerCase()) && val && label !== val) {
                    const m = this.createMetric(metricKey, val, 'USD', 'TTM');
                    if (m && !metrics.find((x) => x.metricName === metricKey)) {
                        metrics.push(m);
                    }
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
exports.MorningstarAdapter = MorningstarAdapter;
//# sourceMappingURL=morningstar.adapter.js.map