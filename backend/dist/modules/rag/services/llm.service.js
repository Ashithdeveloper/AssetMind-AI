"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmService = void 0;
const axios_1 = __importDefault(require("axios"));
class LlmService {
    static instance;
    ollamaUrl;
    modelName;
    timeoutMs;
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
        this.modelName = process.env.OLLAMA_MODEL || 'gpt-oss:20b-cloud';
        this.timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);
    }
    static getInstance() {
        if (!LlmService.instance) {
            LlmService.instance = new LlmService();
        }
        return LlmService.instance;
    }
    /**
     * System prompt enforcing financial analytical rigor and zero hallucination
     */
    getSystemPrompt() {
        return [
            'You are AssetMind AI, a specialized institutional financial intelligence assistant.',
            'Your task is to provide accurate, evidence-based financial analysis using ONLY the provided verified context.',
            '',
            'CRITICAL RULES:',
            '1. Strictly ground all factual financial claims, numbers, and dates in the provided evidence. DO NOT invent, assume, or hallucinate metrics.',
            '2. If the retrieved evidence does not contain the answer or specific metrics requested, state clearly and unequivocally: "Insufficient evidence in current database for [metric/question]."',
            '3. Always preserve original financial units (e.g. Billion, Million, %, ratio) and currencies as cited in the evidence.',
            '4. Distinguish clearly between objective facts (e.g., "In period 2024, Revenue was $391B") and analytical interpretations.',
            '5. Attribute claims to the specific sources and reporting periods cited in the evidence (e.g., [Source: yahoo-finance, Period: 2024]).',
            '6. NEVER guarantee future stock returns or make predictive investment promises.',
            '7. Structure your response clearly with concise executive takeaways, direct metric answers, and source attribution.',
        ].join('\n');
    }
    /**
     * Generates structured answer for user query and verified evidence context
     */
    async generateAnswer(evidenceContext) {
        const systemPrompt = this.getSystemPrompt();
        const prompt = [
            `CONTEXT AND EVIDENCE:`,
            evidenceContext.formattedContext,
            '',
            `USER QUERY:`,
            evidenceContext.query,
            '',
            `INSTRUCTIONS:`,
            `Generate a clear, professional, evidence-backed financial analysis for ${evidenceContext.targetSymbol} based exclusively on the context above.`,
        ].join('\n\n');
        try {
            const response = await axios_1.default.post(`${this.ollamaUrl}/api/generate`, {
                model: this.modelName,
                prompt,
                system: systemPrompt,
                stream: false,
                options: {
                    temperature: 0.2, // Low temperature for high factual precision
                    top_p: 0.9,
                    num_ctx: 4096,
                    num_predict: 350, // Keep generation focused and fast on CPU
                },
            }, { timeout: this.timeoutMs });
            let generatedText = response.data?.response?.trim() || '';
            // Strip chain-of-thought tags (<think>...</think>) if present in model output
            generatedText = generatedText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            // Extract key evidence sentences for structured payload
            const evidenceList = evidenceContext.evidenceSnippets
                .slice(0, 5)
                .map((s) => `[${s.documentType} | ${s.reportingPeriod} | ${s.source}]: ${s.text.split('\n').filter(l => l.includes('|') || l.startsWith('-')).slice(0, 3).join('; ')}`);
            return {
                answer: generatedText,
                symbol: evidenceContext.targetSymbol,
                evidence: evidenceList,
                sources: evidenceContext.sources,
                dataFreshness: evidenceContext.dataFreshness,
                confidenceScore: evidenceContext.retrievedCount > 0 ? 0.95 : 0.2,
                modelUsed: this.modelName,
            };
        }
        catch (err) {
            console.error(`[LlmService] Error querying Ollama (${this.modelName}):`, err.message);
            // Handle timeout or connection error with fallback
            if (err.code === 'ECONNREFUSED' || err.message.includes('timeout')) {
                return {
                    answer: `[AI Model Notice] Unable to reach LLM inference engine (${this.modelName}) at ${this.ollamaUrl}. The retrieved factual evidence is preserved below for direct reference:\n\n${evidenceContext.formattedContext}`,
                    symbol: evidenceContext.targetSymbol,
                    evidence: evidenceContext.evidenceSnippets.map((s) => s.text),
                    sources: evidenceContext.sources,
                    dataFreshness: evidenceContext.dataFreshness,
                    confidenceScore: 0.5,
                    modelUsed: `${this.modelName} (fallback-offline)`,
                };
            }
            throw new Error(`LLM generation failed: ${err.message}`);
        }
    }
}
exports.LlmService = LlmService;
//# sourceMappingURL=llm.service.js.map