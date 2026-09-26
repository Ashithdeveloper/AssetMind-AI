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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenerExtractionService = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const Asset_model_1 = require("../../../models/Asset.model");
const StockPrice_model_1 = require("../../../models/StockPrice.model");
const FinancialData_model_1 = require("../../../models/FinancialData.model");
const FinancialMetrics_model_1 = require("../../../models/FinancialMetrics.model");
const FinancialStatement_model_1 = require("../../../models/FinancialStatement.model");
const ScrapingJob_model_1 = require("../../../models/ScrapingJob.model");
const companies_catalog_1 = require("../../../config/companies.catalog");
const SCREENER_SLUG_OVERRIDES = {
    TATAMOTORS: '500570',
    ZOMATO: '543320',
    'M&M': '500520',
    MM: '500520',
};
// Companies that report pure standalone financials without consolidated subsidiaries
const STANDALONE_SCREENER_SYMBOLS = new Set(['SBILIFE']);
// In-memory cache to avoid duplicate scrapes within TTL
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
class ScreenerExtractionService {
    /**
     * Helper to clean and parse numeric strings from Screener.in
     */
    static cleanNumber(val) {
        if (!val)
            return null;
        const clean = val
            .replace(/,/g, '')
            .replace(/₹/g, '')
            .replace(/%/g, '')
            .replace(/Cr\./gi, '')
            .trim();
        const num = parseFloat(clean);
        return isNaN(num) ? null : num;
    }
    /**
     * Parse HTML table into headers and rows
     */
    static parseTable($, selector) {
        const table = $(selector);
        if (!table.length)
            return { headers: [], rows: [] };
        const headers = [];
        table.find('thead th').each((_, th) => {
            headers.push($(th).text().trim());
        });
        const rows = [];
        table.find('tbody tr').each((_, tr) => {
            const tds = $(tr).find('td');
            if (!tds.length)
                return;
            const name = $(tds[0]).text().replace(/\+/g, '').trim();
            if (!name)
                return;
            const values = [];
            const rawValues = [];
            tds.slice(1).each((_, td) => {
                const text = $(td).text().trim();
                rawValues.push(text);
                values.push(this.cleanNumber(text));
            });
            rows.push({ name, values, rawValues });
        });
        return { headers, rows };
    }
    /**
     * Find matching catalog metadata for fallback sector/industry
     */
    static getCatalogMetadata(symbol) {
        const clean = symbol.trim().toUpperCase().replace(/\.NS$|\.BO$/i, '');
        return companies_catalog_1.TOP_80_COMPANIES.find((c) => c.symbol.toUpperCase() === clean || c.name.toUpperCase().includes(clean));
    }
    /**
     * Extract comprehensive company data from Screener.in
     */
    static async scrapeCompany(symbolOrCode, options = {}) {
        const cleanSym = symbolOrCode.trim().toUpperCase().replace(/\.NS$|\.BO$/i, '');
        // Check cache unless force refresh
        if (!options.force) {
            const cached = cache.get(cleanSym);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
                return cached.data;
            }
        }
        const job = await ScrapingJob_model_1.ScrapingJob.create({
            symbol: cleanSym,
            source: 'screener-in',
            scraperProvider: 'playwright',
            status: 'RUNNING',
            startedAt: new Date(),
            recordsCollected: 0,
            recordsValidated: 0,
            recordsRejected: 0,
        }).catch(() => null);
        const startTime = Date.now();
        try {
            // 1. Fetch HTML from Screener.in (try consolidated first unless known standalone, fallback to standalone)
            const slug = SCREENER_SLUG_OVERRIDES[cleanSym] || cleanSym;
            let html = '';
            const preferStandalone = STANDALONE_SCREENER_SYMBOLS.has(cleanSym);
            let sourceUrl = preferStandalone
                ? `https://www.screener.in/company/${encodeURIComponent(slug)}/`
                : `https://www.screener.in/company/${encodeURIComponent(slug)}/consolidated/`;
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            };
            try {
                const res = await axios_1.default.get(sourceUrl, { headers, timeout: 15000 });
                html = res.data;
            }
            catch (consErr) {
                if (consErr.response?.status === 404 && !preferStandalone) {
                    sourceUrl = `https://www.screener.in/company/${encodeURIComponent(slug)}/`;
                    const res = await axios_1.default.get(sourceUrl, { headers, timeout: 15000 });
                    html = res.data;
                }
                else {
                    throw consErr;
                }
            }
            let $ = cheerio.load(html);
            // Fail-safe: Check if consolidated page returned empty ratios (e.g. pure standalone entities where consolidated returns 200 OK but has no ratios)
            const testMarketCap = this.cleanNumber($('#top-ratios li:contains("Market Cap") .value').text());
            const testPrice = this.cleanNumber($('#top-ratios li:contains("Current Price") .value').text());
            if (testMarketCap === null && testPrice === null && sourceUrl.includes('/consolidated/')) {
                try {
                    const standaloneUrl = `https://www.screener.in/company/${encodeURIComponent(slug)}/`;
                    const resStandalone = await axios_1.default.get(standaloneUrl, { headers, timeout: 15000 });
                    if (resStandalone.data) {
                        html = resStandalone.data;
                        sourceUrl = standaloneUrl;
                        $ = cheerio.load(html);
                    }
                }
                catch (standaloneErr) {
                    console.warn(`[ScreenerExtraction] Fallback to standalone failed for ${cleanSym}:`, standaloneErr.message);
                }
            }
            // 2. Company Name
            let companyName = $('h1').first().text().replace(/\s+/g, ' ').trim();
            if (!companyName) {
                companyName = cleanSym;
            }
            // 3. BSE Code & NSE Symbol & Website Link
            let bseCode = '';
            let nseSymbol = cleanSym;
            let website = '';
            $('a').each((_, a) => {
                const href = $(a).attr('href') || '';
                // BSE link: e.g. bseindia.com/stock-share-price/.../500325/
                const bseMatch = href.match(/bseindia\.com\/.*\/(\d{6})\/?/i);
                if (bseMatch && !bseCode) {
                    bseCode = bseMatch[1];
                }
                // NSE link: e.g. nseindia.com/get-quotes/equity?symbol=RELIANCE
                const nseMatch = href.match(/nseindia\.com\/.*symbol=([^&]+)/i);
                if (nseMatch && !nseSymbol) {
                    nseSymbol = decodeURIComponent(nseMatch[1]).trim().toUpperCase();
                }
                // Official website link
                if (!website &&
                    ($(a).find('i.icon-link').length > 0 ||
                        $(a).find('i.icon-globe').length > 0 ||
                        href.includes('.com') ||
                        href.includes('.in') ||
                        href.includes('.org')) &&
                    !href.includes('screener.in') &&
                    !href.includes('bseindia.com') &&
                    !href.includes('nseindia.com') &&
                    href.startsWith('http')) {
                    website = href;
                }
            });
            // 4. Sector & Industry from peers or catalog
            const catalog = this.getCatalogMetadata(cleanSym);
            let sector = catalog?.sector || 'General';
            let industry = catalog?.industry || 'General';
            $('#peers a[href*="/explore/"]').each((i, el) => {
                const txt = $(el).text().trim();
                if (txt) {
                    if (i === 0)
                        sector = txt;
                    if (i === 1)
                        industry = txt;
                }
            });
            // 5. Description
            let description = $('#about .sub, .about p, .company-profile p').first().text().trim();
            if (!description) {
                description = `${companyName} is one of India's leading companies listed on NSE and BSE.`;
            }
            // 6. Top Ratios
            const topRatios = {};
            $('#top-ratios li').each((_, el) => {
                const label = $(el).find('.name').text().trim();
                const valText = $(el).find('.value').text().trim();
                if (label) {
                    topRatios[label] = this.cleanNumber(valText);
                }
            });
            const currentPrice = topRatios['Current Price'] ??
                this.cleanNumber($('#top-ratios li:contains("Current Price") .value').text()) ??
                0;
            const marketCapCr = topRatios['Market Cap'] ??
                this.cleanNumber($('#top-ratios li:contains("Market Cap") .value').text()) ??
                0;
            const peRatio = topRatios['Stock P/E'] ?? topRatios['P/E'] ?? null;
            const bookValue = topRatios['Book Value'] ?? null;
            const dividendYield = topRatios['Dividend Yield'] ?? null;
            const roce = topRatios['ROCE'] ?? null;
            const roe = topRatios['ROE'] ?? null;
            const faceValue = topRatios['Face Value'] ?? null;
            const pbRatio = bookValue && currentPrice && bookValue > 0 ? +(currentPrice / bookValue).toFixed(2) : null;
            // 7. Parse Full Financial Statement Tables
            const quarters = this.parseTable($, '#quarters table');
            const profitLoss = this.parseTable($, '#profit-loss table');
            const balanceSheet = this.parseTable($, '#balance-sheet table');
            const cashFlow = this.parseTable($, '#cash-flow table');
            const ratios = this.parseTable($, '#ratios table');
            // 8. Compute Derived Key Metrics from Financial Statements
            // a) EPS from P&L or Quarters
            let eps = topRatios['EPS'] ?? null;
            if (eps === null) {
                const epsRow = profitLoss.rows.find((r) => r.name.toLowerCase().includes('eps'));
                if (epsRow && epsRow.values.length > 0) {
                    const valid = epsRow.values.filter((v) => v !== null);
                    if (valid.length > 0)
                        eps = valid[valid.length - 1];
                }
            }
            // b) Operating Profit Margin % from P&L or Quarters
            let operatingProfitMarginPercent = null;
            const opmRow = profitLoss.rows.find((r) => r.name.toLowerCase().includes('opm')) ||
                quarters.rows.find((r) => r.name.toLowerCase().includes('opm'));
            if (opmRow && opmRow.values.length > 0) {
                const valid = opmRow.values.filter((v) => v !== null);
                if (valid.length > 0)
                    operatingProfitMarginPercent = valid[valid.length - 1];
            }
            // c) Revenue Growth % YoY (from last two annual Sales in P&L)
            let revenueGrowthPercent = null;
            const salesRow = profitLoss.rows.find((r) => r.name.toLowerCase().includes('sales'));
            if (salesRow && salesRow.values.length >= 2) {
                const valid = salesRow.values.filter((v) => v !== null && v > 0);
                if (valid.length >= 2) {
                    const prev = valid[valid.length - 2];
                    const curr = valid[valid.length - 1];
                    revenueGrowthPercent = +(((curr - prev) / prev) * 100).toFixed(1);
                }
            }
            // d) Profit Growth % YoY (from last two annual Net Profit in P&L)
            let profitGrowthPercent = null;
            const netProfitRow = profitLoss.rows.find((r) => r.name.toLowerCase().includes('net profit'));
            if (netProfitRow && netProfitRow.values.length >= 2) {
                const valid = netProfitRow.values.filter((v) => v !== null);
                if (valid.length >= 2) {
                    const prev = valid[valid.length - 2];
                    const curr = valid[valid.length - 1];
                    if (prev !== 0) {
                        profitGrowthPercent = +(((curr - prev) / Math.abs(prev)) * 100).toFixed(1);
                    }
                }
            }
            // e) Net Profit Margin % (latest Net Profit / Sales)
            let netProfitMarginPercent = null;
            if (salesRow && netProfitRow) {
                const validSales = salesRow.values.filter((v) => v !== null && v > 0);
                const validProfits = netProfitRow.values.filter((v) => v !== null);
                if (validSales.length > 0 && validProfits.length > 0) {
                    const latestSales = validSales[validSales.length - 1];
                    const latestProfit = validProfits[validProfits.length - 1];
                    netProfitMarginPercent = +((latestProfit / latestSales) * 100).toFixed(1);
                }
            }
            // f) Debt to Equity
            let debtToEquity = topRatios['Debt to equity'] ?? topRatios['Debt to Equity'] ?? null;
            let borrowingsCr = 0;
            const borrowRow = balanceSheet.rows.find((r) => r.name.toLowerCase().includes('borrowings'));
            const equityRow = balanceSheet.rows.find((r) => r.name.toLowerCase().includes('equity capital'));
            const reserveRow = balanceSheet.rows.find((r) => r.name.toLowerCase().includes('reserves'));
            if (borrowRow && borrowRow.values.length > 0) {
                const validB = borrowRow.values.filter((v) => v !== null);
                if (validB.length > 0)
                    borrowingsCr = validB[validB.length - 1];
            }
            let totalEquityCr = 0;
            if (equityRow && equityRow.values.length > 0) {
                const validE = equityRow.values.filter((v) => v !== null);
                if (validE.length > 0)
                    totalEquityCr += validE[validE.length - 1];
            }
            if (reserveRow && reserveRow.values.length > 0) {
                const validR = reserveRow.values.filter((v) => v !== null);
                if (validR.length > 0)
                    totalEquityCr += validR[validR.length - 1];
            }
            if (debtToEquity === null && totalEquityCr > 0) {
                debtToEquity = +(borrowingsCr / totalEquityCr).toFixed(2);
            }
            // g) Free Cash Flow (Cr) - Check direct Screener row first, then Operating Cash Flow - Capex
            let freeCashFlowCr = null;
            const fcfRow = cashFlow.rows.find((r) => r.name.toLowerCase().trim() === 'free cash flow' || r.name.toLowerCase().includes('free cash flow'));
            if (fcfRow && fcfRow.values.length > 0) {
                const validFCF = fcfRow.values.filter((v) => v !== null && !isNaN(Number(v)));
                if (validFCF.length > 0) {
                    freeCashFlowCr = validFCF[validFCF.length - 1];
                }
            }
            if (freeCashFlowCr === null) {
                const opCashRow = cashFlow.rows.find((r) => r.name.toLowerCase().includes('operating activity'));
                if (opCashRow && opCashRow.values.length > 0) {
                    const validOp = opCashRow.values.filter((v) => v !== null);
                    if (validOp.length > 0) {
                        const latestOp = validOp[validOp.length - 1];
                        let capex = 0;
                        const capexRow = cashFlow.rows.find((r) => r.name.toLowerCase().includes('fixed assets') || r.name.toLowerCase().includes('capex'));
                        if (capexRow && capexRow.values.length > 0) {
                            const validCap = capexRow.values.filter((v) => v !== null);
                            if (validCap.length > 0)
                                capex = Math.abs(validCap[validCap.length - 1]);
                        }
                        freeCashFlowCr = Math.round(latestOp - capex);
                    }
                }
            }
            // h) Enterprise Value (Cr) = Market Cap + Borrowings
            const enterpriseValueCr = marketCapCr > 0 ? Math.round(marketCapCr + borrowingsCr) : null;
            const logoUrl = `https://assets.parqet.com/logos/symbol/${cleanSym}?format=png`;
            const scrapedData = {
                symbol: cleanSym,
                nseSymbol: nseSymbol || cleanSym,
                bseCode,
                companyName,
                country: 'India',
                currency: 'INR',
                exchange: 'NSE',
                sector,
                industry,
                website,
                description,
                logoUrl,
                currentPrice,
                marketCapCr,
                metrics: {
                    peRatio,
                    pbRatio,
                    bookValue,
                    dividendYield,
                    roce,
                    roe,
                    eps,
                    faceValue,
                    debtToEquity,
                    freeCashFlowCr,
                    revenueGrowthPercent,
                    profitGrowthPercent,
                    operatingProfitMarginPercent,
                    netProfitMarginPercent,
                    enterpriseValueCr,
                },
                statements: {
                    quarters,
                    profitLoss,
                    balanceSheet,
                    cashFlow,
                    ratios,
                },
                sourceUrl,
                lastUpdated: new Date(),
            };
            // 9. Persist into MongoDB
            await this.persistScrapedData(scrapedData);
            // Cache result
            cache.set(cleanSym, { data: scrapedData, timestamp: Date.now() });
            if (job) {
                await ScrapingJob_model_1.ScrapingJob.findByIdAndUpdate(job._id, {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    recordsCollected: quarters.rows.length + profitLoss.rows.length + balanceSheet.rows.length,
                    recordsValidated: Object.keys(scrapedData.metrics).length,
                    durationMs: Date.now() - startTime,
                });
            }
            return scrapedData;
        }
        catch (err) {
            console.error(`[ScreenerService] ❌ Scraping error for ${cleanSym}:`, err.message || err);
            if (job) {
                await ScrapingJob_model_1.ScrapingJob.findByIdAndUpdate(job._id, {
                    status: 'FAILED',
                    errorMessage: err.message,
                    completedAt: new Date(),
                    durationMs: Date.now() - startTime,
                });
            }
            throw err;
        }
    }
    /**
     * Persist scraped data across MongoDB models
     */
    static async persistScrapedData(data) {
        // 1. Upsert Asset
        const asset = await Asset_model_1.Asset.findOneAndUpdate({ symbol: data.symbol }, {
            $set: {
                symbol: data.symbol,
                nseSymbol: data.nseSymbol,
                bseCode: data.bseCode,
                companyName: data.companyName,
                country: 'India',
                currency: 'INR',
                exchange: data.exchange || 'NSE',
                sector: data.sector,
                industry: data.industry,
                description: data.description,
                website: data.website,
                logoUrl: data.logoUrl,
                currentPrice: data.currentPrice,
                marketCapitalization: data.marketCapCr,
                dataSource: 'Screener.in',
                lastScrapedAt: data.lastUpdated,
            },
        }, { upsert: true, returnDocument: 'after' });
        if (!asset)
            return;
        // 2. Upsert StockPrice
        if (data.currentPrice > 0) {
            await StockPrice_model_1.StockPrice.findOneAndUpdate({ assetId: asset._id }, {
                $set: {
                    assetId: asset._id,
                    symbol: data.symbol,
                    price: data.currentPrice,
                    currency: 'INR',
                    source: 'Screener.in',
                    priceTimestamp: data.lastUpdated,
                },
            }, { upsert: true });
        }
        // 3. Upsert FinancialStatement
        await FinancialStatement_model_1.FinancialStatement.findOneAndUpdate({ symbol: data.symbol }, {
            $set: {
                assetId: asset._id,
                symbol: data.symbol,
                nseSymbol: data.nseSymbol,
                bseCode: data.bseCode,
                companyName: data.companyName,
                quarters: data.statements.quarters,
                profitLoss: data.statements.profitLoss,
                balanceSheet: data.statements.balanceSheet,
                cashFlow: data.statements.cashFlow,
                ratios: data.statements.ratios,
                source: 'Screener.in',
                sourceUrl: data.sourceUrl,
                lastUpdated: data.lastUpdated,
            },
        }, { upsert: true });
        // 4. Extract latest annual sales and net profit from P&L
        let latestSalesCr = null;
        const salesRow = data.statements.profitLoss?.rows?.find((r) => r.name.toLowerCase().includes('sales'));
        if (salesRow && salesRow.values.length > 0) {
            const validSales = salesRow.values.filter((v) => v !== null && Number(v) > 0);
            if (validSales.length > 0)
                latestSalesCr = validSales[validSales.length - 1];
        }
        let latestNetProfitCr = null;
        const netProfitRow = data.statements.profitLoss?.rows?.find((r) => r.name.toLowerCase().includes('net profit'));
        if (netProfitRow && netProfitRow.values.length > 0) {
            const validProfits = netProfitRow.values.filter((v) => v !== null && !isNaN(Number(v)));
            if (validProfits.length > 0)
                latestNetProfitCr = validProfits[validProfits.length - 1];
        }
        // 5. Upsert FinancialMetrics with accurate units (INR Crore, percentage, ratio)
        const m = data.metrics;
        await FinancialMetrics_model_1.FinancialMetrics.findOneAndUpdate({ companyId: asset._id }, {
            $set: {
                companyId: asset._id,
                symbol: data.symbol,
                fiscalPeriod: 'TTM',
                revenue: { value: latestSalesCr, currency: 'INR', unit: 'INR Crore', source: 'Screener.in' },
                netIncome: { value: latestNetProfitCr, currency: 'INR', unit: 'INR Crore', source: 'Screener.in' },
                freeCashFlow: {
                    value: m.freeCashFlowCr,
                    currency: 'INR',
                    unit: 'INR Crore',
                    reportingPeriod: 'FY2026',
                    source: 'Screener.in',
                    explanation: 'Audited Free Cash Flow from Screener.in cash flow statement',
                },
                roe: { value: m.roe, unit: 'percentage', currency: '%', source: 'Screener.in' },
                debtToEquity: { value: m.debtToEquity, unit: 'ratio', currency: 'ratio', source: 'Screener.in' },
                profitability: {
                    operatingProfitMargin: { value: m.operatingProfitMarginPercent, unit: 'percentage', currency: '%' },
                    netProfitMargin: { value: m.netProfitMarginPercent, unit: 'percentage', currency: '%' },
                    revenue: { value: latestSalesCr, unit: 'INR Crore', currency: 'INR' },
                    netIncome: { value: latestNetProfitCr, unit: 'INR Crore', currency: 'INR' },
                },
                valuation: {
                    peRatio: { value: m.peRatio, unit: 'ratio', source: 'Screener.in' },
                    pbRatio: { value: m.pbRatio, unit: 'ratio', source: 'Screener.in' },
                    evToEbitda: { value: m.enterpriseValueCr, unit: 'INR Crore', source: 'Screener.in' },
                    enterpriseValue: { value: m.enterpriseValueCr, unit: 'INR Crore', source: 'Screener.in' },
                },
                growth: {
                    revenueGrowth: { value: m.revenueGrowthPercent, unit: 'percentage', currency: '%' },
                    profitGrowth: { value: m.profitGrowthPercent, unit: 'percentage', currency: '%' },
                },
                source: 'Screener.in',
                updatedAt: data.lastUpdated,
            },
        }, { upsert: true });
        // 5. Store key financial data entries
        const keyDataEntries = [
            { name: 'marketCap', val: data.marketCapCr, unit: 'INR Crore' },
            { name: 'peRatio', val: m.peRatio, unit: 'ratio' },
            { name: 'pbRatio', val: m.pbRatio, unit: 'ratio' },
            { name: 'bookValue', val: m.bookValue, unit: 'INR' },
            { name: 'roe', val: m.roe, unit: 'percentage' },
            { name: 'roce', val: m.roce, unit: 'percentage' },
            { name: 'dividendYield', val: m.dividendYield, unit: 'percentage' },
            { name: 'freeCashFlow', val: m.freeCashFlowCr, unit: 'INR Crore' },
            { name: 'debtToEquity', val: m.debtToEquity, unit: 'ratio' },
            { name: 'revenueGrowth', val: m.revenueGrowthPercent, unit: 'percentage' },
            { name: 'profitGrowth', val: m.profitGrowthPercent, unit: 'percentage' },
            { name: 'eps', val: m.eps, unit: 'INR' },
        ];
        for (const entry of keyDataEntries) {
            if (entry.val !== null && !isNaN(entry.val)) {
                await FinancialData_model_1.FinancialData.findOneAndUpdate({
                    assetId: asset._id,
                    symbol: data.symbol,
                    metricName: entry.name,
                }, {
                    $set: {
                        assetId: asset._id,
                        symbol: data.symbol,
                        metricName: entry.name,
                        metricValue: entry.val,
                        currency: 'INR',
                        unit: entry.unit,
                        source: 'Screener.in',
                        sourceUrl: data.sourceUrl,
                        scraperProvider: 'playwright',
                        collectedAt: data.lastUpdated,
                        validationStatus: 'VALID',
                    },
                }, { upsert: true });
            }
        }
    }
    /**
     * Get financial statements for a symbol (fetches from DB or triggers live scrape)
     */
    static async getStatements(symbol) {
        const cleanSym = symbol.trim().toUpperCase().replace(/\.NS$|\.BO$/i, '');
        let doc = await FinancialStatement_model_1.FinancialStatement.findOne({ symbol: cleanSym }).lean();
        if (!doc || !doc.quarters?.rows?.length) {
            try {
                await this.scrapeCompany(cleanSym);
                doc = await FinancialStatement_model_1.FinancialStatement.findOne({ symbol: cleanSym }).lean();
            }
            catch (err) {
                console.warn(`[ScreenerService] Could not scrape statements on-demand for ${cleanSym}:`, err.message);
            }
        }
        return doc;
    }
}
exports.ScreenerExtractionService = ScreenerExtractionService;
//# sourceMappingURL=screenerExtraction.service.js.map