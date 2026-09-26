/**
 * Centralized financial unit and metric formatters for AssetMind AI (Indian Stock Market)
 *
 * Rules:
 * 1. Convert values exactly once.
 * 2. Never multiply or divide by the same conversion factor twice.
 * 3. Never append "Cr" to a value already expressed in crores.
 * 4. Never interpret a percentage as a currency value.
 * 5. Never interpret a ratio as a currency value.
 * 6. Display "Data unavailable" for null, undefined, or invalid numbers. Never display ₹0.00, NaN, or undefined.
 */

export const DATA_UNAVAILABLE = 'Data unavailable';

/**
 * Formats a stock price in Indian Rupees (₹)
 * Example: ₹1,226.00
 */
export function formatStockPrice(value: number | null | undefined): string {
  if (value == null || isNaN(value) || value <= 0) {
    return DATA_UNAVAILABLE;
  }
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats market capitalization in Indian format (₹ Cr or ₹ Lakh Cr).
 * Accepts value in Crores (or optionally raw INR if specified).
 */
export function formatMarketCap(valueInCrores: number | null | undefined): string {
  if (valueInCrores == null || isNaN(valueInCrores) || valueInCrores <= 0) {
    return DATA_UNAVAILABLE;
  }

  const num = Number(valueInCrores);

  // If over 1,00,000 Crores (e.g. Reliance ~ 20 Lakh Cr), format cleanly as Lakh Cr
  if (num >= 100000) {
    const lakhCr = num / 100000;
    return `₹${lakhCr.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Lakh Cr`;
  }

  return `₹${num.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })} Cr`;
}

/**
 * Formats Free Cash Flow in ₹ Crores
 * Example: ₹70,023 Cr or -₹1,200 Cr
 */
export function formatFreeCashFlow(valueInCrores: number | null | undefined): string {
  if (valueInCrores == null || isNaN(valueInCrores)) {
    return DATA_UNAVAILABLE;
  }

  const num = Number(valueInCrores);
  const prefix = num < 0 ? '-₹' : '₹';
  const abs = Math.abs(num);

  return `${prefix}${abs.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })} Cr`;
}

/**
 * Formats financial ratios (e.g. Debt-to-Equity, Current Ratio)
 * Example: 0.45 or 1.20
 */
export function formatRatio(value: number | null | undefined, suffix: string = ''): string {
  if (value == null || isNaN(value)) {
    return DATA_UNAVAILABLE;
  }
  return `${Number(value).toFixed(2)}${suffix}`;
}

/**
 * Formats valuation multiples (e.g. P/E, P/B, EV/EBITDA)
 * Example: 24.50x
 */
export function formatMultiple(value: number | null | undefined): string {
  if (value == null || isNaN(value) || value <= 0) {
    return DATA_UNAVAILABLE;
  }
  return `${Number(value).toFixed(2)}x`;
}

/**
 * Formats percentage metrics (e.g. ROE, ROCE, Margins, Growth)
 * Example: 18.50% or +12.40%
 */
export function formatPercentage(
  value: number | null | undefined,
  includeSign: boolean = false
): string {
  if (value == null || isNaN(value)) {
    return DATA_UNAVAILABLE;
  }

  const num = Number(value);
  const sign = includeSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

/**
 * Formats enterprise value in ₹ Cr
 */
export function formatEnterpriseValue(valueInCrores: number | null | undefined): string {
  return formatMarketCap(valueInCrores);
}

/**
 * Formats daily price change
 * Example: +12.50 (+1.05%)
 */
export function formatPriceChange(
  change: number | null | undefined,
  changePercent: number | null | undefined
): { text: string; isPositive: boolean; isNegative: boolean } {
  if (changePercent == null || isNaN(changePercent)) {
    return { text: DATA_UNAVAILABLE, isPositive: false, isNegative: false };
  }

  const isPos = changePercent > 0;
  const isNeg = changePercent < 0;
  const sign = isPos ? '+' : '';

  let text = '';
  if (change != null && !isNaN(change)) {
    text = `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
  } else {
    text = `${sign}${changePercent.toFixed(2)}%`;
  }

  return { text, isPositive: isPos, isNegative: isNeg };
}
