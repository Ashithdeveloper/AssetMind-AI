import mongoose, { Schema, Document } from 'mongoose';

export interface IMarketData extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  symbol: string;
  price: number;
  currency: string;
  marketCap?: number;
  dailyChange?: number;
  dailyChangePercent?: number;
  timestamp: Date;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const MarketDataSchema = new Schema<IMarketData>(
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
    price: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'USD',
    },
    marketCap: {
      type: Number,
      index: true,
    },
    dailyChange: {
      type: Number,
    },
    dailyChangePercent: {
      type: Number,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

MarketDataSchema.index({ symbol: 1, timestamp: -1 });

export const MarketData = mongoose.model<IMarketData>('MarketData', MarketDataSchema);
