import mongoose, { Schema, Document } from 'mongoose';

export interface IFinancialDocument extends Document {
  _id: mongoose.Types.ObjectId;
  assetId: mongoose.Types.ObjectId;
  symbol: string;
  documentType: string;
  title: string;
  content?: string;
  source: string;
  sourceUrl?: string;
  publicationDate?: Date;
  collectedAt: Date;
  processingStatus: 'PENDING' | 'PROCESSED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

const FinancialDocumentSchema = new Schema<IFinancialDocument>(
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
    documentType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
    publicationDate: {
      type: Date,
    },
    collectedAt: {
      type: Date,
      default: Date.now,
    },
    processingStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSED', 'FAILED'],
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

FinancialDocumentSchema.index({ symbol: 1, documentType: 1, publicationDate: -1 });

export const FinancialDocument = mongoose.model<IFinancialDocument>(
  'FinancialDocument',
  FinancialDocumentSchema
);
