import { Router } from 'express';
import mongoose from 'mongoose';
import { authRoutes } from '../modules/auth/auth.routes';
import { scrapingRoutes } from '../modules/scraping/scraping.routes';
import { stockRoutes } from '../modules/stocks/stock.routes';
import { ragRoutes } from '../modules/rag/rag.routes';
import { companyRoutes } from '../modules/companies/company.routes';
import { analysisRoutes } from '../modules/analysis/analysis.routes';
import { realtimeRoutes } from '../modules/realtime/realtime.routes';
import { sendSuccess } from '../utils/apiResponse';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  sendSuccess(
    res,
    {
      status: 'UP',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      version: '3.0.0 (Real-Time Prices + News + RAG Analysis)',
    },
    'AssetMind AI Backend is operating normally with Real-Time Prices, Live News, and AI Analysis',
    200
  );
});

// Mount modules
router.use('/auth', authRoutes);
router.use('/scraping', scrapingRoutes);
router.use('/stocks', stockRoutes);
router.use('/rag', ragRoutes);
router.use('/companies', companyRoutes);
router.use('/analysis', analysisRoutes);
router.use('/realtime', realtimeRoutes);

export const apiRoutes = router;
