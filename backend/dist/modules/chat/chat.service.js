"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const axios_1 = __importDefault(require("axios"));
const mongoose_1 = __importDefault(require("mongoose"));
const ChatSession_model_1 = require("../../models/ChatSession.model");
const ChatMessage_model_1 = require("../../models/ChatMessage.model");
const chatContext_service_1 = require("./chatContext.service");
class ChatService {
    static ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    static modelName = process.env.OLLAMA_MODEL || 'gpt-oss:20b-cloud';
    static timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '90000', 10);
    /**
     * Create a new chat session
     */
    static async createSession(userId, title) {
        const session = await ChatSession_model_1.ChatSession.create({
            userId: userId ? new mongoose_1.default.Types.ObjectId(userId) : undefined,
            title: title || 'New Financial Research',
            lastMessageAt: new Date(),
        });
        return session;
    }
    /**
     * List all sessions
     */
    static async listSessions(userId) {
        const query = {};
        if (userId) {
            query.userId = new mongoose_1.default.Types.ObjectId(userId);
        }
        return ChatSession_model_1.ChatSession.find(query).sort({ pinned: -1, lastMessageAt: -1 }).limit(50).lean();
    }
    /**
     * Get session by ID
     */
    static async getSession(sessionId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(sessionId))
            return null;
        return ChatSession_model_1.ChatSession.findById(sessionId);
    }
    /**
     * Get all messages for a session
     */
    static async getSessionMessages(sessionId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(sessionId))
            return [];
        return ChatMessage_model_1.ChatMessage.find({ sessionId: new mongoose_1.default.Types.ObjectId(sessionId) })
            .sort({ createdAt: 1 })
            .lean();
    }
    /**
     * Delete a session and its associated messages
     */
    static async deleteSession(sessionId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(sessionId))
            return false;
        const sessionObjId = new mongoose_1.default.Types.ObjectId(sessionId);
        await Promise.all([
            ChatSession_model_1.ChatSession.findByIdAndDelete(sessionObjId),
            ChatMessage_model_1.ChatMessage.deleteMany({ sessionId: sessionObjId }),
        ]);
        return true;
    }
    /**
     * Send a chat message, orchestrating context retrieval, LLM inference, and persistence
     */
    static async processUserMessage(params) {
        const { sessionId, message, userId } = params;
        // 1. Resolve or create chat session
        let session = null;
        if (sessionId && mongoose_1.default.Types.ObjectId.isValid(sessionId)) {
            session = await ChatSession_model_1.ChatSession.findById(sessionId);
        }
        if (!session) {
            // Generate clean session title from query (max 40 chars)
            const cleanTitle = message.trim().replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 45);
            session = await this.createSession(userId, cleanTitle || 'Market Research');
        }
        // 2. Fetch recent conversation history to maintain context
        const recentHistory = await ChatMessage_model_1.ChatMessage.find({ sessionId: session._id })
            .sort({ createdAt: -1 })
            .limit(6)
            .lean();
        recentHistory.reverse();
        // Collect recent symbols mentioned in previous turns
        const recentSymbols = [];
        for (const h of recentHistory) {
            if (h.referencedSymbols && h.referencedSymbols.length > 0) {
                recentSymbols.push(...h.referencedSymbols);
            }
        }
        // 3. Save User Message
        const userMsgDoc = await ChatMessage_model_1.ChatMessage.create({
            sessionId: session._id,
            role: 'user',
            content: message,
            referencedSymbols: [],
            stockSnapshots: [],
            evidence: [],
            newsHighlights: [],
        });
        // 4. Assemble Grounded Context (Live Quotes + Vector Evidence + News)
        const context = await chatContext_service_1.ChatContextService.assembleContext(message, recentSymbols);
        // 5. Generate LLM Response with fallback
        let responseText = '';
        let modelUsed = this.modelName;
        try {
            const historyPrompt = recentHistory
                .map((h) => `${h.role === 'user' ? 'Investor' : 'AssetMind AI'}: ${h.content}`)
                .join('\n\n');
            const fullPrompt = `${context.contextText ? `=== RETRIEVED FINANCIAL CONTEXT ===\n${context.contextText}\n\n` : ''}${historyPrompt ? `=== CONVERSATION HISTORY ===\n${historyPrompt}\n\n` : ''}=== CURRENT USER QUESTION ===\nInvestor: ${message}\n\nAssetMind AI:`;
            const llmRes = await axios_1.default.post(`${this.ollamaUrl}/api/generate`, {
                model: this.modelName,
                prompt: fullPrompt,
                system: context.systemPrompt,
                stream: false,
                options: {
                    temperature: 0.25,
                    top_p: 0.9,
                    num_predict: 1200,
                },
            }, { timeout: this.timeoutMs });
            if (llmRes.data && llmRes.data.response) {
                responseText = llmRes.data.response.trim();
            }
        }
        catch (err) {
            console.warn(`[ChatService] Ollama chat inference unavailable (${err.message}). Using grounded synthesis.`);
            modelUsed = 'AssetMind-Grounded-Synthesizer';
            responseText = this.synthesizeGroundedResponse(message, context);
        }
        // 6. Save Assistant Response
        const assistantMsgDoc = await ChatMessage_model_1.ChatMessage.create({
            sessionId: session._id,
            role: 'assistant',
            content: responseText,
            referencedSymbols: context.detectedSymbols,
            stockSnapshots: context.stockSnapshots,
            evidence: context.evidence,
            newsHighlights: context.newsHighlights,
            modelUsed,
            confidenceScore: context.evidence.length > 0 ? 0.95 : 0.88,
        });
        // 7. Update Session metadata
        session.lastMessage = responseText.slice(0, 90) + (responseText.length > 90 ? '...' : '');
        session.lastMessageAt = new Date();
        await session.save();
        return {
            session,
            userMessage: userMsgDoc,
            assistantMessage: assistantMsgDoc,
        };
    }
    /**
     * Grounded synthesizer if Ollama is offline or times out
     */
    static synthesizeGroundedResponse(query, context) {
        const { detectedSymbols, stockSnapshots, evidence, newsHighlights } = context;
        if (stockSnapshots.length === 0 && evidence.length === 0) {
            return `I analyzed your query: **"${query}"**.\n\nTo provide comprehensive financial research grounded in verified filings and live market data, please specify an Indian company symbol or ticker (e.g., **TCS**, **INFY**, **RELIANCE**, **TATAMOTORS**, **HDFCBANK**, or **ADANIENT**). You can also ask about financial ratios, valuation multiples, or risk assessments.`;
        }
        const sections = [];
        // Header / Executive Summary
        if (stockSnapshots.length > 0) {
            const primaryStock = stockSnapshots[0];
            const sign = primaryStock.change >= 0 ? '+' : '';
            sections.push(`### 📊 Market Intelligence: **${primaryStock.companyName} (${primaryStock.symbol})**\n\n` +
                `**Live Price:** ₹${primaryStock.price.toFixed(2)} (${sign}${primaryStock.changePercent.toFixed(2)}%) | ` +
                `**P/E Ratio:** ${primaryStock.pe ? primaryStock.pe.toFixed(1) : 'N/A'} | ` +
                `**52W Range:** ₹${primaryStock.low52 ?? 'N/A'} – ₹${primaryStock.high52 ?? 'N/A'} [Live ${primaryStock.source}]`);
        }
        // Valuation & Multi-Stock comparison
        if (stockSnapshots.length > 1) {
            sections.push(`#### ⚖️ Relative Valuation Comparison\n` +
                stockSnapshots
                    .map((s) => `- **${s.symbol}**: ₹${s.price.toFixed(2)} (${s.change >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%) | P/E: ${s.pe ? s.pe.toFixed(1) : 'N/A'} | 52W High: ₹${s.high52 ?? 'N/A'}`)
                    .join('\n'));
        }
        // Filing Evidence
        if (evidence.length > 0) {
            sections.push(`#### 📑 Verified Vector Filing Evidence (RAG Audit)\n` +
                evidence
                    .slice(0, 3)
                    .map((e) => {
                    const snippet = e.text.slice(0, 280).replace(/\n+/g, ' ');
                    return `> **[Source: ${e.source} (${e.reportingPeriod})]**\n> ${snippet}...`;
                })
                    .join('\n\n'));
        }
        // News
        if (newsHighlights.length > 0) {
            sections.push(`#### 📰 Market Catalysts & Recent Developments\n` +
                newsHighlights
                    .slice(0, 2)
                    .map((n) => `- **${n.title}** _(${n.source})_ — Sentiment: **${n.sentiment?.toUpperCase() || 'NEUTRAL'}**`)
                    .join('\n'));
        }
        // Strategic takeaway
        sections.push(`#### 💡 Strategic Analyst Takeaway\n` +
            `Based on verified market data and filed disclosures, investors should evaluate cash flow stability, debt coverage, and sector headwinds before adjusting allocation sizes. Review the embedded interactive quote card and evidence citations below for granular verification.`);
        return sections.join('\n\n');
    }
}
exports.ChatService = ChatService;
//# sourceMappingURL=chat.service.js.map