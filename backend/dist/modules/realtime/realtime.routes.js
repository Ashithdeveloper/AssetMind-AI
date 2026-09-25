"use strict";
/**
 * AssetMind AI — Real-Time Routes
 * Mounts at /api/realtime
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeRoutes = void 0;
const express_1 = require("express");
const realtime_controller_1 = require("./realtime.controller");
const router = (0, express_1.Router)();
// Market-level endpoints (must be before /:symbol to avoid route conflicts)
router.get('/market/news', realtime_controller_1.RealTimeController.getMarketNews);
router.get('/market/indices', realtime_controller_1.RealTimeController.getMarketIndices);
router.get('/quotes/snapshot', realtime_controller_1.RealTimeController.getQuoteSnapshot);
router.post('/refresh', realtime_controller_1.RealTimeController.triggerRefresh);
// Per-symbol endpoints
router.get('/:symbol/quote', realtime_controller_1.RealTimeController.getLiveQuote);
router.get('/:symbol/news', realtime_controller_1.RealTimeController.getSymbolNews);
router.get('/:symbol/full', realtime_controller_1.RealTimeController.getFullRealtime);
router.get('/:symbol/stream', realtime_controller_1.RealTimeController.streamQuote);
exports.realtimeRoutes = router;
//# sourceMappingURL=realtime.routes.js.map