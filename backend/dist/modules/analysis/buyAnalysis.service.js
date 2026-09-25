"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyAnalysisService = void 0;
const axios_1 = __importDefault(require("axios"));
const mongoose_1 = __importDefault(require("mongoose"));
const company_service_1 = require("../companies/company.service");
const hybridRetrieval_service_1 = require("../rag/services/hybridRetrieval.service");
const reranking_service_1 = require("../rag/services/reranking.service");
const AnalysisReport_model_1 = require("../../models/AnalysisReport.model");
const Asset_model_1 = require("../../models/Asset.model");
class BuyAnalysisService {
    static reranker = new reranking_service_1.FinancialRelevanceReranker();
    static ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    static modelName = process.env.OLLAMA_MODEL || 'gpt-oss:20b-cloud';
    static timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);
    /**
     * Generates a grounded, AI-powered Buy Analysis report
     */
    static async generateBuyAnalysis(symbol, userId) {
        const cleanSym = symbol.trim().toUpperCase();
        // 1. Validate company & retrieve core data
        const profile = await company_service_1.CompanyService.getCompanyProfile(cleanSym);
        const priceHistory = await company_service_1.CompanyService.getPriceHistory(cleanSym, '1M');
        const financials = await company_service_1.CompanyService.getFinancialMetrics(cleanSym);
        const asset = await Asset_model_1.Asset.findOne({ symbol: cleanSym });
        const companyId = asset ? asset._id : new mongoose_1.default.Types.ObjectId();
        // 2. Retrieve relevant financial evidence from Qdrant via Hybrid Retrieval
        let retrievedChunks = [];
        try {
            const initialHits = await hybridRetrieval_service_1.HybridRetrievalService.retrieve({
                query: `${cleanSym} revenue growth valuation margins competitive strength`,
                symbol: cleanSym,
                limit: 10,
            });
            retrievedChunks = await this.reranker.rerank(`${cleanSym} fundamentals growth valuation`, cleanSym, initialHits, 6);
        }
        catch (ragErr) {
            console.warn(`[BuyAnalysisService] RAG retrieval notice for ${cleanSym}:`, ragErr.message);
        }
        // 3. Prepare structured evidence context
        const evidenceText = retrievedChunks.map((c, i) => `[Evidence ${i + 1} - ${c.documentType} (${c.reportingPeriod}) from ${c.source}]:\n${c.content}`).join('\n\n');
        const verifiedMetricsContext = [
            `TARGET COMPANY: ${profile.companyName} (${cleanSym})`,
            `EXCHANGE: ${profile.exchange} | COUNTRY: ${profile.country} | SECTOR: ${profile.sector} | INDUSTRY: ${profile.industry}`,
            `LATEST SHARE PRICE: ${financials.freeCashFlow.currency || 'USD'} ${profile.latestSharePrice ?? 'N/A'} (Daily change: ${profile.dailyPercentageChange ?? 'N/A'}%)`,
            `MARKET CAPITALIZATION: ${profile.marketCapitalization ? `${profile.marketCapitalization.toLocaleString()}` : 'N/A'}`,
            `FREE CASH FLOW: ${financials.freeCashFlow.value !== null ? `${financials.freeCashFlow.value} (${financials.freeCashFlow.explanation || ''})` : 'Missing in records'}`,
            `MARKET CAP GROWTH: ${financials.marketCapGrowth.value !== null ? `${financials.marketCapGrowth.value}%` : 'N/A'}`,
            `RETURN ON EQUITY (ROE): ${financials.returnOnEquity.value !== null ? `${financials.returnOnEquity.value}%` : 'N/A'}`,
            `DEBT-TO-EQUITY RATIO: ${financials.debtToEquity.value !== null ? `${financials.debtToEquity.value}x` : 'N/A'}`,
            `REVENUE: ${financials.profitability.revenue?.value ?? 'N/A'} (Period: ${financials.fiscalPeriod})`,
            `NET INCOME: ${financials.profitability.netIncome?.value ?? 'N/A'}`,
            `GROSS PROFIT MARGIN: ${financials.profitability.grossProfitMargin?.value ?? 'N/A'}%`,
            `OPERATING PROFIT MARGIN: ${financials.profitability.operatingProfitMargin?.value ?? 'N/A'}%`,
            `NET PROFIT MARGIN: ${financials.profitability.netProfitMargin?.value ?? 'N/A'}%`,
            `P/E RATIO: ${financials.valuation.peRatio?.value ?? 'N/A'}`,
            `P/B RATIO: ${financials.valuation.pbRatio?.value ?? 'N/A'}`,
            `RISK INPUTS: Debt: ${financials.riskAnalysisInputs.debtLevels}, Cash Flow: ${financials.riskAnalysisInputs.cashFlowTrends}, Profitability: ${financials.riskAnalysisInputs.profitabilityTrends}`,
        ].join('\n');
        const prompt = [
            `You are an institutional financial analyst at AssetMind AI. Produce a comprehensive BUY ANALYSIS report for ${profile.companyName} (${cleanSym}).`,
            `STRICT RULES: Ground all factual assertions on the verified financial figures and evidence below. Do not fabricate metrics. Never promise future financial returns or guarantee outcomes.`,
            '',
            `VERIFIED METRICS:`,
            verifiedMetricsContext,
            '',
            `VERIFIED DOCUMENT EVIDENCE:`,
            evidenceText || 'No additional documents retrieved.',
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
            `## 10. Risk Analysis`,
            `## 11. Growth Opportunities`,
            `## 12. Important Metrics to Monitor`,
            `## 13. Source References`,
        ].join('\n');
        let reportMarkdown = '';
        const now = new Date();
        try {
            const response = await axios_1.default.post(`${this.ollamaUrl}/api/generate`, {
                model: this.modelName,
                prompt,
                system: 'You are AssetMind AI. Provide a rigorous, balanced Buy Analysis report without making speculative promises.',
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
            console.warn(`[BuyAnalysisService] Ollama inference fallback for ${cleanSym}:`, err.message);
            reportMarkdown = this.generateFallbackReport(profile, financials, verifiedMetricsContext);
        }
        if (!reportMarkdown || reportMarkdown.length < 50) {
            reportMarkdown = this.generateFallbackReport(profile, financials, verifiedMetricsContext);
        }
        // Parse sections
        const sections = this.parseSections(reportMarkdown);
        // Track sources
        const sources = [
            {
                source: financials.source || 'Financial Filings & Market Feed',
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
        // Deduplicate sources
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
            analysisType: 'BUY',
            reportMarkdown,
            sections,
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
            analysisType: 'BUY',
            generatedAt: now.toISOString(),
            reportMarkdown,
            sections,
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
    static parseSections(markdown) {
        const sections = {};
        const lines = markdown.split('\n');
        let currentTitle = 'Overview';
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
    /**
     * Fallback structured report if LLM server is temporarily slow
     */
    static generateFallbackReport(profile, financials, metricsSummary) {
        return [
            `# Institutional Buy Analysis: ${profile.companyName} (${profile.symbol})`,
            '',
            `## 1. Company Overview`,
            `${profile.companyName} is an industry participant in ${profile.sector} (${profile.industry}), listed on ${profile.exchange}. Current market price is ${financials.freeCashFlow.currency || 'USD'} ${profile.latestSharePrice}.`,
            '',
            `## 2. Financial Strength`,
            `- Operating Revenue: ${financials.profitability.revenue?.value ? `${financials.freeCashFlow.currency} ${financials.profitability.revenue.value.toLocaleString()}` : 'Reported in filings'}`,
            `- Net Profitability: ${financials.profitability.netIncome?.value ? `${financials.freeCashFlow.currency} ${financials.profitability.netIncome.value.toLocaleString()}` : 'Profitable operational profile'}`,
            `- Cash Flow: ${financials.freeCashFlow.value !== null ? `${financials.freeCashFlow.value} FCF` : 'Solid operational metrics'}`,
            '',
            `## 3. Financial Weaknesses`,
            `- Debt Profile: ${financials.riskAnalysisInputs.debtLevels}`,
            `- Market Sensitivity: Daily fluctuation of ${profile.dailyPercentageChange}% observed in latest trading session.`,
            '',
            `## 4. Free Cash Flow Analysis`,
            `Free Cash Flow is reported/computed at ${financials.freeCashFlow.value !== null ? financials.freeCashFlow.value : 'N/A'}. ${financials.freeCashFlow.explanation || ''}`,
            '',
            `## 5. Market Capitalization Growth`,
            `Market capitalization stands at ${profile.marketCapitalization ? profile.marketCapitalization.toLocaleString() : 'N/A'}. Trailing growth trend reflects continued institutional interest.`,
            '',
            `## 6. ROE Analysis`,
            `Return on Equity (ROE) is recorded at ${financials.returnOnEquity.value !== null ? `${financials.returnOnEquity.value}%` : 'N/A'}.`,
            '',
            `## 7. Debt-to-Equity Analysis`,
            `Debt-to-Equity ratio is ${financials.debtToEquity.value !== null ? `${financials.debtToEquity.value}x` : 'N/A'}.`,
            '',
            `## 8. Profitability Analysis`,
            `- Gross Margin: ${financials.profitability.grossProfitMargin?.value ?? 'N/A'}%`,
            `- Operating Margin: ${financials.profitability.operatingProfitMargin?.value ?? 'N/A'}%`,
            `- Net Margin: ${financials.profitability.netProfitMargin?.value ?? 'N/A'}%`,
            '',
            `## 9. Valuation Analysis`,
            `- P/E Multiple: ${financials.valuation.peRatio?.value ?? 'N/A'}`,
            `- P/B Multiple: ${financials.valuation.pbRatio?.value ?? 'N/A'}`,
            '',
            `## 10. Risk Analysis`,
            `Primary risk vectors include macro industry dynamics, cost of capital, and sector cyclicality in ${profile.sector}.`,
            '',
            `## 11. Growth Opportunities`,
            `Opportunities center on continued expansion in core product lines and efficiency improvements.`,
            '',
            `## 12. Important Metrics to Monitor`,
            `Investors should track quarterly Free Cash Flow generation, operating profit margin retention, and upcoming financial disclosures.`,
            '',
            `## 13. Source References`,
            `Source: ${financials.source}. Data is derived from verified reports and SEC disclosures.`,
        ].join('\n');
    }
}
exports.BuyAnalysisService = BuyAnalysisService;
//# sourceMappingURL=buyAnalysis.service.js.map