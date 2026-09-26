import { Request, Response, NextFunction } from 'express';
import { CompanyService } from './company.service';
import { sendSuccess, AppError } from '../../utils/apiResponse';

export class CompanyController {
  /**
   * GET /api/companies/explore
   */
  public static async explore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const sector = req.query.sector as string | undefined;
      const country = req.query.country as string | undefined;
      const minMarketCap = req.query.minMarketCap ? parseFloat(req.query.minMarketCap as string) : undefined;
      const maxMarketCap = req.query.maxMarketCap ? parseFloat(req.query.maxMarketCap as string) : undefined;
      const sortBy = req.query.sortBy as any;
      const order = req.query.order as any;

      const result = await CompanyService.getExploreCompanies({
        page,
        limit,
        sector,
        country,
        minMarketCap,
        maxMarketCap,
        sortBy,
        order,
      });

      sendSuccess(res, result, 'Listed companies retrieved successfully for Explore Home', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/companies/search?q=
   */
  public static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req.query.q || req.query.query || '') as string;
      const exchange = req.query.exchange as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;

      const result = await CompanyService.searchCompanies(query, exchange, page, limit);

      sendSuccess(res, result, `Found ${result.total} matching companies`, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/companies/:symbol
   */
  public static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol || '');
      if (!symbol.trim()) {
        throw new AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
      }

      const profile = await CompanyService.getCompanyProfile(symbol);
      sendSuccess(res, profile, `Profile for ${profile.symbol} retrieved successfully`, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/companies/:symbol/price-history?period=1M
   */
  public static async getPriceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol || '');
      const period = (req.query.period as string) || '1M';

      if (!symbol.trim()) {
        throw new AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
      }

      const history = await CompanyService.getPriceHistory(symbol, period);
      sendSuccess(res, history, `Price history for ${history.symbol} (${period}) retrieved successfully`, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/companies/:symbol/financials
   */
  public static async getFinancials(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol || '');
      if (!symbol.trim()) {
        throw new AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
      }

      const metrics = await CompanyService.getFinancialMetrics(symbol);
      sendSuccess(res, metrics, `Financial metrics for ${metrics.symbol} calculated successfully`, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/companies/:symbol/statements
   * Full quarterly, annual P&L, balance sheet, and cash flow statements from Screener.in
   */
  public static async getStatements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol || '');
      if (!symbol.trim()) {
        throw new AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
      }

      const statements = await CompanyService.getStatements(symbol);
      sendSuccess(res, statements, `Financial statements for ${symbol} retrieved successfully`, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/companies/:symbol/refresh
   * On-demand live refresh of company fundamentals and statements directly from Screener.in
   */
  public static async refreshCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.params.symbol || '');
      if (!symbol.trim()) {
        throw new AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
      }

      const refreshed = await CompanyService.refreshCompany(symbol);
      sendSuccess(res, refreshed, `Successfully refreshed ${symbol} from Screener.in`, 200);
    } catch (err) {
      next(err);
    }
  }
}
