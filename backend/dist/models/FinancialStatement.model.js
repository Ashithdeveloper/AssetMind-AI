"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialStatement = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const StatementRowSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    values: [{ type: mongoose_1.Schema.Types.Mixed }],
    rawValues: [{ type: String }],
}, { _id: false });
const StatementTableSchema = new mongoose_1.Schema({
    headers: [{ type: String }],
    rows: [StatementRowSchema],
}, { _id: false });
const FinancialStatementSchema = new mongoose_1.Schema({
    assetId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
});
exports.FinancialStatement = mongoose_1.default.model('FinancialStatement', FinancialStatementSchema);
//# sourceMappingURL=FinancialStatement.model.js.map