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
exports.StockMarketCapAdapter = void 0;
const cheerio = __importStar(require("cheerio"));
const base_adapter_1 = require("./base.adapter");
class StockMarketCapAdapter extends base_adapter_1.BaseAdapter {
    id = 'stockmarketcap';
    name = 'StockMarketCap';
    baseUrl = 'https://get.stockmarketcap.io';
    supportedMetrics = [
        'marketCap',
        'peRatio',
        'revenue',
        'eps',
        'sharesOutstanding',
    ];
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            baseUrl: this.baseUrl,
            supportedMetrics: this.supportedMetrics,
            supportedScrapers: ['playwright', 'scrapingbee'],
            description: 'Stock market capitalization, outstanding shares, and valuation intelligence.',
        };
    }
    buildUrl(symbol) {
        const cleanSym = symbol.trim().toLowerCase();
        return `https://get.stockmarketcap.io/stocks/${cleanSym}`;
    }
    getWaitForSelector() {
        return '.market-cap, .stock-details, table';
    }
    async extractData(html, symbol, sourceUrl, scraperProvider) {
        const $ = cheerio.load(html);
        const cleanSym = symbol.trim().toUpperCase();
        let companyName = $('h1').first().text().replace(/\s+/g, ' ').trim() || cleanSym;
        let currentPrice;
        const priceText = $('.stock-price, .price, [data-price]').first().text().trim();
        if (priceText) {
            const parsed = this.parseNumericValue(priceText);
            if (parsed)
                currentPrice = parsed.value;
        }
        const metrics = [];
        const metricMapping = {
            'Market Cap': 'marketCap',
            'P/E Ratio': 'peRatio',
            'Revenue': 'revenue',
            'EPS': 'eps',
            'Shares Outstanding': 'sharesOutstanding',
        };
        $('table tr, .stat-row').each((_, elem) => {
            const label = $(elem).find('td, th, .stat-title').first().text().trim();
            const val = $(elem).find('td, .stat-value').last().text().trim();
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
exports.StockMarketCapAdapter = StockMarketCapAdapter;
//# sourceMappingURL=stockMarketCap.adapter.js.map