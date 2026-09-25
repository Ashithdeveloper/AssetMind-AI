"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("../app");
const axios_1 = __importDefault(require("axios"));
const PORT = 5002;
const BASE_URL = `http://localhost:${PORT}/api/rag`;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/assetmind_ai';
async function runDemo() {
    console.log('\n===============================================================');
    console.log('🚀 ASSETMIND AI: PHASE 2 FINANCIAL RAG LIVE API DEMONSTRATION');
    console.log('===============================================================\n');
    await mongoose_1.default.connect(MONGODB_URI);
    console.log(`[Database] Connected to MongoDB: ${MONGODB_URI}`);
    const app = (0, app_1.createApp)();
    const server = await new Promise((resolve) => {
        const s = app.listen(PORT, () => {
            console.log(`[Server] Live test server listening on port ${PORT}`);
            resolve(s);
        });
    });
    try {
        // 1. Check Health & RAG Status
        console.log('\n--- 1. Testing GET /api/health ---');
        const healthRes = await axios_1.default.get(`http://localhost:${PORT}/api/health`);
        console.log('Health Response:', healthRes.data);
        // 2. Check Qdrant Stats
        console.log('\n--- 2. Testing GET /api/rag/stats ---');
        const statsRes = await axios_1.default.get(`${BASE_URL}/stats`);
        console.log('Stats Response:', statsRes.data);
        // 3. Index Financial Data for AAPL
        console.log('\n--- 3. Testing POST /api/rag/index (AAPL) ---');
        const indexRes = await axios_1.default.post(`${BASE_URL}/index`, { symbol: 'AAPL' });
        console.log('Index Response:', indexRes.data);
        // 4. Search Financial Knowledge (Hybrid Retrieval & Re-ranking)
        console.log('\n--- 4. Testing POST /api/rag/search ("Apple free cash flow") ---');
        const searchRes = await axios_1.default.post(`${BASE_URL}/search`, {
            query: 'Apple free cash flow and revenue',
            symbol: 'AAPL',
            limit: 3,
        });
        console.log(`Retrieved ${searchRes.data.data.count} chunks. Top chunk preview:`);
        if (searchRes.data.data.results.length > 0) {
            const top = searchRes.data.data.results[0];
            console.log(`  • Symbol: ${top.symbol} | DocType: ${top.documentType} | Period: ${top.reportingPeriod}`);
            console.log(`  • Rerank Score: ${top.rerankScore} | Combined Score: ${top.score}`);
            console.log(`  • Explanation: ${top.relevanceExplanation}`);
        }
        // 5. Full RAG Question Answering (Qwen3-4B Inference)
        console.log('\n--- 5. Testing POST /api/rag/query (Full RAG QA) ---');
        const queryRes = await axios_1.default.post(`${BASE_URL}/query`, {
            query: "What is Apple's financial position and latest revenue?",
            symbol: 'AAPL',
        });
        console.log('\n===============================================================');
        console.log('📑 STRUCTURED AI ANSWER:');
        console.log('===============================================================');
        console.log(`Symbol:         ${queryRes.data.data.symbol}`);
        console.log(`Data Freshness: ${queryRes.data.data.dataFreshness}`);
        console.log(`Sources:        ${queryRes.data.data.sources.map((s) => `${s.source} (${s.reportingPeriod || 'N/A'})`).join(', ')}`);
        console.log('\nEvidence Snippets:');
        queryRes.data.data.evidence.forEach((e, i) => console.log(`  [${i + 1}] ${e}`));
        console.log('\nAI Answer:');
        console.log(queryRes.data.data.answer);
        console.log('===============================================================\n');
    }
    finally {
        server.close();
        await mongoose_1.default.disconnect();
        console.log('[Server & Database] Shutdown cleanly.');
    }
}
runDemo().catch((err) => {
    console.error('Demo encountered error:', err.response?.data || err.message);
    process.exit(1);
});
//# sourceMappingURL=demo-rag-api.js.map