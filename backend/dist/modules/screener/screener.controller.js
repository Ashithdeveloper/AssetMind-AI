"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenerController = void 0;
const screener_service_1 = require("./screener.service");
const apiResponse_1 = require("../../utils/apiResponse");
class ScreenerController {
    /**
     * Search Screener.in live by company name or stock symbol
     * GET /api/screener/search?q=
     */
    static async search(req, res, next) {
        try {
            const query = typeof req.query.q === 'string' ? req.query.q : '';
            const result = await screener_service_1.ScreenerService.searchScreener(query);
            (0, apiResponse_1.sendSuccess)(res, result, `Found ${result.total} companies matching '${query}' on Screener.in`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Scrape a company on demand from Screener.in by slug/symbol
     * POST /api/screener/scrape
     */
    static async scrape(req, res, next) {
        try {
            const { symbol, force } = req.body;
            if (!symbol || typeof symbol !== 'string') {
                res.status(400).json({ success: false, message: 'Field "symbol" is required' });
                return;
            }
            const result = await screener_service_1.ScreenerService.scrapeAndGetCompany(symbol, Boolean(force));
            (0, apiResponse_1.sendSuccess)(res, result, result.message, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get scraped company details
     * GET /api/screener/company/:symbol
     */
    static async getCompany(req, res, next) {
        try {
            const rawSymbol = req.params.symbol;
            const symbol = Array.isArray(rawSymbol) ? rawSymbol[0] : rawSymbol;
            if (!symbol) {
                res.status(400).json({ success: false, message: 'Symbol parameter required' });
                return;
            }
            const result = await screener_service_1.ScreenerService.scrapeAndGetCompany(symbol, false);
            (0, apiResponse_1.sendSuccess)(res, result, `Retrieved ${symbol} details`, 200);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ScreenerController = ScreenerController;
//# sourceMappingURL=screener.controller.js.map