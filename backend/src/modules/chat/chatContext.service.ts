import { TOP_80_COMPANIES } from '../../config/companies.catalog';
import { fetchLiveQuote } from '../realtime/liveQuote.service';
import { fetchNewsForSymbol } from '../realtime/news.service';
import { HybridRetrievalService } from '../rag/services/hybridRetrieval.service';
import { FinancialRelevanceReranker } from '../rag/services/reranking.service';
import { FinancialMetrics } from '../../models/FinancialMetrics.model';
import { MarketData } from '../../models/MarketData.model';
import { IChatStockSnapshot, IChatEvidenceItem, IChatNewsItem } from '../../models/ChatMessage.model';
import { GeopoliticalRiskEngine } from '../analysis/geopoliticalRisk.engine';

export interface ChatAssembledContext {
  detectedSymbols: string[];
  stockSnapshots: IChatStockSnapshot[];
  evidence: IChatEvidenceItem[];
  newsHighlights: IChatNewsItem[];
  systemPrompt: string;
  contextText: string;
}

export class ChatContextService {
  private static reranker = new FinancialRelevanceReranker();

  /**
   * Detect symbols from user message, falling back to previous turns if query is a follow-up
   */
  public static detectSymbols(query: string, recentSymbols: string[] = []): string[] {
    const qLower = query.toLowerCase();
    const detected = new Set<string>();

    // 1. Match company names and explicit ticker symbols from catalog
    for (const comp of TOP_80_COMPANIES) {
      const symUpper = comp.symbol.toUpperCase();
      const nameLower = comp.name.toLowerCase();
      
      // Match exact ticker boundary
      const symRegex = new RegExp(`\\b${symUpper}\\b`, 'i');
      if (symRegex.test(query)) {
        detected.add(symUpper);
        continue;
      }

      // Match core brand name (e.g., "Reliance", "Tata Motors", "Infosys", "HDFC", "Zomato")
      const primaryBrand = nameLower
        .replace(/(\s+limited|\s+ltd\.?|\s+industries|\s+enterprises|\s+technologies|\s+consultancy\s+services|\s+bank)/gi, '')
        .trim();

      if (primaryBrand.length >= 3 && qLower.includes(primaryBrand)) {
        detected.add(symUpper);
      }
    }

    // 2. Check for common ticker regex patterns (e.g., $RELIANCE or standalone upper tickers)
    const tickerMatches = query.match(/\$([A-Za-z0-9_-]+)/g);
    if (tickerMatches) {
      for (const m of tickerMatches) {
        const clean = m.replace('$', '').toUpperCase();
        if (clean.length >= 2) detected.add(clean);
      }
    }

    // 3. If no symbol found in query, check if query is contextual (e.g. "what is its PE?", "show risks", "compare it")
    if (detected.size === 0 && recentSymbols.length > 0) {
      const pronounRegex = /\b(it|its|this company|the stock|their|they|the firm|current)\b/i;
      if (pronounRegex.test(query) || query.length < 35) {
        recentSymbols.slice(0, 2).forEach((s) => detected.add(s));
      }
    }

    // Return max 3 symbols to preserve prompt window
    return Array.from(detected).slice(0, 3);
  }

  /**
   * Fetch live quotes and verified financial ratios for detected symbols
   */
  public static async fetchStockSnapshots(symbols: string[]): Promise<IChatStockSnapshot[]> {
    const snapshots: IChatStockSnapshot[] = [];

    for (const sym of symbols) {
      try {
        const quote = await fetchLiveQuote(sym);
        let peVal = quote?.pe ?? null;
        let marketCapVal = quote?.marketCap ?? null;

        // If PE or market cap missing from live quote, check FinancialMetrics / MarketData collections
        if (peVal === null || marketCapVal === null) {
          const fm = await FinancialMetrics.findOne({ symbol: sym.toUpperCase() }).lean();
          if (fm && peVal === null && fm.valuation?.peRatio?.value) {
            peVal = fm.valuation.peRatio.value;
          }
          if (marketCapVal === null) {
            const md = await MarketData.findOne({ symbol: sym.toUpperCase() }).lean();
            if (md?.marketCap) {
              marketCapVal = md.marketCap;
            }
          }
        }

        if (quote) {
          snapshots.push({
            symbol: quote.symbol,
            companyName: quote.companyName || sym,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            currency: quote.currency || 'INR',
            pe: peVal,
            marketCap: marketCapVal,
            high52: quote.fiftyTwoWeekHigh,
            low52: quote.fiftyTwoWeekLow,
            volume: quote.volume,
            source: quote.source,
            lastUpdated: quote.lastUpdated || new Date(),
          });
        }
      } catch (err: any) {
        console.warn(`[ChatContextService] Failed fetching quote for ${sym}:`, err.message);
      }
    }

    return snapshots;
  }

  /**
   * Fetch RAG vector filing chunks from Qdrant and rerank them
   */
  public static async fetchRagEvidence(query: string, symbols: string[]): Promise<IChatEvidenceItem[]> {
    const allEvidence: IChatEvidenceItem[] = [];

    // Prioritize search for detected symbols, or general query if none
    const targets = symbols.length > 0 ? symbols : [undefined];

    for (const sym of targets) {
      try {
        const hits = await HybridRetrievalService.retrieve({
          query,
          symbol: sym,
          limit: 6,
        });

        if (hits.length > 0) {
          const targetSym = sym || hits[0]?.symbol || 'EQUITY';
          const reranked = await this.reranker.rerank(query, targetSym, hits, 3);

          for (const item of reranked) {
            allEvidence.push({
              chunkId: item.chunkId,
              symbol: item.symbol,
              documentType: item.documentType,
              reportingPeriod: item.reportingPeriod,
              source: item.source,
              sourceUrl: item.sourceUrl,
              text: item.content.slice(0, 600), // Trim individual chunk for prompt economy
              rerankScore: item.rerankScore,
            });
          }
        }
      } catch (err: any) {
        console.warn(`[ChatContextService] Vector RAG error for ${sym || 'general'}:`, err.message);
      }
    }

    // Deduplicate chunks by chunkId
    const seen = new Set<string>();
    return allEvidence.filter((e) => {
      if (seen.has(e.chunkId)) return false;
      seen.add(e.chunkId);
      return true;
    }).slice(0, 5);
  }

  /**
   * Fetch recent news for detected symbols
   */
  public static async fetchNewsContext(symbols: string[]): Promise<IChatNewsItem[]> {
    const newsItems: IChatNewsItem[] = [];

    for (const sym of symbols) {
      try {
        const articles = await fetchNewsForSymbol(sym);
        const topArticles = articles.slice(0, 2);
        for (const a of topArticles) {
          newsItems.push({
            title: a.title,
            source: a.source,
            sentiment: a.sentiment,
            publishedAt: a.publishedAt,
            url: a.url,
          });
        }
      } catch (err: any) {
        console.warn(`[ChatContextService] News retrieval error for ${sym}:`, err.message);
      }
    }

    return newsItems.slice(0, 4);
  }

  /**
   * Assemble full grounded context including system prompts and user prompt
   */
  public static async assembleContext(
    query: string,
    recentSymbols: string[] = []
  ): Promise<ChatAssembledContext> {
    const detectedSymbols = this.detectSymbols(query, recentSymbols);

    // Parallel fetch live quotes, vector RAG evidence, and news
    const [stockSnapshots, evidence, newsHighlights] = await Promise.all([
      this.fetchStockSnapshots(detectedSymbols),
      this.fetchRagEvidence(query, detectedSymbols),
      this.fetchNewsContext(detectedSymbols),
    ]);

    // Build context sections
    const contextSections: string[] = [];

    if (stockSnapshots.length > 0) {
      contextSections.push(
        `### REAL-TIME MARKET QUOTES:\n` +
          stockSnapshots
            .map(
              (q) =>
                `- **${q.companyName} (${q.symbol})**: Price: ₹${q.price.toFixed(2)} (${q.change >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%) | 52W High: ₹${q.high52 ?? 'N/A'} | 52W Low: ₹${q.low52 ?? 'N/A'} | P/E: ${q.pe ? q.pe.toFixed(1) : 'N/A'} | MCap: ₹${q.marketCap ? (q.marketCap / 100).toFixed(0) + ' Cr' : 'N/A'} [Source: Live ${q.source}]`
            )
            .join('\n')
      );
    }

    if (evidence.length > 0) {
      contextSections.push(
        `### VERIFIED VECTOR FILINGS & RATIOS (RAG):\n` +
          evidence
            .map(
              (e, idx) =>
                `[Filing Evidence #${idx + 1} | Symbol: ${e.symbol} | Source: ${e.source} (${e.reportingPeriod})]\n${e.text}`
            )
            .join('\n\n')
      );
    }

    if (newsHighlights.length > 0) {
      contextSections.push(
        `### RECENT NEWS HEADLINES & MARKET SENTIMENT:\n` +
          newsHighlights
            .map((n) => `- ${n.title} (Source: ${n.source}, Sentiment: ${n.sentiment?.toUpperCase() || 'NEUTRAL'})`)
            .join('\n')
      );
    }

    // Geopolitical & War Conflict Impact Assessments
    const warImpacts = detectedSymbols.map((sym) => {
      const comp = TOP_80_COMPANIES.find((c) => c.symbol.toUpperCase() === sym.toUpperCase());
      return {
        symbol: sym,
        impact: GeopoliticalRiskEngine.evaluateWarImpact(sym, comp?.sector, comp?.industry, comp?.name),
      };
    });

    if (warImpacts.length > 0) {
      contextSections.push(
        `### ACTIVE GEOPOLITICAL & WAR CONFLICT IMPACT ASSESSMENTS:\n` +
          warImpacts
            .map(
              ({ symbol, impact }) =>
                `- **${symbol}**: Conflict: ${impact.conflictType} (${impact.conflictStatus}) | Impact Severity: **${impact.impactSeverity}** (War Risk Score: ${impact.warRiskScorePercent}%)\n` +
                `  - Transmission Vectors: ${impact.exposureChannels.join(', ')}\n` +
                `  - Direct Operational Impact: ${impact.directEffect}\n` +
                `  - Strategic Investor Implication: ${impact.strategicImplication}`
            )
            .join('\n\n')
      );
    }

    const contextText = contextSections.join('\n\n');

    const systemPrompt = `You are AssetMind AI, a world-class senior financial analyst, institutional equity researcher, and portfolio advisor specializing in the Indian Stock Market (NSE/BSE).

Core Operational Rules:
1. STRICT FINANCIAL GROUNDING: Ground your answers in the provided Real-Time Market Quotes, Verified RAG Vector Filings, Recent News, and Geopolitical War Impact data.
2. CITATIONS: Whenever citing financial statements, metrics, or ratios, include source tags like [Source: Screener FY24] or [Live NSE].
3. REAL-TIME DATA ACCURACY: If asked about stock price, quote the exact real-time price and percentage change provided in the context.
4. UNBIASED & PROFESSIONAL: Provide clear, multi-faceted analysis: key business drivers, valuation metrics (P/E, Market Cap, ROE, FCF), competitive advantages (moat), and downside risk factors.
5. NO HALLUCINATION: If a metric is not present in the verified context, state that it is currently unavailable from filings rather than guessing.
6. GEOPOLITICAL & WAR CONFLICT IMPACT: If asked about wars or geopolitical tensions (e.g. Middle East, Red Sea shipping, Russia-Ukraine, US-China, regional border tensions), explain the exact conflict type, transmission channels (crude, shipping routes, foreign demand), and whether the company is a beneficiary, insulated, or vulnerable.
7. FORMATTING: Use clean GitHub Markdown: bullet points, bold key figures, and concise summary takeaways.`;

    return {
      detectedSymbols,
      stockSnapshots,
      evidence,
      newsHighlights,
      systemPrompt,
      contextText,
    };
  }
}
