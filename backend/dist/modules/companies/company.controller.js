"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyController = void 0;
const company_service_1 = require("./company.service");
const apiResponse_1 = require("../../utils/apiResponse");
class CompanyController {
    /**
     * GET /api/companies/explore
     */
    static async explore(req, res, next) {
        try {
            const page = req.query.page ? parseInt(req.query.page, 10) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
            const sector = req.query.sector;
            const country = req.query.country;
            const minMarketCap = req.query.minMarketCap ? parseFloat(req.query.minMarketCap) : undefined;
            const maxMarketCap = req.query.maxMarketCap ? parseFloat(req.query.maxMarketCap) : undefined;
            const sortBy = req.query.sortBy;
            const order = req.query.order;
            const result = await company_service_1.CompanyService.getExploreCompanies({
                page,
                limit,
                sector,
                country,
                minMarketCap,
                maxMarketCap,
                sortBy,
                order,
            });
            (0, apiResponse_1.sendSuccess)(res, result, 'Listed companies retrieved successfully for Explore Home', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/companies/search?q=
     */
    static async search(req, res, next) {
        try {
            const query = (req.query.q || req.query.query || '');
            const exchange = req.query.exchange;
            const page = req.query.page ? parseInt(req.query.page, 10) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 15;
            const result = await company_service_1.CompanyService.searchCompanies(query, exchange, page, limit);
            (0, apiResponse_1.sendSuccess)(res, result, `Found ${result.total} matching companies`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/companies/:symbol
     */
    static async getProfile(req, res, next) {
        try {
            const symbol = String(req.params.symbol || '');
            if (!symbol.trim()) {
                throw new apiResponse_1.AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
            }
            const profile = await company_service_1.CompanyService.getCompanyProfile(symbol);
            (0, apiResponse_1.sendSuccess)(res, profile, `Profile for ${profile.symbol} retrieved successfully`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/companies/:symbol/price-history?period=1M
     */
    static async getPriceHistory(req, res, next) {
        try {
            const symbol = String(req.params.symbol || '');
            const period = req.query.period || '1M';
            if (!symbol.trim()) {
                throw new apiResponse_1.AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
            }
            const history = await company_service_1.CompanyService.getPriceHistory(symbol, period);
            (0, apiResponse_1.sendSuccess)(res, history, `Price history for ${history.symbol} (${period}) retrieved successfully`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/companies/:symbol/financials
     */
    static async getFinancials(req, res, next) {
        try {
            const symbol = String(req.params.symbol || '');
            if (!symbol.trim()) {
                throw new apiResponse_1.AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
            }
            const metrics = await company_service_1.CompanyService.getFinancialMetrics(symbol);
            (0, apiResponse_1.sendSuccess)(res, metrics, `Financial metrics for ${metrics.symbol} calculated successfully`, 200);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.CompanyController = CompanyController;
//# sourceMappingURL=company.controller.js.map