"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyRoutes = void 0;
const express_1 = require("express");
const company_controller_1 = require("./company.controller");
const router = (0, express_1.Router)();
// GET /api/companies/explore
router.get('/explore', company_controller_1.CompanyController.explore);
// GET /api/companies/search
router.get('/search', company_controller_1.CompanyController.search);
// GET /api/companies/:symbol
router.get('/:symbol', company_controller_1.CompanyController.getProfile);
// GET /api/companies/:symbol/price-history
router.get('/:symbol/price-history', company_controller_1.CompanyController.getPriceHistory);
// GET /api/companies/:symbol/financials
router.get('/:symbol/financials', company_controller_1.CompanyController.getFinancials);
exports.companyRoutes = router;
//# sourceMappingURL=company.routes.js.map