import { z } from 'zod';
import {
  RawStockData,
  RawFinancialMetric,
  RawStockPriceData,
  RawCompanyInfo,
  RawFinancialDocument,
} from '../scrapers/scraper.interface';

// Canonical Metric Names
export const CANONICAL_METRIC_MAP: Record<string, string> = {
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
export const companyInfoSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.trim().toUpperCase()),
  companyName: z.string().min(1).max(255).transform((s) => s.trim()),
  exchange: z.string().optional().transform((s) => s?.trim().toUpperCase()),
  country: z.string().optional().transform((s) => s?.trim()),
  sector: z.string().optional().transform((s) => s?.trim()),
  industry: z.string().optional().transform((s) => s?.trim()),
  description: z.string().optional().transform((s) => s?.trim()),
});

export const stockPriceSchema = z.object({
  price: z.number().positive('Stock price must be positive'),
  currency: z.string().min(3).max(5).default('USD').transform((s) => s.trim().toUpperCase()),
  change: z.number().optional(),
  changePercent: z.number().optional(),
  previousClose: z.number().positive().optional(),
  volume: z.number().nonnegative().optional(),
  priceTimestamp: z.date().default(() => new Date()),
});

export const financialMetricSchema = z.object({
  metricName: z.string().min(1).transform((s) => {
    const key = s.trim().toLowerCase().replace(/[\s_-]/g, '');
    return CANONICAL_METRIC_MAP[key] || s.trim();
  }),
  metricValue: z.number().refine((val) => !isNaN(val) && isFinite(val), {
    message: 'Metric value must be a valid finite number',
  }),
  currency: z.string().min(2).max(5).default('USD').transform((s) => s.trim().toUpperCase()),
  unit: z.string().default('raw').transform((s) => s.trim().toLowerCase()),
  reportingPeriod: z.string().default('TTM').transform((s) => s.trim().toUpperCase()),
  dataTimestamp: z.date().default(() => new Date()),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const financialDocumentSchema = z.object({
  documentType: z.string().min(1).transform((s) => s.trim().toUpperCase()),
  title: z.string().min(1).transform((s) => s.trim()),
  content: z.string().optional(),
  publicationDate: z.date().default(() => new Date()),
  sourceUrl: z.string().url().optional(),
});

export interface ValidatedScrapedData {
  symbol: string;
  source: string;
  sourceUrl: string;
  scraperProvider: 'playwright' | 'scrapingbee';
  collectedAt: Date;
  companyInfo?: z.infer<typeof companyInfoSchema>;
  stockPrice?: z.infer<typeof stockPriceSchema>;
  financialMetrics: Array<z.infer<typeof financialMetricSchema> & { validationStatus: 'VALID' | 'WARNING' }>;
  financialDocuments: Array<z.infer<typeof financialDocumentSchema>>;
  validationErrors: string[];
  recordsCount: {
    collected: number;
    validated: number;
    rejected: number;
  };
}

export class FinancialDataValidator {
  public static validateAndNormalize(raw: RawStockData): ValidatedScrapedData {
    const errors: string[] = [];
    let recordsCollected = 0;
    let recordsValidated = 0;
    let recordsRejected = 0;

    // 1. Symbol normalization
    const normalizedSymbol = raw.symbol.trim().toUpperCase();
    if (!normalizedSymbol) {
      errors.push('Missing or invalid stock symbol');
    }

    // 2. Validate Company Info
    let validatedCompanyInfo: z.infer<typeof companyInfoSchema> | undefined;
    if (raw.companyInfo) {
      recordsCollected++;
      const companyResult = companyInfoSchema.safeParse({
        ...raw.companyInfo,
        symbol: normalizedSymbol,
      });
      if (companyResult.success) {
        validatedCompanyInfo = companyResult.data;
        recordsValidated++;
      } else {
        recordsRejected++;
        errors.push(`Company info validation failed: ${companyResult.error.message}`);
      }
    }

    // 3. Validate Stock Price
    let validatedStockPrice: z.infer<typeof stockPriceSchema> | undefined;
    if (raw.stockPrice) {
      recordsCollected++;
      const priceResult = stockPriceSchema.safeParse(raw.stockPrice);
      if (priceResult.success) {
        validatedStockPrice = priceResult.data;
        recordsValidated++;
      } else {
        recordsRejected++;
        errors.push(`Stock price validation failed: ${priceResult.error.message}`);
      }
    }

    // 4. Validate Financial Metrics and deduplicate in-batch
    const validatedMetrics: Array<
      z.infer<typeof financialMetricSchema> & { validationStatus: 'VALID' | 'WARNING' }
    > = [];
    const seenMetricKeys = new Set<string>();

    for (const metric of raw.financialMetrics || []) {
      recordsCollected++;
      const metricResult = financialMetricSchema.safeParse(metric);

      if (!metricResult.success) {
        recordsRejected++;
        errors.push(
          `Invalid metric "${metric.metricName}": ${metricResult.error.issues.map((i) => i.message).join(', ')}`
        );
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
      let validationStatus: 'VALID' | 'WARNING' = 'VALID';
      if (
        validatedMetric.metricName === 'marketCap' &&
        validatedMetric.metricValue <= 0
      ) {
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
    const validatedDocuments: Array<z.infer<typeof financialDocumentSchema>> = [];
    for (const doc of raw.financialDocuments || []) {
      recordsCollected++;
      const docResult = financialDocumentSchema.safeParse(doc);
      if (docResult.success) {
        validatedDocuments.push(docResult.data);
        recordsValidated++;
      } else {
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
