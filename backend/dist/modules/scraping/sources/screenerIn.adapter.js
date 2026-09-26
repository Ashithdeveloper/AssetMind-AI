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
exports.ScreenerInAdapter = void 0;
const cheerio = __importStar(require("cheerio"));
const base_adapter_1 = require("./base.adapter");
class ScreenerInAdapter extends base_adapter_1.BaseAdapter {
    id = 'screener-in';
    name = 'Screener.in';
    baseUrl = 'https://www.screener.in';
    supportedMetrics = [
        'marketCap',
        'currentPrice',
        'highPrice',
        'lowPrice',
        'peRatio',
        'bookValue',
        'dividendYield',
        'roce',
        'roe',
        'faceValue',
        'revenue',
        'netIncome',
        'operatingProfit',
        'operatingMargin',
        'eps',
        'totalAssets',
        'borrowings',
        'operatingCashFlow',
    ];
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            baseUrl: this.baseUrl,
            supportedMetrics: this.supportedMetrics,
            supportedScrapers: ['playwright', 'scrapingbee'],
            description: 'Comprehensive Indian equity fundamentals, top ratios, balance sheet, cash flows, and company analysis.',
        };
    }
    buildUrl(symbol) {
        const cleanSym = encodeURIComponent(symbol.trim().toUpperCase().replace(/\.NS$|\.BO$/i, ''));
        if (cleanSym === 'SBILIFE') {
            return `https://www.screener.in/company/${cleanSym}/`;
        }
        return `https://www.screener.in/company/${cleanSym}/consolidated/`;
    }
    getWaitForSelector() {
        return '#top-ratios, #ratios, .company-ratios, h1';
    }
    async extractData(html, symbol, sourceUrl, scraperProvider) {
        const $ = cheerio.load(html);
        const cleanSym = symbol.trim().toUpperCase().replace(/\.NS$|\.BO$/i, '');
        // 1. Company Name & Description
        let companyName = $('h1.h2, h1, .show-from-tablet-landscape h1').first().text().replace(/\s+/g, ' ').trim();
        if (!companyName) {
            companyName = cleanSym;
        }
        const description = $('.about p, .company-profile p, #about p').first().text().trim() || undefined;
        // Sector & Industry from peer section or links
        let sector;
        let industry;
        $('#peers a[href*="/explore/"]').each((i, el) => {
            if (i === 0)
                sector = $(el).text().trim();
            if (i === 1)
                industry = $(el).text().trim();
        });
        let currentPrice;
        // 2. Top Ratios Parsing
        const metrics = [];
        const metricMapping = {
            'Market Cap': 'marketCap',
            'Current Price': 'currentPrice',
            'Stock P/E': 'peRatio',
            'P/E': 'peRatio',
            'Book Value': 'bookValue',
            'Dividend Yield': 'dividendYield',
            'ROCE': 'roce',
            'ROE': 'roe',
            'Face Value': 'faceValue',
            'Sales': 'revenue',
            'Revenue': 'revenue',
            'Operating Profit': 'operatingProfit',
            'OPM %': 'operatingMargin',
            'Net Profit': 'netIncome',
            'EPS': 'eps',
            'Total Assets': 'totalAssets',
            'Borrowings': 'borrowings',
            'Cash from Operating Activity': 'operatingCashFlow',
        };
        $('#top-ratios li, ul.top-ratios li, #ratios li, tr').each((_, elem) => {
            const label = $(elem).find('.name, td, th').first().text().trim();
            const val = $(elem).find('.value, .number, td').last().text().trim();
            for (const [key, metricKey] of Object.entries(metricMapping)) {
                if (label.toLowerCase().includes(key.toLowerCase()) && val) {
                    if (metricKey === 'currentPrice') {
                        const parsed = this.parseNumericValue(val);
                        if (parsed)
                            currentPrice = parsed.value;
                    }
                    // Note: Screener.in values are in Crores (Cr = 1e7) for absolute numbers or raw percentage/ratio
                    const m = this.createMetric(metricKey, val, 'INR', 'TTM');
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
                exchange: 'NSE',
                country: 'India',
                sector,
                industry,
                description,
            },
            stockPrice: currentPrice
                ? {
                    price: currentPrice,
                    currency: 'INR',
                    priceTimestamp: new Date(),
                }
                : undefined,
            financialMetrics: metrics,
        };
    }
}
exports.ScreenerInAdapter = ScreenerInAdapter;
//# sourceMappingURL=screenerIn.adapter.js.map