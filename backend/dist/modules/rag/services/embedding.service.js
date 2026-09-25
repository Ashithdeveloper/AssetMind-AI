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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BgeSmallEmbeddingService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class BgeSmallEmbeddingService {
    static instance;
    pipelinePromise = null;
    modelName = 'Xenova/bge-small-en-v1.5';
    dimension = 384;
    cache = new Map();
    maxCacheSize = 5000;
    constructor() { }
    static getInstance() {
        if (!BgeSmallEmbeddingService.instance) {
            BgeSmallEmbeddingService.instance = new BgeSmallEmbeddingService();
        }
        return BgeSmallEmbeddingService.instance;
    }
    getDimension() {
        return this.dimension;
    }
    getModelName() {
        return 'BAAI/bge-small-en-v1.5';
    }
    /**
     * Lazily loads the Transformers.js feature-extraction pipeline
     */
    async getPipeline() {
        if (!this.pipelinePromise) {
            this.pipelinePromise = (async () => {
                try {
                    const { pipeline, env } = await Promise.resolve().then(() => __importStar(require('@xenova/transformers')));
                    // Disable remote telemetry/unneeded logs
                    env.allowLocalModels = true;
                    return await pipeline('feature-extraction', this.modelName);
                }
                catch (err) {
                    this.pipelinePromise = null;
                    throw new Error(`Failed to load embedding model ${this.modelName}: ${err.message || err}`);
                }
            })();
        }
        return this.pipelinePromise;
    }
    /**
     * Generates a normalized 384-dim vector for a single text input
     */
    async generateEmbedding(text) {
        const cleanText = text.trim();
        if (!cleanText) {
            return new Array(this.dimension).fill(0);
        }
        const hash = crypto_1.default.createHash('sha256').update(cleanText).digest('hex');
        if (this.cache.has(hash)) {
            return this.cache.get(hash);
        }
        const extractor = await this.getPipeline();
        const output = await extractor(cleanText, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data);
        if (vector.length !== this.dimension) {
            throw new Error(`Expected embedding dimension ${this.dimension}, got ${vector.length}`);
        }
        // Evict oldest cache entries if size exceeds limit
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey)
                this.cache.delete(firstKey);
        }
        this.cache.set(hash, vector);
        return vector;
    }
    /**
     * Batch generation of embeddings with configurable batch sizes
     */
    async generateBatchEmbeddings(texts, batchSize = 16) {
        const results = new Array(texts.length);
        const toComputeIndices = [];
        const toComputeTexts = [];
        // Check cache first
        for (let i = 0; i < texts.length; i++) {
            const cleanText = texts[i].trim();
            const hash = crypto_1.default.createHash('sha256').update(cleanText).digest('hex');
            if (this.cache.has(hash)) {
                results[i] = this.cache.get(hash);
            }
            else {
                toComputeIndices.push(i);
                toComputeTexts.push(cleanText);
            }
        }
        if (toComputeTexts.length === 0) {
            return results;
        }
        const extractor = await this.getPipeline();
        // Process in batches
        for (let b = 0; b < toComputeTexts.length; b += batchSize) {
            const currentBatchTexts = toComputeTexts.slice(b, b + batchSize);
            const currentIndices = toComputeIndices.slice(b, b + batchSize);
            for (let j = 0; j < currentBatchTexts.length; j++) {
                const text = currentBatchTexts[j];
                const globalIdx = currentIndices[j];
                if (!text) {
                    const zeroVec = new Array(this.dimension).fill(0);
                    results[globalIdx] = zeroVec;
                    continue;
                }
                try {
                    const output = await extractor(text, { pooling: 'mean', normalize: true });
                    const vector = Array.from(output.data);
                    const hash = crypto_1.default.createHash('sha256').update(text).digest('hex');
                    if (this.cache.size >= this.maxCacheSize) {
                        const firstKey = this.cache.keys().next().value;
                        if (firstKey)
                            this.cache.delete(firstKey);
                    }
                    this.cache.set(hash, vector);
                    results[globalIdx] = vector;
                }
                catch (itemErr) {
                    console.error(`[EmbeddingService] Failed generating embedding for chunk:`, itemErr.message);
                    throw itemErr;
                }
            }
        }
        return results;
    }
}
exports.BgeSmallEmbeddingService = BgeSmallEmbeddingService;
//# sourceMappingURL=embedding.service.js.map