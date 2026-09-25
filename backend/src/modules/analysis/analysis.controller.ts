import { Request, Response, NextFunction } from 'express';
import { BuyAnalysisService } from './buyAnalysis.service';
import { SellAnalysisService } from './sellAnalysis.service';
import { AnalysisReport } from '../../models/AnalysisReport.model';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { sendSuccess, AppError } from '../../utils/apiResponse';

export class AnalysisController {
  /**
   * POST /api/analysis/:symbol/buy
   */
  public static async postBuyAnalysis(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol || '');
      if (!symbol.trim()) {
        throw new AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
      }

      const userId = req.user ? req.user._id.toString() : undefined;
      const report = await BuyAnalysisService.generateBuyAnalysis(symbol, userId);

      sendSuccess(res, report, `Buy Analysis report for ${report.symbol} generated successfully`, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/analysis/:symbol/sell
   */
  public static async postSellAnalysis(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol || '');
      if (!symbol.trim()) {
        throw new AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
      }

      const { purchasePrice, quantity, investmentDate, portfolioValue } = req.body;

      const investorInput =
        purchasePrice !== undefined
          ? {
              purchasePrice: Number(purchasePrice),
              quantity: quantity !== undefined ? Number(quantity) : 1,
              investmentDate: investmentDate ? String(investmentDate) : undefined,
              portfolioValue: portfolioValue !== undefined ? Number(portfolioValue) : undefined,
            }
          : undefined;

      const userId = req.user ? req.user._id.toString() : undefined;
      const report = await SellAnalysisService.generateSellAnalysis(symbol, investorInput, userId);

      sendSuccess(res, report, `Sell Analysis report for ${report.symbol} generated successfully`, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analysis/reports
   * List past analysis reports with optional filtering by symbol and type
   */
  public static async getReports(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query: Record<string, any> = {};
      if (req.user) {
        query.userId = req.user._id;
      }
      if (req.query.symbol) {
        query.symbol = (req.query.symbol as string).trim().toUpperCase();
      }
      if (req.query.type) {
        query.analysisType = (req.query.type as string).trim().toUpperCase();
      }

      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
      const reports = await AnalysisReport.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('-reportMarkdown')
        .lean();

      sendSuccess(res, { count: reports.length, reports }, 'Historical analysis reports retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analysis/reports/:id
   */
  public static async getReportById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id || '');
      const report = await AnalysisReport.findById(id).lean();

      if (!report) {
        throw new AppError('Analysis report not found', 404, 'REPORT_NOT_FOUND');
      }

      // Security check: If report belongs to another user, restrict access
      if (report.userId && req.user && report.userId.toString() !== req.user._id.toString()) {
        throw new AppError('Access denied: You do not have permission to view this report', 403, 'FORBIDDEN');
      }

      sendSuccess(res, report, 'Analysis report retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }
}
