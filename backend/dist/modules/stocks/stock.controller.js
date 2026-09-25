"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockController = void 0;
const stock_service_1 = require("./stock.service");
const apiResponse_1 = require("../../utils/apiResponse");
class StockController {
    static async searchStocks(req, res, next) {
        try {
            const q = String(req.query.q || '');
            const limit = req.query.limit ? Number(req.query.limit) : 20;
            const results = await stock_service_1.StockService.searchStocks(q, limit);
            (0, apiResponse_1.sendSuccess)(res, results, 'Stock search results retrieved', 200);
        }
        catch (error) {
            next(error);
        }
    }
    static async getCompanyProfile(req, res, next) {
        try {
            const symbol = String(req.params.symbol);
            const profile = await stock_service_1.StockService.getCompanyProfile(symbol);
            (0, apiResponse_1.sendSuccess)(res, profile, 'Company profile retrieved successfully', 200);
        }
        catch (error) {
            next(error);
        }
    }
    static async getFinancialData(req, res, next) {
        try {
            const symbol = String(req.params.symbol);
            const { metricName, reportingPeriod, source, currency } = req.query;
            const data = await stock_service_1.StockService.getFinancialData(symbol, {
                metricName: metricName ? String(metricName) : undefined,
                reportingPeriod: reportingPeriod ? String(reportingPeriod) : undefined,
                source: source ? String(source) : undefined,
                currency: currency ? String(currency) : undefined,
            });
            (0, apiResponse_1.sendSuccess)(res, data, 'Financial data retrieved successfully', 200);
        }
        catch (error) {
            next(error);
        }
    }
    static async getStockPrices(req, res, next) {
        try {
            const symbol = String(req.params.symbol);
            const { limit, startDate, endDate } = req.query;
            const data = await stock_service_1.StockService.getStockPrices(symbol, {
                limit: limit ? Number(limit) : undefined,
                startDate: startDate ? String(startDate) : undefined,
                endDate: endDate ? String(endDate) : undefined,
            });
            (0, apiResponse_1.sendSuccess)(res, data, 'Stock prices retrieved successfully', 200);
        }
        catch (error) {
            next(error);
        }
    }
    static async getAvailableSources(req, res, next) {
        try {
            const symbol = String(req.params.symbol);
            const data = await stock_service_1.StockService.getAvailableSources(symbol);
            (0, apiResponse_1.sendSuccess)(res, data, 'Available data sources retrieved successfully', 200);
        }
        catch (error) {
            next(error);
        }
    }
    static async getFinancialDocuments(req, res, next) {
        try {
            const symbol = String(req.params.symbol);
            const { documentType } = req.query;
            const data = await stock_service_1.StockService.getFinancialDocuments(symbol, documentType ? String(documentType) : undefined);
            (0, apiResponse_1.sendSuccess)(res, data, 'Financial documents retrieved successfully', 200);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.StockController = StockController;
//# sourceMappingURL=stock.controller.js.map