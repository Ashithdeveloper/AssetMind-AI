import { Router } from 'express';
import { ScreenerController } from './screener.controller';

const router = Router();

// Live search Screener.in by company name or ticker
router.get('/search', ScreenerController.search);

// On-demand scrape company from Screener.in
router.post('/scrape', ScreenerController.scrape);

// Get company details / on-demand fetch
router.get('/company/:symbol', ScreenerController.getCompany);

export const screenerRoutes = router;
