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
exports.InvestingAdapter = void 0;
const cheerio = __importStar(require("cheerio"));
const base_adapter_1 = require("./base.adapter");
/**
 * Investing.com uses company-name slugs, not ticker symbols.
 */
const INVESTING_SLUG = {
    'AAPL': 'apple-computer-inc',
    'MSFT': 'microsoft-corp',
    'GOOGL': 'alphabet-inc',
    'GOOG': 'alphabet-inc',
    'AMZN': 'amazon-com-inc',
    'NVDA': 'nvidia-corp',
    'META': 'facebook-inc',
    'TSLA': 'tesla-motors',
    'JPM': 'jp-morgan-chase',
    'V': 'visa-inc',
    'WMT': 'wal-mart-stores',
    'MA': 'mastercard-cl-a',
    'UNH': 'united-health-group',
    'XOM': 'exxon-mobil',
    'JNJ': 'johnson-johnson',
    'PG': 'procter-gamble',
    'HD': 'home-depot',
    'AVGO': 'broadcom-ltd',
    'NFLX': 'netflix---inc',
    'ADBE': 'adobe-sys-inc',
    'AMD': 'amd',
    'INTC': 'intel-corp',
    'DIS': 'walt-disney',
    'CSCO': 'cisco-sys-inc',
    'ORCL': 'oracle-corp',
    'BA': 'boeing-co',
    'KO': 'coca-cola-co',
    'PEP': 'pepsico',
    'CRM': 'salesforce-com',
    'LLY': 'eli-lilly-co',
    'ABBV': 'abbvie-inc',
    'MRK': 'merck---co-new',
    'CVX': 'chevron',
    'COST': 'costco-whsl',
    'IBM': 'ibm',
    'QCOM': 'qualcomm',
    'GE': 'general-electric',
    'RELIANCE': 'reliance-industries',
    'TCS': 'tata-consultancy-services',
    'INFY': 'infosys',
    'HDFCBANK': 'hdfc-bank',
};
class InvestingAdapter extends base_adapter_1.BaseAdapter {
    id = 'investing';
    name = 'Investing.com';
    baseUrl = 'https://www.investing.com';
    supportedMetrics = [
        'marketCap',
        'peRatio',
        'eps',
        'dividendYield',
        'beta',
        'revenue',
        'previousClose',
        'volume',
    ];
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            baseUrl: this.baseUrl,
            supportedMetrics: this.supportedMetrics,
            supportedScrapers: ['playwright', 'scrapingbee'],
            description: 'Real-time financial markets data, quotes, fundamental indicators, and ratio metrics.',
        };
    }
    buildUrl(symbol) {
        const upper = symbol.trim().toUpperCase();
        const slug = INVESTING_SLUG[upper] || symbol.trim().toLowerCase();
        return `https://www.investing.com/equities/${slug}`;
    }
    getWaitForSelector() {
        return '[data-test="instrument-price-last"], .text-5xl, h1';
    }
    async extractData(html, symbol, sourceUrl, scraperProvider) {
        const $ = cheerio.load(html);
        const cleanSym = symbol.trim().toUpperCase();
        // Check for bot-protection pages
        const titleText = $('title').text().toLowerCase();
        if (titleText.includes('moment') || titleText.includes('blocked') || titleText.includes('denied')) {
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
        let companyName = $('h1').first().text().replace(/\s+/g, ' ').trim() || cleanSym;
        // Clean up company name if it includes price info
        if (companyName.includes('(')) {
            companyName = companyName.split('(')[0].trim();
        }
        let currentPrice;
        let changePercent;
        const priceText = $('[data-test="instrument-price-last"], .text-5xl').first().text().trim();
        if (priceText) {
            const parsed = this.parseNumericValue(priceText);
            if (parsed)
                currentPrice = parsed.value;
        }
        const changePctText = $('[data-test="instrument-price-change-percent"]').first().text().trim();
        if (changePctText) {
            const parsed = this.parseNumericValue(changePctText);
            if (parsed)
                changePercent = parsed.value;
        }
        const metrics = [];
        const metricMapping = {
            'Market Cap': 'marketCap',
            'P/E Ratio': 'peRatio',
            'EPS': 'eps',
            'Dividend': 'dividendYield',
            'Dividend Yield': 'dividendYield',
            'Beta': 'beta',
            'Revenue': 'revenue',
            'Prev. Close': 'previousClose',
            'Previous Close': 'previousClose',
            'Volume': 'volume',
            'Avg. Volume': 'avgVolume',
            'Open': 'openPrice',
            '1-Year Change': 'yearChange',
            'Shares Outstanding': 'sharesOutstanding',
        };
        // Investing.com uses dl/dt/dd pairs, tr/td pairs, and data-test attributes
        $('dl div, tr, [data-test="key-info"] div').each((_, elem) => {
            const label = $(elem).find('dt, td, span').first().text().trim();
            const val = $(elem).find('dd, td, span').last().text().trim();
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
                    changePercent,
                    priceTimestamp: new Date(),
                }
                : undefined,
            financialMetrics: metrics,
        };
    }
}
exports.InvestingAdapter = InvestingAdapter;
//# sourceMappingURL=investing.adapter.js.map