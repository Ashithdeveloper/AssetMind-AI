/**
 * AssetMind AI Backend API Client
 * Connects Frontend UI directly to Node.js/Express Backend Services
 */

const API_BASE = import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:5000/api';

export interface ExploreCompany {
  id: string;
  companyName: string;
  symbol: string;
  exchange: string;
  country: string;
  sector: string;
  industry?: string;
  logoUrl: string;
  latestSharePrice: number;
  dailyPercentageChange: number;
  marketCapitalization: number | null;
  currency: string;
  lastUpdated: string;
}

export interface ExploreResponse {
  totalCompanies: number;
  page: number;
  limit: number;
  totalPages: number;
  sectorsCount: number;
  sectors: {
    sector: string;
    count: number;
    companies: ExploreCompany[];
  }[];
  companies: ExploreCompany[];
}

export interface CompanyProfile {
  companyName: string;
  symbol: string;
  nseSymbol?: string;
  bseCode?: string;
  exchange: string;
  country: string;
  sector: string;
  industry: string;
  description: string;
  website: string;
  logoUrl: string;
  dataSource?: string;
  marketCapitalization: number | null;
  latestSharePrice: number;
  dailyPercentageChange: number;
  currency: string;
  latestReportingPeriod: string;
  lastUpdated: string;
  realTimePrice?: any;
}

export interface StatementRow {
  name: string;
  values: (number | null)[];
  rawValues?: string[];
}

export interface StatementTable {
  headers: string[];
  rows: StatementRow[];
}

export interface FinancialStatementsResponse {
  symbol: string;
  companyName: string;
  nseSymbol?: string;
  bseCode?: string;
  quarters: StatementTable;
  profitLoss: StatementTable;
  balanceSheet: StatementTable;
  cashFlow: StatementTable;
  ratios?: StatementTable;
  source: string;
  sourceUrl?: string;
  lastUpdated: string;
}

export interface PricePoint {
  date: string;
  timestamp?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceHistoryResponse {
  symbol: string;
  period: string;
  currency: string;
  exchange: string;
  source: string;
  lastUpdated: string;
  data: PricePoint[];
}

export interface MetricItem {
  value: number | null;
  currency?: string;
  unit?: string;
  reportingPeriod?: string;
  explanation?: string;
}

export interface FinancialMetricsResponse {
  symbol: string;
  companyName: string;
  fiscalPeriod: string;
  freeCashFlow: MetricItem;
  marketCapGrowth: MetricItem;
  returnOnEquity: MetricItem;
  debtToEquity: MetricItem;
  profitability: {
    revenue?: MetricItem;
    netIncome?: MetricItem;
    grossProfitMargin?: MetricItem;
    operatingProfitMargin?: MetricItem;
    netProfitMargin?: MetricItem;
  };
  growth?: {
    revenueGrowth?: MetricItem;
    profitGrowth?: MetricItem;
  };
  valuation: {
    peRatio?: MetricItem;
    pbRatio?: MetricItem;
    evToEbitda?: MetricItem;
    enterpriseValue?: MetricItem;
  };
  dataQuality?: {
    status: 'Verified' | 'Partially Available' | 'Conflicting Data' | 'Refresh Required' | 'Data Unavailable' | string;
    completenessScore: number;
    checkedAt?: string;
    flags?: Array<{ field: string; issue: string; severity: string }>;
  };
  riskAnalysisInputs: {
    debtLevels?: string;
    cashFlowTrends?: string;
    earningsVolatility?: string;
    revenueGrowth?: string;
    profitabilityTrends?: string;
    marketVolatility?: string;
  };
  source: string;
  lastUpdated: string;
}

export interface WarConflictImpact {
  conflictType: string;
  conflictStatus: string;
  impactSeverity: 'Critical Negative' | 'High Negative' | 'Moderate Negative' | 'Neutral / Insulated' | 'Net Beneficiary';
  exposureChannels: string[];
  directEffect: string;
  warRiskScorePercent: number;
  strategicImplication: string;
}

export interface BuyRiskRewardMetrics {
  currentPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  profitPotentialPercent: number;
  downsideLossPercent: number;
  riskRewardRatio: number;
  riskScorePercent: number;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Very High';
  profitProbabilityPercent: number;
  lossProbabilityPercent: number;
  supportPrice: number;
  resistancePrice: number;
  rationale: string;
  warConflictImpact?: WarConflictImpact;
}

export interface SellRiskRewardMetrics {
  currentPrice: number;
  purchasePrice?: number;
  unrealizedPnlPercent: number | null;
  isProfitable?: boolean;
  profitLockInPercent: number;
  downsideLossPercent: number;
  upsideRecoveryPercent: number;
  riskScorePercent: number;
  riskLevel: 'Low Risk (Hold)' | 'Moderate Risk (Monitor)' | 'High Risk (Trim/Hedge)' | 'Severe Risk (Exit)';
  exitTriggerPrice: number;
  targetRecoveryPrice: number;
  riskRewardRatio: number;
  recommendationAction: 'HOLD' | 'TRIM' | 'EXIT' | 'TAKE_PROFIT';
  recommendationSummary: string;
  rationale: string;
  warConflictImpact?: WarConflictImpact;
}

export interface AnalysisResponse {
  reportId: string;
  symbol: string;
  companyName: string;
  analysisType: 'BUY' | 'SELL';
  generatedAt: string;
  verifiedFinancialData?: Record<string, any>;
  reportMarkdown: string;
  sections: Record<string, string>;
  keyMetrics?: Record<string, any>;
  personalInvestmentAnalysis?: any;
  riskRewardMetrics?: BuyRiskRewardMetrics | SellRiskRewardMetrics | any;
  riskSnapshot?: Record<string, any>;
  sourceReferences: {
    source: string;
    sourceUrl?: string;
    reportingPeriod?: string;
    timestamp?: string;
  }[];
}

export interface RealTimePrice {
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  pe: number | null;
  eps: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  source: string;
  lastUpdated: string;
}

export interface ScreenerSearchResultItem {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  url: string;
  isScraped: boolean;
  marketCap?: number | null | undefined;
  latestPrice?: number | null | undefined;
  changePercent?: number | null | undefined;
  sector?: string | null | undefined;
  pe?: number | null | undefined;
  bseCode?: string | null | undefined;
  nseSymbol?: string | null | undefined;
}

export interface ScreenerSearchResponse {
  query: string;
  total: number;
  source: string;
  results: ScreenerSearchResultItem[];
}

export interface ScreenerScrapeResponse {
  message: string;
  company: {
    id: string;
    companyName: string;
    symbol: string;
    nseSymbol: string;
    bseCode?: string;
    exchange: string;
    country: string;
    sector: string;
    industry: string;
    website?: string;
    description?: string;
    marketCap?: number | null;
    latestPrice?: number | null;
    changePercent?: number | null;
    pe?: number | null;
    roe?: number | null;
    roce?: number | null;
    bookValue?: number | null;
    dividendYield?: number | null;
    source: string;
    scrapedAt: string;
  };
}

export interface LiveQuote extends RealTimePrice {
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  marketCap: number | null;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  symbols: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  relevanceScore: number;
  imageUrl?: string;
}

export interface NewsResponse {
  symbol: string;
  totalArticles: number;
  articles: NewsArticle[];
  lastFetched: string;
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

export interface MarketNewsResponse {
  totalArticles: number;
  articles: NewsArticle[];
  lastFetched: string;
  sources: string[];
}

export interface ChatStockSnapshot {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  pe: number | null;
  marketCap: number | null;
  high52: number | null;
  low52: number | null;
  volume: number;
  source: string;
  lastUpdated: string;
}

export interface ChatEvidenceItem {
  chunkId: string;
  symbol: string;
  documentType: string;
  reportingPeriod: string;
  source: string;
  sourceUrl?: string;
  text: string;
  rerankScore?: number;
}

export interface ChatNewsItem {
  title: string;
  source: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  publishedAt?: string;
  url?: string;
}

export interface ChatMessage {
  _id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  referencedSymbols: string[];
  stockSnapshots: ChatStockSnapshot[];
  evidence: ChatEvidenceItem[];
  newsHighlights: ChatNewsItem[];
  modelUsed?: string;
  confidenceScore?: number;
  createdAt: string;
}

export interface ChatSession {
  _id: string;
  title: string;
  pinned?: boolean;
  lastMessage?: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendChatMessageResponse {
  session: ChatSession;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface MarketIndex {
  index: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('assetmind_token') : null;
    const authHeaders: Record<string, string> = {};
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options?.headers,
      },
      ...options,
    });

    const json = await res.json();
    if (!res.ok || json.success === false) {
      throw new Error(json.message || `Request failed with status ${res.status}`);
    }
    return json.data;
  } catch (err: any) {
    console.error(`[API Client Error] ${endpoint}:`, err.message);
    throw err;
  }
}

export const apiClient = {
  // 1. Explore Home: Listed companies grouped by sector, pagination, filters, sorting
  getExploreCompanies: async (params?: {
    page?: number;
    limit?: number;
    sector?: string;
    country?: string;
    minMarketCap?: number;
    maxMarketCap?: number;
    sortBy?: string;
    order?: string;
  }): Promise<ExploreResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.sector && params.sector !== 'All') query.set('sector', params.sector);
    if (params?.country && params.country !== 'All') query.set('country', params.country);
    if (params?.minMarketCap) query.set('minMarketCap', String(params.minMarketCap));
    if (params?.maxMarketCap) query.set('maxMarketCap', String(params.maxMarketCap));
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.order) query.set('order', params.order);

    const qs = query.toString();
    return request<ExploreResponse>(`/companies/explore${qs ? `?${qs}` : ''}`);
  },

  // 2. Search companies
  searchCompanies: async (q: string, exchange?: string): Promise<{ total: number; companies: ExploreCompany[] }> => {
    const query = new URLSearchParams({ q });
    if (exchange && exchange !== 'All') query.set('exchange', exchange);
    return request<{ total: number; companies: ExploreCompany[] }>(`/companies/search?${query.toString()}`);
  },

  // 3. Company Profile
  getCompanyProfile: async (symbol: string): Promise<CompanyProfile> => {
    return request<CompanyProfile>(`/companies/${encodeURIComponent(symbol)}`);
  },

  // 4. Historical Share Price
  getPriceHistory: async (symbol: string, period = '1M'): Promise<PriceHistoryResponse> => {
    return request<PriceHistoryResponse>(`/companies/${encodeURIComponent(symbol)}/price-history?period=${period}`);
  },

  // 5. Financial Metrics
  getFinancialMetrics: async (symbol: string): Promise<FinancialMetricsResponse> => {
    return request<FinancialMetricsResponse>(`/companies/${encodeURIComponent(symbol)}/financials`);
  },

  // 5b. Financial Statements (Quarterly, Annual P&L, Balance Sheet, Cash Flow from Screener.in)
  getStatements: async (symbol: string): Promise<FinancialStatementsResponse> => {
    return request<FinancialStatementsResponse>(`/companies/${encodeURIComponent(symbol)}/statements`);
  },

  // 5c. Manual Company Refresh from Screener.in
  refreshCompany: async (symbol: string): Promise<any> => {
    return request<any>(`/companies/${encodeURIComponent(symbol)}/refresh`, {
      method: 'POST',
    });
  },

  // 6. Buy Analysis (AI-powered, grounded in Qdrant evidence)
  generateBuyAnalysis: async (symbol: string): Promise<AnalysisResponse> => {
    return request<AnalysisResponse>(`/analysis/${encodeURIComponent(symbol)}/buy`, {
      method: 'POST',
    });
  },

  // 7. Sell Analysis (AI-powered, investigating 4 deterioration vectors)
  generateSellAnalysis: async (
    symbol: string,
    investorInput?: {
      purchasePrice?: number;
      quantity?: number;
      investmentDate?: string;
      portfolioValue?: number;
    }
  ): Promise<AnalysisResponse> => {
    return request<AnalysisResponse>(`/analysis/${encodeURIComponent(symbol)}/sell`, {
      method: 'POST',
      body: JSON.stringify(investorInput || {}),
    });
  },

  // 8. RAG QA
  queryRag: async (query: string, symbol: string): Promise<any> => {
    return request<any>('/rag/query', {
      method: 'POST',
      body: JSON.stringify({ query, symbol }),
    });
  },

  // ── Real-Time Data Endpoints ─────────────────────────────────────────────

  // 9. Live quote (Yahoo Finance V8 API)
  getLiveQuote: async (symbol: string): Promise<LiveQuote> => {
    return request<LiveQuote>(`/realtime/${encodeURIComponent(symbol)}/quote`);
  },

  // 10. Symbol news (Yahoo RSS + Google News)
  getSymbolNews: async (symbol: string, companyName?: string): Promise<NewsResponse> => {
    const qs = companyName ? `?name=${encodeURIComponent(companyName)}` : '';
    return request<NewsResponse>(`/realtime/${encodeURIComponent(symbol)}/news${qs}`);
  },

  // 10b. AI News Analysis (Synthesizes and distills all company news)
  getCompanyNewsAnalysis: async (symbol: string, companyName?: string): Promise<CompanyNewsAnalysis> => {
    const qs = companyName ? `?name=${encodeURIComponent(companyName)}` : '';
    return request<CompanyNewsAnalysis>(`/realtime/${encodeURIComponent(symbol)}/news-analysis${qs}`);
  },

  // 11. Combined real-time data (quote + news)
  getFullRealtime: async (symbol: string, companyName?: string): Promise<{
    symbol: string;
    quote: LiveQuote | null;
    news: { totalArticles: number; articles: NewsArticle[] };
    lastFetched: string;
  }> => {
    const qs = companyName ? `?name=${encodeURIComponent(companyName)}` : '';
    return request(`/realtime/${encodeURIComponent(symbol)}/full${qs}`);
  },

  // 12. Indian market news
  getMarketNews: async (): Promise<MarketNewsResponse> => {
    return request<MarketNewsResponse>('/realtime/market/news');
  },

  // 13. Live market indices (Nifty 50, Sensex, Bank Nifty)
  getMarketIndices: async (): Promise<{ indices: MarketIndex[]; lastFetched: string }> => {
    return request('/realtime/market/indices');
  },

  // 14. Snapshot of all live quotes
  getQuoteSnapshot: async (): Promise<{ totalSymbols: number; quotes: LiveQuote[]; lastFetched: string }> => {
    return request('/realtime/quotes/snapshot');
  },

  // 15. Manual quote refresh
  refreshQuote: async (symbol: string): Promise<LiveQuote> => {
    return request<LiveQuote>('/realtime/refresh', {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    });
  },

  // 16. SSE live price stream (returns EventSource URL)
  getStreamUrl: (symbol: string): string => {
    return `${API_BASE}/realtime/${encodeURIComponent(symbol)}/stream`;
  },

  // ── Authentication Endpoints ───────────────────────────────────────────
  login: async (credentials: { email: string; password: string }): Promise<{ user: any; token: string }> => {
    return request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  register: async (data: { name: string; email: string; password: string }): Promise<{ user: any; token: string }> => {
    return request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCurrentUser: async (): Promise<{ user: any }> => {
    return request<{ user: any }>('/auth/me');
  },

  // ── AI Financial Chat Endpoints (RAG + Live Quotes) ────────────────────
  sendChatMessage: async (message: string, sessionId?: string): Promise<SendChatMessageResponse> => {
    return request<SendChatMessageResponse>('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId }),
    });
  },

  getChatSessions: async (): Promise<ChatSession[]> => {
    return request<ChatSession[]>('/chat/sessions');
  },

  getChatSessionMessages: async (sessionId: string): Promise<ChatMessage[]> => {
    return request<ChatMessage[]>(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`);
  },

  deleteChatSession: async (sessionId: string): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  },

  // ── Screener.in Live Search & On-Demand Scraping ─────────────────────────
  searchScreener: async (query: string): Promise<ScreenerSearchResponse> => {
    return request<ScreenerSearchResponse>(`/screener/search?q=${encodeURIComponent(query)}`);
  },

  scrapeScreenerCompany: async (symbol: string, force = false): Promise<ScreenerScrapeResponse> => {
    return request<ScreenerScrapeResponse>('/screener/scrape', {
      method: 'POST',
      body: JSON.stringify({ symbol, force }),
    });
  },

  getScreenerCompany: async (symbol: string): Promise<ScreenerScrapeResponse> => {
    return request<ScreenerScrapeResponse>(`/screener/company/${encodeURIComponent(symbol)}`);
  },
};

