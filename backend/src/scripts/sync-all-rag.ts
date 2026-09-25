import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { RagSyncService } from '../modules/rag/services/ragSync.service';
import { QdrantService } from '../modules/rag/services/qdrant.service';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/assetmind_ai';

async function syncAll() {
  console.log('\n===============================================================');
  console.log('🔄 ASSETMIND AI: FULL RAG VECTOR REINDEXING SCRIPT');
  console.log('===============================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log(`[Database] Connected to MongoDB: ${MONGODB_URI}`);

  try {
    const summary = await RagSyncService.syncAllAssets();
    console.log('\n---------------------------------------------------------------');
    console.log('📊 REINDEXING SUMMARY:');
    console.log(`   • Total Assets Processed: ${summary.totalAssets}`);
    console.log(`   • Assets Successfully Indexed: ${summary.indexedCount}`);
    console.log(`   • Total Vector Chunks Created: ${summary.totalChunks}`);
    console.log('---------------------------------------------------------------');

    const stats = await QdrantService.getInstance().getStats();
    console.log(`[Qdrant] Collection Status: ${stats.status}, Total Points: ${stats.pointsCount}`);
  } finally {
    await mongoose.disconnect();
    console.log('[Database] Disconnected from MongoDB.');
  }
}

syncAll().catch((err) => {
  console.error('Reindexing script error:', err);
  process.exit(1);
});
