"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockRoutes = void 0;
const express_1 = require("express");
const stock_controller_1 = require("./stock.controller");
const router = (0, express_1.Router)();
// Search stocks
router.get('/search', stock_controller_1.StockController.searchStocks);
// Detailed stock endpoints
router.get('/:symbol/financials', stock_controller_1.StockController.getFinancialData);
router.get('/:symbol/prices', stock_controller_1.StockController.getStockPrices);
router.get('/:symbol/sources', stock_controller_1.StockController.getAvailableSources);
router.get('/:symbol/documents', stock_controller_1.StockController.getFinancialDocuments);
router.get('/:symbol', stock_controller_1.StockController.getCompanyProfile);
exports.stockRoutes = router;
//# sourceMappingURL=stock.routes.js.map