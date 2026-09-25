/**
 * RAG Module Core Type Definitions
 * AssetMind AI - Phase 2
 */

export type DocumentType =
  | 'company_profile'
  | 'financial_statement'
  | 'financial_ratios'
  | 'historical_performance'
  | 'stock_price_history'
  | 'financial_disclosures'
  | 'source_specific_info';

export interface FinancialMetricItem {
  name: string;
  value: number;
  formattedValue?: string;
  currency?: string;
  unit?: string;
  reportingPeriod?: string;
  timestamp?: Date | string;
  source?: string;
}

export interface GeneratedDocument {
  id: string;
  symbol: string;
  companyName: string;
  assetId: string;
  documentType: DocumentType;
  title: string;
  content: string;
  reportingPeriod: string;
  financialMetrics: FinancialMetricItem[];
  source: string;
  sourceUrl?: string;
  dataTimestamp: string;
  metadata?: Record<string, any>;
}

export interface ChunkMetadata {
  domain: 'stocks';
  assetId: string;
  symbol: string;
  companyName: string;
  documentType: DocumentType;
  reportingPeriod: string;
  source: string;
  sourceUrl?: string;
  dataTimestamp: string;
  chunkId: string;
  metricNames?: string[];
}

export interface DocumentChunk {
  chunkId: string;
  documentId: string;
  content: string;
  metadata: ChunkMetadata;
  tokenCount?: number;
}

export interface EmbeddedChunk extends DocumentChunk {
  embedding: number[];
}

export interface SearchFilter {
  symbol?: string;
  documentType?: DocumentType | DocumentType[];
  reportingPeriod?: string;
  sources?: string[];
  limit?: number;
}

export interface RetrievalResult {
  chunkId: string;
  symbol: string;
  companyName: string;
  documentType: DocumentType;
  reportingPeriod: string;
  source: string;
  sourceUrl?: string;
  dataTimestamp: string;
  content: string;
  score: number;
  vectorScore?: number;
  keywordScore?: number;
  metadata?: Record<string, any>;
}

export interface RerankedResult extends RetrievalResult {
  rerankScore: number;
  relevanceExplanation?: string;
}

export interface EvidenceContext {
  query: string;
  targetSymbol: string;
  companyName?: string;
  retrievedCount: number;
  evidenceSnippets: {
    chunkId: string;
    documentType: string;
    reportingPeriod: string;
    source: string;
    timestamp: string;
    text: string;
  }[];
  formattedContext: string;
  dataFreshness: string | null;
  sources: {
    source: string;
    sourceUrl?: string;
    reportingPeriod?: string;
    timestamp?: string;
  }[];
}

export interface LLMAnswerResponse {
  answer: string;
  symbol: string;
  evidence: string[];
  sources: {
    source: string;
    sourceUrl?: string;
    reportingPeriod?: string;
    timestamp?: string;
  }[];
  dataFreshness: string | null;
  confidenceScore?: number;
  modelUsed?: string;
}
