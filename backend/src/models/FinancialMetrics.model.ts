import mongoose, { Schema, Document } from 'mongoose';

export interface IFinancialMetricEntry {
  value: number | null;
  currency?: string;
  unit?: string;
  reportingPeriod?: string;
  historicalComparison?: string;
  source?: string;
  lastUpdated?: Date;
  explanation?: string;
}

export interface IFinancialMetricsDoc extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  symbol: string;
  fiscalPeriod: string;
  revenue: IFinancialMetricEntry;
  netIncome: IFinancialMetricEntry;
  operatingCashFlow: IFinancialMetricEntry;
  capitalExpenditure: IFinancialMetricEntry;
  freeCashFlow: IFinancialMetricEntry;
  shareholdersEquity: IFinancialMetricEntry;
  totalDebt: IFinancialMetricEntry;
  roe: IFinancialMetricEntry;
  debtToEquity: IFinancialMetricEntry;
  profitability: {
    revenue?: IFinancialMetricEntry;
    netIncome?: IFinancialMetricEntry;
    grossProfitMargin?: IFinancialMetricEntry;
    operatingProfitMargin?: IFinancialMetricEntry;
    netProfitMargin?: IFinancialMetricEntry;
  };
  valuation: {
    peRatio?: IFinancialMetricEntry;
    pbRatio?: IFinancialMetricEntry;
    evToEbitda?: IFinancialMetricEntry;
  };
  riskInputs: {
    debtLevels?: string;
    cashFlowTrends?: string;
    earningsVolatility?: string;
    revenueGrowth?: string;
    profitabilityTrends?: string;
    marketVolatility?: string;
  };
  source: string;
  updatedAt: Date;
  createdAt: Date;
}

const MetricEntrySchema = new Schema(
  {
    value: { type: Number, default: null },
    currency: { type: String, trim: true },
    unit: { type: String, trim: true },
    reportingPeriod: { type: String, trim: true },
    historicalComparison: { type: String, trim: true },
    source: { type: String, trim: true },
    lastUpdated: { type: Date, default: Date.now },
    explanation: { type: String, trim: true },
  },
  { _id: false }
);

const FinancialMetricsSchema = new Schema<IFinancialMetricsDoc>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

FinancialMetricsSchema.index({ symbol: 1, fiscalPeriod: 1 }, { unique: true });

export const FinancialMetrics = mongoose.model<IFinancialMetricsDoc>(
  'FinancialMetrics',
  FinancialMetricsSchema
);
