import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
  _id: mongoose.Types.ObjectId;
  symbol: string;
  companyName: string;
  exchange?: string;
  country?: string;
  sector?: string;
  industry?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
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
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    exchange: {
      type: String,
      trim: true,
      default: 'UNKNOWN',
    },
    country: {
      type: String,
      trim: true,
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
