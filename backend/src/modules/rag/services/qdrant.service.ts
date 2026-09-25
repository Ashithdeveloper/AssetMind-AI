import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'crypto';
import { EmbeddedChunk, SearchFilter, DocumentType } from '../rag.types';

export class QdrantService {
  private static instance: QdrantService;
  private client: QdrantClient;
  public readonly collectionName = 'assetmind_stock_documents';
  private initialized = false;

  private constructor() {
    const qdrantUrl = process.env.QDRANT_URL || 'http://127.0.0.1:6333';
    const apiKey = process.env.QDRANT_API_KEY || undefined;

    this.client = new QdrantClient({
      url: qdrantUrl,
      apiKey: apiKey,
    });
  }

  public static getInstance(): QdrantService {
    if (!QdrantService.instance) {
      QdrantService.instance = new QdrantService();
    }
    return QdrantService.instance;
  }

  public getClient(): QdrantClient {
    return this.client;
  }

  /**
   * Deterministically converts a string chunk ID into a valid RFC4122 UUID v4 variant
   */
  public static stringToUuid(input: string): string {
    const hash = crypto.createHash('md5').update(input).digest('hex');
    // 8-4-4-4-12 hex format with version 4 and variant RFC4122
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
  }

  /**
   * Initializes the collection and creates payload indices for fast metadata filtering
   */
  public async ensureCollectionInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c) => c.name === this.collectionName);

      if (!exists) {
        console.log(`[Qdrant] Creating collection "${this.collectionName}" (384 dimensions, Cosine distance)...`);
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 384,
            distance: 'Cosine',
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });

        // Create payload indexes for metadata fields to support high-performance filtering
        await this.createPayloadIndexes();
        console.log(`[Qdrant] Collection "${this.collectionName}" created successfully.`);
      }

      this.initialized = true;
    } catch (err: any) {
      console.error(`[Qdrant] Error initializing collection: ${err.message || err}`);
      throw err;
    }
  }

  /**
   * Creates indexes on payload fields for fast filtered retrieval
   */
  private async createPayloadIndexes(): Promise<void> {
    const indexFields = [
      { name: 'symbol', type: 'keyword' },
      { name: 'documentType', type: 'keyword' },
      { name: 'reportingPeriod', type: 'keyword' },
      { name: 'domain', type: 'keyword' },
      { name: 'chunkId', type: 'keyword' },
    ];

    for (const field of indexFields) {
      try {
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: field.name,
          field_schema: field.type as any,
        });
      } catch (e: any) {
        // Index might already exist or not supported in mock
      }
    }
  }

  /**
   * Upsert embedded chunks into Qdrant collection
   */
  public async upsertChunks(chunks: EmbeddedChunk[]): Promise<{ count: number }> {
    if (chunks.length === 0) return { count: 0 };
    await this.ensureCollectionInitialized();

    const points = chunks.map((chunk) => {
      const pointId = QdrantService.stringToUuid(chunk.chunkId);
      return {
        id: pointId,
        vector: chunk.embedding,
        payload: {
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          content: chunk.content,
          domain: chunk.metadata.domain,
          assetId: chunk.metadata.assetId,
          symbol: chunk.metadata.symbol,
          companyName: chunk.metadata.companyName,
          documentType: chunk.metadata.documentType,
          reportingPeriod: chunk.metadata.reportingPeriod,
          source: chunk.metadata.source,
          sourceUrl: chunk.metadata.sourceUrl,
          dataTimestamp: chunk.metadata.dataTimestamp,
          metricNames: chunk.metadata.metricNames || [],
        },
      };
    });

    // Batch upsert in chunks of 50
    const batchSize = 50;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: batch,
      });
    }

    return { count: chunks.length };
  }

  /**
   * Search by vector similarity with metadata filters
   */
  public async searchVectors(
    queryVector: number[],
    filter?: SearchFilter,
    limit = 10
  ): Promise<any[]> {
    await this.ensureCollectionInitialized();

    const mustConditions: any[] = [];

    if (filter?.symbol) {
      mustConditions.push({
        key: 'symbol',
        match: { value: filter.symbol.toUpperCase() },
      });
    }

    if (filter?.documentType) {
      if (Array.isArray(filter.documentType)) {
        mustConditions.push({
          key: 'documentType',
          match: { any: filter.documentType },
        });
      } else {
        mustConditions.push({
          key: 'documentType',
          match: { value: filter.documentType },
        });
      }
    }

    if (filter?.reportingPeriod) {
      mustConditions.push({
        key: 'reportingPeriod',
        match: { value: filter.reportingPeriod },
      });
    }

    const qdrantFilter = mustConditions.length > 0 ? { must: mustConditions } : undefined;

    const response = await this.client.query(this.collectionName, {
      query: queryVector,
      filter: qdrantFilter,
      limit: limit || 10,
      with_payload: true,
    });

    return response.points || [];
  }

  /**
   * Scroll / Keyword query payload records from Qdrant
   */
  public async scrollPoints(filter?: SearchFilter, limit = 50): Promise<any[]> {
    await this.ensureCollectionInitialized();

    const mustConditions: any[] = [];
    if (filter?.symbol) {
      mustConditions.push({
        key: 'symbol',
        match: { value: filter.symbol.toUpperCase() },
      });
    }

    if (filter?.documentType) {
      if (Array.isArray(filter.documentType)) {
        mustConditions.push({
          key: 'documentType',
          match: { any: filter.documentType },
        });
      } else {
        mustConditions.push({
          key: 'documentType',
          match: { value: filter.documentType },
        });
      }
    }

    const qdrantFilter = mustConditions.length > 0 ? { must: mustConditions } : undefined;

    const res = await this.client.scroll(this.collectionName, {
      filter: qdrantFilter,
      limit,
      with_payload: true,
      with_vector: false,
    });

    return res.points || [];
  }

  /**
   * Delete all vectors for a specific symbol
   */
  public async deleteBySymbol(symbol: string): Promise<void> {
    await this.ensureCollectionInitialized();
    await this.client.delete(this.collectionName, {
      wait: true,
      filter: {
        must: [
          {
            key: 'symbol',
            match: { value: symbol.toUpperCase() },
          },
        ],
      },
    });
  }

  /**
   * Delete specific chunk IDs
   */
  public async deleteByChunkIds(chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) return;
    await this.ensureCollectionInitialized();

    const pointIds = chunkIds.map((id) => QdrantService.stringToUuid(id));
    await this.client.delete(this.collectionName, {
      wait: true,
      points: pointIds,
    });
  }

  /**
   * Get collection stats and count
   */
  public async getStats(): Promise<{ pointsCount: number; status: string }> {
    await this.ensureCollectionInitialized();
    const info = await this.client.getCollection(this.collectionName);
    return {
      pointsCount: info.points_count ?? 0,
      status: info.status,
    };
  }
}
