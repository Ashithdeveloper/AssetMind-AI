"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockService = void 0;
const Asset_model_1 = require("../../models/Asset.model");
const FinancialData_model_1 = require("../../models/FinancialData.model");
const StockPrice_model_1 = require("../../models/StockPrice.model");
const FinancialDocument_model_1 = require("../../models/FinancialDocument.model");
const apiResponse_1 = require("../../utils/apiResponse");
class StockService {
    /**
     * Search stocks by symbol or company name
     */
    static async searchStocks(query, limit = 20) {
        if (!query || !query.trim()) {
            return [];
        }
        const cleanQuery = query.trim();
        const regex = new RegExp(cleanQuery, 'i');
        const assets = await Asset_model_1.Asset.find({
            $or: [{ symbol: regex }, { companyName: regex }],
        })
            .limit(limit)
            .lean();
        return assets;
    }
    /**
     * Get company profile and latest stock price by symbol
     */
    static async getCompanyProfile(symbol) {
        const cleanSym = symbol.trim().toUpperCase();
        const asset = await Asset_model_1.Asset.findOne({ symbol: cleanSym }).lean();
        if (!asset) {
            throw new apiResponse_1.AppError(`Stock asset with symbol '${cleanSym}' not found in database. Please scrape it first.`, 404, 'ASSET_NOT_FOUND');
        }
        // Also attach latest price
        const latestPrice = await StockPrice_model_1.StockPrice.findOne({ assetId: asset._id })
            .sort({ priceTimestamp: -1 })
            .lean();
        return {
            ...asset,
            latestPrice: latestPrice || null,
        };
    }
    /**
     * Get financial metrics with optional filtering
     */
    static async getFinancialData(symbol, filters = {}) {
        const cleanSym = symbol.trim().toUpperCase();
        const asset = await Asset_model_1.Asset.findOne({ symbol: cleanSym }).lean();
        if (!asset) {
            throw new apiResponse_1.AppError(`Stock asset with symbol '${cleanSym}' not found.`, 404, 'ASSET_NOT_FOUND');
        }
        const query = { assetId: asset._id };
        if (filters.metricName) {
            query.metricName = new RegExp(`^${filters.metricName.trim()}$`, 'i');
        }
        if (filters.reportingPeriod) {
            query.reportingPeriod = filters.reportingPeriod.trim().toUpperCase();
        }
        if (filters.source) {
            query.source = filters.source.trim().toLowerCase();
        }
        if (filters.currency) {
            query.currency = filters.currency.trim().toUpperCase();
        }
        const financials = await FinancialData_model_1.FinancialData.find(query)
            .sort({ reportingPeriod: -1, collectedAt: -1 })
            .lean();
        // Also group by canonical metric name for convenience
        const metricsMap = {};
        for (const item of financials) {
            if (!metricsMap[item.metricName]) {
                metricsMap[item.metricName] = item;
            }
        }
        return {
            symbol: cleanSym,
            companyName: asset.companyName,
            totalMetrics: financials.length,
            metrics: financials,
            summary: metricsMap,
        };
    }
    /**
     * Get historical stock prices
     */
    static async getStockPrices(symbol, filters = {}) {
        const cleanSym = symbol.trim().toUpperCase();
        const asset = await Asset_model_1.Asset.findOne({ symbol: cleanSym }).lean();
        if (!asset) {
            throw new apiResponse_1.AppError(`Stock asset with symbol '${cleanSym}' not found.`, 404, 'ASSET_NOT_FOUND');
        }
        const limit = Math.min(500, Math.max(1, Number(filters.limit) || 50));
        const query = { assetId: asset._id };
        if (filters.startDate || filters.endDate) {
            query.priceTimestamp = {};
            if (filters.startDate) {
                query.priceTimestamp.$gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                query.priceTimestamp.$lte = new Date(filters.endDate);
            }
        }
        const prices = await StockPrice_model_1.StockPrice.find(query)
            .sort({ priceTimestamp: -1 })
            .limit(limit)
            .lean();
        return {
            symbol: cleanSym,
            count: prices.length,
            prices,
        };
    }
    /**
     * Get list of data sources from which financial records exist for this symbol
     */
    static async getAvailableSources(symbol) {
        const cleanSym = symbol.trim().toUpperCase();
        const asset = await Asset_model_1.Asset.findOne({ symbol: cleanSym }).lean();
        if (!asset) {
            throw new apiResponse_1.AppError(`Stock asset with symbol '${cleanSym}' not found.`, 404, 'ASSET_NOT_FOUND');
        }
        const [financialSources, priceSources, docSources] = await Promise.all([
            FinancialData_model_1.FinancialData.distinct('source', { assetId: asset._id }),
            StockPrice_model_1.StockPrice.distinct('source', { assetId: asset._id }),
            FinancialDocument_model_1.FinancialDocument.distinct('source', { assetId: asset._id }),
        ]);
        const allSources = Array.from(new Set([...financialSources, ...priceSources, ...docSources]));
        return {
            symbol: cleanSym,
            sources: allSources,
            details: {
                financialDataSources: financialSources,
                priceDataSources: priceSources,
                documentSources: docSources,
            },
        };
    }
    /**
     * Get company filings and financial documents
     */
    static async getFinancialDocuments(symbol, documentType) {
        const cleanSym = symbol.trim().toUpperCase();
        const asset = await Asset_model_1.Asset.findOne({ symbol: cleanSym }).lean();
        if (!asset) {
            throw new apiResponse_1.AppError(`Stock asset with symbol '${cleanSym}' not found.`, 404, 'ASSET_NOT_FOUND');
        }
        const query = { assetId: asset._id };
        if (documentType) {
            query.documentType = new RegExp(documentType.trim(), 'i');
        }
        const documents = await FinancialDocument_model_1.FinancialDocument.find(query)
            .sort({ publicationDate: -1, collectedAt: -1 })
            .lean();
        return {
            symbol: cleanSym,
            count: documents.length,
            documents,
        };
    }
}
exports.StockService = StockService;
//# sourceMappingURL=stock.service.js.map