import { Request, Response, NextFunction } from 'express';
import { RagSyncService } from './services/ragSync.service';
import { HybridRetrievalService } from './services/hybridRetrieval.service';
import { FinancialRelevanceReranker } from './services/reranking.service';
import { EvidenceContextBuilderService } from './services/evidenceContext.service';
import { LlmService } from './services/llm.service';
import { QdrantService } from './services/qdrant.service';
import { sendSuccess, AppError } from '../../utils/apiResponse';

export class RagController {
  private static reranker = new FinancialRelevanceReranker();
  private static llmService = LlmService.getInstance();
  private static qdrantService = QdrantService.getInstance();

  /**
   * POST /api/rag/index
   * Index financial data for a specific asset
   */
  public static async indexFinancialData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { symbol } = req.body;
      if (!symbol || typeof symbol !== 'string') {
        throw new AppError('Stock symbol is required for indexing', 400, 'SYMBOL_REQUIRED');
      }

      const result = await RagSyncService.syncAssetBySymbol(symbol);

      sendSuccess(
        res,
        result,
        `Financial data for ${result.symbol} indexed successfully (${result.chunksCount} chunks stored in Qdrant)`,
        200
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/rag/reindex
   * Reindex all companies or a specific asset
   */
  public static async reindexFinancialData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { symbol } = req.body;

      if (symbol && typeof symbol === 'string') {
        const result = await RagSyncService.syncAssetBySymbol(symbol);
        sendSuccess(res, result, `Reindexed financial data for ${result.symbol}`, 200);
        return;
      }

      // Reindex all assets
      const summary = await RagSyncService.syncAllAssets();
      sendSuccess(
        res,
        summary,
        `Completed reindexing: ${summary.indexedCount} of ${summary.totalAssets} companies indexed (${summary.totalChunks} total vectors)`,
        200
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/rag/search
   * Hybrid search (vector similarity + keyword search + re-ranking)
   */
  public static async searchFinancialKnowledge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, symbol, limit } = req.body;
      if (!query || typeof query !== 'string') {
        throw new AppError('Search query string is required', 400, 'QUERY_REQUIRED');
      }

      // 1. Hybrid Retrieval
      const initialHits = await HybridRetrievalService.retrieve({
        query,
        symbol,
        limit: limit ? parseInt(limit, 10) : 10,
      });

      if (initialHits.length === 0) {
        sendSuccess(res, { results: [], count: 0 }, 'No matching financial evidence found', 200);
        return;
      }

      // 2. Re-ranking
      const targetSymbol = initialHits[0]?.symbol || symbol?.toUpperCase();
      const reranked = await RagController.reranker.rerank(
        query,
        targetSymbol,
        initialHits,
        limit ? parseInt(limit, 10) : 10
      );

      sendSuccess(
        res,
        {
          symbol: targetSymbol,
          count: reranked.length,
          results: reranked,
        },
        'Hybrid retrieval and re-ranking completed successfully',
        200
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/rag/query
   * Full RAG pipeline: Retrieval -> Re-ranking -> Context Building -> Qwen3-4B generation
   */
  public static async queryRagAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, symbol } = req.body;
      if (!query || typeof query !== 'string') {
        throw new AppError('User query is required', 400, 'QUERY_REQUIRED');
      }

      // 1. Hybrid Retrieval
      const initialHits = await HybridRetrievalService.retrieve({
        query,
        symbol,
        limit: 15,
      });

      const targetSymbol = initialHits[0]?.symbol || symbol?.toUpperCase() || 'UNKNOWN';
      const companyName = initialHits[0]?.companyName;

      // 2. Re-ranking
      const rerankedChunks = await RagController.reranker.rerank(
        query,
        targetSymbol,
        initialHits,
        7
      );

      // 3. Evidence Context Assembly
      const evidenceContext = EvidenceContextBuilderService.buildContext(
        query,
        targetSymbol,
        companyName,
        rerankedChunks
      );

      // 4. LLM Generation via Qwen3-4B
      const aiResponse = await RagController.llmService.generateAnswer(evidenceContext);

      sendSuccess(
        res,
        {
          answer: aiResponse.answer,
          symbol: aiResponse.symbol,
          evidence: aiResponse.evidence,
          sources: aiResponse.sources,
          dataFreshness: aiResponse.dataFreshness,
        },
        'RAG financial analysis generated successfully',
        200
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/rag/stats
   * Get Qdrant collection status and vector counts
   */
  public static async getCollectionStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await RagController.qdrantService.getStats();
      sendSuccess(res, stats, 'Qdrant collection status retrieved', 200);
    } catch (err) {
      next(err);
    }
  }
}
