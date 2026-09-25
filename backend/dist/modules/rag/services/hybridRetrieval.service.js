"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridRetrievalService = void 0;
const qdrant_service_1 = require("./qdrant.service");
const embedding_service_1 = require("./embedding.service");
const Asset_model_1 = require("../../../models/Asset.model");
class HybridRetrievalService {
    static qdrantService = qdrant_service_1.QdrantService.getInstance();
    static embeddingService = embedding_service_1.BgeSmallEmbeddingService.getInstance();
    /**
     * Resolves target symbol from query or explicit parameter
     */
    static async identifyAsset(query, explicitSymbol) {
        if (explicitSymbol && explicitSymbol.trim()) {
            const clean = explicitSymbol.trim().toUpperCase();
            const asset = await Asset_model_1.Asset.findOne({ symbol: clean });
            return { symbol: clean, companyName: asset?.companyName };
        }
        // Try to detect symbol or company name in query text
        const cleanQuery = query.toLowerCase();
        // Check symbols directly in Asset collection
        const assets = await Asset_model_1.Asset.find({}, { symbol: 1, companyName: 1 });
        for (const a of assets) {
            const sym = a.symbol.toLowerCase();
            const name = a.companyName.toLowerCase().replace(/^(the\s+)/, '');
            const shortName = name.replace(/\s+(inc|corp|corporation|co|ltd|plc|technologies|group)\.?$/i, '').trim();
            // Check symbol token or company name
            const queryWords = cleanQuery.split(/[\s,?.!]+/);
            if (queryWords.includes(sym) || cleanQuery.includes(shortName.toLowerCase())) {
                return { symbol: a.symbol, companyName: a.companyName };
            }
        }
        return null;
    }
    /**
     * Extract financial keywords from user query
     */
    static extractFinancialKeywords(query) {
        const commonFinancialTerms = [
            'free cash flow',
            'operating cash flow',
            'cash flow',
            'net income',
            'revenue',
            'gross profit',
            'operating income',
            'ebitda',
            'eps',
            'earnings per share',
            'pe ratio',
            'price to earnings',
            'pb ratio',
            'price to book',
            'debt to equity',
            'market cap',
            'market capitalization',
            'balance sheet',
            'total debt',
            'total assets',
            'total liabilities',
            'profit margin',
            'gross margin',
            'operating margin',
            'stock price',
            'current price',
            'volume',
            'previous close',
            'historical',
            'trend',
            'performance',
            'valuation',
            'dividend',
        ];
        const lower = query.toLowerCase();
        const matched = [];
        for (const term of commonFinancialTerms) {
            if (lower.includes(term)) {
                matched.push(term);
            }
        }
        // Also extract individual significant words
        const tokens = lower
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter((w) => w.length > 3 && !['what', 'when', 'where', 'which', 'about', 'company', 'tell', 'show', 'give'].includes(w));
        return Array.from(new Set([...matched, ...tokens]));
    }
    /**
     * Hybrid retrieval combining dense vector similarity and sparse keyword matching
     */
    static async retrieve(params) {
        const { query, limit = 10 } = params;
        // 1. Identify Target Asset strictly (prevents mixing unrelated company data)
        let targetAsset = await this.identifyAsset(query, params.symbol);
        const targetSymbol = targetAsset?.symbol || params.symbol?.toUpperCase();
        if (!targetSymbol) {
            throw new Error('A target asset symbol must be specified or identifiable in the query.');
        }
        const filter = {
            symbol: targetSymbol,
            documentType: params.documentType,
            reportingPeriod: params.reportingPeriod,
        };
        // 2. Vector Similarity Search
        const queryVector = await this.embeddingService.generateEmbedding(query);
        const vectorHits = await this.qdrantService.searchVectors(queryVector, filter, limit * 2);
        // Map vector hits by chunkId
        const vectorResultsMap = new Map();
        for (const hit of vectorHits) {
            const payload = hit.payload;
            if (payload?.chunkId) {
                vectorResultsMap.set(payload.chunkId, {
                    hit,
                    score: hit.score, // Cosine similarity
                });
            }
        }
        // 3. Keyword-Based Matching
        const allCandidatePoints = await this.qdrantService.scrollPoints(filter, 60);
        const keywords = this.extractFinancialKeywords(query);
        const keywordScoresMap = new Map();
        for (const point of allCandidatePoints) {
            const payload = point.payload;
            if (!payload)
                continue;
            const chunkId = payload.chunkId;
            const contentLower = (payload.content || '').toLowerCase();
            const metricNames = (payload.metricNames || []);
            let kwScore = 0;
            // Exact financial metric match bonus
            for (const kw of keywords) {
                // High bonus if explicit metric name matches query
                const metricMatch = metricNames.some((m) => m.toLowerCase().includes(kw.replace(/\s+/g, '')));
                if (metricMatch) {
                    kwScore += 3.0;
                }
                // Content presence
                if (contentLower.includes(kw)) {
                    kwScore += 1.5;
                }
            }
            // Exact symbol match confirmation
            if (payload.symbol === targetSymbol) {
                kwScore += 0.5;
            }
            if (kwScore > 0) {
                keywordScoresMap.set(chunkId, kwScore);
            }
        }
        // 4. Combine and Rank Results using Reciprocal Rank Fusion / Weighted Scoring
        const allChunkIds = Array.from(new Set([...Array.from(vectorResultsMap.keys()), ...Array.from(keywordScoresMap.keys())]));
        // Normalize keyword scores
        const maxKwScore = Math.max(...Array.from(keywordScoresMap.values()), 1);
        const combined = [];
        for (const chunkId of allChunkIds) {
            const vEntry = vectorResultsMap.get(chunkId);
            const kwScore = keywordScoresMap.get(chunkId) || 0;
            let payload = null;
            let vectorScore = 0;
            if (vEntry) {
                payload = vEntry.hit.payload;
                // Cosine similarity in Qdrant is between -1 and 1 (or 0 and 1)
                vectorScore = Math.max(0, vEntry.score);
            }
            else {
                const candidate = allCandidatePoints.find((p) => p.payload?.chunkId === chunkId);
                payload = candidate?.payload;
            }
            if (!payload)
                continue;
            // Ensure that chunk strictly belongs to targetSymbol
            if (payload.symbol !== targetSymbol) {
                continue;
            }
            const normalizedKwScore = kwScore / maxKwScore;
            // Hybrid combined score: 60% semantic similarity + 40% keyword precision
            const combinedScore = (vectorScore * 0.60) + (normalizedKwScore * 0.40);
            combined.push({
                chunkId,
                symbol: payload.symbol,
                companyName: payload.companyName || targetAsset?.companyName || payload.symbol,
                documentType: payload.documentType,
                reportingPeriod: payload.reportingPeriod,
                source: payload.source,
                sourceUrl: payload.sourceUrl,
                dataTimestamp: payload.dataTimestamp,
                content: payload.content,
                score: Number(combinedScore.toFixed(4)),
                vectorScore: Number(vectorScore.toFixed(4)),
                keywordScore: Number(normalizedKwScore.toFixed(4)),
                metadata: payload,
            });
        }
        // Sort by combined score descending
        combined.sort((a, b) => b.score - a.score);
        return combined.slice(0, limit);
    }
}
exports.HybridRetrievalService = HybridRetrievalService;
//# sourceMappingURL=hybridRetrieval.service.js.map