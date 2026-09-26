import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
  _id: mongoose.Types.ObjectId;
  symbol: string;
  nseSymbol?: string;
  bseCode?: string;
  companyName: string;
  exchange?: string;
  country?: string;
  currency?: string;
  sector?: string;
  industry?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  dataSource?: string;
  currentPrice?: number;
  marketCapitalization?: number;
  lastScrapedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema = new Schema<IAsset>(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    nseSymbol: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
    },
    bseCode: {
      type: String,
      trim: true,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    exchange: {
      type: String,
      trim: true,
      default: 'NSE',
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
    currency: {
      type: String,
      trim: true,
      default: 'INR',
    },
    sector: {
      type: String,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    dataSource: {
      type: String,
      trim: true,
      default: 'Screener.in',
    },
    currentPrice: {
      type: Number,
    },
    marketCapitalization: {
      type: Number,
    },
    lastScrapedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound unique index for exchange and symbol to prevent duplicate asset records
AssetSchema.index({ symbol: 1, exchange: 1 }, { unique: true });
AssetSchema.index({ companyName: 'text', symbol: 'text' });

export const Asset = mongoose.model<IAsset>('Asset', AssetSchema);
export const Company = Asset;
export type ICompany = IAsset;
