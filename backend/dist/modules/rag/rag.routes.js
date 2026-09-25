"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragRoutes = void 0;
const express_1 = require("express");
const rag_controller_1 = require("./rag.controller");
const router = (0, express_1.Router)();
// A. Index Financial Data
router.post('/index', rag_controller_1.RagController.indexFinancialData);
// B. Reindex Financial Data
router.post('/reindex', rag_controller_1.RagController.reindexFinancialData);
// C. Search Financial Knowledge
router.post('/search', rag_controller_1.RagController.searchFinancialKnowledge);
// D. RAG Question Answering
router.post('/query', rag_controller_1.RagController.queryRagAnswer);
// Stats & Monitoring
router.get('/stats', rag_controller_1.RagController.getCollectionStats);
exports.ragRoutes = router;
//# sourceMappingURL=rag.routes.js.map