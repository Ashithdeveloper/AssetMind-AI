"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialRelevanceReranker = void 0;
const hybridRetrieval_service_1 = require("./hybridRetrieval.service");
class FinancialRelevanceReranker {
    /**
     * Re-ranks retrieved chunks based on financial relevance, metric prominence, recency, and deduplication
     */
    async rerank(query, targetSymbol, results, topK = 5) {
        if (!results || results.length === 0)
            return [];
        const cleanSymbol = targetSymbol.trim().toUpperCase();
        const cleanQuery = query.toLowerCase();
        const extractedKeywords = hybridRetrieval_service_1.HybridRetrievalService.extractFinancialKeywords(query);
        // 1. Strict Asset Isolation: Filter out any items that don't match targetSymbol
        const assetMatched = results.filter((r) => r.symbol.toUpperCase() === cleanSymbol);
        // 2. Score adjustments per chunk
        const scoredList = [];
        for (const item of assetMatched) {
            const contentLower = item.content.toLowerCase();
            let metricBoost = 0;
            let recencyBoost = 0;
            const explanations = [];
            // A. Metric relevance
            let matchedMetricsCount = 0;
            for (const kw of extractedKeywords) {
                if (contentLower.includes(kw)) {
                    matchedMetricsCount++;
                }
            }
            if (matchedMetricsCount > 0) {
                metricBoost = Math.min(1.0, matchedMetricsCount * 0.35);
                explanations.push(`Contains ${matchedMetricsCount} query financial terms`);
            }
            // Check for specific document type alignment
            if (cleanQuery.includes('cash flow') && item.documentType === 'financial_statement') {
                metricBoost += 0.25;
                explanations.push('Document type matches cash flow query');
            }
            else if ((cleanQuery.includes('ratio') || cleanQuery.includes('valuation') || cleanQuery.includes('pe')) && item.documentType === 'financial_ratios') {
                metricBoost += 0.25;
                explanations.push('Matches financial ratios query');
            }
            else if ((cleanQuery.includes('price') || cleanQuery.includes('trading') || cleanQuery.includes('stock')) && item.documentType === 'stock_price_history') {
                metricBoost += 0.25;
                explanations.push('Matches stock price history query');
            }
            else if ((cleanQuery.includes('trend') || cleanQuery.includes('history') || cleanQuery.includes('changed') || cleanQuery.includes('growth')) && item.documentType === 'historical_performance') {
                metricBoost += 0.25;
                explanations.push('Matches historical performance query');
            }
            // B. Reporting Period Recency / Query Period Match
            const period = item.reportingPeriod?.toUpperCase() || '';
            // If user query mentions a specific year (e.g. 2024, 2023), reward exact match
            const yearMatch = cleanQuery.match(/\b(202\d)\b/);
            if (yearMatch && period.includes(yearMatch[1])) {
                recencyBoost = 0.4;
                explanations.push(`Direct match for requested year ${yearMatch[1]}`);
            }
            else if (period === 'TTM' || period === 'CURRENT' || period === 'LATEST') {
                recencyBoost = 0.3;
                explanations.push('Latest TTM/Current period prioritized');
            }
            else if (period.includes('2025') || period.includes('2024')) {
                recencyBoost = 0.2;
                explanations.push('Recent fiscal period prioritized');
            }
            // C. Base score weighting
            const baseScore = item.score || 0;
            const finalScore = Number((baseScore * 0.45 + metricBoost * 0.35 + recencyBoost * 0.20).toFixed(4));
            scoredList.push({
                ...item,
                rerankScore: finalScore,
                relevanceExplanation: explanations.join('; ') || 'Standard relevance score',
            });
        }
        // 3. Sort by rerankScore descending
        scoredList.sort((a, b) => b.rerankScore - a.rerankScore);
        // 4. Deduplication: remove chunks that have excessive text overlap with higher-ranked chunks
        const deduplicated = [];
        for (const candidate of scoredList) {
            const isDuplicate = deduplicated.some((accepted) => {
                return this.computeTextSimilarity(accepted.content, candidate.content) > 0.85;
            });
            if (!isDuplicate) {
                deduplicated.push(candidate);
            }
        }
        return deduplicated.slice(0, topK);
    }
    /**
     * Simple character Jaccard / token overlap similarity to detect near-duplicate evidence chunks
     */
    computeTextSimilarity(textA, textB) {
        const tokensA = new Set(textA.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
        const tokensB = new Set(textB.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
        if (tokensA.size === 0 || tokensB.size === 0)
            return 0;
        let intersectionCount = 0;
        for (const t of tokensA) {
            if (tokensB.has(t))
                intersectionCount++;
        }
        const unionCount = new Set([...Array.from(tokensA), ...Array.from(tokensB)]).size;
        return unionCount === 0 ? 0 : intersectionCount / unionCount;
    }
}
exports.FinancialRelevanceReranker = FinancialRelevanceReranker;
//# sourceMappingURL=reranking.service.js.map