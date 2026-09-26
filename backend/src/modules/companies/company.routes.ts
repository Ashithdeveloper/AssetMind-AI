import { Router } from 'express';
import { CompanyController } from './company.controller';

const router = Router();

// GET /api/companies and GET /api/companies/explore
router.get('/', CompanyController.explore);
router.get('/explore', CompanyController.explore);

// GET /api/companies/search
router.get('/search', CompanyController.search);

// GET /api/companies/:symbol
router.get('/:symbol', CompanyController.getProfile);

// GET /api/companies/:symbol/prices and GET /api/companies/:symbol/price-history
router.get('/:symbol/prices', CompanyController.getPriceHistory);
router.get('/:symbol/price-history', CompanyController.getPriceHistory);

// GET /api/companies/:symbol/financials
router.get('/:symbol/financials', CompanyController.getFinancials);

// GET /api/companies/:symbol/statements
router.get('/:symbol/statements', CompanyController.getStatements);

// POST /api/companies/:symbol/refresh
router.post('/:symbol/refresh', CompanyController.refreshCompany);

export const companyRoutes = router;
