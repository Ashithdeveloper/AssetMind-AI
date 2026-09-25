import { chromium, Browser } from 'playwright';
import { StockScraper } from './scraper.interface';
import { env } from '../../../config/env';

export class PlaywrightStockScraper implements StockScraper {
  public readonly provider = 'playwright' as const;
  private browserInstance: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browserInstance || !this.browserInstance.isConnected()) {
      try {
        this.browserInstance = await chromium.launch({
          headless: env.PLAYWRIGHT_HEADLESS,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
          ],
        });
      } catch (err) {
        // Fallback to system chrome channel if bundled testing binary is unavailable
        this.browserInstance = await chromium.launch({
          channel: 'chrome',
          headless: env.PLAYWRIGHT_HEADLESS,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
          ],
        });
      }
    }
    return this.browserInstance;
  }

  public async fetchHtml(url: string, waitForSelector?: string): Promise<string> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Sec-Ch-Ua': '"Chromium";v="123", "Not:A-Brand";v="8"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
      },
    });

    const page = await context.newPage();

    try {
      page.setDefaultTimeout(30000);

      // Navigate to target page
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait for specific selector if requested
      if (waitForSelector) {
        try {
          await page.waitForSelector(waitForSelector, { timeout: 6000 });
        } catch {
          // If selector times out, proceed with current DOM
        }
      }

      // Small delay for dynamic client hydration
      await page.waitForTimeout(1200);

      const html = await page.content();
      return html;
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  }

  public async close(): Promise<void> {
    if (this.browserInstance) {
      await this.browserInstance.close().catch(() => {});
      this.browserInstance = null;
    }
  }
}
