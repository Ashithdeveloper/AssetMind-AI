"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisController = void 0;
const buyAnalysis_service_1 = require("./buyAnalysis.service");
const sellAnalysis_service_1 = require("./sellAnalysis.service");
const AnalysisReport_model_1 = require("../../models/AnalysisReport.model");
const apiResponse_1 = require("../../utils/apiResponse");
class AnalysisController {
    /**
     * POST /api/analysis/:symbol/buy
     */
    static async postBuyAnalysis(req, res, next) {
        try {
            const symbol = String(req.params.symbol || '');
            if (!symbol.trim()) {
                throw new apiResponse_1.AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
            }
            const userId = req.user ? req.user._id.toString() : undefined;
            const report = await buyAnalysis_service_1.BuyAnalysisService.generateBuyAnalysis(symbol, userId);
            (0, apiResponse_1.sendSuccess)(res, report, `Buy Analysis report for ${report.symbol} generated successfully`, 201);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/analysis/:symbol/sell
     */
    static async postSellAnalysis(req, res, next) {
        try {
            const symbol = String(req.params.symbol || '');
            if (!symbol.trim()) {
                throw new apiResponse_1.AppError('Stock symbol is required', 400, 'SYMBOL_REQUIRED');
            }
            const { purchasePrice, quantity, investmentDate, portfolioValue } = req.body;
            const investorInput = purchasePrice !== undefined
                ? {
                    purchasePrice: Number(purchasePrice),
                    quantity: quantity !== undefined ? Number(quantity) : 1,
                    investmentDate: investmentDate ? String(investmentDate) : undefined,
                    portfolioValue: portfolioValue !== undefined ? Number(portfolioValue) : undefined,
                }
                : undefined;
            const userId = req.user ? req.user._id.toString() : undefined;
            const report = await sellAnalysis_service_1.SellAnalysisService.generateSellAnalysis(symbol, investorInput, userId);
            (0, apiResponse_1.sendSuccess)(res, report, `Sell Analysis report for ${report.symbol} generated successfully`, 201);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/analysis/reports
     * List past analysis reports with optional filtering by symbol and type
     */
    static async getReports(req, res, next) {
        try {
            const query = {};
            if (req.user) {
                query.userId = req.user._id;
            }
            if (req.query.symbol) {
                query.symbol = req.query.symbol.trim().toUpperCase();
            }
            if (req.query.type) {
                query.analysisType = req.query.type.trim().toUpperCase();
            }
            const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
            const reports = await AnalysisReport_model_1.AnalysisReport.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .select('-reportMarkdown')
                .lean();
            (0, apiResponse_1.sendSuccess)(res, { count: reports.length, reports }, 'Historical analysis reports retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/analysis/reports/:id
     */
    static async getReportById(req, res, next) {
        try {
            const id = String(req.params.id || '');
            const report = await AnalysisReport_model_1.AnalysisReport.findById(id).lean();
            if (!report) {
                throw new apiResponse_1.AppError('Analysis report not found', 404, 'REPORT_NOT_FOUND');
            }
            // Security check: If report belongs to another user, restrict access
            if (report.userId && req.user && report.userId.toString() !== req.user._id.toString()) {
                throw new apiResponse_1.AppError('Access denied: You do not have permission to view this report', 403, 'FORBIDDEN');
            }
            (0, apiResponse_1.sendSuccess)(res, report, 'Analysis report retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AnalysisController = AnalysisController;
//# sourceMappingURL=analysis.controller.js.map