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
exports.TradingViewAdapter = void 0;
const cheerio = __importStar(require("cheerio"));
const base_adapter_1 = require("./base.adapter");
class TradingViewAdapter extends base_adapter_1.BaseAdapter {
    id = 'tradingview';
    name = 'TradingView';
    baseUrl = 'https://www.tradingview.com';
    supportedMetrics = [
        'marketCap',
        'peRatio',
        'eps',
        'dividendYield',
        'beta',
        'volume',
        'revenue',
        'netIncome',
    ];
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            baseUrl: this.baseUrl,
            supportedMetrics: this.supportedMetrics,
            supportedScrapers: ['playwright', 'scrapingbee'],
            description: 'Technical and fundamental summary, market quotes, valuation metrics, and sector indicators.',
        };
    }
    buildUrl(symbol) {
        const cleanSym = encodeURIComponent(symbol.trim().toUpperCase());
        return `https://www.tradingview.com/symbols/${cleanSym}/`;
    }
    getWaitForSelector() {
        return '.js-symbol-last, [class*="last-"], [class*="tv-category-header"]';
    }
    async extractData(html, symbol, sourceUrl, scraperProvider) {
        const $ = cheerio.load(html);
        const cleanSym = symbol.trim().toUpperCase();
        // Company Name
        let companyName = $('h1').first().text().replace(/\s+/g, ' ').trim();
        if (!companyName) {
            companyName = cleanSym;
        }
        // Price
        let currentPrice;
        let changePercent;
        const priceText = $('span[class*="last-"], [data-field="price"], span[class*="priceWrapper"]').first().text().trim();
        if (priceText) {
            const parsed = this.parseNumericValue(priceText);
            if (parsed)
                currentPrice = parsed.value;
        }
        const changeText = $('span[class*="change-"], [data-field="change_percent"]').first().text().trim();
        if (changeText) {
            const parsed = this.parseNumericValue(changeText);
            if (parsed)
                changePercent = parsed.value;
        }
        // Key stats
        const metrics = [];
        const metricMapping = {
            'Market capitalization': 'marketCap',
            'Market cap': 'marketCap',
            'Price to earnings': 'peRatio',
            'P/E ratio': 'peRatio',
            'EPS': 'eps',
            'Dividend yield': 'dividendYield',
            'Beta': 'beta',
            'Volume': 'volume',
            'Revenue': 'revenue',
            'Net income': 'netIncome',
        };
        $('div[class*="keyStat-"], div[class*="item-"], tr').each((_, elem) => {
            const label = $(elem).find('[class*="title-"], [class*="label-"], td').first().text().trim();
            const val = $(elem).find('[class*="value-"], td').last().text().trim();
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
                    changePercent,
                    priceTimestamp: new Date(),
                }
                : undefined,
            financialMetrics: metrics,
        };
    }
}
exports.TradingViewAdapter = TradingViewAdapter;
//# sourceMappingURL=tradingView.adapter.js.map