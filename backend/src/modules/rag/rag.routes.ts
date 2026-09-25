import { Router } from 'express';
import { RagController } from './rag.controller';

const router = Router();

// A. Index Financial Data
router.post('/index', RagController.indexFinancialData);

// B. Reindex Financial Data
router.post('/reindex', RagController.reindexFinancialData);

// C. Search Financial Knowledge
router.post('/search', RagController.searchFinancialKnowledge);

// D. RAG Question Answering
router.post('/query', RagController.queryRagAnswer);

// Stats & Monitoring
router.get('/stats', RagController.getCollectionStats);

export const ragRoutes = router;
