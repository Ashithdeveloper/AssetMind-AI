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
exports.FinancialData = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const FinancialDataSchema = new mongoose_1.Schema({
    assetId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
    metricName: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    metricValue: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        trim: true,
        uppercase: true,
        default: 'USD',
    },
    unit: {
        type: String,
        trim: true,
        default: 'raw', // e.g., 'raw', 'millions', 'billions', 'percentage', 'ratio'
    },
    reportingPeriod: {
        type: String,
        trim: true,
        default: 'TTM',
        index: true,
    },
    dataTimestamp: {
        type: Date,
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
    scraperProvider: {
        type: String,
        enum: ['playwright', 'scrapingbee'],
        required: true,
    },
    collectedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    validationStatus: {
        type: String,
        enum: ['VALID', 'WARNING', 'REJECTED'],
        default: 'VALID',
        index: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
}, {
    timestamps: true,
    versionKey: false,
});
// Compound unique index to prevent duplicate records from the same source, period, metric for the asset
FinancialDataSchema.index({ assetId: 1, metricName: 1, reportingPeriod: 1, source: 1 }, { unique: true });
exports.FinancialData = mongoose_1.default.model('FinancialData', FinancialDataSchema);
//# sourceMappingURL=FinancialData.model.js.map