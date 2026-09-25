"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoose_1 = __importDefault(require("mongoose"));
const ragSync_service_1 = require("../modules/rag/services/ragSync.service");
const qdrant_service_1 = require("../modules/rag/services/qdrant.service");
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/assetmind_ai';
async function syncAll() {
    console.log('\n===============================================================');
    console.log('🔄 ASSETMIND AI: FULL RAG VECTOR REINDEXING SCRIPT');
    console.log('===============================================================\n');
    await mongoose_1.default.connect(MONGODB_URI);
    console.log(`[Database] Connected to MongoDB: ${MONGODB_URI}`);
    try {
        const summary = await ragSync_service_1.RagSyncService.syncAllAssets();
        console.log('\n---------------------------------------------------------------');
        console.log('📊 REINDEXING SUMMARY:');
        console.log(`   • Total Assets Processed: ${summary.totalAssets}`);
        console.log(`   • Assets Successfully Indexed: ${summary.indexedCount}`);
        console.log(`   • Total Vector Chunks Created: ${summary.totalChunks}`);
        console.log('---------------------------------------------------------------');
        const stats = await qdrant_service_1.QdrantService.getInstance().getStats();
        console.log(`[Qdrant] Collection Status: ${stats.status}, Total Points: ${stats.pointsCount}`);
    }
    finally {
        await mongoose_1.default.disconnect();
        console.log('[Database] Disconnected from MongoDB.');
    }
}
syncAll().catch((err) => {
    console.error('Reindexing script error:', err);
    process.exit(1);
});
//# sourceMappingURL=sync-all-rag.js.map