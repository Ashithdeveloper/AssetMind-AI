import mongoose, { Schema, Document } from 'mongoose';

export interface IStatementRow {
  name: string;
  values: Array<number | null>;
  rawValues?: string[];
}

export interface IStatementTable {
  headers: string[];
  rows: IStatementRow[];
}

export interface IFinancialStatementDoc extends Document {
  _id: mongoose.Types.ObjectId;
  assetId?: mongoose.Types.ObjectId;
  symbol: string;
  nseSymbol?: string;
  bseCode?: string;
  companyName: string;
  quarters: IStatementTable;
  profitLoss: IStatementTable;
  balanceSheet: IStatementTable;
  cashFlow: IStatementTable;
  ratios?: IStatementTable;
  source: string;
  sourceUrl?: string;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StatementRowSchema = new Schema(
  {
    name: { type: String, required: true },
    values: [{ type: Schema.Types.Mixed }],
    rawValues: [{ type: String }],
  },
  { _id: false }
);

const StatementTableSchema = new Schema(
  {
    headers: [{ type: String }],
    rows: [StatementRowSchema],
  },
  { _id: false }
);

const FinancialStatementSchema = new Schema<IFinancialStatementDoc>(
  {
    assetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
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
    },
    quarters: {
      type: StatementTableSchema,
      default: { headers: [], rows: [] },
    },
    profitLoss: {
      type: StatementTableSchema,
      default: { headers: [], rows: [] },
    },
    balanceSheet: {
      type: StatementTableSchema,
      default: { headers: [], rows: [] },
    },
    cashFlow: {
      type: StatementTableSchema,
      default: { headers: [], rows: [] },
    },
    ratios: {
      type: StatementTableSchema,
      default: { headers: [], rows: [] },
    },
    source: {
      type: String,
      default: 'Screener.in',
    },
    sourceUrl: {
      type: String,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const FinancialStatement = mongoose.model<IFinancialStatementDoc>(
  'FinancialStatement',
  FinancialStatementSchema
);
