"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScrapingService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Asset_model_1 = require("../../models/Asset.model");
const FinancialData_model_1 = require("../../models/FinancialData.model");
const StockPrice_model_1 = require("../../models/StockPrice.model");
const FinancialDocument_model_1 = require("../../models/FinancialDocument.model");
const ScrapingJob_model_1 = require("../../models/ScrapingJob.model");
const scrapers_1 = require("./scrapers");
const sources_1 = require("./sources");
const financialData_validator_1 = require("./validators/financialData.validator");
const ragSync_service_1 = require("../rag/services/ragSync.service");
const apiResponse_1 = require("../../utils/apiResponse");
class ScrapingService {
    /**
     * Get supported sources and their capabilities
     */
    static getSupportedSources() {
        return (0, sources_1.getAllSourceInfos)();
    }
    /**
     * Get scraping job status by ID
     */
    static async getJobById(jobId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(jobId)) {
            throw new apiResponse_1.AppError('Invalid job ID format', 400, 'INVALID_JOB_ID');
        }
        const job = await ScrapingJob_model_1.ScrapingJob.findById(jobId);
        if (!job) {
            throw new apiResponse_1.AppError('Scraping job not found', 404, 'JOB_NOT_FOUND');
        }
        return job;
    }
    /**
     * Get scraping history with pagination and filters
     */
    static async getJobsHistory(params) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
        const skip = (page - 1) * limit;
        const query = {};
        if (params.symbol) {
            query.symbol = params.symbol.trim().toUpperCase();
        }
        if (params.status) {
            query.status = params.status.trim().toUpperCase();
        }
        const [jobs, total] = await Promise.all([
            ScrapingJob_model_1.ScrapingJob.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            ScrapingJob_model_1.ScrapingJob.countDocuments(query),
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
    static async triggerScrape(params) {
        const symbol = params.symbol.trim().toUpperCase();
        if (!symbol) {
            throw new apiResponse_1.AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
        }
        const scraperProvider = params.scraperProvider || 'playwright';
        const isIndian = symbol.endsWith('.NS') ||
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
        // Target sources: defaults strictly to Screener.in and Yahoo Finance India for Indian equities
        let targetSources = params.sources && params.sources.length > 0
            ? params.sources
            : ['screener-in', 'yahoo-finance'];
        // Normalize source ids
        targetSources = targetSources.map((s) => s.trim().toLowerCase().replace(/[_\s]/g, '-'));
        // Validate that at least one valid source exists
        const validSources = targetSources.filter((s) => !!sources_1.sourceAdapters[s]);
        if (validSources.length === 0) {
            throw new apiResponse_1.AppError(`None of the requested sources are valid. Supported sources: ${Object.keys(sources_1.sourceAdapters).join(', ')}`, 400, 'INVALID_SOURCES');
        }
        // Create scraping job record
        const job = await ScrapingJob_model_1.ScrapingJob.create({
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
            const errors = [];
            for (const sourceId of validSources) {
                const adapter = (0, sources_1.getSourceAdapter)(sourceId);
                if (!adapter)
                    continue;
                try {
                    // If yahoo-finance and Indian equity without suffix, add .NS
                    const querySymbol = sourceId === 'yahoo-finance' && isIndian && !symbol.includes('.')
                        ? `${symbol}.NS`
                        : symbol;
                    const url = adapter.buildUrl(querySymbol);
                    const scraper = (0, scrapers_1.getScraper)(scraperProvider);
                    const waitForSelector = adapter.getWaitForSelector ? adapter.getWaitForSelector() : undefined;
                    // Fetch HTML with fast HTTP fallback for server-rendered sources
                    let html = '';
                    try {
                        html = await scraper.fetchHtml(url, waitForSelector);
                    }
                    catch (fetchErr) {
                        const axiosLib = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
                        const res = await axiosLib.get(url, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                            timeout: 20000,
                        });
                        html = res.data;
                    }
                    // Extract raw data
                    const rawData = await adapter.extractData(html, symbol, url, scraperProvider);
                    // Validate and normalize
                    const validated = financialData_validator_1.FinancialDataValidator.validateAndNormalize(rawData);
                    totalCollected += validated.recordsCount.collected;
                    totalValidated += validated.recordsCount.validated;
                    totalRejected += validated.recordsCount.rejected;
                    if (validated.validationErrors.length > 0) {
                        errors.push(`[${adapter.name}] ${validated.validationErrors.join('; ')}`);
                    }
                    // Persist to MongoDB
                    await this.persistScrapedData(validated);
                }
                catch (sourceErr) {
                    const errMsg = `[${adapter.name}] Scraping failed: ${sourceErr.message || sourceErr}`;
                    errors.push(errMsg);
                    totalRejected++;
                }
            }
            // Determine final status
            const finalStatus = errors.length === 0
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
        }
        catch (err) {
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
    static async persistScrapedData(data) {
        // 1. Find or create Asset
        let asset = await Asset_model_1.Asset.findOne({ symbol: data.symbol });
        if (!asset) {
            asset = await Asset_model_1.Asset.create({
                symbol: data.symbol,
                companyName: data.companyInfo?.companyName || data.symbol,
                exchange: data.companyInfo?.exchange || 'UNKNOWN',
                country: data.companyInfo?.country,
                sector: data.companyInfo?.sector,
                industry: data.companyInfo?.industry,
                description: data.companyInfo?.description,
            });
        }
        else if (data.companyInfo) {
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
            await StockPrice_model_1.StockPrice.create({
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
            await FinancialData_model_1.FinancialData.findOneAndUpdate({
                assetId,
                metricName: metric.metricName,
                reportingPeriod: metric.reportingPeriod,
                source: data.source,
            }, {
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
            }, { upsert: true, returnDocument: 'after' });
        }
        // 4. Save Financial Documents if any
        for (const doc of data.financialDocuments) {
            const existingDoc = await FinancialDocument_model_1.FinancialDocument.findOne({
                assetId,
                documentType: doc.documentType,
                title: doc.title,
            });
            if (!existingDoc) {
                await FinancialDocument_model_1.FinancialDocument.create({
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
        ragSync_service_1.RagSyncService.syncAssetBySymbol(data.symbol).catch((ragErr) => {
            console.warn(`[ScrapingService] Background RAG sync for ${data.symbol} deferred:`, ragErr.message);
        });
    }
}
exports.ScrapingService = ScrapingService;
//# sourceMappingURL=scraping.service.js.map