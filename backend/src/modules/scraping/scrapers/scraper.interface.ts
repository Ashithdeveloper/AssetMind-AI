export interface RawCompanyInfo {
  companyName?: string;
  symbol: string;
  exchange?: string;
  country?: string;
  industry?: string;
  sector?: string;
  description?: string;
}

export interface RawStockPriceData {
  price: number;
  currency?: string;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  priceTimestamp?: Date;
}

export interface RawFinancialMetric {
  metricName: string;
  metricValue: number;
  currency?: string;
  unit?: string;
  reportingPeriod?: string;
  dataTimestamp?: Date;
  metadata?: Record<string, any>;
}

export interface RawFinancialDocument {
  documentType: string;
  title: string;
  content?: string;
  publicationDate?: Date;
  sourceUrl?: string;
}

export interface RawStockData {
  symbol: string;
  source: string;
  sourceUrl: string;
  scraperProvider: 'playwright' | 'scrapingbee';
  collectedAt: Date;
  companyInfo?: RawCompanyInfo;
  stockPrice?: RawStockPriceData;
  financialMetrics: RawFinancialMetric[];
  financialDocuments?: RawFinancialDocument[];
  rawMetadata?: Record<string, any>;
}

export interface StockScraper {
  readonly provider: 'playwright' | 'scrapingbee';
  fetchHtml(url: string, waitForSelector?: string): Promise<string>;
}
