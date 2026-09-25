import { Asset } from '../../models/Asset.model';
import { FinancialData } from '../../models/FinancialData.model';
import { StockPrice } from '../../models/StockPrice.model';
import { FinancialDocument } from '../../models/FinancialDocument.model';
import { AppError } from '../../utils/apiResponse';

export interface FinancialsFilterParams {
  metricName?: string;
  reportingPeriod?: string;
  source?: string;
  currency?: string;
}

export interface PricesFilterParams {
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export class StockService {
  /**
   * Search stocks by symbol or company name
   */
  public static async searchStocks(query: string, limit = 20) {
    if (!query || !query.trim()) {
      return [];
    }

    const cleanQuery = query.trim();
    const regex = new RegExp(cleanQuery, 'i');

    const assets = await Asset.find({
      $or: [{ symbol: regex }, { companyName: regex }],
    })
      .limit(limit)
      .lean();

    return assets;
  }

  /**
   * Get company profile and latest stock price by symbol
   */
  public static async getCompanyProfile(symbol: string) {
    const cleanSym = symbol.trim().toUpperCase();
    const asset = await Asset.findOne({ symbol: cleanSym }).lean();

    if (!asset) {
      throw new AppError(`Stock asset with symbol '${cleanSym}' not found in database. Please scrape it first.`, 404, 'ASSET_NOT_FOUND');
    }

    // Also attach latest price
    const latestPrice = await StockPrice.findOne({ assetId: asset._id })
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
  public static async getFinancialData(symbol: string, filters: FinancialsFilterParams = {}) {
    const cleanSym = symbol.trim().toUpperCase();
    const asset = await Asset.findOne({ symbol: cleanSym }).lean();

    if (!asset) {
      throw new AppError(`Stock asset with symbol '${cleanSym}' not found.`, 404, 'ASSET_NOT_FOUND');
    }

    const query: Record<string, any> = { assetId: asset._id };

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

    const financials = await FinancialData.find(query)
      .sort({ reportingPeriod: -1, collectedAt: -1 })
      .lean();

    // Also group by canonical metric name for convenience
    const metricsMap: Record<string, any> = {};
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
  public static async getStockPrices(symbol: string, filters: PricesFilterParams = {}) {
    const cleanSym = symbol.trim().toUpperCase();
    const asset = await Asset.findOne({ symbol: cleanSym }).lean();

    if (!asset) {
      throw new AppError(`Stock asset with symbol '${cleanSym}' not found.`, 404, 'ASSET_NOT_FOUND');
    }

    const limit = Math.min(500, Math.max(1, Number(filters.limit) || 50));
    const query: Record<string, any> = { assetId: asset._id };

    if (filters.startDate || filters.endDate) {
      query.priceTimestamp = {};
      if (filters.startDate) {
        query.priceTimestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.priceTimestamp.$lte = new Date(filters.endDate);
      }
    }

    const prices = await StockPrice.find(query)
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
  public static async getAvailableSources(symbol: string) {
    const cleanSym = symbol.trim().toUpperCase();
    const asset = await Asset.findOne({ symbol: cleanSym }).lean();

    if (!asset) {
      throw new AppError(`Stock asset with symbol '${cleanSym}' not found.`, 404, 'ASSET_NOT_FOUND');
    }

    const [financialSources, priceSources, docSources] = await Promise.all([
      FinancialData.distinct('source', { assetId: asset._id }),
      StockPrice.distinct('source', { assetId: asset._id }),
      FinancialDocument.distinct('source', { assetId: asset._id }),
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
  public static async getFinancialDocuments(symbol: string, documentType?: string) {
    const cleanSym = symbol.trim().toUpperCase();
    const asset = await Asset.findOne({ symbol: cleanSym }).lean();

    if (!asset) {
      throw new AppError(`Stock asset with symbol '${cleanSym}' not found.`, 404, 'ASSET_NOT_FOUND');
    }

    const query: Record<string, any> = { assetId: asset._id };
    if (documentType) {
      query.documentType = new RegExp(documentType.trim(), 'i');
    }

    const documents = await FinancialDocument.find(query)
      .sort({ publicationDate: -1, collectedAt: -1 })
      .lean();

    return {
      symbol: cleanSym,
      count: documents.length,
      documents,
    };
  }
}
