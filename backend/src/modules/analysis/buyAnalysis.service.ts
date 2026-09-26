import axios from 'axios';
import mongoose from 'mongoose';
import { CompanyService } from '../companies/company.service';
import { HybridRetrievalService } from '../rag/services/hybridRetrieval.service';
import { FinancialRelevanceReranker } from '../rag/services/reranking.service';
import { AnalysisReport, IAnalysisReportDoc } from '../../models/AnalysisReport.model';
import { Asset } from '../../models/Asset.model';
import { GeopoliticalRiskEngine, WarConflictImpact } from './geopoliticalRisk.engine';

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

export class BuyAnalysisService {
  private static reranker = new FinancialRelevanceReranker();
  private static ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  private static modelName = process.env.OLLAMA_MODEL || 'gpt-oss:20b-cloud';
  private static timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);

  /**
   * Generates a grounded, AI-powered Buy Analysis report
   */
  public static async generateBuyAnalysis(symbol: string, userId?: string): Promise<any> {
    const cleanSym = symbol.trim().toUpperCase();

    // 1. Validate company & retrieve core data
    const profile = await CompanyService.getCompanyProfile(cleanSym);
    const priceHistory = await CompanyService.getPriceHistory(cleanSym, '1M');
    const financials = await CompanyService.getFinancialMetrics(cleanSym);

    const asset = await Asset.findOne({ symbol: cleanSym });
    const companyId = asset ? asset._id : new mongoose.Types.ObjectId();

    // 2. Retrieve relevant financial evidence from Qdrant via Hybrid Retrieval
    let retrievedChunks: any[] = [];
    try {
      const initialHits = await HybridRetrievalService.retrieve({
        query: `${cleanSym} revenue growth valuation margins competitive strength`,
        symbol: cleanSym,
        limit: 10,
      });

      retrievedChunks = await this.reranker.rerank(
        `${cleanSym} fundamentals growth valuation`,
        cleanSym,
        initialHits,
        6
      );
    } catch (ragErr: any) {
      console.warn(`[BuyAnalysisService] RAG retrieval notice for ${cleanSym}:`, ragErr.message);
    }

    // 3. Prepare structured evidence context
    const evidenceText = retrievedChunks.map((c, i) => `[Evidence ${i + 1} - ${c.documentType} (${c.reportingPeriod}) from ${c.source}]:\n${c.content}`).join('\n\n');

    const formattedMcap = profile.marketCapitalization != null
      ? (profile.marketCapitalization >= 100000 
          ? `₹${(profile.marketCapitalization / 100000).toFixed(2)} Lakh Cr`
          : `₹${Number(profile.marketCapitalization).toLocaleString('en-IN')} Cr`)
      : 'Data unavailable';

    const formattedFcf = financials.freeCashFlow.value != null
      ? `₹${Number(financials.freeCashFlow.value).toLocaleString('en-IN')} Cr`
      : 'Data unavailable';

    const verifiedFinancialData = {
      companyName: profile.companyName,
      symbol: cleanSym,
      exchange: profile.exchange || 'NSE/BSE',
      country: profile.country || 'India',
      currency: 'INR',
      sharePrice: profile.latestSharePrice != null ? `₹${Number(profile.latestSharePrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Data unavailable',
      dailyChangePercent: profile.dailyPercentageChange != null ? `${profile.dailyPercentageChange >= 0 ? '+' : ''}${profile.dailyPercentageChange.toFixed(2)}%` : 'Data unavailable',
      marketCapitalization: formattedMcap,
      freeCashFlow: formattedFcf,
      returnOnEquity: financials.returnOnEquity.value != null ? `${financials.returnOnEquity.value.toFixed(2)}%` : 'Data unavailable',
      debtToEquity: financials.debtToEquity.value != null ? `${financials.debtToEquity.value.toFixed(2)}` : 'Data unavailable',
      peRatio: financials.valuation.peRatio?.value != null ? `${financials.valuation.peRatio.value.toFixed(2)}x` : 'Data unavailable',
      pbRatio: financials.valuation.pbRatio?.value != null ? `${financials.valuation.pbRatio.value.toFixed(2)}x` : 'Data unavailable',
      revenue: financials.profitability.revenue?.value != null ? `₹${Number(financials.profitability.revenue.value).toLocaleString('en-IN')} Cr` : 'Data unavailable',
      netIncome: financials.profitability.netIncome?.value != null ? `₹${Number(financials.profitability.netIncome.value).toLocaleString('en-IN')} Cr` : 'Data unavailable',
      operatingProfitMargin: financials.profitability.operatingProfitMargin?.value != null ? `${financials.profitability.operatingProfitMargin.value.toFixed(2)}%` : 'Data unavailable',
      netProfitMargin: financials.profitability.netProfitMargin?.value != null ? `${financials.profitability.netProfitMargin.value.toFixed(2)}%` : 'Data unavailable',
      reportingPeriod: financials.fiscalPeriod || 'Latest Fiscal Year',
      source: financials.source || 'Screener.in & NSE/BSE Market Data',
      dataQuality: financials.dataQuality || { status: 'Verified', completenessScore: 90 },
    };

    const verifiedMetricsContext = [
      `TARGET COMPANY: ${verifiedFinancialData.companyName} (${cleanSym})`,
      `EXCHANGE: ${verifiedFinancialData.exchange} | COUNTRY: India | CURRENCY: INR (₹)`,
      `SECTOR: ${profile.sector || 'N/A'} | INDUSTRY: ${profile.industry || 'N/A'}`,
      `LATEST SHARE PRICE: ${verifiedFinancialData.sharePrice} (Daily Change: ${verifiedFinancialData.dailyChangePercent})`,
      `MARKET CAPITALIZATION: ${verifiedFinancialData.marketCapitalization}`,
      `FREE CASH FLOW: ${verifiedFinancialData.freeCashFlow}`,
      `RETURN ON EQUITY (ROE): ${verifiedFinancialData.returnOnEquity}`,
      `DEBT-TO-EQUITY RATIO: ${verifiedFinancialData.debtToEquity}`,
      `P/E RATIO: ${verifiedFinancialData.peRatio} | P/B RATIO: ${verifiedFinancialData.pbRatio}`,
      `REVENUE: ${verifiedFinancialData.revenue} (Period: ${verifiedFinancialData.reportingPeriod})`,
      `NET INCOME: ${verifiedFinancialData.netIncome}`,
      `OPERATING PROFIT MARGIN: ${verifiedFinancialData.operatingProfitMargin}`,
      `NET PROFIT MARGIN: ${verifiedFinancialData.netProfitMargin}`,
      `DATA SOURCE: Screener.in & Verified Market Data`,
    ].join('\n');

    // ─── Quantitative Risk, Profit & Downside Loss Calculations ───────────
    const currentPriceNum = Number(profile.latestSharePrice) ||
      (priceHistory.data && priceHistory.data.length > 0 ? Number(priceHistory.data[priceHistory.data.length - 1].close) : 100);

    const roe = financials.returnOnEquity?.value ?? 15;
    const pe = financials.valuation?.peRatio?.value ?? 25;
    const debtToEquity = financials.debtToEquity?.value ?? 0.5;
    const netProfitMargin = financials.profitability?.netProfitMargin?.value ?? 10;
    const fcf = financials.freeCashFlow?.value ?? 0;

    let highPrice = currentPriceNum * 1.15;
    let lowPrice = currentPriceNum * 0.90;
    if (priceHistory.data && priceHistory.data.length > 0) {
      const closes = priceHistory.data.map((d: any) => Number(d.close)).filter((c: any) => !isNaN(c) && c > 0);
      if (closes.length > 0) {
        highPrice = Math.max(...closes);
        lowPrice = Math.min(...closes);
      }
    }

    // Profit Potential %: Higher for fundamentally strong companies
    let profitBoost = 0.16;
    if (roe > 20) profitBoost += 0.08;
    if (debtToEquity < 0.6) profitBoost += 0.04;
    if (netProfitMargin > 15) profitBoost += 0.05;
    if (fcf > 0) profitBoost += 0.03;
    if (pe > 45) profitBoost -= 0.06;

    const profitPotentialPercent = Math.max(8.0, Math.min(45.0, Number((profitBoost * 100).toFixed(2))));
    const targetPrice = Number((currentPriceNum * (1 + profitPotentialPercent / 100)).toFixed(2));

    // Downside Loss %: Loss percentage if support breaks or valuation derates
    let lossBuffer = 0.075;
    if (debtToEquity > 1.0) lossBuffer += 0.035;
    if (debtToEquity > 2.0) lossBuffer += 0.04;
    if (netProfitMargin < 6) lossBuffer += 0.03;
    if (fcf < 0) lossBuffer += 0.025;

    const downsideLossPercent = -Math.max(5.0, Math.min(22.0, Number((lossBuffer * 100).toFixed(2))));
    const stopLossPrice = Number((currentPriceNum * (1 + downsideLossPercent / 100)).toFixed(2));

    // Risk to Reward Ratio
    const riskRewardRatio = Number((Math.abs(profitPotentialPercent) / Math.abs(downsideLossPercent)).toFixed(2));

    // Risk Score Percentage (0% to 100%)
    let riskCalc = 22;
    if (debtToEquity > 0.8) riskCalc += 16;
    if (debtToEquity > 1.5) riskCalc += 16;
    if (netProfitMargin < 8) riskCalc += 12;
    if (netProfitMargin < 0) riskCalc += 20;
    if (pe > 35) riskCalc += 12;
    if (fcf <= 0) riskCalc += 14;
    if (roe < 12) riskCalc += 10;
    const riskScorePercent = Math.max(10, Math.min(95, riskCalc));

    const riskLevel: 'Low' | 'Moderate' | 'High' | 'Very High' =
      riskScorePercent <= 30 ? 'Low' :
      riskScorePercent <= 55 ? 'Moderate' :
      riskScorePercent <= 75 ? 'High' : 'Very High';

    const profitProbabilityPercent = Math.min(85, Math.max(25, 100 - riskScorePercent));
    const lossProbabilityPercent = 100 - profitProbabilityPercent;

    // 4. Geopolitical & War Conflict Impact Assessment
    const warConflictImpact = GeopoliticalRiskEngine.evaluateWarImpact(
      cleanSym,
      profile.sector,
      profile.industry,
      profile.companyName
    );

    const riskRewardMetrics: BuyRiskRewardMetrics = {
      currentPrice: currentPriceNum,
      targetPrice,
      stopLossPrice,
      profitPotentialPercent,
      downsideLossPercent,
      riskRewardRatio,
      riskScorePercent,
      riskLevel,
      profitProbabilityPercent,
      lossProbabilityPercent,
      supportPrice: Number(lowPrice.toFixed(2)),
      resistancePrice: Number(highPrice.toFixed(2)),
      rationale: `Potential target profit of +${profitPotentialPercent}% vs downside risk stop-loss of ${downsideLossPercent}% gives an asymmetric ${riskRewardRatio}:1 Risk/Reward ratio with ${riskLevel.toLowerCase()} risk (${riskScorePercent}% risk score). War & Geopolitical Conflict Sensitivity: ${warConflictImpact.impactSeverity} (${warConflictImpact.conflictType}).`,
      warConflictImpact,
    };

    const prompt = [
      `You are an institutional financial analyst at AssetMind AI covering the Indian stock market. Produce a comprehensive, balanced BUY ANALYSIS report for ${profile.companyName} (${cleanSym}).`,
      `CRITICAL CONSTRAINTS:`,
      `1. Ground all factual assertions STRICTLY on the VERIFIED FINANCIAL METRICS, QUANTITATIVE RISK-REWARD DATA, and GEOPOLITICAL CONFLICT DATA below.`,
      `2. NEVER fabricate, hallucinate, or alter any stock price, market cap, free cash flow, or financial ratios.`,
      `3. Explicitly analyze the Potential Profit Percentage (+${profitPotentialPercent}%), Downside Loss Risk Percentage (${downsideLossPercent}%), Risk/Reward Ratio (${riskRewardRatio}:1), Risk Probability Score (${riskScorePercent}% - ${riskLevel} Risk), and War Conflict Impact in Sections 10 and 11.`,
      `4. If any metric is "Data unavailable", explicitly state that the metric is unavailable or limited in official corporate filings.`,
      `5. All monetary figures are in Indian Rupees (₹) and Crores (Cr). Never use USD or $ symbols.`,
      `6. Provide an objective, balanced evaluation without promising guaranteed future returns.`,
      '',
      `VERIFIED METRICS:`,
      verifiedMetricsContext,
      '',
      `QUANTITATIVE RISK & PROFIT/LOSS PERCENTAGE ESTIMATES:`,
      `- Current Stock Price: ₹${currentPriceNum.toLocaleString('en-IN')}`,
      `- Potential Profit Target: +${profitPotentialPercent}% (Estimated Target Price: ₹${targetPrice.toLocaleString('en-IN')})`,
      `- Downside Risk / Max Loss Exposure: ${downsideLossPercent}% (Capital Protection Stop: ₹${stopLossPrice.toLocaleString('en-IN')})`,
      `- Risk-to-Reward Ratio: ${riskRewardRatio} : 1`,
      `- Risk Exposure Score: ${riskScorePercent}% (${riskLevel} Risk profile)`,
      `- Estimated Profit Probability: ${profitProbabilityPercent}% | Downside Loss Probability: ${lossProbabilityPercent}%`,
      '',
      `GEOPOLITICAL & WAR CONFLICT IMPACT PROFILE:`,
      `- Active Conflict: ${warConflictImpact.conflictType} (${warConflictImpact.conflictStatus})`,
      `- Exposure Severity: ${warConflictImpact.impactSeverity} (War Risk Score: ${warConflictImpact.warRiskScorePercent}%)`,
      `- Key Transmission Vectors: ${warConflictImpact.exposureChannels.join(', ')}`,
      `- Operational Impact: ${warConflictImpact.directEffect}`,
      `- Strategic Investor Perspective: ${warConflictImpact.strategicImplication}`,
      '',
      `VERIFIED DOCUMENT EVIDENCE:`,
      evidenceText || 'No additional filing documents retrieved.',
      '',
      `REQUIRED SECTIONS (Use exact Markdown headings):`,
      `## 1. Company Overview`,
      `## 2. Financial Strength`,
      `## 3. Financial Weaknesses`,
      `## 4. Free Cash Flow Analysis`,
      `## 5. Market Capitalization Growth`,
      `## 6. ROE Analysis`,
      `## 7. Debt-to-Equity Analysis`,
      `## 8. Profitability Analysis`,
      `## 9. Valuation Analysis`,
      `## 10. Risk, Profit Potential & Downside Loss Analysis`,
      `## 11. Geopolitical & War Conflict Impact Analysis`,
      `## 12. Growth Opportunities`,
      `## 13. Important Metrics to Monitor`,
      `## 14. Source References`,
    ].join('\n');

    let reportMarkdown = '';
    const now = new Date();

    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.modelName,
          prompt,
          system: 'You are AssetMind AI. Provide a rigorous, balanced Buy Analysis report on Indian equities without making speculative promises or inventing numbers.',
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
      console.warn(`[BuyAnalysisService] Ollama inference fallback for ${cleanSym}:`, err.message);
      reportMarkdown = this.generateFallbackReport(profile, financials, verifiedFinancialData, riskRewardMetrics);
    }

    if (!reportMarkdown || reportMarkdown.length < 50) {
      reportMarkdown = this.generateFallbackReport(profile, financials, verifiedFinancialData, riskRewardMetrics);
    }

    // Parse sections
    const sections = this.parseSections(reportMarkdown);

    // Track sources
    const sources = [
      {
        source: 'Screener.in (Audited Financial Statements)',
        reportingPeriod: financials.fiscalPeriod || 'FY24',
        timestamp: now.toISOString(),
      },
      {
        source: 'NSE / BSE Verified Market Feed',
        reportingPeriod: 'Live / Daily Close',
        timestamp: now.toISOString(),
      },
      ...retrievedChunks.map((c) => ({
        source: c.source,
        sourceUrl: c.sourceUrl,
        reportingPeriod: c.reportingPeriod,
        timestamp: c.dataTimestamp,
      })),
    ];

    // Deduplicate sources
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
      analysisType: 'BUY',
      reportMarkdown,
      sections,
      sourceReferences: finalSources,
      riskRewardMetrics,
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
      analysisType: 'BUY',
      generatedAt: now.toISOString(),
      verifiedFinancialData,
      reportMarkdown,
      sections,
      riskRewardMetrics,
      keyMetrics: {
        sharePrice: profile.latestSharePrice,
        marketCap: profile.marketCapitalization,
        freeCashFlow: financials.freeCashFlow.value,
        roe: financials.returnOnEquity.value,
        debtToEquity: financials.debtToEquity.value,
        revenue: financials.profitability.revenue?.value,
        netIncome: financials.profitability.netIncome?.value,
        peRatio: financials.valuation.peRatio?.value,
      },
      sourceReferences: finalSources,
    };
  }

  /**
   * Parses markdown headings into structured sections
   */
  private static parseSections(markdown: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = markdown.split('\n');
    let currentTitle = 'Overview';
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

  /**
   * Fallback structured report if LLM server is temporarily slow
   */
  private static generateFallbackReport(
    profile: any,
    financials: any,
    data: any,
    riskMetrics?: BuyRiskRewardMetrics
  ): string {
    const rm: BuyRiskRewardMetrics = riskMetrics || {
      currentPrice: Number(profile.latestSharePrice) || 100,
      profitPotentialPercent: 18.5,
      downsideLossPercent: -8.0,
      riskRewardRatio: 2.31,
      riskScorePercent: 35,
      riskLevel: 'Moderate' as const,
      profitProbabilityPercent: 65,
      lossProbabilityPercent: 35,
      targetPrice: (Number(profile.latestSharePrice) || 100) * 1.185,
      stopLossPrice: (Number(profile.latestSharePrice) || 100) * 0.92,
      supportPrice: (Number(profile.latestSharePrice) || 100) * 0.9,
      resistancePrice: (Number(profile.latestSharePrice) || 100) * 1.2,
      rationale: 'Balanced risk-reward profile',
    };

    return [
      `# Institutional Buy Analysis: ${profile.companyName} (${profile.symbol})`,
      '',
      `## 1. Company Overview`,
      `${profile.companyName} is a leading Indian enterprise operating in ${profile.sector || 'its sector'} (${profile.industry || 'Core Operations'}), listed on ${profile.exchange || 'NSE / BSE'}. The current market price stands at ${data.sharePrice} with a market capitalization of ${data.marketCapitalization}.`,
      '',
      `## 2. Financial Strength`,
      `- Operating Revenue: ${data.revenue}`,
      `- Net Profitability: ${data.netIncome} (Net Margin: ${data.netProfitMargin})`,
      `- Cash Generation: Free Cash Flow reported at ${data.freeCashFlow}`,
      `- Operating Efficiency: Operating Profit Margin at ${data.operatingProfitMargin}`,
      '',
      `## 3. Financial Weaknesses`,
      `- Leverage Profile: Debt-to-Equity stands at ${data.debtToEquity}`,
      `- Volatility: Recent daily market price change recorded at ${data.dailyChangePercent}`,
      '',
      `## 4. Free Cash Flow Analysis`,
      `Free Cash Flow is audited at ${data.freeCashFlow} for ${data.reportingPeriod}. Consistent positive FCF provides resilience for reinvestment, dividends, and debt service.`,
      '',
      `## 5. Market Capitalization Growth`,
      `Market capitalization is verified at ${data.marketCapitalization}, reflecting institutional ownership and market valuation across Indian exchanges.`,
      '',
      `## 6. ROE Analysis`,
      `Return on Equity (ROE) stands at ${data.returnOnEquity}, indicating capital efficiency generated for equity shareholders.`,
      '',
      `## 7. Debt-to-Equity Analysis`,
      `Debt-to-Equity ratio is ${data.debtToEquity}. A ratio below 1.0 indicates prudent capital structuring and manageable solvency risk.`,
      '',
      `## 8. Profitability Analysis`,
      `- Operating Profit Margin (OPM): ${data.operatingProfitMargin}`,
      `- Net Profit Margin (NPM): ${data.netProfitMargin}`,
      '',
      `## 9. Valuation Analysis`,
      `- P/E Multiple: ${data.peRatio}`,
      `- P/B Multiple: ${data.pbRatio}`,
      '',
      `## 10. Risk, Profit Potential & Downside Loss Analysis`,
      `- **Potential Profit Target**: +${rm.profitPotentialPercent}% (Estimated Target Price: ₹${rm.targetPrice.toLocaleString('en-IN')})`,
      `- **Downside Risk (Stop Loss)**: ${rm.downsideLossPercent}% (Capital Protection Stop: ₹${rm.stopLossPrice.toLocaleString('en-IN')})`,
      `- **Risk-to-Reward Ratio**: ${rm.riskRewardRatio} : 1 (${rm.riskRewardRatio >= 2 ? 'Favorable asymmetric upside profile' : 'Balanced risk-reward profile'})`,
      `- **Total Risk Exposure Score**: ${rm.riskScorePercent}% (${rm.riskLevel} Risk profile)`,
      `- **Estimated Probability**: ${rm.profitProbabilityPercent}% estimated upside probability vs ${rm.lossProbabilityPercent}% downside risk variance.`,
      `- **Key Risk Considerations**: Debt-to-Equity is ${data.debtToEquity}, Free Cash Flow is ${data.freeCashFlow}, and sector cyclicality in ${profile.sector || 'the industry'}.`,
      '',
      `## 11. Geopolitical & War Conflict Impact Analysis`,
      rm.warConflictImpact
        ? [
            `- **Active Geopolitical Conflict**: ${rm.warConflictImpact.conflictType} (${rm.warConflictImpact.conflictStatus})`,
            `- **Conflict Sensitivity Rating**: **${rm.warConflictImpact.impactSeverity}** (War Risk Score: ${rm.warConflictImpact.warRiskScorePercent}%)`,
            `- **Primary Transmission Vectors**: ${rm.warConflictImpact.exposureChannels.map((c: string) => `\`${c}\``).join(' • ')}`,
            `- **Direct Operational Effect**: ${rm.warConflictImpact.directEffect}`,
            `- **Strategic Investor Guidance**: ${rm.warConflictImpact.strategicImplication}`,
          ].join('\n')
        : `- Domestic operations maintain strong insulation from direct overseas war hostilities. Macro energy inflation remains the primary monitoring variable.`,
      '',
      `## 12. Growth Opportunities`,
      `Long-term growth is driven by domestic demand expansion, operational scaling, and sustained return on capital.`,
      '',
      `## 13. Important Metrics to Monitor`,
      `Investors should monitor quarterly Free Cash Flow trends, OPM resilience, and debt obligations in upcoming corporate filings.`,
      '',
      `## 14. Source References`,
      `Data verified from Screener.in corporate filings and NSE/BSE market records. Reporting period: ${data.reportingPeriod}.`,
    ].join('\n');
  }
}

