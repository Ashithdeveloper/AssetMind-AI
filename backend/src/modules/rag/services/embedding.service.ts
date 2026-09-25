import crypto from 'crypto';

export interface IEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[], batchSize?: number): Promise<number[][]>;
  getDimension(): number;
  getModelName(): string;
}

export class BgeSmallEmbeddingService implements IEmbeddingService {
  private static instance: BgeSmallEmbeddingService;
  private pipelinePromise: Promise<any> | null = null;
  private modelName = 'Xenova/bge-small-en-v1.5';
  private dimension = 384;
  private cache: Map<string, number[]> = new Map();
  private maxCacheSize = 5000;

  private constructor() {}

  public static getInstance(): BgeSmallEmbeddingService {
    if (!BgeSmallEmbeddingService.instance) {
      BgeSmallEmbeddingService.instance = new BgeSmallEmbeddingService();
    }
    return BgeSmallEmbeddingService.instance;
  }

  public getDimension(): number {
    return this.dimension;
  }

  public getModelName(): string {
    return 'BAAI/bge-small-en-v1.5';
  }

  /**
   * Lazily loads the Transformers.js feature-extraction pipeline
   */
  private async getPipeline(): Promise<any> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        try {
          const { pipeline, env } = await import('@xenova/transformers');
          // Disable remote telemetry/unneeded logs
          env.allowLocalModels = true;
          return await pipeline('feature-extraction', this.modelName);
        } catch (err: any) {
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
  public async generateEmbedding(text: string): Promise<number[]> {
    const cleanText = text.trim();
    if (!cleanText) {
      return new Array(this.dimension).fill(0);
    }

    const hash = crypto.createHash('sha256').update(cleanText).digest('hex');
    if (this.cache.has(hash)) {
      return this.cache.get(hash)!;
    }

    const extractor = await this.getPipeline();
    const output = await extractor(cleanText, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data as Float32Array);

    if (vector.length !== this.dimension) {
      throw new Error(`Expected embedding dimension ${this.dimension}, got ${vector.length}`);
    }

    // Evict oldest cache entries if size exceeds limit
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(hash, vector);
    return vector;
  }

  /**
   * Batch generation of embeddings with configurable batch sizes
   */
  public async generateBatchEmbeddings(texts: string[], batchSize = 16): Promise<number[][]> {
    const results: number[][] = new Array(texts.length);
    const toComputeIndices: number[] = [];
    const toComputeTexts: string[] = [];

    // Check cache first
    for (let i = 0; i < texts.length; i++) {
      const cleanText = texts[i].trim();
      const hash = crypto.createHash('sha256').update(cleanText).digest('hex');
      if (this.cache.has(hash)) {
        results[i] = this.cache.get(hash)!;
      } else {
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
          const vector = Array.from(output.data as Float32Array);

          const hash = crypto.createHash('sha256').update(text).digest('hex');
          if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
          }
          this.cache.set(hash, vector);

          results[globalIdx] = vector;
        } catch (itemErr: any) {
          console.error(`[EmbeddingService] Failed generating embedding for chunk:`, itemErr.message);
          throw itemErr;
        }
      }
    }

    return results;
  }
}
