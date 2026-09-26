"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellAnalysisService = void 0;
const axios_1 = __importDefault(require("axios"));
const mongoose_1 = __importDefault(require("mongoose"));
const company_service_1 = require("../companies/company.service");
const hybridRetrieval_service_1 = require("../rag/services/hybridRetrieval.service");
const reranking_service_1 = require("../rag/services/reranking.service");
const AnalysisReport_model_1 = require("../../models/AnalysisReport.model");
const Asset_model_1 = require("../../models/Asset.model");
const geopoliticalRisk_engine_1 = require("./geopoliticalRisk.engine");
class SellAnalysisService {
    static reranker = new reranking_service_1.FinancialRelevanceReranker();
    static ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    static modelName = process.env.OLLAMA_MODEL || 'gpt-oss:20b-cloud';
    static timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);
    /**
     * Generates a grounded, AI-powered Sell Analysis investigating risks and potential deterioration
     */
    static async generateSellAnalysis(symbol, investorInput, userId) {
        const cleanSym = symbol.trim().toUpperCase();
        // 1. Retrieve company data
        const profile = await company_service_1.CompanyService.getCompanyProfile(cleanSym);
        const priceHistory = await company_service_1.CompanyService.getPriceHistory(cleanSym, '1M');
        const financials = await company_service_1.CompanyService.getFinancialMetrics(cleanSym);
        const asset = await Asset_model_1.Asset.findOne({ symbol: cleanSym });
        const companyId = asset ? asset._id : new mongoose_1.default.Types.ObjectId();
        // 2. Personal Investment Calculations (if provided)
        let personalPnlAnalysis = null;
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
        let retrievedChunks = [];
        try {
            const initialHits = await hybridRetrieval_service_1.HybridRetrievalService.retrieve({
                query: `${cleanSym} debt decline competition risk margins customer demand regulatory`,
                symbol: cleanSym,
                limit: 10,
            });
            retrievedChunks = await this.reranker.rerank(`${cleanSym} decline risks competition liabilities`, cleanSym, initialHits, 6);
        }
        catch (ragErr) {
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
        // ─── Quantitative Exit Risk, Profit Protection & Loss Thresholds ───
        const currentPriceNum = profile.latestSharePrice ?? (priceHistory.data && priceHistory.data.length > 0 ? Number(priceHistory.data[priceHistory.data.length - 1].close) : 100);
        const purchasePrice = investorInput?.purchasePrice;
        const hasPurchase = purchasePrice !== undefined && purchasePrice > 0;
        const unrealizedPnlPercent = hasPurchase ? Number((((currentPriceNum - purchasePrice) / purchasePrice) * 100).toFixed(2)) : null;
        const isProfitable = hasPurchase ? currentPriceNum >= purchasePrice : undefined;
        const roe = financials.returnOnEquity?.value ?? 15;
        const debtToEquity = financials.debtToEquity?.value ?? 0.5;
        const netProfitMargin = financials.profitability?.netProfitMargin?.value ?? 10;
        const fcf = financials.freeCashFlow?.value ?? 0;
        // Downside Risk Loss %: If position deteriorates further or support breaks
        let downsideBuffer = 0.10;
        if (debtToEquity > 1.0)
            downsideBuffer += 0.04;
        if (debtToEquity > 2.0)
            downsideBuffer += 0.05;
        if (fcf < 0)
            downsideBuffer += 0.04;
        if (netProfitMargin < 5)
            downsideBuffer += 0.03;
        if (unrealizedPnlPercent !== null && unrealizedPnlPercent < -15)
            downsideBuffer += 0.04;
        const downsideLossPercent = -Math.max(6.0, Math.min(30.0, Number((downsideBuffer * 100).toFixed(2))));
        const exitTriggerPrice = Number((currentPriceNum * (1 + downsideLossPercent / 100)).toFixed(2));
        // Upside Rebound / Recovery %: Potential bounce back
        let reboundBuffer = 0.08;
        if (debtToEquity < 0.6)
            reboundBuffer += 0.03;
        if (roe > 15)
            reboundBuffer += 0.03;
        if (fcf > 0)
            reboundBuffer += 0.02;
        if (debtToEquity > 1.5)
            reboundBuffer -= 0.03;
        const upsideRecoveryPercent = Math.max(4.0, Math.min(22.0, Number((reboundBuffer * 100).toFixed(2))));
        const targetRecoveryPrice = Number((currentPriceNum * (1 + upsideRecoveryPercent / 100)).toFixed(2));
        // Capital Risk Score % (0-100%)
        let riskCalc = 25;
        if (debtToEquity > 0.8)
            riskCalc += 18;
        if (debtToEquity > 1.8)
            riskCalc += 15;
        if (fcf <= 0)
            riskCalc += 16;
        if (netProfitMargin < 8)
            riskCalc += 12;
        if (netProfitMargin < 0)
            riskCalc += 18;
        if (unrealizedPnlPercent !== null) {
            if (unrealizedPnlPercent < 0) {
                riskCalc += Math.min(20, Math.abs(unrealizedPnlPercent) * 0.8);
            }
            else if (unrealizedPnlPercent > 40) {
                riskCalc += 10;
            }
        }
        const riskScorePercent = Math.max(10, Math.min(95, Math.round(riskCalc)));
        const riskLevel = riskScorePercent <= 35 ? 'Low Risk (Hold)' :
            riskScorePercent <= 60 ? 'Moderate Risk (Monitor)' :
                riskScorePercent <= 78 ? 'High Risk (Trim/Hedge)' : 'Severe Risk (Exit)';
        let recommendationAction = 'HOLD';
        if (riskScorePercent > 78) {
            recommendationAction = 'EXIT';
        }
        else if (isProfitable && (unrealizedPnlPercent ?? 0) >= 25 && riskScorePercent > 50) {
            recommendationAction = 'TAKE_PROFIT';
        }
        else if (riskScorePercent > 60 || (unrealizedPnlPercent !== null && unrealizedPnlPercent < -15)) {
            recommendationAction = 'TRIM';
        }
        const profitLockInPercent = isProfitable && (unrealizedPnlPercent ?? 0) > 0 ? (unrealizedPnlPercent ?? 0) : 0;
        const riskRewardRatio = Number((Math.abs(downsideLossPercent) / Math.max(upsideRecoveryPercent, 0.1)).toFixed(2));
        const recommendationSummary = recommendationAction === 'EXIT'
            ? `High capital risk of ${riskScorePercent}%: Potential downside loss of ${downsideLossPercent}% indicates stop-loss exit or capital preservation at ₹${exitTriggerPrice}.`
            : recommendationAction === 'TAKE_PROFIT'
                ? `Profit lock-in favorable: Realized gain of +${profitLockInPercent}% can be protected against ${downsideLossPercent}% downside risk.`
                : recommendationAction === 'TRIM'
                    ? `Elevated risk of ${riskScorePercent}%: Downside loss exposure of ${downsideLossPercent}% warrants partial trim with trailing stop at ₹${exitTriggerPrice}.`
                    : `Manageable risk of ${riskScorePercent}%: Upside recovery of +${upsideRecoveryPercent}% (Target ₹${targetRecoveryPrice}) justifies holding with trailing stop at ₹${exitTriggerPrice}.`;
        // Geopolitical & War Conflict Impact
        const warConflictImpact = geopoliticalRisk_engine_1.GeopoliticalRiskEngine.evaluateWarImpact(cleanSym, profile.sector, profile.industry, profile.companyName);
        const riskRewardMetrics = {
            currentPrice: currentPriceNum,
            purchasePrice,
            unrealizedPnlPercent,
            isProfitable,
            profitLockInPercent,
            downsideLossPercent,
            upsideRecoveryPercent,
            riskScorePercent,
            riskLevel,
            exitTriggerPrice,
            targetRecoveryPrice,
            riskRewardRatio,
            recommendationAction,
            recommendationSummary,
            rationale: recommendationSummary,
            warConflictImpact,
        };
        const prompt = [
            `You are an institutional risk & sell-side equity analyst at AssetMind AI. Produce an objective, evidence-based SELL ANALYSIS for ${profile.companyName} (${cleanSym}).`,
            `CRITICAL GUIDELINES:`,
            `1. Clearly distinguish VERIFIED FACTS from EVIDENCE-BASED INTERPRETATIONS and POTENTIAL EXPLANATIONS.`,
            `2. Explicitly analyze the Risk %, Profit % (Unrealized/Lock-in: ${unrealizedPnlPercent !== null ? `${unrealizedPnlPercent}%` : 'N/A'}), Downside Loss Risk % (${downsideLossPercent}%), Recovery Upside % (+${upsideRecoveryPercent}%), and Capital Deterioration Risk Score (${riskScorePercent}% - ${riskLevel}) in Section 8.`,
            `3. Identify any MISSING INFORMATION explicitly.`,
            `4. DO NOT automatically advise the user to sell; present a balanced risk assessment.`,
            `5. Investigate the 4 core deterioration categories:`,
            `   A. Personal Investment Mistakes (if user data provided)`,
            `   B. Company Decision Problems (capital allocation, acquisitions, borrowing, expansion inefficiencies)`,
            `   C. Product and Business Problems (demand changes, product quality, competition, launch failures)`,
            `   D. External Market & War Factors (geopolitics, macro inflation, supply chain routes, interest rates)`,
            '',
            `VERIFIED FINANCIAL METRICS:`,
            metricsSummary,
            '',
            `QUANTITATIVE RISK, PROFIT & LOSS METRICS:`,
            `- Current Stock Price: ₹${currentPriceNum}`,
            `- Position Return / P&L: ${unrealizedPnlPercent !== null ? `${unrealizedPnlPercent >= 0 ? '+' : ''}${unrealizedPnlPercent}%` : 'No purchase price provided'}`,
            `- Potential Downside Loss Exposure: ${downsideLossPercent}% (Capital Protection Exit Trigger: ₹${exitTriggerPrice})`,
            `- Upside Recovery Target: +${upsideRecoveryPercent}% (Recovery Target: ₹${targetRecoveryPrice})`,
            `- Capital Deterioration Risk Score: ${riskScorePercent}% (${riskLevel})`,
            `- Recommended Action: ${recommendationAction} (${recommendationSummary})`,
            '',
            `GEOPOLITICAL & WAR CONFLICT RISK METRICS:`,
            `- Active War / Conflict: ${warConflictImpact.conflictType} (${warConflictImpact.conflictStatus})`,
            `- Conflict Sensitivity: ${warConflictImpact.impactSeverity} (War Risk Score: ${warConflictImpact.warRiskScorePercent}%)`,
            `- Direct Vulnerability Channels: ${warConflictImpact.exposureChannels.join(', ')}`,
            `- Geopolitical Sell Trigger: ${warConflictImpact.directEffect}`,
            `- Defensive Hedging / Exit Strategy: ${warConflictImpact.strategicImplication}`,
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
            `## 8. Risk, Profit Protection & Loss Threshold Analysis`,
            `## 9. Important Metrics to Monitor`,
            `## 10. Evidence and Sources`,
        ].join('\n');
        let reportMarkdown = '';
        const now = new Date();
        try {
            const response = await axios_1.default.post(`${this.ollamaUrl}/api/generate`, {
                model: this.modelName,
                prompt,
                system: 'You are AssetMind AI. Provide a rigorous, objective Sell Analysis report distinguishing facts from interpretations.',
                stream: false,
                options: {
                    temperature: 0.25,
                    num_ctx: 4096,
                    num_predict: 800,
                },
            }, { timeout: this.timeoutMs });
            let rawText = response.data?.response?.trim() || '';
            rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            if (rawText.includes('<think>')) {
                rawText = rawText.split('<think>')[0].trim();
            }
            reportMarkdown = rawText;
        }
        catch (err) {
            console.warn(`[SellAnalysisService] Ollama inference fallback for ${cleanSym}:`, err.message);
            reportMarkdown = this.generateFallbackReport(profile, financials, personalSectionText, riskRewardMetrics);
        }
        if (!reportMarkdown || reportMarkdown.length < 50) {
            reportMarkdown = this.generateFallbackReport(profile, financials, personalSectionText, riskRewardMetrics);
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
        const uniqueSourcesMap = new Map();
        for (const s of sources) {
            uniqueSourcesMap.set(`${s.source}_${s.reportingPeriod}`, s);
        }
        const finalSources = Array.from(uniqueSourcesMap.values());
        // Save report in MongoDB
        const reportDoc = await AnalysisReport_model_1.AnalysisReport.create({
            userId: userId && mongoose_1.default.Types.ObjectId.isValid(userId) ? new mongoose_1.default.Types.ObjectId(userId) : undefined,
            companyId,
            symbol: cleanSym,
            analysisType: 'SELL',
            reportMarkdown,
            sections,
            personalInvestmentData: personalPnlAnalysis || undefined,
            riskRewardMetrics,
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
            riskRewardMetrics,
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
    static parseSections(markdown) {
        const sections = {};
        const lines = markdown.split('\n');
        let currentTitle = 'Summary';
        let currentLines = [];
        for (const line of lines) {
            if (line.startsWith('## ') || line.startsWith('### ')) {
                if (currentLines.length > 0) {
                    sections[currentTitle] = currentLines.join('\n').trim();
                    currentLines = [];
                }
                currentTitle = line.replace(/^[#\s0-9.]+/g, '').trim();
            }
            else {
                currentLines.push(line);
            }
        }
        if (currentLines.length > 0) {
            sections[currentTitle] = currentLines.join('\n').trim();
        }
        return sections;
    }
    static generateFallbackReport(profile, financials, personalText, riskMetrics) {
        const rm = riskMetrics || {
            currentPrice: profile.latestSharePrice ?? 100,
            unrealizedPnlPercent: null,
            profitLockInPercent: 0,
            downsideLossPercent: -15.0,
            upsideRecoveryPercent: 8.0,
            riskScorePercent: 65,
            riskLevel: 'Moderate Risk (Monitor)',
            exitTriggerPrice: (profile.latestSharePrice ?? 100) * 0.85,
            targetRecoveryPrice: (profile.latestSharePrice ?? 100) * 1.08,
            riskRewardRatio: 1.88,
            recommendationAction: 'TRIM',
            recommendationSummary: 'Manage downside exposure with trailing capital protection stop.',
            rationale: 'Manage downside exposure with trailing capital protection stop.',
        };
        return [
            `# Institutional Sell & Risk Analysis: ${profile.companyName} (${profile.symbol})`,
            '',
            `## 1. Performance Summary`,
            `**Verified Fact:** ${profile.companyName} trades at ${financials.freeCashFlow.currency || 'INR'} ${profile.latestSharePrice}, showing daily variance of ${profile.dailyPercentageChange}%.`,
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
            `## 8. Risk, Profit Protection & Loss Threshold Analysis`,
            `- **Current Position Return / P&L**: ${rm.unrealizedPnlPercent !== null ? `${rm.unrealizedPnlPercent >= 0 ? '+' : ''}${rm.unrealizedPnlPercent}%` : 'Position cost basis not provided'}`,
            `- **Downside Loss Risk (Further Decline)**: ${rm.downsideLossPercent}% (Capital Protection Stop: ₹${rm.exitTriggerPrice.toLocaleString('en-IN')})`,
            `- **Upside Recovery Potential**: +${rm.upsideRecoveryPercent}% (Mean-Reversion Target: ₹${rm.targetRecoveryPrice.toLocaleString('en-IN')})`,
            `- **Capital Deterioration Risk Score**: ${rm.riskScorePercent}% (${rm.riskLevel})`,
            `- **Actionable Exit Strategy**: **${rm.recommendationAction}** — ${rm.recommendationSummary}`,
            `- **Leverage & Solvency Risk**: Debt Level is ${financials.riskAnalysisInputs.debtLevels} (D/E: ${financials.debtToEquity.value ?? 'N/A'}).`,
            `- **Cash Flow Protection**: Cash trend evaluated as ${financials.riskAnalysisInputs.cashFlowTrends} (FCF: ${financials.freeCashFlow.value !== null ? financials.freeCashFlow.value : 'N/A'}).`,
            rm.warConflictImpact
                ? [
                    `- **Geopolitical & War Vulnerability**: **${rm.warConflictImpact.impactSeverity}** (${rm.warConflictImpact.conflictType})`,
                    `- **War Transmission Channels**: ${rm.warConflictImpact.exposureChannels.map((c) => `\`${c}\``).join(' • ')}`,
                    `- **Geopolitical Exit Risk**: ${rm.warConflictImpact.directEffect}`,
                    `- **Strategic Risk Guidance**: ${rm.warConflictImpact.strategicImplication}`,
                ].join('\n')
                : '',
            '',
            `## 9. Important Metrics to Monitor`,
            `1. Free Cash Flow stability (${financials.freeCashFlow.value !== null ? financials.freeCashFlow.value : 'N/A'}).`,
            `2. Quarterly operating margin retention (${financials.profitability.operatingProfitMargin?.value ?? 'N/A'}%).`,
            `3. Debt servicing covenants and leverage ratio.`,
            `4. Geopolitical crude benchmark volatility and international shipping freight costs.`,
            '',
            `## 10. Evidence and Sources`,
            `Source: ${financials.source}. Analysis grounded in verified financial filings. Note: Independent financial consultation is advised before executing sell orders.`,
        ].join('\n');
    }
}
exports.SellAnalysisService = SellAnalysisService;
//# sourceMappingURL=sellAnalysis.service.js.map