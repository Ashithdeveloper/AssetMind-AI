"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllSourceInfos = exports.getSourceAdapter = exports.sourceAdapters = void 0;
const yahooFinance_adapter_1 = require("./yahooFinance.adapter");
const stockAnalysis_adapter_1 = require("./stockAnalysis.adapter");
const marketScreener_adapter_1 = require("./marketScreener.adapter");
const macrotrends_adapter_1 = require("./macrotrends.adapter");
const companiesMarketCap_adapter_1 = require("./companiesMarketCap.adapter");
const tradingView_adapter_1 = require("./tradingView.adapter");
const investing_adapter_1 = require("./investing.adapter");
const morningstar_adapter_1 = require("./morningstar.adapter");
const secEdgar_adapter_1 = require("./secEdgar.adapter");
const stockMarketCap_adapter_1 = require("./stockMarketCap.adapter");
const screenerIn_adapter_1 = require("./screenerIn.adapter");
exports.sourceAdapters = {
    'yahoo-finance': new yahooFinance_adapter_1.YahooFinanceAdapter(),
    'stockanalysis': new stockAnalysis_adapter_1.StockAnalysisAdapter(),
    'marketscreener': new marketScreener_adapter_1.MarketScreenerAdapter(),
    'macrotrends': new macrotrends_adapter_1.MacrotrendsAdapter(),
    'companiesmarketcap': new companiesMarketCap_adapter_1.CompaniesMarketCapAdapter(),
    'tradingview': new tradingView_adapter_1.TradingViewAdapter(),
    'investing': new investing_adapter_1.InvestingAdapter(),
    'morningstar': new morningstar_adapter_1.MorningstarAdapter(),
    'sec-edgar': new secEdgar_adapter_1.SecEdgarAdapter(),
    'stockmarketcap': new stockMarketCap_adapter_1.StockMarketCapAdapter(),
    'screener-in': new screenerIn_adapter_1.ScreenerInAdapter(),
};
const getSourceAdapter = (id) => {
    const normalizedId = id.trim().toLowerCase().replace(/[_\s]/g, '-');
    return exports.sourceAdapters[normalizedId];
};
exports.getSourceAdapter = getSourceAdapter;
const getAllSourceInfos = () => {
    return Object.values(exports.sourceAdapters).map((adapter) => adapter.getInfo());
};
exports.getAllSourceInfos = getAllSourceInfos;
//# sourceMappingURL=index.js.map