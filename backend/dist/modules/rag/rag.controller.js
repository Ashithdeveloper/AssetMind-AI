"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RagController = void 0;
const ragSync_service_1 = require("./services/ragSync.service");
const hybridRetrieval_service_1 = require("./services/hybridRetrieval.service");
const reranking_service_1 = require("./services/reranking.service");
const evidenceContext_service_1 = require("./services/evidenceContext.service");
const llm_service_1 = require("./services/llm.service");
const qdrant_service_1 = require("./services/qdrant.service");
const apiResponse_1 = require("../../utils/apiResponse");
class RagController {
    static reranker = new reranking_service_1.FinancialRelevanceReranker();
    static llmService = llm_service_1.LlmService.getInstance();
    static qdrantService = qdrant_service_1.QdrantService.getInstance();
    /**
     * POST /api/rag/index
     * Index financial data for a specific asset
     */
    static async indexFinancialData(req, res, next) {
        try {
            const { symbol } = req.body;
            if (!symbol || typeof symbol !== 'string') {
                throw new apiResponse_1.AppError('Stock symbol is required for indexing', 400, 'SYMBOL_REQUIRED');
            }
            const result = await ragSync_service_1.RagSyncService.syncAssetBySymbol(symbol);
            (0, apiResponse_1.sendSuccess)(res, result, `Financial data for ${result.symbol} indexed successfully (${result.chunksCount} chunks stored in Qdrant)`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/rag/reindex
     * Reindex all companies or a specific asset
     */
    static async reindexFinancialData(req, res, next) {
        try {
            const { symbol } = req.body;
            if (symbol && typeof symbol === 'string') {
                const result = await ragSync_service_1.RagSyncService.syncAssetBySymbol(symbol);
                (0, apiResponse_1.sendSuccess)(res, result, `Reindexed financial data for ${result.symbol}`, 200);
                return;
            }
            // Reindex all assets
            const summary = await ragSync_service_1.RagSyncService.syncAllAssets();
            (0, apiResponse_1.sendSuccess)(res, summary, `Completed reindexing: ${summary.indexedCount} of ${summary.totalAssets} companies indexed (${summary.totalChunks} total vectors)`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/rag/search
     * Hybrid search (vector similarity + keyword search + re-ranking)
     */
    static async searchFinancialKnowledge(req, res, next) {
        try {
            const { query, symbol, limit } = req.body;
            if (!query || typeof query !== 'string') {
                throw new apiResponse_1.AppError('Search query string is required', 400, 'QUERY_REQUIRED');
            }
            // 1. Hybrid Retrieval
            const initialHits = await hybridRetrieval_service_1.HybridRetrievalService.retrieve({
                query,
                symbol,
                limit: limit ? parseInt(limit, 10) : 10,
            });
            if (initialHits.length === 0) {
                (0, apiResponse_1.sendSuccess)(res, { results: [], count: 0 }, 'No matching financial evidence found', 200);
                return;
            }
            // 2. Re-ranking
            const targetSymbol = initialHits[0]?.symbol || symbol?.toUpperCase();
            const reranked = await RagController.reranker.rerank(query, targetSymbol, initialHits, limit ? parseInt(limit, 10) : 10);
            (0, apiResponse_1.sendSuccess)(res, {
                symbol: targetSymbol,
                count: reranked.length,
                results: reranked,
            }, 'Hybrid retrieval and re-ranking completed successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/rag/query
     * Full RAG pipeline: Retrieval -> Re-ranking -> Context Building -> Qwen3-4B generation
     */
    static async queryRagAnswer(req, res, next) {
        try {
            const { query, symbol } = req.body;
            if (!query || typeof query !== 'string') {
                throw new apiResponse_1.AppError('User query is required', 400, 'QUERY_REQUIRED');
            }
            // 1. Hybrid Retrieval
            const initialHits = await hybridRetrieval_service_1.HybridRetrievalService.retrieve({
                query,
                symbol,
                limit: 15,
            });
            const targetSymbol = initialHits[0]?.symbol || symbol?.toUpperCase() || 'UNKNOWN';
            const companyName = initialHits[0]?.companyName;
            // 2. Re-ranking
            const rerankedChunks = await RagController.reranker.rerank(query, targetSymbol, initialHits, 7);
            // 3. Evidence Context Assembly
            const evidenceContext = evidenceContext_service_1.EvidenceContextBuilderService.buildContext(query, targetSymbol, companyName, rerankedChunks);
            // 4. LLM Generation via Qwen3-4B
            const aiResponse = await RagController.llmService.generateAnswer(evidenceContext);
            (0, apiResponse_1.sendSuccess)(res, {
                answer: aiResponse.answer,
                symbol: aiResponse.symbol,
                evidence: aiResponse.evidence,
                sources: aiResponse.sources,
                dataFreshness: aiResponse.dataFreshness,
            }, 'RAG financial analysis generated successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/rag/stats
     * Get Qdrant collection status and vector counts
     */
    static async getCollectionStats(req, res, next) {
        try {
            const stats = await RagController.qdrantService.getStats();
            (0, apiResponse_1.sendSuccess)(res, stats, 'Qdrant collection status retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.RagController = RagController;
//# sourceMappingURL=rag.controller.js.map