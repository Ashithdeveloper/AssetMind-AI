"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.screenerRoutes = void 0;
const express_1 = require("express");
const screener_controller_1 = require("./screener.controller");
const router = (0, express_1.Router)();
// Live search Screener.in by company name or ticker
router.get('/search', screener_controller_1.ScreenerController.search);
// On-demand scrape company from Screener.in
router.post('/scrape', screener_controller_1.ScreenerController.scrape);
// Get company details / on-demand fetch
router.get('/company/:symbol', screener_controller_1.ScreenerController.getCompany);
exports.screenerRoutes = router;
//# sourceMappingURL=screener.routes.js.map