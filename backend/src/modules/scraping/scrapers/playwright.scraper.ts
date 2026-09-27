import { chromium, Browser, BrowserContext } from 'playwright';
import { StockScraper } from './scraper.interface';
import { env } from '../../../config/env';

// In-memory cache for fetched HTML to avoid duplicate fetches for same URL
const htmlCache = new Map<string, { html: string; timestamp: number }>();
const HTML_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class PlaywrightStockScraper implements StockScraper {
  public readonly provider = 'playwright' as const;
  private browserInstance: Browser | null = null;
  private contextInstance: BrowserContext | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browserInstance || !this.browserInstance.isConnected()) {
      // Close stale context if browser died
      this.contextInstance = null;
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

  /**
   * Reuse a single BrowserContext across fetches to avoid the overhead
   * of creating new contexts (cookie jars, proxy configs, etc.) for every URL.
   */
  private async getContext(): Promise<BrowserContext> {
    if (this.contextInstance) return this.contextInstance;

    const browser = await this.getBrowser();
    this.contextInstance = await browser.newContext({
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
    return this.contextInstance;
  }

  public async fetchHtml(url: string, waitForSelector?: string): Promise<string> {
    // Check in-memory cache first to skip duplicate fetches
    const cached = htmlCache.get(url);
    if (cached && Date.now() - cached.timestamp < HTML_CACHE_TTL_MS) {
      return cached.html;
    }

    const context = await this.getContext();
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

      // Small delay for dynamic client hydration (reduced from 1200ms)
      await page.waitForTimeout(500);

      const html = await page.content();

      // Cache the result
      htmlCache.set(url, { html, timestamp: Date.now() });

      return html;
    } finally {
      await page.close().catch(() => {});
    }
  }

  public async close(): Promise<void> {
    if (this.contextInstance) {
      await this.contextInstance.close().catch(() => {});
      this.contextInstance = null;
    }
    if (this.browserInstance) {
      await this.browserInstance.close().catch(() => {});
      this.browserInstance = null;
    }
    // Clear HTML cache on close
    htmlCache.clear();
  }
}
