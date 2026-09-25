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
exports.PriceHistory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PriceHistorySchema = new mongoose_1.Schema({
    companyId: {
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
}, {
    timestamps: true,
    versionKey: false,
});
PriceHistorySchema.index({ symbol: 1, dateString: 1 }, { unique: true });
PriceHistorySchema.index({ symbol: 1, date: 1 });
exports.PriceHistory = mongoose_1.default.model('PriceHistory', PriceHistorySchema);
//# sourceMappingURL=PriceHistory.model.js.map