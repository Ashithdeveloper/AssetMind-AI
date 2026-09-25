import mongoose, { Schema, Document } from 'mongoose';

export interface IStockPrice extends Document {
  _id: mongoose.Types.ObjectId;
  assetId: mongoose.Types.ObjectId;
  symbol: string;
  price: number;
  currency?: string;
  change?: number;
  changePercent?: number;
  previousClose?: number;
  volume?: number;
  priceTimestamp: Date;
  source: string;
  sourceUrl?: string;
  collectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StockPriceSchema = new Schema<IStockPrice>(
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
    change: {
      type: Number,
    },
    changePercent: {
      type: Number,
    },
    previousClose: {
      type: Number,
    },
    volume: {
      type: Number,
    },
    priceTimestamp: {
      type: Date,
      default: Date.now,
      index: true,
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
    collectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

StockPriceSchema.index({ symbol: 1, priceTimestamp: -1 });

export const StockPrice = mongoose.model<IStockPrice>('StockPrice', StockPriceSchema);
