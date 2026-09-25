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
exports.MacrotrendsAdapter = void 0;
const cheerio = __importStar(require("cheerio"));
const base_adapter_1 = require("./base.adapter");
/**
 * Macrotrends requires company-name slugs in URLs.
 * Also protected by Cloudflare, which may block headless browsers.
 */
const MACROTRENDS_SLUG = {
    'AAPL': 'apple',
    'MSFT': 'microsoft',
    'GOOGL': 'alphabet',
    'GOOG': 'alphabet',
    'AMZN': 'amazon',
    'NVDA': 'nvidia',
    'META': 'meta-platforms',
    'TSLA': 'tesla',
    'JPM': 'jpmorgan-chase',
    'V': 'visa',
    'WMT': 'walmart',
    'MA': 'mastercard',
    'UNH': 'unitedhealth-group',
    'XOM': 'exxon-mobil',
    'JNJ': 'johnson-johnson',
    'PG': 'procter-gamble',
    'HD': 'home-depot',
    'AVGO': 'broadcom',
    'NFLX': 'netflix',
    'ADBE': 'adobe',
    'AMD': 'amd',
    'INTC': 'intel',
    'DIS': 'walt-disney',
    'CSCO': 'cisco',
    'ORCL': 'oracle',
    'BA': 'boeing',
    'GE': 'general-electric',
    'IBM': 'ibm',
    'KO': 'coca-cola',
    'PEP': 'pepsico',
    'CRM': 'salesforce',
    'LLY': 'eli-lilly',
    'ABBV': 'abbvie',
    'MRK': 'merck',
    'CVX': 'chevron',
    'COST': 'costco',
};
class MacrotrendsAdapter extends base_adapter_1.BaseAdapter {
    id = 'macrotrends';
    name = 'Macrotrends';
    baseUrl = 'https://www.macrotrends.net';
    supportedMetrics = [
        'marketCap',
        'peRatio',
        'revenue',
        'netIncome',
        'freeCashFlow',
        'operatingIncome',
        'eps',
        'roe',
        'profitMargin',
    ];
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            baseUrl: this.baseUrl,
            supportedMetrics: this.supportedMetrics,
            supportedScrapers: ['playwright', 'scrapingbee'],
            description: 'Long-term historical financial trends, ratios, and fundamental metrics. Note: may be blocked by Cloudflare.',
        };
    }
    buildUrl(symbol) {
        const upper = symbol.trim().toUpperCase();
        const slug = MACROTRENDS_SLUG[upper] || symbol.trim().toLowerCase();
        return `https://www.macrotrends.net/stocks/charts/${upper}/${slug}/financial-statements`;
    }
    getWaitForSelector() {
        return '#style-1, table.historical_data_table, .jqsfield, h2';
    }
    async extractData(html, symbol, sourceUrl, scraperProvider) {
        const $ = cheerio.load(html);
        const cleanSym = symbol.trim().toUpperCase();
        // Check for Cloudflare challenge page
        const titleText = $('title').text().toLowerCase();
        const h2Text = $('h2').first().text().toLowerCase();
        if (titleText.includes('moment') || h2Text.includes('security verification') || h2Text.includes('challenge')) {
            console.log(`  ⚠️ [Macrotrends] Cloudflare challenge detected for ${cleanSym}. Returning empty result.`);
            return {
                symbol: cleanSym,
                source: this.id,
                sourceUrl,
                scraperProvider,
                collectedAt: new Date(),
                companyInfo: {
                    symbol: cleanSym,
                    companyName: cleanSym,
                },
                financialMetrics: [],
                rawMetadata: { error: 'CLOUDFLARE_BLOCKED', message: 'Macrotrends is protected by Cloudflare bot detection.' },
            };
        }
        const companyName = $('h2, h1').first().text().replace(/Financial Statements.*$/i, '').trim() || cleanSym;
        let currentPrice;
        const priceMatch = html.match(/current stock price as of [^:]+:\s*\$?([\d,.]+)/i) ||
            html.match(/Price:\s*\$?([\d,.]+)/i);
        if (priceMatch && priceMatch[1]) {
            const parsed = this.parseNumericValue(priceMatch[1]);
            if (parsed)
                currentPrice = parsed.value;
        }
        const metrics = [];
        const metricMapping = {
            'Market Cap': 'marketCap',
            'PE Ratio': 'peRatio',
            'Revenue': 'revenue',
            'Net Income': 'netIncome',
            'Operating Income': 'operatingIncome',
            'EPS': 'eps',
            'ROE': 'roe',
            'Return on Equity': 'roe',
            'Profit Margin': 'profitMargin',
        };
        $('table.historical_data_table tr, table tr').each((_, row) => {
            const label = $(row).find('td, th').first().text().trim();
            const val = $(row).find('td').eq(1).text().trim() || $(row).find('td').last().text().trim();
            for (const [key, metricKey] of Object.entries(metricMapping)) {
                if (label.toLowerCase().includes(key.toLowerCase()) && val && label !== val) {
                    const m = this.createMetric(metricKey, val, 'USD', 'ANNUAL');
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
exports.MacrotrendsAdapter = MacrotrendsAdapter;
//# sourceMappingURL=macrotrends.adapter.js.map