"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialDataValidator = exports.financialDocumentSchema = exports.financialMetricSchema = exports.stockPriceSchema = exports.companyInfoSchema = exports.CANONICAL_METRIC_MAP = void 0;
const zod_1 = require("zod");
// Canonical Metric Names
exports.CANONICAL_METRIC_MAP = {
    // Valuation
    marketcap: 'marketCap',
    market_cap: 'marketCap',
    'market capitalization': 'marketCap',
    peratio: 'peRatio',
    pe_ratio: 'peRatio',
    p_e: 'peRatio',
    'p/e': 'peRatio',
    forwardpe: 'forwardPe',
    forward_pe: 'forwardPe',
    'forward p/e': 'forwardPe',
    pricetobook: 'priceToBook',
    pb_ratio: 'priceToBook',
    'price/book': 'priceToBook',
    pricetosales: 'priceToSales',
    ps_ratio: 'priceToSales',
    'price/sales': 'priceToSales',
    eps: 'eps',
    'earnings per share': 'eps',
    dividendyield: 'dividendYield',
    dividend_yield: 'dividendYield',
    yield: 'dividendYield',
    // Financials
    revenue: 'revenue',
    revenues: 'revenue',
    sales: 'revenue',
    totalrevenue: 'revenue',
    netincome: 'netIncome',
    net_income: 'netIncome',
    profit: 'netIncome',
    operatingincome: 'operatingIncome',
    operating_income: 'operatingIncome',
    freecashflow: 'freeCashFlow',
    free_cash_flow: 'freeCashFlow',
    fcf: 'freeCashFlow',
    operatingcashflow: 'operatingCashFlow',
    operating_cash_flow: 'operatingCashFlow',
    totalassets: 'totalAssets',
    total_assets: 'totalAssets',
    totalliabilities: 'totalLiabilities',
    total_liabilities: 'totalLiabilities',
    totalequity: 'totalEquity',
    total_equity: 'totalEquity',
    stockholdersequity: 'totalEquity',
    capex: 'capitalExpenditure',
    capitalexpenditure: 'capitalExpenditure',
    // Ratios & Margins
    roe: 'roe',
    returnonequity: 'roe',
    'return on equity': 'roe',
    roce: 'roce',
    debttoequity: 'debtToEquity',
    debt_to_equity: 'debtToEquity',
    'debt / equity': 'debtToEquity',
    profitmargin: 'profitMargin',
    profit_margin: 'profitMargin',
    netprofitmargin: 'profitMargin',
    operatingmargin: 'operatingMargin',
    operating_margin: 'operatingMargin',
    beta: 'beta',
};
// Zod validation schemas
exports.companyInfoSchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1).max(20).transform((s) => s.trim().toUpperCase()),
    companyName: zod_1.z.string().min(1).max(255).transform((s) => s.trim()),
    exchange: zod_1.z.string().optional().transform((s) => s?.trim().toUpperCase()),
    country: zod_1.z.string().optional().transform((s) => s?.trim()),
    sector: zod_1.z.string().optional().transform((s) => s?.trim()),
    industry: zod_1.z.string().optional().transform((s) => s?.trim()),
    description: zod_1.z.string().optional().transform((s) => s?.trim()),
});
exports.stockPriceSchema = zod_1.z.object({
    price: zod_1.z.number().positive('Stock price must be positive'),
    currency: zod_1.z.string().min(3).max(5).default('USD').transform((s) => s.trim().toUpperCase()),
    change: zod_1.z.number().optional(),
    changePercent: zod_1.z.number().optional(),
    previousClose: zod_1.z.number().positive().optional(),
    volume: zod_1.z.number().nonnegative().optional(),
    priceTimestamp: zod_1.z.date().default(() => new Date()),
});
exports.financialMetricSchema = zod_1.z.object({
    metricName: zod_1.z.string().min(1).transform((s) => {
        const key = s.trim().toLowerCase().replace(/[\s_-]/g, '');
        return exports.CANONICAL_METRIC_MAP[key] || s.trim();
    }),
    metricValue: zod_1.z.number().refine((val) => !isNaN(val) && isFinite(val), {
        message: 'Metric value must be a valid finite number',
    }),
    currency: zod_1.z.string().min(2).max(5).default('USD').transform((s) => s.trim().toUpperCase()),
    unit: zod_1.z.string().default('raw').transform((s) => s.trim().toLowerCase()),
    reportingPeriod: zod_1.z.string().default('TTM').transform((s) => s.trim().toUpperCase()),
    dataTimestamp: zod_1.z.date().default(() => new Date()),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
exports.financialDocumentSchema = zod_1.z.object({
    documentType: zod_1.z.string().min(1).transform((s) => s.trim().toUpperCase()),
    title: zod_1.z.string().min(1).transform((s) => s.trim()),
    content: zod_1.z.string().optional(),
    publicationDate: zod_1.z.date().default(() => new Date()),
    sourceUrl: zod_1.z.string().url().optional(),
});
class FinancialDataValidator {
    static validateAndNormalize(raw) {
        const errors = [];
        let recordsCollected = 0;
        let recordsValidated = 0;
        let recordsRejected = 0;
        // 1. Symbol normalization
        const normalizedSymbol = raw.symbol.trim().toUpperCase();
        if (!normalizedSymbol) {
            errors.push('Missing or invalid stock symbol');
        }
        // 2. Validate Company Info
        let validatedCompanyInfo;
        if (raw.companyInfo) {
            recordsCollected++;
            const companyResult = exports.companyInfoSchema.safeParse({
                ...raw.companyInfo,
                symbol: normalizedSymbol,
            });
            if (companyResult.success) {
                validatedCompanyInfo = companyResult.data;
                recordsValidated++;
            }
            else {
                recordsRejected++;
                errors.push(`Company info validation failed: ${companyResult.error.message}`);
            }
        }
        // 3. Validate Stock Price
        let validatedStockPrice;
        if (raw.stockPrice) {
            recordsCollected++;
            const priceResult = exports.stockPriceSchema.safeParse(raw.stockPrice);
            if (priceResult.success) {
                validatedStockPrice = priceResult.data;
                recordsValidated++;
            }
            else {
                recordsRejected++;
                errors.push(`Stock price validation failed: ${priceResult.error.message}`);
            }
        }
        // 4. Validate Financial Metrics and deduplicate in-batch
        const validatedMetrics = [];
        const seenMetricKeys = new Set();
        for (const metric of raw.financialMetrics || []) {
            recordsCollected++;
            const metricResult = exports.financialMetricSchema.safeParse(metric);
            if (!metricResult.success) {
                recordsRejected++;
                errors.push(`Invalid metric "${metric.metricName}": ${metricResult.error.issues.map((i) => i.message).join(', ')}`);
                continue;
            }
            const validatedMetric = metricResult.data;
            const dedupeKey = `${validatedMetric.metricName}_${validatedMetric.reportingPeriod}_${validatedMetric.currency}`;
            if (seenMetricKeys.has(dedupeKey)) {
                // In-batch duplicate detected
                continue;
            }
            seenMetricKeys.add(dedupeKey);
            // Data consistency checks
            let validationStatus = 'VALID';
            if (validatedMetric.metricName === 'marketCap' &&
                validatedMetric.metricValue <= 0) {
                validationStatus = 'WARNING';
                errors.push(`Suspicious non-positive Market Cap value: ${validatedMetric.metricValue}`);
            }
            validatedMetrics.push({
                ...validatedMetric,
                validationStatus,
            });
            recordsValidated++;
        }
        // 5. Validate Documents
        const validatedDocuments = [];
        for (const doc of raw.financialDocuments || []) {
            recordsCollected++;
            const docResult = exports.financialDocumentSchema.safeParse(doc);
            if (docResult.success) {
                validatedDocuments.push(docResult.data);
                recordsValidated++;
            }
            else {
                recordsRejected++;
                errors.push(`Document validation error: ${docResult.error.message}`);
            }
        }
        return {
            symbol: normalizedSymbol,
            source: raw.source,
            sourceUrl: raw.sourceUrl,
            scraperProvider: raw.scraperProvider,
            collectedAt: raw.collectedAt || new Date(),
            companyInfo: validatedCompanyInfo,
            stockPrice: validatedStockPrice,
            financialMetrics: validatedMetrics,
            financialDocuments: validatedDocuments,
            validationErrors: errors,
            recordsCount: {
                collected: recordsCollected,
                validated: recordsValidated,
                rejected: recordsRejected,
            },
        };
    }
}
exports.FinancialDataValidator = FinancialDataValidator;
//# sourceMappingURL=financialData.validator.js.map