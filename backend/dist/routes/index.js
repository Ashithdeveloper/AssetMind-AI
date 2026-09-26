"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRoutes = void 0;
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const auth_routes_1 = require("../modules/auth/auth.routes");
const scraping_routes_1 = require("../modules/scraping/scraping.routes");
const stock_routes_1 = require("../modules/stocks/stock.routes");
const rag_routes_1 = require("../modules/rag/rag.routes");
const company_routes_1 = require("../modules/companies/company.routes");
const analysis_routes_1 = require("../modules/analysis/analysis.routes");
const realtime_routes_1 = require("../modules/realtime/realtime.routes");
const chat_routes_1 = require("../modules/chat/chat.routes");
const screener_routes_1 = require("../modules/screener/screener.routes");
const apiResponse_1 = require("../utils/apiResponse");
const router = (0, express_1.Router)();
// Health check endpoint
router.get('/health', (req, res) => {
    const dbStatus = mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected';
    (0, apiResponse_1.sendSuccess)(res, {
        status: 'UP',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        version: '3.1.0 (Real-Time Stock Quotes + Qdrant RAG AI Chat)',
    }, 'AssetMind AI Backend is operating normally with Real-Time Stock Quotes, Live News, and RAG AI Chat', 200);
});
// Mount modules
router.use('/auth', auth_routes_1.authRoutes);
router.use('/scraping', scraping_routes_1.scrapingRoutes);
router.use('/stocks', stock_routes_1.stockRoutes);
router.use('/rag', rag_routes_1.ragRoutes);
router.use('/companies', company_routes_1.companyRoutes);
router.use('/analysis', analysis_routes_1.analysisRoutes);
router.use('/realtime', realtime_routes_1.realtimeRoutes);
router.use('/chat', chat_routes_1.chatRoutes);
router.use('/screener', screener_routes_1.screenerRoutes);
exports.apiRoutes = router;
//# sourceMappingURL=index.js.map