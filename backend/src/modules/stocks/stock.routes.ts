import { Router } from 'express';
import { StockController } from './stock.controller';

const router = Router();

// Search stocks
router.get('/search', StockController.searchStocks);

// Detailed stock endpoints
router.get('/:symbol/financials', StockController.getFinancialData);
router.get('/:symbol/prices', StockController.getStockPrices);
router.get('/:symbol/sources', StockController.getAvailableSources);
router.get('/:symbol/documents', StockController.getFinancialDocuments);
router.get('/:symbol', StockController.getCompanyProfile);

export const stockRoutes = router;
