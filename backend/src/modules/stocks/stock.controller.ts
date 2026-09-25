import { Request, Response, NextFunction } from 'express';
import { StockService } from './stock.service';
import { sendSuccess } from '../../utils/apiResponse';

export class StockController {
  public static async searchStocks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = String(req.query.q || '');
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const results = await StockService.searchStocks(q, limit);
      sendSuccess(res, results, 'Stock search results retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getCompanyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol);
      const profile = await StockService.getCompanyProfile(symbol);
      sendSuccess(res, profile, 'Company profile retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getFinancialData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol);
      const { metricName, reportingPeriod, source, currency } = req.query;

      const data = await StockService.getFinancialData(symbol, {
        metricName: metricName ? String(metricName) : undefined,
        reportingPeriod: reportingPeriod ? String(reportingPeriod) : undefined,
        source: source ? String(source) : undefined,
        currency: currency ? String(currency) : undefined,
      });

      sendSuccess(res, data, 'Financial data retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getStockPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol);
      const { limit, startDate, endDate } = req.query;

      const data = await StockService.getStockPrices(symbol, {
        limit: limit ? Number(limit) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });

      sendSuccess(res, data, 'Stock prices retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getAvailableSources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol);
      const data = await StockService.getAvailableSources(symbol);
      sendSuccess(res, data, 'Available data sources retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getFinancialDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol);
      const { documentType } = req.query;

      const data = await StockService.getFinancialDocuments(
        symbol,
        documentType ? String(documentType) : undefined
      );

      sendSuccess(res, data, 'Financial documents retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}
