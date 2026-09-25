import mongoose from 'mongoose';
import { Asset } from '../../models/Asset.model';
import { FinancialData } from '../../models/FinancialData.model';
import { StockPrice } from '../../models/StockPrice.model';
import { FinancialDocument } from '../../models/FinancialDocument.model';
import { ScrapingJob, IScrapingJob } from '../../models/ScrapingJob.model';
import { getScraper } from './scrapers';
import { getSourceAdapter, getAllSourceInfos, sourceAdapters } from './sources';
import { FinancialDataValidator, ValidatedScrapedData } from './validators/financialData.validator';
import { RagSyncService } from '../rag/services/ragSync.service';
import { AppError } from '../../utils/apiResponse';

export interface TriggerScrapeParams {
  symbol: string;
  sources?: string[];
  scraperProvider?: 'playwright' | 'scrapingbee';
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  symbol?: string;
  status?: string;
}

export class ScrapingService {
  /**
   * Get supported sources and their capabilities
   */
  public static getSupportedSources() {
    return getAllSourceInfos();
  }

  /**
   * Get scraping job status by ID
   */
  public static async getJobById(jobId: string) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      throw new AppError('Invalid job ID format', 400, 'INVALID_JOB_ID');
    }

    const job = await ScrapingJob.findById(jobId);
    if (!job) {
      throw new AppError('Scraping job not found', 404, 'JOB_NOT_FOUND');
    }

    return job;
  }

  /**
   * Get scraping history with pagination and filters
   */
  public static async getJobsHistory(params: PaginationParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (params.symbol) {
      query.symbol = params.symbol.trim().toUpperCase();
    }
    if (params.status) {
      query.status = params.status.trim().toUpperCase();
    }

    const [jobs, total] = await Promise.all([
      ScrapingJob.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ScrapingJob.countDocuments(query),
    ]);

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Core orchestrator: triggers scraping for a symbol across sources
   */
  public static async triggerScrape(params: TriggerScrapeParams) {
    const symbol = params.symbol.trim().toUpperCase();
    if (!symbol) {
      throw new AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
    }

    const scraperProvider = params.scraperProvider || 'playwright';

    const isIndian =
      symbol.endsWith('.NS') ||
      symbol.endsWith('.BO') ||
      [
        'TCS',
        'INFY',
        'WIPRO',
        'HCLTECH',
        'ADANIENT',
        'ADANIPORTS',
        'ADANIGREEN',
        'ADANIPOWER',
        'OLAELEC',
        'RELIANCE',
        'TATAMOTORS',
        'HDFCBANK',
        'ICICIBANK',
        'SBIN',
        'ITC',
        'LT',
      ].includes(symbol.replace(/\.NS$|\.BO$/i, ''));

    // Target sources: defaults to screener-in for Indian equities, yahoo-finance & stockanalysis for global
    let targetSources =
      params.sources && params.sources.length > 0
        ? params.sources
        : isIndian
        ? ['screener-in', 'yahoo-finance']
        : ['yahoo-finance', 'stockanalysis'];

    // Normalize source ids
    targetSources = targetSources.map((s) => s.trim().toLowerCase().replace(/[_\s]/g, '-'));

    // Validate that at least one valid source exists
    const validSources = targetSources.filter((s) => !!sourceAdapters[s]);
    if (validSources.length === 0) {
      throw new AppError(
        `None of the requested sources are valid. Supported sources: ${Object.keys(sourceAdapters).join(', ')}`,
        400,
        'INVALID_SOURCES'
      );
    }

    // Create scraping job record
    const job = await ScrapingJob.create({
      source: validSources.join(', '),
      symbol,
      scraperProvider,
      status: 'RUNNING',
      startedAt: new Date(),
      recordsCollected: 0,
      recordsValidated: 0,
      recordsRejected: 0,
    });

    // Run scraping asynchronously or wait
    try {
      let totalCollected = 0;
      let totalValidated = 0;
      let totalRejected = 0;
      const errors: string[] = [];

      for (const sourceId of validSources) {
        const adapter = getSourceAdapter(sourceId);
        if (!adapter) continue;

        try {
          // If yahoo-finance and Indian equity without suffix, add .NS
          const querySymbol =
            sourceId === 'yahoo-finance' && isIndian && !symbol.includes('.')
              ? `${symbol}.NS`
              : symbol;

          const url = adapter.buildUrl(querySymbol);
          const scraper = getScraper(scraperProvider);
          const waitForSelector = adapter.getWaitForSelector ? adapter.getWaitForSelector() : undefined;

          // Fetch HTML with fast HTTP fallback for server-rendered sources
          let html = '';
          try {
            html = await scraper.fetchHtml(url, waitForSelector);
          } catch (fetchErr: any) {
            const axiosLib = (await import('axios')).default;
            const res = await axiosLib.get(url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              timeout: 20000,
            });
            html = res.data;
          }

          // Extract raw data
          const rawData = await adapter.extractData(html, symbol, url, scraperProvider);

          // Validate and normalize
          const validated = FinancialDataValidator.validateAndNormalize(rawData);

          totalCollected += validated.recordsCount.collected;
          totalValidated += validated.recordsCount.validated;
          totalRejected += validated.recordsCount.rejected;

          if (validated.validationErrors.length > 0) {
            errors.push(`[${adapter.name}] ${validated.validationErrors.join('; ')}`);
          }

          // Persist to MongoDB
          await this.persistScrapedData(validated);
        } catch (sourceErr: any) {
          const errMsg = `[${adapter.name}] Scraping failed: ${sourceErr.message || sourceErr}`;
          errors.push(errMsg);
          totalRejected++;
        }
      }

      // Determine final status
      const finalStatus =
        errors.length === 0
          ? 'COMPLETED'
          : totalValidated > 0
          ? 'PARTIAL'
          : 'FAILED';

      job.status = finalStatus;
      job.completedAt = new Date();
      job.recordsCollected = totalCollected;
      job.recordsValidated = totalValidated;
      job.recordsRejected = totalRejected;
      if (errors.length > 0) {
        job.errorMessage = errors.join(' | ');
      }
      await job.save();

      return job;
    } catch (err: any) {
      job.status = 'FAILED';
      job.completedAt = new Date();
      job.errorMessage = err.message || 'Scraping process encountered an unexpected failure';
      await job.save();
      throw err;
    }
  }

  /**
   * Persist validated data to MongoDB (Asset, FinancialData, StockPrice, FinancialDocument)
   */
  private static async persistScrapedData(data: ValidatedScrapedData): Promise<void> {
    // 1. Find or create Asset
    let asset = await Asset.findOne({ symbol: data.symbol });

    if (!asset) {
      asset = await Asset.create({
        symbol: data.symbol,
        companyName: data.companyInfo?.companyName || data.symbol,
        exchange: data.companyInfo?.exchange || 'UNKNOWN',
        country: data.companyInfo?.country,
        sector: data.companyInfo?.sector,
        industry: data.companyInfo?.industry,
        description: data.companyInfo?.description,
      });
    } else if (data.companyInfo) {
      // Update missing fields
      let changed = false;
      if (data.companyInfo.companyName && (!asset.companyName || asset.companyName === asset.symbol)) {
        asset.companyName = data.companyInfo.companyName;
        changed = true;
      }
      if (data.companyInfo.sector && !asset.sector) {
        asset.sector = data.companyInfo.sector;
        changed = true;
      }
      if (data.companyInfo.industry && !asset.industry) {
        asset.industry = data.companyInfo.industry;
        changed = true;
      }
      if (data.companyInfo.description && !asset.description) {
        asset.description = data.companyInfo.description;
        changed = true;
      }
      if (changed) {
        await asset.save();
      }
    }

    const assetId = asset._id;

    // 2. Save Stock Price if available
    if (data.stockPrice) {
      await StockPrice.create({
        assetId,
        symbol: data.symbol,
        price: data.stockPrice.price,
        currency: data.stockPrice.currency,
        change: data.stockPrice.change,
        changePercent: data.stockPrice.changePercent,
        previousClose: data.stockPrice.previousClose,
        volume: data.stockPrice.volume,
        priceTimestamp: data.stockPrice.priceTimestamp || new Date(),
        source: data.source,
        sourceUrl: data.sourceUrl,
        collectedAt: data.collectedAt,
      });
    }

    // 3. Upsert Financial Metrics (avoid duplicate metrics for same asset, period, metricName, and source)
    for (const metric of data.financialMetrics) {
      await FinancialData.findOneAndUpdate(
        {
          assetId,
          metricName: metric.metricName,
          reportingPeriod: metric.reportingPeriod,
          source: data.source,
        },
        {
          $set: {
            assetId,
            symbol: data.symbol,
            metricName: metric.metricName,
            metricValue: metric.metricValue,
            currency: metric.currency,
            unit: metric.unit,
            reportingPeriod: metric.reportingPeriod,
            dataTimestamp: metric.dataTimestamp,
            source: data.source,
            sourceUrl: data.sourceUrl,
            scraperProvider: data.scraperProvider,
            collectedAt: data.collectedAt,
            validationStatus: metric.validationStatus,
            metadata: metric.metadata,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 4. Save Financial Documents if any
    for (const doc of data.financialDocuments) {
      const existingDoc = await FinancialDocument.findOne({
        assetId,
        documentType: doc.documentType,
        title: doc.title,
      });

      if (!existingDoc) {
        await FinancialDocument.create({
          assetId,
          symbol: data.symbol,
          documentType: doc.documentType,
          title: doc.title,
          content: doc.content,
          source: data.source,
          sourceUrl: doc.sourceUrl || data.sourceUrl,
          publicationDate: doc.publicationDate,
          collectedAt: data.collectedAt,
          processingStatus: 'PROCESSED',
        });
      }
    }

    // Trigger asynchronous RAG vector indexing synchronization for the updated asset
    RagSyncService.syncAssetBySymbol(data.symbol).catch((ragErr) => {
      console.warn(`[ScrapingService] Background RAG sync for ${data.symbol} deferred:`, ragErr.message);
    });
  }
}
