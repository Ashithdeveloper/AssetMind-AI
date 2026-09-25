"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceContextBuilderService = void 0;
const hybridRetrieval_service_1 = require("./hybridRetrieval.service");
class EvidenceContextBuilderService {
    static defaultMaxTokens = 3000;
    /**
     * Constructs the structured evidence context for LLM ingestion
     */
    static buildContext(query, targetSymbol, companyName, evidenceChunks, options) {
        const maxTokens = options?.maxContextTokens || this.defaultMaxTokens;
        const maxChars = maxTokens * 4;
        const cleanSymbol = targetSymbol.toUpperCase();
        const cleanCompany = companyName || cleanSymbol;
        const sourcesMap = new Map();
        const evidenceSnippets = [];
        let latestTimestamp = null;
        // Check for potential missing metrics
        const queryKeywords = hybridRetrieval_service_1.HybridRetrievalService.extractFinancialKeywords(query);
        const missingMetrics = [];
        // Format individual evidence blocks
        const formattedEvidenceBlocks = [];
        let currentTotalChars = 0;
        for (let i = 0; i < evidenceChunks.length; i++) {
            const chunk = evidenceChunks[i];
            // Track provenance
            const srcKey = `${chunk.source}_${chunk.reportingPeriod}`;
            if (!sourcesMap.has(srcKey)) {
                sourcesMap.set(srcKey, {
                    source: chunk.source,
                    sourceUrl: chunk.sourceUrl,
                    reportingPeriod: chunk.reportingPeriod,
                    timestamp: chunk.dataTimestamp,
                });
            }
            // Track freshness
            if (chunk.dataTimestamp) {
                if (!latestTimestamp || new Date(chunk.dataTimestamp) > new Date(latestTimestamp)) {
                    latestTimestamp = chunk.dataTimestamp;
                }
            }
            const snippet = {
                chunkId: chunk.chunkId,
                documentType: chunk.documentType,
                reportingPeriod: chunk.reportingPeriod,
                source: chunk.source,
                timestamp: chunk.dataTimestamp,
                text: chunk.content,
            };
            evidenceSnippets.push(snippet);
            const blockText = [
                `### Evidence Block #${i + 1}`,
                `- **Document Category:** ${chunk.documentType}`,
                `- **Fiscal / Reporting Period:** ${chunk.reportingPeriod}`,
                `- **Primary Source:** ${chunk.source}${chunk.sourceUrl ? ` (${chunk.sourceUrl})` : ''}`,
                `- **Recorded Timestamp:** ${chunk.dataTimestamp}`,
                `- **Verified Evidence Text:**`,
                chunk.content,
            ].join('\n');
            if (currentTotalChars + blockText.length > maxChars && formattedEvidenceBlocks.length > 0) {
                // Enforce context window limit
                break;
            }
            formattedEvidenceBlocks.push(blockText);
            currentTotalChars += blockText.length;
        }
        // Verify which query keywords were not found in any chunk
        const allText = evidenceChunks.map((c) => c.content.toLowerCase()).join(' ');
        for (const kw of queryKeywords) {
            if (!allText.includes(kw.toLowerCase())) {
                missingMetrics.push(kw);
            }
        }
        // Assemble the complete prompt context
        const contextLines = [
            `=== TARGET ASSET IDENTITY ===`,
            `Symbol: ${cleanSymbol}`,
            `Company Name: ${cleanCompany}`,
            `Domain: Equity / Stock Financial Data`,
            '',
            `=== USER INQUIRY ===`,
            query,
            '',
            `=== VERIFIED FINANCIAL EVIDENCE (${formattedEvidenceBlocks.length} records retrieved) ===`,
            formattedEvidenceBlocks.length > 0
                ? formattedEvidenceBlocks.join('\n\n---\n\n')
                : 'NO DIRECT FINANCIAL RECORDS FOUND FOR THIS QUERY.',
            '',
            `=== PROVENANCE & FRESHNESS SUMMARY ===`,
            `Data Freshness (Latest Record): ${latestTimestamp || 'N/A'}`,
            `Unique Verified Sources: ${Array.from(sourcesMap.values()).map((s) => s.source).join(', ') || 'N/A'}`,
        ];
        if (missingMetrics.length > 0) {
            contextLines.push('', `=== NOTED MISSING INFORMATION ===`, `The following metrics or terms mentioned in the query were not present in the indexed database: ${missingMetrics.join(', ')}. If the user asked specifically about these missing metrics, explicitly declare that data for them is unavailable in the database.`);
        }
        return {
            query,
            targetSymbol: cleanSymbol,
            companyName: cleanCompany,
            retrievedCount: formattedEvidenceBlocks.length,
            evidenceSnippets,
            formattedContext: contextLines.join('\n'),
            dataFreshness: latestTimestamp,
            sources: Array.from(sourcesMap.values()),
        };
    }
}
exports.EvidenceContextBuilderService = EvidenceContextBuilderService;
//# sourceMappingURL=evidenceContext.service.js.map