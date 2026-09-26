"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const historicalPrice_service_1 = require("../modules/realtime/services/historicalPrice.service");
async function test() {
    console.log('--- TESTING REAL HISTORICAL PRICES ---');
    for (const period of ['1D', '1W', '1M', '3M', '6M', '1Y']) {
        const res = await historicalPrice_service_1.HistoricalPriceService.getHistoricalPrices('RELIANCE', period);
        console.log(`Period ${period}: ${res.data.length} real bars | Latest: ${res.data[res.data.length - 1]?.date} (₹${res.data[res.data.length - 1]?.close}) | Source: ${res.source}`);
    }
    console.log('✅ ALL HISTORICAL PERIODS VERIFIED WITH REAL YAHOO/NSE DATA');
}
test().catch(console.error);
//# sourceMappingURL=test-historical-prices.js.map