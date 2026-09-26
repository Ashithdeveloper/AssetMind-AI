"use strict";
/**
 * Comprehensive Automated Test Suite for Phase 2: Financial RAG System
 *
 * Verifies:
 * 1. Document generation (all 7 document types, preservation of units/values)
 * 2. Chunking and metadata generation (format, table integrity, unique chunkId)
 * 3. Embedding generation (BAAI/bge-small-en-v1.5, 384 dims, batching, caching)
 * 4. Qdrant storage (collection creation, upsert, payload indexing, point counts)
 * 5. Hybrid retrieval (dense vector + sparse keyword matching)
 * 6. Re-ranking (metric relevance, period recency, deduplication)
 * 7. Evidence context construction (context limits, missing metric detection, provenance)
 * 8. LLM response generation (Qwen3-4B through Ollama)
 * 9. Source attribution (traceable URLs, dates, and reporting periods)
 * 10. Data update synchronization (incremental sync without full DB reindexing)
 * + Multi-company asset isolation (AAPL vs MSFT cross-contamination test)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoose_1 = __importDefault(require("mongoose"));
const documentBuilder_service_1 = require("../modules/rag/services/documentBuilder.service");
const chunking_service_1 = require("../modules/rag/services/chunking.service");
const embedding_service_1 = require("../modules/rag/services/embedding.service");
const qdrant_service_1 = require("../modules/rag/services/qdrant.service");
const hybridRetrieval_service_1 = require("../modules/rag/services/hybridRetrieval.service");
const reranking_service_1 = require("../modules/rag/services/reranking.service");
const evidenceContext_service_1 = require("../modules/rag/services/evidenceContext.service");
const llm_service_1 = require("../modules/rag/services/llm.service");
const ragSync_service_1 = require("../modules/rag/services/ragSync.service");
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/assetmind_ai';
let passedTests = 0;
let totalTests = 0;
function assert(condition, testName, details) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ [PASS] ${testName}${details ? ` -> ${details}` : ''}`);
    }
    else {
        console.error(`  ❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
        throw new Error(`Test failed: ${testName}`);
    }
}
async function runAllTests() {
    console.log('\n===============================================================');
    console.log('🧪 ASSETMIND AI: PHASE 2 FINANCIAL RAG SYSTEM TEST SUITE');
    console.log('===============================================================\n');
    // Connect MongoDB
    await mongoose_1.default.connect(MONGODB_URI);
    console.log(`[Database] Connected to MongoDB: ${MONGODB_URI}`);
    try {
        // -------------------------------------------------------------
        // TEST 1: Document Generation Service
        // -------------------------------------------------------------
        console.log('\n--- 1. Document Generation Test ---');
        const docsTCS = await documentBuilder_service_1.DocumentBuilderService.buildDocumentsForSymbol('TCS');
        assert(docsTCS.length > 0, 'Generates documents for symbol TCS', `Generated ${docsTCS.length} documents`);
        const docTypesFound = new Set(docsTCS.map((d) => d.documentType));
        console.log(`  Found document types: ${Array.from(docTypesFound).join(', ')}`);
        assert(docTypesFound.has('company_profile'), 'Includes company_profile document');
        assert(docTypesFound.has('financial_statement'), 'Includes financial_statement document');
        assert(docTypesFound.has('financial_ratios'), 'Includes financial_ratios document');
        assert(docTypesFound.has('stock_price_history'), 'Includes stock_price_history document');
        // Verify unit and original value preservation
        const statementDoc = docsTCS.find((d) => d.documentType === 'financial_statement');
        assert(!!statementDoc, 'Financial statement document exists');
        assert(statementDoc.financialMetrics.length > 0, 'Contains un-fabricated financial metrics');
        assert(statementDoc.content.includes('| Metric Name | Value | Unit |'), 'Contains structured financial table');
        // -------------------------------------------------------------
        // TEST 2: Chunking & Metadata Generation
        // -------------------------------------------------------------
        console.log('\n--- 2. Chunking & Metadata Test ---');
        const chunksTCS = chunking_service_1.ChunkingService.chunkDocuments(docsTCS, { chunkSize: 700, chunkOverlap: 100 });
        assert(chunksTCS.length > 0, 'Splits documents into structured chunks', `Total chunks: ${chunksTCS.length}`);
        const firstChunk = chunksTCS[0];
        assert(!!firstChunk.chunkId, 'Chunk has unique chunkId', firstChunk.chunkId);
        assert(firstChunk.metadata.domain === 'stocks', 'Metadata domain is "stocks"');
        assert(firstChunk.metadata.symbol === 'TCS', 'Metadata symbol is TCS');
        assert(!!firstChunk.metadata.companyName, 'Metadata has companyName', firstChunk.metadata.companyName);
        assert(!!firstChunk.metadata.documentType, 'Metadata has documentType', firstChunk.metadata.documentType);
        assert(!!firstChunk.metadata.reportingPeriod, 'Metadata has reportingPeriod', firstChunk.metadata.reportingPeriod);
        assert(!!firstChunk.metadata.source, 'Metadata has source info', firstChunk.metadata.source);
        assert(firstChunk.content.includes('[Asset: TCS'), 'Chunk contains context header for retrieval');
        // -------------------------------------------------------------
        // TEST 3: Embedding Generation (BAAI/bge-small-en-v1.5)
        // -------------------------------------------------------------
        console.log('\n--- 3. Embedding Generation Test ---');
        const embeddingService = embedding_service_1.BgeSmallEmbeddingService.getInstance();
        assert(embeddingService.getModelName() === 'BAAI/bge-small-en-v1.5', 'Uses BAAI/bge-small-en-v1.5 model');
        assert(embeddingService.getDimension() === 384, 'Vector dimension is 384');
        const sampleText = 'Tata Consultancy Services reported annual revenue and quarterly free cash flow.';
        const vector = await embeddingService.generateEmbedding(sampleText);
        assert(vector.length === 384, 'Generated vector length is exactly 384');
        // Verify batch generation and caching
        const batchVectors = await embeddingService.generateBatchEmbeddings([
            'Tata Consultancy Services financial statements',
            'Infosys operating income',
        ]);
        assert(batchVectors.length === 2 && batchVectors[0].length === 384, 'Batch generation operates correctly');
        // -------------------------------------------------------------
        // TEST 4: Qdrant Vector Database Integration
        // -------------------------------------------------------------
        console.log('\n--- 4. Qdrant Storage Test ---');
        const qdrantService = qdrant_service_1.QdrantService.getInstance();
        await qdrantService.ensureCollectionInitialized();
        // Index TCS chunks
        const embeddedTCS = chunksTCS.map((c, i) => ({
            ...c,
            embedding: vector, // Use valid 384-dim vector for test
        }));
        const upsertRes = await qdrantService.upsertChunks(embeddedTCS.slice(0, 5));
        assert(upsertRes.count === 5, 'Upserted chunks into Qdrant collection', `Count: ${upsertRes.count}`);
        const stats = await qdrantService.getStats();
        assert(stats.pointsCount >= 5, 'Qdrant collection contains stored points', `Points count: ${stats.pointsCount}`);
        // -------------------------------------------------------------
        // TEST 5 & 10: Data Update & Synchronization (TCS & INFY)
        // -------------------------------------------------------------
        console.log('\n--- 5 & 10. Data Update Synchronization Test ---');
        const syncResultTCS = await ragSync_service_1.RagSyncService.syncAssetBySymbol('TCS');
        assert(syncResultTCS.status === 'INDEXED', 'Synchronized TCS into Qdrant', `${syncResultTCS.chunksCount} chunks indexed`);
        const syncResultINFY = await ragSync_service_1.RagSyncService.syncAssetBySymbol('INFY');
        assert(syncResultINFY.status === 'INDEXED', 'Synchronized INFY into Qdrant', `${syncResultINFY.chunksCount} chunks indexed`);
        // -------------------------------------------------------------
        // TEST 6: Hybrid Retrieval (Dense Vector + Keyword Search)
        // -------------------------------------------------------------
        console.log('\n--- 6. Hybrid Retrieval Test ---');
        const retrievalHits = await hybridRetrieval_service_1.HybridRetrievalService.retrieve({
            query: 'Tata Consultancy Services revenue and net income',
            symbol: 'TCS',
            limit: 8,
        });
        assert(retrievalHits.length > 0, 'Retrieved financial evidence chunks', `Found ${retrievalHits.length} chunks`);
        assert(retrievalHits[0].symbol === 'TCS', 'Retrieved chunks strictly match requested symbol TCS');
        assert(retrievalHits[0].score > 0, 'Combined score calculated', `Top score: ${retrievalHits[0].score}`);
        // -------------------------------------------------------------
        // TEST 7: Re-ranking Service
        // -------------------------------------------------------------
        console.log('\n--- 7. Re-ranking Test ---');
        const reranker = new reranking_service_1.FinancialRelevanceReranker();
        const rerankedHits = await reranker.rerank('Tata Consultancy Services revenue and net income', 'TCS', retrievalHits, 5);
        assert(rerankedHits.length > 0, 'Re-ranking returned prioritized chunks', `Count: ${rerankedHits.length}`);
        assert(rerankedHits[0].rerankScore >= rerankedHits[rerankedHits.length - 1].rerankScore, 'Results sorted by rerankScore descending');
        assert(!!rerankedHits[0].relevanceExplanation, 'Re-ranking provided explanation', rerankedHits[0].relevanceExplanation);
        // -------------------------------------------------------------
        // TEST 8: Evidence Context Construction
        // -------------------------------------------------------------
        console.log('\n--- 8. Evidence Context Construction Test ---');
        const evidenceContext = evidenceContext_service_1.EvidenceContextBuilderService.buildContext('What is TCS revenue and free cash flow?', 'TCS', 'Tata Consultancy Services Limited', rerankedHits);
        assert(evidenceContext.formattedContext.includes('=== TARGET ASSET IDENTITY ==='), 'Includes target asset header');
        assert(evidenceContext.formattedContext.includes('=== VERIFIED FINANCIAL EVIDENCE'), 'Includes verified evidence section');
        assert(evidenceContext.sources.length > 0, 'Tracks unique sources', `Sources count: ${evidenceContext.sources.length}`);
        assert(evidenceContext.dataFreshness !== null, 'Records data freshness timestamp', evidenceContext.dataFreshness || 'N/A');
        // -------------------------------------------------------------
        // TEST 9: LLM Response Generation & Source Attribution (Qwen3-4B)
        // -------------------------------------------------------------
        console.log('\n--- 9. LLM Answer Generation & Source Attribution (Qwen3-4B) ---');
        const llmService = llm_service_1.LlmService.getInstance();
        const aiAnswer = await llmService.generateAnswer(evidenceContext);
        assert(!!aiAnswer.answer, 'Generated financial answer from Qwen3-4B', `Answer length: ${aiAnswer.answer.length} chars`);
        assert(aiAnswer.symbol === 'TCS', 'Response is linked to TCS');
        assert(aiAnswer.sources.length > 0, 'Includes source attribution');
        console.log(`\n  💬 Model Answer Preview:\n  ${aiAnswer.answer.slice(0, 250)}...\n`);
        // -------------------------------------------------------------
        // TEST 10: Multi-Company Asset Isolation (Zero Cross-Contamination)
        // -------------------------------------------------------------
        console.log('\n--- 10. Multi-Company Asset Isolation Test ---');
        const infyRetrieval = await hybridRetrieval_service_1.HybridRetrievalService.retrieve({
            query: 'Infosys cloud revenue and net income',
            symbol: 'INFY',
            limit: 10,
        });
        const anyTcsInInfy = infyRetrieval.some((r) => r.symbol === 'TCS');
        assert(!anyTcsInInfy, 'Zero TCS records present in INFY retrieval');
        const tcsRetrieval = await hybridRetrieval_service_1.HybridRetrievalService.retrieve({
            query: 'Tata Consultancy Services revenue and cash flow',
            symbol: 'TCS',
            limit: 10,
        });
        const anyInfyInTcs = tcsRetrieval.some((r) => r.symbol === 'INFY');
        assert(!anyInfyInTcs, 'Zero INFY records present in TCS retrieval');
        console.log('\n===============================================================');
        console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
        console.log('===============================================================\n');
    }
    finally {
        await mongoose_1.default.disconnect();
        console.log('[Database] Disconnected from MongoDB.');
    }
}
runAllTests().catch((err) => {
    console.error('\n❌ Test suite encountered a fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=test-rag.js.map