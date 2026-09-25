"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialMetrics = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const MetricEntrySchema = new mongoose_1.Schema({
    value: { type: Number, default: null },
    currency: { type: String, trim: true },
    unit: { type: String, trim: true },
    reportingPeriod: { type: String, trim: true },
    historicalComparison: { type: String, trim: true },
    source: { type: String, trim: true },
    lastUpdated: { type: Date, default: Date.now },
    explanation: { type: String, trim: true },
}, { _id: false });
const FinancialMetricsSchema = new mongoose_1.Schema({
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Asset',
        required: true,
        index: true,
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        index: true,
    },
    fiscalPeriod: {
        type: String,
        required: true,
        trim: true,
        default: 'TTM',
    },
    revenue: { type: MetricEntrySchema, default: () => ({ value: null }) },
    netIncome: { type: MetricEntrySchema, default: () => ({ value: null }) },
    operatingCashFlow: { type: MetricEntrySchema, default: () => ({ value: null }) },
    capitalExpenditure: { type: MetricEntrySchema, default: () => ({ value: null }) },
    freeCashFlow: { type: MetricEntrySchema, default: () => ({ value: null }) },
    shareholdersEquity: { type: MetricEntrySchema, default: () => ({ value: null }) },
    totalDebt: { type: MetricEntrySchema, default: () => ({ value: null }) },
    roe: { type: MetricEntrySchema, default: () => ({ value: null }) },
    debtToEquity: { type: MetricEntrySchema, default: () => ({ value: null }) },
    profitability: {
        revenue: MetricEntrySchema,
        netIncome: MetricEntrySchema,
        grossProfitMargin: MetricEntrySchema,
        operatingProfitMargin: MetricEntrySchema,
        netProfitMargin: MetricEntrySchema,
    },
    valuation: {
        peRatio: MetricEntrySchema,
        pbRatio: MetricEntrySchema,
        evToEbitda: MetricEntrySchema,
    },
    riskInputs: {
        debtLevels: String,
        cashFlowTrends: String,
        earningsVolatility: String,
        revenueGrowth: String,
        profitabilityTrends: String,
        marketVolatility: String,
    },
    source: {
        type: String,
        required: true,
        default: 'calculated_from_reports',
    },
}, {
    timestamps: true,
    versionKey: false,
});
FinancialMetricsSchema.index({ symbol: 1, fiscalPeriod: 1 }, { unique: true });
exports.FinancialMetrics = mongoose_1.default.model('FinancialMetrics', FinancialMetricsSchema);
//# sourceMappingURL=FinancialMetrics.model.js.map