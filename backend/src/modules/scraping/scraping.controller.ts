import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ScrapingService } from './scraping.service';
import { MarketDiscoveryService } from './discovery/marketDiscovery.service';
import { ScrapingScheduler } from './scraping.scheduler';
import { sendSuccess } from '../../utils/apiResponse';

const triggerScrapingSchema = z.object({
  symbol: z.string().min(1, 'Stock symbol is required').max(20),
  sources: z.array(z.string()).optional(),
  scraperProvider: z.enum(['playwright', 'scrapingbee']).optional(),
});

const discoverScrapeSchema = z.object({
  region: z.enum(['india', 'global', 'all']).optional(),
  limit: z.number().int().positive().max(200).optional(),
  scraperProvider: z.enum(['playwright', 'scrapingbee']).optional(),
});

export class ScrapingController {
  public static async triggerScrape(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = triggerScrapingSchema.parse(req.body);
      const job = await ScrapingService.triggerScrape(validated);
      sendSuccess(res, job, `Scraping job completed with status: ${job.status}`, 201);
    } catch (error) {
      next(error);
    }
  }

  public static async getJobStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = String(req.params.jobId);
      const job = await ScrapingService.getJobById(jobId);
      sendSuccess(res, job, 'Scraping job details retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getJobsHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, symbol, status } = req.query;
      const result = await ScrapingService.getJobsHistory({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        symbol: symbol ? String(symbol) : undefined,
        status: status ? String(status) : undefined,
      });
      sendSuccess(res, result.jobs, 'Scraping jobs retrieved successfully', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  public static async getSupportedSources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sources = ScrapingService.getSupportedSources();
      sendSuccess(res, sources, 'Supported financial data sources retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dynamically discover stock market companies directly from source websites (Screener.in / CompaniesMarketCap)
   */
  public static async discoverCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const region = (req.query.region as 'india' | 'global' | 'all') || 'all';
      const limit = req.query.limit ? Number(req.query.limit) : 80;

      const discovered = await MarketDiscoveryService.discoverLiveCompanies({ region, limit });
      sendSuccess(
        res,
        {
          count: discovered.length,
          region,
          companies: discovered,
        },
        `Dynamically discovered ${discovered.length} companies from live source websites`,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dynamically discover companies from source websites and immediately scrape their full financials
   */
  public static async discoverAndScrape(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = discoverScrapeSchema.parse(req.body);
      const region = validated.region || 'all';
      const limit = validated.limit || 80;
      const scraperProvider = validated.scraperProvider || 'playwright';

      const discovered = await MarketDiscoveryService.discoverLiveCompanies({ region, limit });

      // Trigger scraping for each dynamically discovered company
      const results: any[] = [];
      for (const comp of discovered) {
        try {
          const sources = ['screener-in', 'yahoo-finance'];

          const job = await ScrapingService.triggerScrape({
            symbol: comp.symbol,
            sources,
            scraperProvider,
          });

          results.push({
            symbol: comp.symbol,
            name: comp.name,
            country: comp.country,
            status: job.status,
            recordsValidated: job.recordsValidated,
          });
        } catch (itemErr: any) {
          results.push({
            symbol: comp.symbol,
            name: comp.name,
            country: comp.country,
            status: 'FAILED',
            error: itemErr.message || itemErr,
          });
        }
      }

      sendSuccess(
        res,
        {
          discoveredCount: discovered.length,
          scrapedCount: results.filter((r) => r.status === 'COMPLETED' || r.status === 'PARTIAL').length,
          results,
        },
        'Live market discovery and scraping workflow completed',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger scraping specifically for companies that currently have NO saved data
   */
  public static async scrapeUnsaved(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const onlyUnsaved = req.body?.onlyUnsaved !== false;
      const forceAll = req.body?.forceAll === true;
      const maxCompanies = req.body?.maxCompanies ? Number(req.body.maxCompanies) : undefined;

      const result = await ScrapingScheduler.runScrapeCycle({
        onlyUnsaved,
        forceAll,
        maxCompanies,
      });

      sendSuccess(res, result, 'Unsaved companies scraping cycle executed', 200);
    } catch (error) {
      next(error);
    }
  }
}

