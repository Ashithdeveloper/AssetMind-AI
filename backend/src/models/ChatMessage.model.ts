import mongoose, { Schema, Document } from 'mongoose';

export interface IChatStockSnapshot {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  pe: number | null;
  marketCap: number | null;
  high52: number | null;
  low52: number | null;
  volume: number;
  source: string;
  lastUpdated: Date;
}

export interface IChatEvidenceItem {
  chunkId: string;
  symbol: string;
  documentType: string;
  reportingPeriod: string;
  source: string;
  sourceUrl?: string;
  text: string;
  rerankScore?: number;
}

export interface IChatNewsItem {
  title: string;
  source: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  publishedAt?: Date;
  url?: string;
}

export interface IChatMessageDoc extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  referencedSymbols: string[];
  stockSnapshots: IChatStockSnapshot[];
  evidence: IChatEvidenceItem[];
  newsHighlights: IChatNewsItem[];
  modelUsed?: string;
  confidenceScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessageDoc>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    referencedSymbols: {
      type: [String],
      default: [],
      index: true,
    },
    stockSnapshots: [
      {
        symbol: { type: String, required: true },
        companyName: { type: String, required: true },
        price: { type: Number, required: true },
        change: { type: Number, default: 0 },
        changePercent: { type: Number, default: 0 },
        currency: { type: String, default: 'INR' },
        pe: { type: Number, default: null },
        marketCap: { type: Number, default: null },
        high52: { type: Number, default: null },
        low52: { type: Number, default: null },
        volume: { type: Number, default: 0 },
        source: { type: String, default: 'realtime' },
        lastUpdated: { type: Date, default: Date.now },
      },
    ],
    evidence: [
      {
        chunkId: { type: String },
        symbol: { type: String },
        documentType: { type: String },
        reportingPeriod: { type: String },
        source: { type: String },
        sourceUrl: { type: String },
        text: { type: String },
        rerankScore: { type: Number },
      },
    ],
    newsHighlights: [
      {
        title: { type: String },
        source: { type: String },
        sentiment: { type: String },
        publishedAt: { type: Date },
        url: { type: String },
      },
    ],
    modelUsed: {
      type: String,
      default: 'gpt-oss:20b-cloud',
    },
    confidenceScore: {
      type: Number,
      default: 0.9,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });

export const ChatMessage = mongoose.model<IChatMessageDoc>('ChatMessage', ChatMessageSchema);
