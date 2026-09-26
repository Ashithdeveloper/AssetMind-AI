import { UnitNormalizer } from '../utils/unitNormalizer';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ ${msg}`);
  }
}

function runTests() {
  console.log('--- RUNNING UNIT NORMALIZER TESTS ---');

  // 1. Conversion tests
  assert(UnitNormalizer.normalizeToINR(1, 'INR') === 1, '1 INR = 1 INR');
  assert(UnitNormalizer.normalizeToINR(1, 'INR_LAKH') === 100_000, '1 Lakh = 100,000 INR');
  assert(UnitNormalizer.normalizeToINR(1, 'INR_CRORE') === 10_000_000, '1 Crore = 10,000,000 INR');
  assert(UnitNormalizer.normalizeToINR(1, 'INR_BILLION') === 1_000_000_000, '1 Billion = 1,000,000,000 INR');

  assert(UnitNormalizer.croresToINR(100) === 1_000_000_000, '100 Crores = 1 Billion INR');
  assert(UnitNormalizer.inrToCrores(10_000_000) === 1, '10 Million INR = 1 Crore');

  // 2. Market Cap formatting tests
  // Reliance market cap: 16,59,361 Cr (or 16593610000000 INR)
  const mcapFromCr = UnitNormalizer.formatMarketCap(1659361, 'Cr');
  assert(mcapFromCr === '₹16.59L Cr', `1,659,361 Cr displays as '₹16.59L Cr' (got: ${mcapFromCr})`);

  const mcapFromRawINR = UnitNormalizer.formatMarketCap(16593610000000, 'INR');
  assert(mcapFromRawINR === '₹16.59L Cr', `16.59 Trillion INR displays as '₹16.59L Cr' (got: ${mcapFromRawINR})`);

  // Small cap: 17,000 Cr
  const smallCap = UnitNormalizer.formatMarketCap(17000, 'Cr');
  assert(smallCap === '₹17,000 Cr', `17,000 Cr displays as '₹17,000 Cr' (got: ${smallCap})`);

  // 3. Free Cash Flow formatting tests
  // Reliance FCF: 70,023 Cr
  const fcfCr = UnitNormalizer.formatFreeCashFlow(70023, 'Cr');
  assert(fcfCr === '₹70,023 Cr', `70,023 Cr displays as '₹70,023 Cr' (got: ${fcfCr})`);

  const fcfFromRawINR = UnitNormalizer.formatFreeCashFlow(700230000000, 'INR');
  assert(fcfFromRawINR === '₹70,023 Cr', `700.23 Billion INR displays as '₹70,023 Cr' (got: ${fcfFromRawINR})`);

  // Negative FCF
  const negFcf = UnitNormalizer.formatFreeCashFlow(-5400, 'Cr');
  assert(negFcf === '-₹5,400 Cr', `-5,400 Cr displays as '-₹5,400 Cr' (got: ${negFcf})`);

  // 4. Ratio formatting tests (P/E, P/B, Debt to Equity)
  assert(UnitNormalizer.formatRatio(0.45) === '0.45', 'D/E 0.45 displays as 0.45');
  assert(UnitNormalizer.formatRatio(22.2, 'x') === '22.20x', 'P/E 22.2 displays as 22.20x');

  // 5. Percentage formatting tests (ROE, Margins)
  assert(UnitNormalizer.formatPercentage(8.91) === '+8.91%', 'ROE 8.91 displays as +8.91%');
  assert(UnitNormalizer.formatPercentage(-7.9) === '-7.90%', 'Profit growth -7.9 displays as -7.90%');

  // 6. Stock Price formatting tests
  assert(UnitNormalizer.formatStockPrice(1226) === '₹1,226.00', '1226 displays as ₹1,226.00');

  // 7. Missing value tests
  assert(UnitNormalizer.formatMarketCap(null) === 'Data unavailable', 'null market cap handled');
  assert(UnitNormalizer.formatFreeCashFlow(undefined) === 'Data unavailable', 'undefined FCF handled');
  assert(UnitNormalizer.formatStockPrice(0) === 'Data unavailable', '0 stock price handled as unavailable');

  console.log('--- ALL UNIT NORMALIZER TESTS PASSED ---');
}

runTests();
