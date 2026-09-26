/**
 * AssetMind AI — Real-Time Data Types
 * Shared type definitions for live quotes, news, and market data
 */

export interface LiveQuote {
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  pe: number | null;
  eps: number | null;
  dividendYield: number | null;
  lastUpdated: Date;
  source: 'yahoo-finance-v8' | 'nse-api' | 'cached';
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date;
  symbols: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  relevanceScore: number;
  imageUrl?: string;
}

export interface MarketSummary {
  index: string;
  value: number;
  change: number;
  changePercent: number;
  lastUpdated: Date;
}

export interface RealTimeDataResponse {
  quote: LiveQuote;
  news: NewsArticle[];
  relatedIndices?: MarketSummary[];
}

export interface CompanyNewsAnalysis {
  symbol: string;
  companyName?: string;
  totalArticles: number;
  sentimentBreakdown: {
    positivePercent: number;
    neutralPercent: number;
    negativePercent: number;
    overallSentiment: 'Bullish' | 'Somewhat Bullish' | 'Neutral' | 'Somewhat Bearish' | 'Bearish';
    score: number;
  };
  headlineTakeaway: string;
  shortSummary: string;
  keyCatalysts: {
    positive: string[];
    concerns: string[];
  };
  marketImpact: {
    shortTerm: {
      outlook: 'Positive' | 'Neutral' | 'Negative' | 'Volatile';
      description: string;
    };
    mediumTerm: {
      outlook: 'Positive' | 'Neutral' | 'Negative' | 'Consolidating';
      description: string;
    };
  };
  analyzedArticles: {
    title: string;
    source: string;
    publishedAt: string;
    sentiment: string;
    url: string;
  }[];
  generatedAt: string;
}
