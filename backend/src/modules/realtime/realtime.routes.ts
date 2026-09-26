/**
 * AssetMind AI — Real-Time Routes
 * Mounts at /api/realtime
 */

import { Router } from 'express';
import { RealTimeController } from './realtime.controller';

const router = Router();

// Market-level endpoints (must be before /:symbol to avoid route conflicts)
router.get('/market/news', RealTimeController.getMarketNews);
router.get('/market/indices', RealTimeController.getMarketIndices);
router.get('/quotes/snapshot', RealTimeController.getQuoteSnapshot);
router.post('/refresh', RealTimeController.triggerRefresh);

// Per-symbol endpoints
router.get('/:symbol/quote', RealTimeController.getLiveQuote);
router.get('/:symbol/news', RealTimeController.getSymbolNews);
router.get('/:symbol/news-analysis', RealTimeController.getCompanyNewsAnalysis);
router.get('/:symbol/full', RealTimeController.getFullRealtime);
router.get('/:symbol/stream', RealTimeController.streamQuote);

export const realtimeRoutes = router;
