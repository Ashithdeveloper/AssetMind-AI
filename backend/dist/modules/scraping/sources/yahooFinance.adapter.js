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
exports.YahooFinanceAdapter = void 0;
const cheerio = __importStar(require("cheerio"));
const base_adapter_1 = require("./base.adapter");
class YahooFinanceAdapter extends base_adapter_1.BaseAdapter {
    id = 'yahoo-finance';
    name = 'Yahoo Finance';
    baseUrl = 'https://finance.yahoo.com';
    supportedMetrics = [
        'marketCap',
        'enterpriseValue',
        'peRatio',
        'forwardPe',
        'priceToBook',
        'priceToSales',
        'eps',
        'beta',
        'dividendYield',
        'previousClose',
        'openPrice',
        'dayRangeLow',
        'dayRangeHigh',
        'yearRangeLow',
        'yearRangeHigh',
        'volume',
        'avgVolume',
        'revenue',
        'netIncome',
        'operatingIncome',
        'operatingCashFlow',
        'freeCashFlow',
        'totalAssets',
        'totalLiabilities',
        'totalEquity',
        'roe',
        'profitMargin',
        'operatingMargin',
        'debtToEquity',
    ];
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            baseUrl: this.baseUrl,
            supportedMetrics: this.supportedMetrics,
            supportedScrapers: ['playwright', 'scrapingbee'],
            description: 'Comprehensive real-time quotes, valuation ratios, income/balance statements, and company profile.',
        };
    }
    buildUrl(symbol) {
        const cleanSym = encodeURIComponent(symbol.trim().toUpperCase());
        return `https://finance.yahoo.com/quote/${cleanSym}/`;
    }
    getWaitForSelector() {
        return '[data-testid="qsp-price"], [data-testid="quote-hdr"], fin-streamer';
    }
    async extractData(html, symbol, sourceUrl, scraperProvider) {
        const $ = cheerio.load(html);
        const cleanSym = symbol.trim().toUpperCase();
        // 1. Company Information
        // Use data-testid="quote-title" first (e.g. "Apple Inc. (AAPL)")
        let companyName = $('[data-testid="quote-title"]').first().text().trim();
        if (companyName.includes('(')) {
            companyName = companyName.split('(')[0].trim();
        }
        // Fallback: second h1 tag (first is "Yahoo Finance" site header)
        if (!companyName) {
            const allH1 = [];
            $('h1').each((_, el) => {
                allH1.push($(el).text().trim());
            });
            for (const h1Text of allH1) {
                if (h1Text !== 'Yahoo Finance' && h1Text.length > 1) {
                    companyName = h1Text.includes('(') ? h1Text.split('(')[0].trim() : h1Text;
                    break;
                }
            }
        }
        // Fallback: title tag
        if (!companyName) {
            const titleText = $('title').text();
            if (titleText.includes('(')) {
                companyName = titleText.split('(')[0].trim();
            }
        }
        if (!companyName)
            companyName = cleanSym;
        let sector;
        let industry;
        let country = 'United States';
        let exchange;
        let description;
        // Exchange from quote header
        const hdrText = $('[data-testid="quote-hdr"]').first().text();
        if (hdrText) {
            if (/nasdaq/i.test(hdrText))
                exchange = 'NASDAQ';
            else if (/nyse/i.test(hdrText))
                exchange = 'NYSE';
            else if (/nse/i.test(hdrText))
                exchange = 'NSE';
            else if (/bse/i.test(hdrText))
                exchange = 'BSE';
        }
        // 2. Stock Price — Use data-testid="qsp-price" which gives the accurate stock price
        let currentPrice;
        let priceChange;
        let percentChange;
        const qspPrice = $('[data-testid="qsp-price"]').first().text().trim();
        if (qspPrice) {
            const parsed = this.parseNumericValue(qspPrice);
            if (parsed)
                currentPrice = parsed.value;
        }
        // Fallback to fin-streamer only if qsp-price not found
        if (!currentPrice) {
            const priceSection = $('section[data-testid="quote-price"], [data-testid="price-statistic"]');
            let finPrice = priceSection.find('fin-streamer[data-field="regularMarketPrice"]').first();
            if (!finPrice.length) {
                finPrice = $('fin-streamer[data-field="regularMarketPrice"]').first();
            }
            const val = finPrice.attr('value') || finPrice.text();
            if (val) {
                const parsed = this.parseNumericValue(val);
                if (parsed)
                    currentPrice = parsed.value;
            }
        }
        // Price change from data-testid or fin-streamer
        const changeText = $('[data-testid="qsp-price-change"]').first().text().trim();
        if (changeText) {
            const parsed = this.parseNumericValue(changeText);
            if (parsed)
                priceChange = parsed.value;
        }
        else {
            const finChange = $('fin-streamer[data-field="regularMarketChange"]').first();
            const val = finChange.attr('value') || finChange.text();
            if (val) {
                const parsed = this.parseNumericValue(val);
                if (parsed)
                    priceChange = parsed.value;
            }
        }
        const changePctText = $('[data-testid="qsp-price-change-percent"]').first().text().trim();
        if (changePctText) {
            const cleaned = changePctText.replace(/[()]/g, '');
            const parsed = this.parseNumericValue(cleaned);
            if (parsed)
                percentChange = parsed.value;
        }
        else {
            const finPct = $('fin-streamer[data-field="regularMarketChangePercent"]').first();
            const val = finPct.attr('value') || finPct.text();
            if (val) {
                const cleaned = val.replace(/[()]/g, '');
                const parsed = this.parseNumericValue(cleaned);
                if (parsed)
                    percentChange = parsed.value;
            }
        }
        // 3. Metrics parsing from key stats tables
        const metrics = [];
        const metricMapping = {
            'Market Cap (intraday)': 'marketCap',
            'Market Cap': 'marketCap',
            'Enterprise Value': 'enterpriseValue',
            'PE Ratio (TTM)': 'peRatio',
            'Forward P/E': 'forwardPe',
            'Price/Book': 'priceToBook',
            'Price/Sales': 'priceToSales',
            'PEG Ratio': 'pegRatio',
            'EPS (TTM)': 'eps',
            'Beta (5Y Monthly)': 'beta',
            'Beta': 'beta',
            'Forward Dividend & Yield': 'dividendYield',
            'Dividend Yield': 'dividendYield',
            'Previous Close': 'previousClose',
            'Open': 'openPrice',
            'Volume': 'volume',
            'Avg. Volume': 'avgVolume',
            '52 Week Range': 'fiftyTwoWeekRange',
            'Day\'s Range': 'dayRange',
            '1y Target Est': 'targetPrice',
            'Revenue': 'revenue',
            'Net Income': 'netIncome',
            'Operating Cash Flow': 'operatingCashFlow',
            'Levered Free Cash Flow': 'freeCashFlow',
            'Return on Equity': 'roe',
            'Profit Margin': 'profitMargin',
            'Operating Margin': 'operatingMargin',
            'Total Debt/Equity': 'debtToEquity',
        };
        // Parse table rows (most Yahoo stats are in <li> or <tr> with label-value pairs)
        $('li, tr').each((_, elem) => {
            const children = $(elem).children();
            if (children.length < 2)
                return;
            const label = $(children[0]).text().trim();
            const value = $(children[children.length - 1]).text().trim();
            if (!label || !value || label === value)
                return;
            for (const [key, metricKey] of Object.entries(metricMapping)) {
                if (label === key || label.startsWith(key)) {
                    const m = this.createMetric(metricKey, value, 'USD', 'TTM');
                    if (m && !metrics.find((x) => x.metricName === metricKey)) {
                        metrics.push(m);
                    }
                    break;
                }
            }
        });
        // 4. JSON-LD structured data
        const jsonLds = this.extractJsonLd($);
        for (const item of jsonLds) {
            if (item['@type'] === 'Corporation' || item['@type'] === 'Organization') {
                if (item.name && (!companyName || companyName === cleanSym))
                    companyName = item.name;
                if (item.description && !description)
                    description = item.description;
                if (item.address?.addressCountry && !country)
                    country = item.address.addressCountry;
            }
        }
        return {
            symbol: cleanSym,
            source: this.id,
            sourceUrl,
            scraperProvider,
            collectedAt: new Date(),
            companyInfo: {
                symbol: cleanSym,
                companyName: companyName || cleanSym,
                exchange: exchange || 'NASDAQ',
                country: country || 'United States',
                sector,
                industry,
                description,
            },
            stockPrice: currentPrice
                ? {
                    price: currentPrice,
                    currency: 'USD',
                    change: priceChange,
                    changePercent: percentChange,
                    priceTimestamp: new Date(),
                }
                : undefined,
            financialMetrics: metrics,
        };
    }
}
exports.YahooFinanceAdapter = YahooFinanceAdapter;
//# sourceMappingURL=yahooFinance.adapter.js.map