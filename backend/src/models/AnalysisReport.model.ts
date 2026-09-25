import mongoose, { Schema, Document } from 'mongoose';

export interface ISourceRef {
  source: string;
  sourceUrl?: string;
  reportingPeriod?: string;
  timestamp?: string;
}

export interface IAnalysisReportDoc extends Document {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  symbol: string;
  analysisType: 'BUY' | 'SELL';
  reportMarkdown: string;
  sections: Record<string, string>;
  sourceReferences: ISourceRef[];
  personalInvestmentData?: {
    purchasePrice?: number;
    quantity?: number;
    investmentDate?: string;
    portfolioValue?: number;
    unrealizedPnl?: number;
    returnPercent?: number;
  };
  metricsSnapshot?: Record<string, any>;
  dataTimestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnalysisReportSchema = new Schema<IAnalysisReportDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
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
    analysisType: {
      type: String,
      enum: ['BUY', 'SELL'],
      required: true,
      index: true,
    },
    reportMarkdown: {
      type: String,
      required: true,
    },
    sections: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sourceReferences: [
      {
        source: { type: String, required: true },
        sourceUrl: { type: String },
        reportingPeriod: { type: String },
        timestamp: { type: String },
      },
    ],
    personalInvestmentData: {
      type: Schema.Types.Mixed,
    },
    metricsSnapshot: {
      type: Schema.Types.Mixed,
    },
    dataTimestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

AnalysisReportSchema.index({ symbol: 1, analysisType: 1, createdAt: -1 });
AnalysisReportSchema.index({ userId: 1, createdAt: -1 });

export const AnalysisReport = mongoose.model<IAnalysisReportDoc>(
  'AnalysisReport',
  AnalysisReportSchema
);
