import { env } from '../../config/env';
import { ScrapingService } from './scraping.service';
import { MarketDiscoveryService } from './discovery/marketDiscovery.service';
import { Asset } from '../../models/Asset.model';
import { FinancialData } from '../../models/FinancialData.model';
import { StockPrice } from '../../models/StockPrice.model';
import { ScrapingJob } from '../../models/ScrapingJob.model';
import { ScreenerExtractionService } from './services/screenerExtraction.service';

export interface ScrapeCycleOptions {
  onlyUnsaved?: boolean;
  forceAll?: boolean;
  maxCompanies?: number;
}

export class ScrapingScheduler {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Start the background scraper scheduler.
   * Runs an immediate live website scrape upon server start, and recurs every 4 hours.
   */
  public static start(): void {
    if (!env.AUTO_SCRAPE_ENABLED) {
      console.log('[Scheduler] Background scraping scheduler is disabled by configuration.');
      return;
    }

    const intervalHours = Math.max(0.1, env.AUTO_SCRAPE_INTERVAL_HOURS);
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(`[Scheduler] Initializing automated stock scraping scheduler...`);
    console.log(`[Scheduler] ⏱️  Cycle interval: Every ${intervalHours} hours`);

    // 1. Trigger initial run immediately after a short delay to let server start completely
    setTimeout(() => {
      console.log('[Scheduler] 🚀 Starting startup discovery & scraping cycle...');
      this.runScrapeCycle().catch((err) => {
        console.error('[Scheduler] Startup scraping cycle error:', err.message || err);
      });
    }, 2000);

    // 2. Schedule recurring runs every interval (e.g., 4 hours)
    this.timer = setInterval(() => {
      console.log(`[Scheduler] ⏰ Starting scheduled ${intervalHours}-hour recurring scraping cycle...`);
      this.runScrapeCycle().catch((err) => {
        console.error('[Scheduler] Scheduled scraping cycle error:', err.message || err);
      });
    }, intervalMs);
  }

  /**
   * Stop the background scheduler
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Scheduler] Scraping scheduler stopped cleanly.');
    }
  }

  /**
   * Dynamically discover companies and scrape financials.
   * Prioritizes companies with NO saved data first, followed by stale data (> interval).
   * Redundant scrapes for companies with fresh saved data are skipped.
   */
  public static async runScrapeCycle(options: ScrapeCycleOptions = {}): Promise<{
    totalTracked: number;
    unsavedCount: number;
    staleCount: number;
    scrapedCount: number;
    completed: number;
    failed: number;
  }> {
    if (this.isRunning) {
      console.log('[Scheduler] Scraping cycle is already running, skipping overlapping execution.');
      return {
        totalTracked: 0,
        unsavedCount: 0,
        staleCount: 0,
        scrapedCount: 0,
        completed: 0,
        failed: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      // 1. Discover companies live directly from source websites (Screener.in & CompaniesMarketCap)
      console.log('[Scheduler] 🔍 Discovering companies directly from live source websites...');

      const candidateMap = new Map<
        string,
        {
          symbol: string;
          name: string;
          country: string;
          exchange: string;
          sector?: string;
          industry?: string;
          sources?: string[];
        }
      >();

      // a) Discover live companies directly from Screener.in
      try {
        const discovered = await MarketDiscoveryService.discoverLiveCompanies({
          region: 'india',
          limit: options.maxCompanies || 80,
        });
        for (const comp of discovered) {
          const sym = comp.symbol.toUpperCase();
          candidateMap.set(sym, {
            symbol: sym,
            name: comp.name || sym,
            country: 'India',
            exchange: comp.exchange || 'NSE',
          });
        }
      } catch (discErr: any) {
        console.warn('[Scheduler] Live discovery warning:', discErr.message || discErr);
      }

      // c) Load existing DB Indian assets
      const dbAssets = await Asset.find({ country: 'India' }).lean();
      for (const asset of dbAssets) {
        const sym = asset.symbol.toUpperCase();
        if (!candidateMap.has(sym)) {
          candidateMap.set(sym, {
            symbol: sym,
            name: asset.companyName || sym,
            country: 'India',
            exchange: asset.exchange || 'NSE',
            sector: asset.sector,
            industry: asset.industry,
          });
        }
      }

      // 2. Ensure all candidates are upserted into MongoDB Asset collection
      for (const [sym, info] of candidateMap.entries()) {
        await Asset.findOneAndUpdate(
          { symbol: sym },
          {
            $setOnInsert: {
              symbol: sym,
              companyName: info.name,
              country: info.country,
              exchange: info.exchange,
              sector: info.sector || 'General',
              industry: info.industry || 'General',
            },
          },
          { upsert: true, returnDocument: 'after' }
        );
      }

      // 3. Check MongoDB for companies that have NO saved data
      const [savedFinancialSymbols, savedPriceSymbols] = await Promise.all([
        FinancialData.distinct('symbol'),
        StockPrice.distinct('symbol'),
      ]);
      const savedSet = new Set<string>([
        ...savedFinancialSymbols.map((s: string) => s.toUpperCase()),
        ...savedPriceSymbols.map((s: string) => s.toUpperCase()),
      ]);

      // 4. Check last scraped timestamp for each company from ScrapingJob
      const recentJobs = await ScrapingJob.aggregate([
        { $match: { status: { $in: ['COMPLETED', 'PARTIAL'] } } },
        { $group: { _id: '$symbol', lastScraped: { $max: '$completedAt' } } },
      ]);
      const lastScrapedMap = new Map<string, Date>();
      for (const r of recentJobs) {
        if (r._id) {
          lastScrapedMap.set(String(r._id).toUpperCase(), new Date(r.lastScraped));
        }
      }

      const staleThresholdMs = env.AUTO_SCRAPE_INTERVAL_HOURS * 60 * 60 * 1000;
      const now = Date.now();

      const unsavedList: Array<{ symbol: string; country: string; sources?: string[] }> = [];
      const staleList: Array<{ symbol: string; country: string; sources?: string[]; lastScraped?: Date }> = [];
      const freshList: Array<{ symbol: string; country: string; sources?: string[]; lastScraped?: Date }> = [];

      for (const [sym, info] of candidateMap.entries()) {
        const item = {
          symbol: sym,
          country: info.country,
          sources: info.sources,
        };

        const hasSavedData = savedSet.has(sym);
        const lastScraped = lastScrapedMap.get(sym);

        if (!hasSavedData) {
          // Category 1: NO SAVED DATA (Priority 1)
          unsavedList.push(item);
        } else if (!lastScraped || now - lastScraped.getTime() > staleThresholdMs) {
          // Category 2: STALE DATA (> interval)
          staleList.push({ ...item, lastScraped });
        } else {
          // Category 3: FRESH DATA (< interval)
          freshList.push({ ...item, lastScraped });
        }
      }

      console.log(`===============================================================`);
      console.log(`[Scheduler] 📊 Target Inventory Breakdown:`);
      console.log(`   • Total Tracked Companies:    ${candidateMap.size}`);
      console.log(`   • ⚡ Companies with NO DATA:    ${unsavedList.length} (⚡ Priority 1 - Scraping First)`);
      console.log(`   • ⏱️  Companies with Stale Data: ${staleList.length} (Priority 2)`);
      console.log(`   • ⏭️  Companies with Fresh Data: ${freshList.length} (Skipping redundant)`);
      console.log(`===============================================================`);

      // Determine queue to scrape
      let queue: Array<{ symbol: string; country: string; sources?: string[] }> = [];

      if (options.onlyUnsaved) {
        queue = [...unsavedList];
      } else if (options.forceAll) {
        queue = [...unsavedList, ...staleList, ...freshList];
      } else {
        // Default: Scrape ALL unsaved first, then stale ones. Fresh ones are skipped!
        queue = [...unsavedList, ...staleList];
      }

      if (options.maxCompanies && options.maxCompanies > 0) {
        queue = queue.slice(0, options.maxCompanies);
      }

      if (queue.length === 0) {
        console.log(
          `[Scheduler] ✨ All ${candidateMap.size} companies already have fresh saved data. No scraping needed right now.`
        );
        return {
          totalTracked: candidateMap.size,
          unsavedCount: unsavedList.length,
          staleCount: staleList.length,
          scrapedCount: 0,
          completed: 0,
          failed: 0,
        };
      }

      console.log(
        `[Scheduler] 🔄 Commencing scraping for ${queue.length} companies (${unsavedList.length} with no saved data)...`
      );

      let completed = 0;
      let failed = 0;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        const isIndia = item.country === 'India';
        const isUnsaved = !savedSet.has(item.symbol);
        const tag = isUnsaved ? '⚡ UNSAVED' : '⏱️ STALE';

        try {
          console.log(`[Scheduler] [${i + 1}/${queue.length}] [${tag}] [INDIA] Scraping ${item.symbol} via Screener.in...`);
          await ScreenerExtractionService.scrapeCompany(item.symbol);
          console.log(`[Scheduler] ✔️ [${item.symbol}] Full fundamentals & financial statements scraped from Screener.in`);
          completed++;
        } catch (err: any) {
          console.error(`[Scheduler] ⚠️ Error scraping ${item.symbol}:`, err.message || err);
          failed++;
        }
      }

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[Scheduler] ✨ Scraping cycle completed in ${elapsedSec}s. (${completed} succeeded, ${failed} failed). Next cycle in ${env.AUTO_SCRAPE_INTERVAL_HOURS} hours.`
      );

      return {
        totalTracked: candidateMap.size,
        unsavedCount: unsavedList.length,
        staleCount: staleList.length,
        scrapedCount: queue.length,
        completed,
        failed,
      };
    } catch (err: any) {
      console.error('[Scheduler] Fatal error in live scraping cycle:', err);
      return {
        totalTracked: 0,
        unsavedCount: 0,
        staleCount: 0,
        scrapedCount: 0,
        completed: 0,
        failed: 0,
      };
    } finally {
      this.isRunning = false;
    }
  }
}
