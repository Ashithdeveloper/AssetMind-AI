import mongoose, { Schema, Document } from 'mongoose';

export interface IScrapingJob extends Document {
  _id: mongoose.Types.ObjectId;
  source: string;
  symbol: string;
  scraperProvider: 'playwright' | 'scrapingbee';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  startedAt: Date;
  completedAt?: Date;
  recordsCollected: number;
  recordsValidated: number;
  recordsRejected: number;
  errorMessage?: string;
  details?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ScrapingJobSchema = new Schema<IScrapingJob>(
  {
    source: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    scraperProvider: {
      type: String,
      enum: ['playwright', 'scrapingbee'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL'],
      default: 'PENDING',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    recordsCollected: {
      type: Number,
      default: 0,
    },
    recordsValidated: {
      type: Number,
      default: 0,
    },
    recordsRejected: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
    },
    details: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ScrapingJobSchema.index({ symbol: 1, createdAt: -1 });

export const ScrapingJob = mongoose.model<IScrapingJob>('ScrapingJob', ScrapingJobSchema);
