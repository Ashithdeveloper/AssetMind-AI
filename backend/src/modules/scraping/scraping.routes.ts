import { Router } from 'express';
import { ScrapingController } from './scraping.controller';
import { authenticateJwt } from '../../middleware/auth.middleware';

const router = Router();

// Sources list can be public or authenticated
router.get('/sources', ScrapingController.getSupportedSources);

// Dynamic live website discovery endpoints
router.get('/discover', ScrapingController.discoverCompanies);
router.post('/discover-and-scrape', authenticateJwt, ScrapingController.discoverAndScrape);

// Scraping management endpoints (protected by JWT)
router.post('/stocks', authenticateJwt, ScrapingController.triggerScrape);
router.post('/scrape-unsaved', authenticateJwt, ScrapingController.scrapeUnsaved);
router.get('/jobs/:jobId', authenticateJwt, ScrapingController.getJobStatus);
router.get('/jobs', authenticateJwt, ScrapingController.getJobsHistory);

export const scrapingRoutes = router;
