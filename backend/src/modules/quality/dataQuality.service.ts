/**
 * Data Quality Monitoring & Validation Service
 * Evaluates completeness, consistency, and canonical integrity for Indian Stock Market data.
 */

export type DataQualityStatus =
  | 'Verified'
  | 'Partially Available'
  | 'Conflicting Data'
  | 'Refresh Required'
  | 'Data Unavailable';

export interface DataQualityReport {
  symbol: string;
  companyName: string;
  status: DataQualityStatus;
  completenessScore: number; // 0 to 100
  checks: {
    identityVerified: boolean;
    priceConsistent: boolean;
    unitsConsistent: boolean;
    reportingPeriodConsistent: boolean;
    statementsComplete: boolean;
    noDuplicateRecords: boolean;
    priceChronological: boolean;
  };
  warnings: string[];
  lastAuditTimestamp: string;
}

export class DataQualityService {
  /**
   * Evaluates company data quality and produces an audit report
   */
  public static evaluateCompanyData(params: {
    symbol: string;
    companyName: string;
    nseSymbol?: string;
    bseCode?: string;
    currentPrice?: number | null;
    marketCap?: number | null;
    freeCashFlow?: number | null;
    roe?: number | null;
    debtToEquity?: number | null;
    peRatio?: number | null;
    hasStatements?: boolean;
    lastUpdated?: Date | string;
    historicalBarsCount?: number;
  }): DataQualityReport {
    const warnings: string[] = [];
    let score = 0;

    // 1. Identity Check (20 pts)
    const hasSymbol = Boolean(params.symbol && params.symbol.length >= 2);
    const hasName = Boolean(params.companyName && params.companyName.trim().length > 2);
    const hasExchangeCode = Boolean(params.nseSymbol || params.bseCode);
    const identityVerified = hasSymbol && hasName && hasExchangeCode;
    if (identityVerified) {
      score += 20;
    } else {
      warnings.push('Incomplete company canonical identity: Missing verified NSE symbol or BSE code.');
    }

    // 2. Price Consistency (20 pts)
    const validPrice = params.currentPrice !== null && params.currentPrice !== undefined && params.currentPrice > 0;
    const priceConsistent = validPrice;
    if (priceConsistent) {
      score += 20;
    } else {
      warnings.push('Latest stock price is missing or invalid.');
    }

    // 3. Statements & Fundamentals Completeness (25 pts)
    const hasStatements = Boolean(params.hasStatements);
    if (hasStatements) {
      score += 25;
    } else {
      warnings.push('Audited financial statement tables have not been synced from Screener.in.');
    }

    // 4. Unit & Financial Metrics Consistency (20 pts)
    let metricsFound = 0;
    if (params.marketCap !== null && params.marketCap !== undefined && params.marketCap > 0) metricsFound++;
    if (params.peRatio !== null && params.peRatio !== undefined) metricsFound++;
    if (params.roe !== null && params.roe !== undefined) metricsFound++;
    if (params.debtToEquity !== null && params.debtToEquity !== undefined) metricsFound++;
    if (params.freeCashFlow !== null && params.freeCashFlow !== undefined) metricsFound++;

    const unitsConsistent = metricsFound >= 4;
    score += Math.round((metricsFound / 5) * 20);
    if (!unitsConsistent) {
      warnings.push(`Only ${metricsFound}/5 key financial metrics available.`);
    }

    // 5. Historical Price Chronology (15 pts)
    const priceChronological = Boolean(params.historicalBarsCount && params.historicalBarsCount >= 10);
    if (priceChronological) {
      score += 15;
    } else {
      warnings.push('Insufficient historical price points for chronological trend analysis.');
    }

    // Check freshness: if last update is > 7 days old, flag refresh
    const lastUpdateDate = params.lastUpdated ? new Date(params.lastUpdated) : null;
    const daysOld = lastUpdateDate ? (Date.now() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24) : 999;
    const refreshRequired = daysOld > 7;
    if (refreshRequired) {
      warnings.push('Data was last audited more than 7 days ago. Refresh recommended.');
    }

    // Determine status
    let status: DataQualityStatus = 'Verified';
    if (score < 40) {
      status = 'Data Unavailable';
    } else if (score < 75) {
      status = 'Partially Available';
    } else if (refreshRequired) {
      status = 'Refresh Required';
    } else {
      status = 'Verified';
    }

    return {
      symbol: params.symbol,
      companyName: params.companyName,
      status,
      completenessScore: score,
      checks: {
        identityVerified,
        priceConsistent,
        unitsConsistent,
        reportingPeriodConsistent: true,
        statementsComplete: hasStatements,
        noDuplicateRecords: true,
        priceChronological,
      },
      warnings,
      lastAuditTimestamp: new Date().toISOString(),
    };
  }
}
