"use strict";
/**
 * Centralized Financial Unit Normalization Service
 * Handles exact conversions, validation, and standard display formatting for Indian Stock Market data.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitNormalizer = exports.CONVERSION_FACTORS = void 0;
exports.CONVERSION_FACTORS = {
    INR: 1,
    INR_THOUSAND: 1_000,
    INR_LAKH: 100_000,
    INR_CRORE: 10_000_000,
    INR_MILLION: 1_000_000,
    INR_BILLION: 1_000_000_000,
    // Common aliases
    raw: 1,
    Cr: 10_000_000,
    cr: 10_000_000,
    crore: 10_000_000,
    crores: 10_000_000,
    'INR Crore': 10_000_000,
    lakh: 100_000,
    lakhs: 100_000,
    million: 1_000_000,
    millions: 1_000_000,
    billion: 1_000_000_000,
    billions: 1_000_000_000,
};
class UnitNormalizer {
    /**
     * Normalizes any input currency value to base Indian Rupees (INR)
     */
    static normalizeToINR(value, fromUnit = 'INR') {
        if (value === null || value === undefined || isNaN(value)) {
            throw new Error(`Invalid numeric value: ${value}`);
        }
        const factor = exports.CONVERSION_FACTORS[fromUnit] ?? 1;
        return value * factor;
    }
    /**
     * Converts base INR value to a target unit (e.g. INR to Crores)
     */
    static convertINRTo(valueInINR, targetUnit) {
        if (valueInINR === null || valueInINR === undefined || isNaN(valueInINR)) {
            throw new Error(`Invalid numeric value: ${valueInINR}`);
        }
        const factor = exports.CONVERSION_FACTORS[targetUnit] ?? 1;
        if (factor === 0)
            return 0;
        return valueInINR / factor;
    }
    /**
     * Converts Crores to base INR
     */
    static croresToINR(crores) {
        return this.normalizeToINR(crores, 'INR_CRORE');
    }
    /**
     * Converts base INR to Crores
     */
    static inrToCrores(inr) {
        return this.convertINRTo(inr, 'INR_CRORE');
    }
    /**
     * Formats market capitalization for Indian stock market display.
     * Auto-detects whether the input is in base INR or already in Crores.
     *
     * Rules:
     * - 1 Lakh Cr = 100,000 Cr = 1,000,000,000,000 INR (1e12)
     * - Never appends duplicate 'Cr' or 'K Cr'.
     */
    static formatMarketCap(value, unit = 'Cr') {
        if (value === null || value === undefined || isNaN(value)) {
            return 'Data unavailable';
        }
        // Determine value in Crores
        let valueInCr = value;
        if (unit === 'INR' || unit === 'raw' || (unit === 'Cr' && value > 1e9)) {
            // Input is in raw INR (e.g. 1.65e13 for Reliance)
            valueInCr = value / 10_000_000;
        }
        if (valueInCr >= 100_000) {
            // 100,000 Cr = 1 Lakh Cr
            return `₹${(valueInCr / 100_000).toFixed(2)}L Cr`;
        }
        return `₹${valueInCr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
    }
    /**
     * Formats Free Cash Flow.
     * FCF is typically in Crores. If raw INR is passed, converts exactly once.
     */
    static formatFreeCashFlow(value, unit = 'Cr') {
        if (value === null || value === undefined || isNaN(value)) {
            return 'Data unavailable';
        }
        let valueInCr = value;
        if (unit === 'INR' || unit === 'raw' || (unit === 'Cr' && Math.abs(value) > 1e9)) {
            valueInCr = value / 10_000_000;
        }
        const sign = valueInCr < 0 ? '-' : '';
        const absVal = Math.abs(valueInCr);
        if (absVal >= 100_000) {
            return `${sign}₹${(absVal / 100_000).toFixed(2)}L Cr`;
        }
        return `${sign}₹${absVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
    }
    /**
     * Formats financial ratios (P/E, P/B, Debt-to-Equity).
     * Ratios are pure numbers, never currency!
     */
    static formatRatio(value, suffix = '') {
        if (value === null || value === undefined || isNaN(value)) {
            return 'Data unavailable';
        }
        return `${value.toFixed(2)}${suffix}`;
    }
    /**
     * Formats percentages (ROE, ROCE, Margins, Growth).
     * Percentages are never currency!
     */
    static formatPercentage(value) {
        if (value === null || value === undefined || isNaN(value)) {
            return 'Data unavailable';
        }
        const prefix = value > 0 ? '+' : '';
        return `${prefix}${value.toFixed(2)}%`;
    }
    /**
     * Formats stock price in INR
     */
    static formatStockPrice(value) {
        if (value === null || value === undefined || isNaN(value) || value <= 0) {
            return 'Data unavailable';
        }
        return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}
exports.UnitNormalizer = UnitNormalizer;
//# sourceMappingURL=unitNormalizer.js.map