"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScrapingController = void 0;
const zod_1 = require("zod");
const scraping_service_1 = require("./scraping.service");
const marketDiscovery_service_1 = require("./discovery/marketDiscovery.service");
const scraping_scheduler_1 = require("./scraping.scheduler");
const apiResponse_1 = require("../../utils/apiResponse");
const triggerScrapingSchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1, 'Stock symbol is required').max(20),
    sources: zod_1.z.array(zod_1.z.string()).optional(),
    scraperProvider: zod_1.z.enum(['playwright', 'scrapingbee']).optional(),
});
const discoverScrapeSchema = zod_1.z.object({
    region: zod_1.z.enum(['india', 'global', 'all']).optional(),
    limit: zod_1.z.number().int().positive().max(200).optional(),
    scraperProvider: zod_1.z.enum(['playwright', 'scrapingbee']).optional(),
});
class ScrapingController {
    static async triggerScrape(req, res, next) {
        try {
            const validated = triggerScrapingSchema.parse(req.body);
            const job = await scraping_service_1.ScrapingService.triggerScrape(validated);
            (0, apiResponse_1.sendSuccess)(res, job, `Scraping job completed with status: ${job.status}`, 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async getJobStatus(req, res, next) {
        try {
            const jobId = String(req.params.jobId);
            const job = await scraping_service_1.ScrapingService.getJobById(jobId);
            (0, apiResponse_1.sendSuccess)(res, job, 'Scraping job details retrieved successfully', 200);
        }
        catch (error) {
            next(error);
        }
    }
    static async getJobsHistory(req, res, next) {
        try {
            const { page, limit, symbol, status } = req.query;
            const result = await scraping_service_1.ScrapingService.getJobsHistory({
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                symbol: symbol ? String(symbol) : undefined,
                status: status ? String(status) : undefined,
            });
            (0, apiResponse_1.sendSuccess)(res, result.jobs, 'Scraping jobs retrieved successfully', 200, result.pagination);
        }
        catch (error) {
            next(error);
        }
    }
    static async getSupportedSources(req, res, next) {
        try {
            const sources = scraping_service_1.ScrapingService.getSupportedSources();
            (0, apiResponse_1.sendSuccess)(res, sources, 'Supported financial data sources retrieved', 200);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Dynamically discover stock market companies directly from source websites (Screener.in / CompaniesMarketCap)
     */
    static async discoverCompanies(req, res, next) {
        try {
            const region = req.query.region || 'all';
            const limit = req.query.limit ? Number(req.query.limit) : 80;
            const discovered = await marketDiscovery_service_1.MarketDiscoveryService.discoverLiveCompanies({ region, limit });
            (0, apiResponse_1.sendSuccess)(res, {
                count: discovered.length,
                region,
                companies: discovered,
            }, `Dynamically discovered ${discovered.length} companies from live source websites`, 200);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Dynamically discover companies from source websites and immediately scrape their full financials
     */
    static async discoverAndScrape(req, res, next) {
        try {
            const validated = discoverScrapeSchema.parse(req.body);
            const region = validated.region || 'all';
            const limit = validated.limit || 80;
            const scraperProvider = validated.scraperProvider || 'playwright';
            const discovered = await marketDiscovery_service_1.MarketDiscoveryService.discoverLiveCompanies({ region, limit });
            // Trigger scraping for each dynamically discovered company
            const results = [];
            for (const comp of discovered) {
                try {
                    const sources = ['screener-in', 'yahoo-finance'];
                    const job = await scraping_service_1.ScrapingService.triggerScrape({
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
                }
                catch (itemErr) {
                    results.push({
                        symbol: comp.symbol,
                        name: comp.name,
                        country: comp.country,
                        status: 'FAILED',
                        error: itemErr.message || itemErr,
                    });
                }
            }
            (0, apiResponse_1.sendSuccess)(res, {
                discoveredCount: discovered.length,
                scrapedCount: results.filter((r) => r.status === 'COMPLETED' || r.status === 'PARTIAL').length,
                results,
            }, 'Live market discovery and scraping workflow completed', 200);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Trigger scraping specifically for companies that currently have NO saved data
     */
    static async scrapeUnsaved(req, res, next) {
        try {
            const onlyUnsaved = req.body?.onlyUnsaved !== false;
            const forceAll = req.body?.forceAll === true;
            const maxCompanies = req.body?.maxCompanies ? Number(req.body.maxCompanies) : undefined;
            const result = await scraping_scheduler_1.ScrapingScheduler.runScrapeCycle({
                onlyUnsaved,
                forceAll,
                maxCompanies,
            });
            (0, apiResponse_1.sendSuccess)(res, result, 'Unsaved companies scraping cycle executed', 200);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ScrapingController = ScrapingController;
//# sourceMappingURL=scraping.controller.js.map