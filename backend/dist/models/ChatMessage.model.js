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
exports.ChatMessage = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ChatMessageSchema = new mongoose_1.Schema({
    sessionId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
    versionKey: false,
});
ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
exports.ChatMessage = mongoose_1.default.model('ChatMessage', ChatMessageSchema);
//# sourceMappingURL=ChatMessage.model.js.map