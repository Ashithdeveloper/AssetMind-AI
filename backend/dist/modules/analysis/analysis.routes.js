"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisRoutes = void 0;
const express_1 = require("express");
const analysis_controller_1 = require("./analysis.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// POST /api/analysis/:symbol/buy
router.post('/:symbol/buy', auth_middleware_1.optionalAuthenticateJwt, analysis_controller_1.AnalysisController.postBuyAnalysis);
// POST /api/analysis/:symbol/sell
router.post('/:symbol/sell', auth_middleware_1.optionalAuthenticateJwt, analysis_controller_1.AnalysisController.postSellAnalysis);
// GET /api/analysis/reports (User's analysis history)
router.get('/reports', auth_middleware_1.optionalAuthenticateJwt, analysis_controller_1.AnalysisController.getReports);
// GET /api/analysis/reports/:id
router.get('/reports/:id', auth_middleware_1.optionalAuthenticateJwt, analysis_controller_1.AnalysisController.getReportById);
exports.analysisRoutes = router;
//# sourceMappingURL=analysis.routes.js.map