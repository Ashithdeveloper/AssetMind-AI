import axios from 'axios';
import mongoose from 'mongoose';
import { CompanyService } from '../companies/company.service';
import { HybridRetrievalService } from '../rag/services/hybridRetrieval.service';
import { FinancialRelevanceReranker } from '../rag/services/reranking.service';
import { AnalysisReport } from '../../models/AnalysisReport.model';
import { Asset } from '../../models/Asset.model';

export interface PersonalInvestmentInput {
  purchasePrice?: number;
  quantity?: number;
  investmentDate?: string;
  portfolioValue?: number;
}

export class SellAnalysisService {
  private static reranker = new FinancialRelevanceReranker();
  private static ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  private static modelName = process.env.OLLAMA_MODEL || 'gpt-oss:20b-cloud';
  private static timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);

  /**
   * Generates a grounded, AI-powered Sell Analysis investigating risks and potential deterioration
   */
  public static async generateSellAnalysis(
    symbol: string,
    investorInput?: PersonalInvestmentInput,
    userId?: string
  ): Promise<any> {
    const cleanSym = symbol.trim().toUpperCase();

    // 1. Retrieve company data
    const profile = await CompanyService.getCompanyProfile(cleanSym);
    const priceHistory = await CompanyService.getPriceHistory(cleanSym, '1M');
    const financials = await CompanyService.getFinancialMetrics(cleanSym);

    const asset = await Asset.findOne({ symbol: cleanSym });
    const companyId = asset ? asset._id : new mongoose.Types.ObjectId();

    // 2. Personal Investment Calculations (if provided)
    let personalPnlAnalysis: any = null;
    let personalSectionText = 'No personal investment details provided. Personal profit/loss analysis skipped.';

    const currentPrice = profile.latestSharePrice ?? 0;

    if (investorInput?.purchasePrice !== undefined && investorInput.purchasePrice > 0) {
      const purchasePrice = investorInput.purchasePrice;
      const quantity = investorInput.quantity ?? 1;
      const totalCost = purchasePrice * quantity;
      const currentHoldingValue = currentPrice * quantity;
      const unrealizedPnl = currentHoldingValue - totalCost;
      const returnPercent = Number(((unrealizedPnl / totalCost) * 100).toFixed(2));
      const concentration = investorInput.portfolioValue && investorInput.portfolioValue > 0
        ? Number(((currentHoldingValue / investorInput.portfolioValue) * 100).toFixed(2))
        : null;

      personalPnlAnalysis = {
        purchasePrice,
        currentPrice,
        quantity,
        totalCost,
        currentHoldingValue,
        unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
        returnPercent,
        investmentDate: investorInput.investmentDate || 'Not specified',
        portfolioConcentrationPercent: concentration,
      };

      personalSectionText = [
        `- Initial Purchase Price: ${financials.freeCashFlow.currency || 'USD'} ${purchasePrice.toFixed(2)}`,
        `- Current Market Price: ${financials.freeCashFlow.currency || 'USD'} ${currentPrice.toFixed(2)}`,
        `- Holding Quantity: ${quantity}`,
        `- Unrealized Gain/Loss: ${financials.freeCashFlow.currency || 'USD'} ${unrealizedPnl.toFixed(2)} (${returnPercent >= 0 ? '+' : ''}${returnPercent}%)`,
        `- Investment Date: ${investorInput.investmentDate || 'N/A'}`,
        `- Portfolio Weight: ${concentration !== null ? `${concentration}% of total portfolio` : 'Portfolio size not provided'}`,
        `- Concentration Assessment: ${concentration && concentration > 20 ? 'WARNING: High position concentration' : 'Manageable position weight'}`,
      ].join('\n');
    }

    // 3. Retrieve relevant risk and performance evidence from Qdrant
    let retrievedChunks: any[] = [];
    try {
      const initialHits = await HybridRetrievalService.retrieve({
        query: `${cleanSym} debt decline competition risk margins customer demand regulatory`,
        symbol: cleanSym,
        limit: 10,
      });

      retrievedChunks = await this.reranker.rerank(
        `${cleanSym} decline risks competition liabilities`,
        cleanSym,
        initialHits,
        6
      );
    } catch (ragErr: any) {
      console.warn(`[SellAnalysisService] RAG retrieval notice for ${cleanSym}:`, ragErr.message);
    }

    const evidenceText = retrievedChunks.map((c, i) => `[Evidence ${i + 1} - ${c.documentType} (${c.reportingPeriod}) from ${c.source}]:\n${c.content}`).join('\n\n');

    const metricsSummary = [
      `COMPANY: ${profile.companyName} (${cleanSym}) | SECTOR: ${profile.sector}`,
      `CURRENT PRICE: ${financials.freeCashFlow.currency || 'USD'} ${profile.latestSharePrice} (Day Change: ${profile.dailyPercentageChange}%)`,
      `DEBT-TO-EQUITY: ${financials.debtToEquity.value !== null ? `${financials.debtToEquity.value}x` : 'N/A'} (${financials.riskAnalysisInputs.debtLevels})`,
      `FREE CASH FLOW: ${financials.freeCashFlow.value !== null ? financials.freeCashFlow.value : 'N/A'} (${financials.riskAnalysisInputs.cashFlowTrends})`,
      `NET PROFIT MARGIN: ${financials.profitability.netProfitMargin?.value ?? 'N/A'}%`,
      `OPERATING MARGIN: ${financials.profitability.operatingProfitMargin?.value ?? 'N/A'}%`,
      `P/E MULTIPLE: ${financials.valuation.peRatio?.value ?? 'N/A'}`,
      `ROE: ${financials.returnOnEquity.value !== null ? `${financials.returnOnEquity.value}%` : 'N/A'}`,
    ].join('\n');

    const prompt = [
      `You are an institutional risk & sell-side equity analyst at AssetMind AI. Produce an objective, evidence-based SELL ANALYSIS for ${profile.companyName} (${cleanSym}).`,
      `CRITICAL GUIDELINES:`,
      `1. Clearly distinguish VERIFIED FACTS from EVIDENCE-BASED INTERPRETATIONS and POTENTIAL EXPLANATIONS.`,
      `2. Identify any MISSING INFORMATION explicitly.`,
      `3. DO NOT automatically advise the user to sell; present a balanced risk assessment.`,
      `4. Investigate the 4 core deterioration categories:`,
      `   A. Personal Investment Mistakes (if user data provided)`,
      `   B. Company Decision Problems (capital allocation, acquisitions, borrowing, expansion inefficiencies)`,
      `   C. Product and Business Problems (demand changes, product quality, competition, launch failures)`,
      `   D. External Market Factors (macroeconomic, interest rates, regulations, supply chain, geopolitics)`,
      '',
      `VERIFIED FINANCIAL METRICS:`,
      metricsSummary,
      '',
      `INVESTOR-SPECIFIC POSITION DATA:`,
      personalSectionText,
      '',
      `VERIFIED DOCUMENT EVIDENCE:`,
      evidenceText || 'No specific negative filings found.',
      '',
      `REQUIRED SECTIONS (Use exact Markdown headings):`,
      `## 1. Performance Summary`,
      `## 2. Financial Deterioration`,
      `## 3. Potential Reasons for Decline`,
      `## 4. Company Decision Analysis`,
      `## 5. Product and Business Analysis`,
      `## 6. External Market Factors`,
      `## 7. Investor-Specific Profit/Loss`,
      `## 8. Risk Assessment`,
      `## 9. Important Metrics to Monitor`,
      `## 10. Evidence and Sources`,
    ].join('\n');

    let reportMarkdown = '';
    const now = new Date();

    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.modelName,
          prompt,
          system: 'You are AssetMind AI. Provide a rigorous, objective Sell Analysis report distinguishing facts from interpretations.',
          stream: false,
          options: {
            temperature: 0.25,
            num_ctx: 4096,
            num_predict: 800,
          },
        },
        { timeout: this.timeoutMs }
      );

      let rawText = response.data?.response?.trim() || '';
      rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (rawText.includes('<think>')) {
        rawText = rawText.split('<think>')[0].trim();
      }
      reportMarkdown = rawText;
    } catch (err: any) {
      console.warn(`[SellAnalysisService] Ollama inference fallback for ${cleanSym}:`, err.message);
      reportMarkdown = this.generateFallbackReport(profile, financials, personalSectionText);
    }

    if (!reportMarkdown || reportMarkdown.length < 50) {
      reportMarkdown = this.generateFallbackReport(profile, financials, personalSectionText);
    }

    const sections = this.parseSections(reportMarkdown);

    // Track sources
    const sources = [
      {
        source: financials.source || 'Verified Financial Disclosures',
        reportingPeriod: financials.fiscalPeriod,
        timestamp: now.toISOString(),
      },
      ...retrievedChunks.map((c) => ({
        source: c.source,
        sourceUrl: c.sourceUrl,
        reportingPeriod: c.reportingPeriod,
        timestamp: c.dataTimestamp,
      })),
    ];

    const uniqueSourcesMap = new Map<string, any>();
    for (const s of sources) {
      uniqueSourcesMap.set(`${s.source}_${s.reportingPeriod}`, s);
    }
    const finalSources = Array.from(uniqueSourcesMap.values());

    // Save report in MongoDB
    const reportDoc = await AnalysisReport.create({
      userId: userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : undefined,
      companyId,
      symbol: cleanSym,
      analysisType: 'SELL',
      reportMarkdown,
      sections,
      personalInvestmentData: personalPnlAnalysis || undefined,
      sourceReferences: finalSources,
      metricsSnapshot: {
        profile,
        financials,
        priceHistoryCount: priceHistory.data.length,
      },
      dataTimestamp: now,
    });

    return {
      reportId: reportDoc._id.toString(),
      symbol: cleanSym,
      companyName: profile.companyName,
      analysisType: 'SELL',
      generatedAt: now.toISOString(),
      reportMarkdown,
      sections,
      personalInvestmentAnalysis: personalPnlAnalysis,
      riskSnapshot: {
        debtToEquity: financials.debtToEquity.value,
        debtAssessment: financials.riskAnalysisInputs.debtLevels,
        freeCashFlow: financials.freeCashFlow.value,
        cashFlowAssessment: financials.riskAnalysisInputs.cashFlowTrends,
        profitMargin: financials.profitability.netProfitMargin?.value,
      },
      sourceReferences: finalSources,
    };
  }

  private static parseSections(markdown: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = markdown.split('\n');
    let currentTitle = 'Summary';
    let currentLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ') || line.startsWith('### ')) {
        if (currentLines.length > 0) {
          sections[currentTitle] = currentLines.join('\n').trim();
          currentLines = [];
        }
        currentTitle = line.replace(/^[#\s0-9.]+/g, '').trim();
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      sections[currentTitle] = currentLines.join('\n').trim();
    }

    return sections;
  }

  private static generateFallbackReport(profile: any, financials: any, personalText: string): string {
    return [
      `# Institutional Sell & Risk Analysis: ${profile.companyName} (${profile.symbol})`,
      '',
      `## 1. Performance Summary`,
      `**Verified Fact:** ${profile.companyName} trades at ${financials.freeCashFlow.currency || 'USD'} ${profile.latestSharePrice}, showing daily variance of ${profile.dailyPercentageChange}%.`,
      '',
      `## 2. Financial Deterioration`,
      `**Verified Fact:** Debt-to-Equity is recorded at ${financials.debtToEquity.value ?? 'N/A'}x (${financials.riskAnalysisInputs.debtLevels}).`,
      `**Evidence-based interpretation:** Operating cash generation must outpace borrowing service requirements to prevent capital strain.`,
      '',
      `## 3. Potential Reasons for Decline`,
      `Key operational headwinds involve margin compression in ${profile.sector}, shifting enterprise spend, or rising supplier input costs.`,
      '',
      `## 4. Company Decision Analysis`,
      `Capital allocation decisions regarding R&D expenditure and infrastructure expansion remain key drivers of operational leverage.`,
      '',
      `## 5. Product and Business Analysis`,
      `Competition from rival players in ${profile.industry || profile.sector} represents a primary headwind to pricing power and market share retention.`,
      '',
      `## 6. External Market Factors`,
      `Macro factors include benchmark interest rates, regional supply chain logistics, and regulatory compliance standards across international jurisdictions.`,
      '',
      `## 7. Investor-Specific Profit/Loss`,
      personalText,
      '',
      `## 8. Risk Assessment`,
      `- Leverage Risk: ${financials.riskAnalysisInputs.debtLevels}`,
      `- Cash Flow Risk: ${financials.riskAnalysisInputs.cashFlowTrends}`,
      `- Valuation Risk: P/E is ${financials.valuation.peRatio?.value ?? 'N/A'}. High multiples leave less margin of safety against missed earnings.`,
      '',
      `## 9. Important Metrics to Monitor`,
      `1. Free Cash Flow stability (${financials.freeCashFlow.value !== null ? financials.freeCashFlow.value : 'N/A'}).`,
      `2. Quarterly operating margin retention (${financials.profitability.operatingProfitMargin?.value ?? 'N/A'}%).`,
      `3. Debt servicing covenants and leverage ratio.`,
      '',
      `## 10. Evidence and Sources`,
      `Source: ${financials.source}. Analysis grounded in verified financial filings. Note: Independent financial consultation is advised before executing sell orders.`,
    ].join('\n');
  }
}
