import { Request, Response, NextFunction } from 'express';
import { ScreenerService } from './screener.service';
import { sendSuccess } from '../../utils/apiResponse';

export class ScreenerController {
  /**
   * Search Screener.in live by company name or stock symbol
   * GET /api/screener/search?q=
   */
  public static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q : '';
      const result = await ScreenerService.searchScreener(query);
      sendSuccess(res, result, `Found ${result.total} companies matching '${query}' on Screener.in`, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Scrape a company on demand from Screener.in by slug/symbol
   * POST /api/screener/scrape
   */
  public static async scrape(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { symbol, force } = req.body;
      if (!symbol || typeof symbol !== 'string') {
        res.status(400).json({ success: false, message: 'Field "symbol" is required' });
        return;
      }

      const result = await ScreenerService.scrapeAndGetCompany(symbol, Boolean(force));
      sendSuccess(res, result, result.message, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get scraped company details
   * GET /api/screener/company/:symbol
   */
  public static async getCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawSymbol = req.params.symbol;
      const symbol = Array.isArray(rawSymbol) ? rawSymbol[0] : rawSymbol;
      if (!symbol) {
        res.status(400).json({ success: false, message: 'Symbol parameter required' });
        return;
      }
      const result = await ScreenerService.scrapeAndGetCompany(symbol, false);
      sendSuccess(res, result, `Retrieved ${symbol} details`, 200);
    } catch (err) {
      next(err);
    }
  }
}
