import { StockScraper } from './scraper.interface';
import { PlaywrightStockScraper } from './playwright.scraper';
import { ScrapingBeeStockScraper } from './scrapingbee.scraper';
import { env } from '../../../config/env';

let playwrightInstance: PlaywrightStockScraper | null = null;
let scrapingBeeInstance: ScrapingBeeStockScraper | null = null;

export const getScraper = (provider?: 'playwright' | 'scrapingbee'): StockScraper => {
  const chosenProvider = provider || env.SCRAPER_PROVIDER;

  if (chosenProvider === 'scrapingbee') {
    if (!scrapingBeeInstance) {
      scrapingBeeInstance = new ScrapingBeeStockScraper();
    }
    return scrapingBeeInstance;
  }

  if (!playwrightInstance) {
    playwrightInstance = new PlaywrightStockScraper();
  }
  return playwrightInstance;
};

export * from './scraper.interface';
export * from './playwright.scraper';
export * from './scrapingbee.scraper';
