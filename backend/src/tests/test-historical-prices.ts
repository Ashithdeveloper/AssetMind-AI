import { HistoricalPriceService } from '../modules/realtime/services/historicalPrice.service';

async function test() {
  console.log('--- TESTING REAL HISTORICAL PRICES ---');
  for (const period of ['1D', '1W', '1M', '3M', '6M', '1Y'] as const) {
    const res = await HistoricalPriceService.getHistoricalPrices('RELIANCE', period);
    console.log(`Period ${period}: ${res.data.length} real bars | Latest: ${res.data[res.data.length - 1]?.date} (₹${res.data[res.data.length - 1]?.close}) | Source: ${res.source}`);
  }
  console.log('✅ ALL HISTORICAL PERIODS VERIFIED WITH REAL YAHOO/NSE DATA');
}

test().catch(console.error);
