import { Router } from 'express';
import { AnalysisController } from './analysis.controller';
import { optionalAuthenticateJwt, authenticateJwt } from '../../middleware/auth.middleware';

const router = Router();

// POST /api/analysis/:symbol/buy
router.post('/:symbol/buy', optionalAuthenticateJwt, AnalysisController.postBuyAnalysis);

// POST /api/analysis/:symbol/sell
router.post('/:symbol/sell', optionalAuthenticateJwt, AnalysisController.postSellAnalysis);

// GET /api/analysis/reports (User's analysis history)
router.get('/reports', optionalAuthenticateJwt, AnalysisController.getReports);

// GET /api/analysis/reports/:id
router.get('/reports/:id', optionalAuthenticateJwt, AnalysisController.getReportById);

export const analysisRoutes = router;
