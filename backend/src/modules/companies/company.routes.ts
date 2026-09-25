import { Router } from 'express';
import { CompanyController } from './company.controller';

const router = Router();

// GET /api/companies/explore
router.get('/explore', CompanyController.explore);

// GET /api/companies/search
router.get('/search', CompanyController.search);

// GET /api/companies/:symbol
router.get('/:symbol', CompanyController.getProfile);

// GET /api/companies/:symbol/price-history
router.get('/:symbol/price-history', CompanyController.getPriceHistory);

// GET /api/companies/:symbol/financials
router.get('/:symbol/financials', CompanyController.getFinancials);

export const companyRoutes = router;
