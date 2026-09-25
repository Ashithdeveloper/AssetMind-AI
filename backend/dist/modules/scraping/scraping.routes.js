"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapingRoutes = void 0;
const express_1 = require("express");
const scraping_controller_1 = require("./scraping.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Sources list can be public or authenticated
router.get('/sources', scraping_controller_1.ScrapingController.getSupportedSources);
// Dynamic live website discovery endpoints
router.get('/discover', scraping_controller_1.ScrapingController.discoverCompanies);
router.post('/discover-and-scrape', auth_middleware_1.authenticateJwt, scraping_controller_1.ScrapingController.discoverAndScrape);
// Scraping management endpoints (protected by JWT)
router.post('/stocks', auth_middleware_1.authenticateJwt, scraping_controller_1.ScrapingController.triggerScrape);
router.post('/scrape-unsaved', auth_middleware_1.authenticateJwt, scraping_controller_1.ScrapingController.scrapeUnsaved);
router.get('/jobs/:jobId', auth_middleware_1.authenticateJwt, scraping_controller_1.ScrapingController.getJobStatus);
router.get('/jobs', auth_middleware_1.authenticateJwt, scraping_controller_1.ScrapingController.getJobsHistory);
exports.scrapingRoutes = router;
//# sourceMappingURL=scraping.routes.js.map