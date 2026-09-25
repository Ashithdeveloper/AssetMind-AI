import axios from 'axios';
import { StockScraper } from './scraper.interface';
import { env } from '../../../config/env';
import { AppError } from '../../../utils/apiResponse';

export class ScrapingBeeStockScraper implements StockScraper {
  public readonly provider = 'scrapingbee' as const;
  private apiKey: string;
  private baseUrl = 'https://app.scrapingbee.com/api/v1/';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || env.SCRAPINGBEE_API_KEY;
  }

  public async fetchHtml(url: string, waitForSelector?: string): Promise<string> {
    if (!this.apiKey) {
      throw new AppError(
        'ScrapingBee API key is not configured. Please set SCRAPINGBEE_API_KEY in your .env file.',
        400,
        'SCRAPINGBEE_KEY_MISSING'
      );
    }

    try {
      const params: Record<string, any> = {
        api_key: this.apiKey,
        url,
        render_js: 'true',
        block_ads: 'true',
        block_resources: 'false',
        premium_proxy: 'false',
      };

      if (waitForSelector) {
        params.wait_for = waitForSelector;
      }

      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 45000,
        headers: {
          Accept: 'text/html',
        },
      });

      return response.data;
    } catch (error: any) {
      const statusCode = error.response?.status || 500;
      const message = error.response?.data?.message || error.message || 'ScrapingBee request failed';
      throw new AppError(
        `ScrapingBee error (${statusCode}): ${message}`,
        statusCode >= 400 && statusCode < 500 ? 400 : 502,
        'SCRAPINGBEE_REQUEST_FAILED',
        { originalError: message, targetUrl: url }
      );
    }
  }
}
