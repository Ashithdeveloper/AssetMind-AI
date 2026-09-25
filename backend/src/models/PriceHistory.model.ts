import mongoose, { Schema, Document } from 'mongoose';

export interface IPriceHistory extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  symbol: string;
  date: Date;
  dateString: string; // 'YYYY-MM-DD' for fast unique indexing
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  currency: string;
  exchange?: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const PriceHistorySchema = new Schema<IPriceHistory>(
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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    dateString: {
      type: String,
      required: true,
      trim: true,
    },
    open: {
      type: Number,
      required: true,
    },
    high: {
      type: Number,
      required: true,
    },
    low: {
      type: Number,
      required: true,
    },
    close: {
      type: Number,
      required: true,
    },
    volume: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
    },
    exchange: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
      default: 'market_data',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

PriceHistorySchema.index({ symbol: 1, dateString: 1 }, { unique: true });
PriceHistorySchema.index({ symbol: 1, date: 1 });

export const PriceHistory = mongoose.model<IPriceHistory>('PriceHistory', PriceHistorySchema);
