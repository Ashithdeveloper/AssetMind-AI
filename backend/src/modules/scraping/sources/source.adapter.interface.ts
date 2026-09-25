import { RawStockData } from '../scrapers/scraper.interface';

export interface SourceInfo {
  id: string;
  name: string;
  baseUrl: string;
  supportedMetrics: string[];
  supportedScrapers: ('playwright' | 'scrapingbee')[];
  description: string;
}

export interface SourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly supportedMetrics: string[];
  
  getInfo(): SourceInfo;
  buildUrl(symbol: string): string;
  getWaitForSelector?(): string;
  extractData(
    html: string,
    symbol: string,
    sourceUrl: string,
    scraperProvider: 'playwright' | 'scrapingbee'
  ): Promise<RawStockData>;
}
