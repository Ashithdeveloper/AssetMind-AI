import mongoose, { Schema, Document } from 'mongoose';

export interface IFinancialData extends Document {
  _id: mongoose.Types.ObjectId;
  assetId: mongoose.Types.ObjectId;
  symbol: string;
  metricName: string;
  metricValue: number;
  currency?: string;
  unit?: string;
  reportingPeriod?: string; // e.g., '2023-FY', '2024-Q3', 'TTM', 'ANNUAL'
  dataTimestamp?: Date;
  source: string;
  sourceUrl?: string;
  scraperProvider: 'playwright' | 'scrapingbee';
  collectedAt: Date;
  validationStatus: 'VALID' | 'WARNING' | 'REJECTED';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialDataSchema = new Schema<IFinancialData>(
  {
    assetId: {
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
    metricName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    metricValue: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'USD',
    },
    unit: {
      type: String,
      trim: true,
      default: 'raw', // e.g., 'raw', 'millions', 'billions', 'percentage', 'ratio'
    },
    reportingPeriod: {
      type: String,
      trim: true,
      default: 'TTM',
      index: true,
    },
    dataTimestamp: {
      type: Date,
    },
    source: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
    scraperProvider: {
      type: String,
      enum: ['playwright', 'scrapingbee'],
      required: true,
    },
    collectedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    validationStatus: {
      type: String,
      enum: ['VALID', 'WARNING', 'REJECTED'],
      default: 'VALID',
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound unique index to prevent duplicate records from the same source, period, metric for the asset
FinancialDataSchema.index(
  { assetId: 1, metricName: 1, reportingPeriod: 1, source: 1 },
  { unique: true }
);

export const FinancialData = mongoose.model<IFinancialData>('FinancialData', FinancialDataSchema);
