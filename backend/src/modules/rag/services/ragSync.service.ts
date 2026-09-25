import { DocumentBuilderService } from './documentBuilder.service';
import { ChunkingService } from './chunking.service';
import { BgeSmallEmbeddingService } from './embedding.service';
import { QdrantService } from './qdrant.service';
import { Asset } from '../../../models/Asset.model';
import { EmbeddedChunk } from '../rag.types';

export class RagSyncService {
  private static documentBuilder = DocumentBuilderService;
  private static chunkingService = ChunkingService;
  private static embeddingService = BgeSmallEmbeddingService.getInstance();
  private static qdrantService = QdrantService.getInstance();

  /**
   * Synchronize / Index a single asset by symbol
   * Avoids re-indexing unrelated companies
   */
  public static async syncAssetBySymbol(symbol: string): Promise<{
    symbol: string;
    companyName: string;
    documentsCount: number;
    chunksCount: number;
    status: 'INDEXED' | 'NO_DATA';
  }> {
    const cleanSymbol = symbol.trim().toUpperCase();
    console.log(`[RagSyncService] Starting incremental sync for symbol: ${cleanSymbol}`);

    // Ensure Qdrant collection is ready
    await this.qdrantService.ensureCollectionInitialized();

    // 1. Build documents from MongoDB
    const docs = await this.documentBuilder.buildDocumentsForSymbol(cleanSymbol);
    if (docs.length === 0) {
      console.log(`[RagSyncService] No documents built for ${cleanSymbol}`);
      return {
        symbol: cleanSymbol,
        companyName: cleanSymbol,
        documentsCount: 0,
        chunksCount: 0,
        status: 'NO_DATA',
      };
    }

    const companyName = docs[0].companyName || cleanSymbol;

    // 2. Split documents into structured chunks
    const chunks = this.chunkingService.chunkDocuments(docs);
    console.log(`[RagSyncService] Generated ${chunks.length} chunks across ${docs.length} documents for ${cleanSymbol}`);

    if (chunks.length === 0) {
      return {
        symbol: cleanSymbol,
        companyName,
        documentsCount: docs.length,
        chunksCount: 0,
        status: 'NO_DATA',
      };
    }

    // 3. Generate embeddings
    const texts = chunks.map((c) => c.content);
    const embeddings = await this.embeddingService.generateBatchEmbeddings(texts, 16);

    const embeddedChunks: EmbeddedChunk[] = chunks.map((chunk, idx) => ({
      ...chunk,
      embedding: embeddings[idx],
    }));

    // 4. Update Qdrant: Delete existing vectors for this specific symbol first to purge stale chunks
    await this.qdrantService.deleteBySymbol(cleanSymbol);

    // 5. Upsert newly generated vectors with latest source metadata
    await this.qdrantService.upsertChunks(embeddedChunks);

    console.log(`[RagSyncService] Successfully synchronized ${embeddedChunks.length} vectors in Qdrant for ${cleanSymbol}`);

    return {
      symbol: cleanSymbol,
      companyName,
      documentsCount: docs.length,
      chunksCount: embeddedChunks.length,
      status: 'INDEXED',
    };
  }

  /**
   * Reindex all assets currently stored in MongoDB
   */
  public static async syncAllAssets(): Promise<{
    totalAssets: number;
    indexedCount: number;
    totalChunks: number;
    results: any[];
  }> {
    await this.qdrantService.ensureCollectionInitialized();

    const assets = await Asset.find({}, { symbol: 1, companyName: 1 });
    console.log(`[RagSyncService] Reindexing financial knowledge base for ${assets.length} companies...`);

    const results: any[] = [];
    let totalChunks = 0;
    let indexedCount = 0;

    for (const asset of assets) {
      try {
        const syncResult = await this.syncAssetBySymbol(asset.symbol);
        results.push(syncResult);
        if (syncResult.status === 'INDEXED') {
          indexedCount++;
          totalChunks += syncResult.chunksCount;
        }
      } catch (err: any) {
        console.warn(`[RagSyncService] Failed to index asset ${asset.symbol}:`, err.message);
        results.push({
          symbol: asset.symbol,
          companyName: asset.companyName,
          status: 'FAILED',
          error: err.message,
        });
      }
    }

    return {
      totalAssets: assets.length,
      indexedCount,
      totalChunks,
      results,
    };
  }
}
