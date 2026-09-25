"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const Asset_model_1 = require("../models/Asset.model");
const FinancialData_model_1 = require("../models/FinancialData.model");
const companies_catalog_1 = require("../config/companies.catalog");
const company_service_1 = require("../modules/companies/company.service");
const liveQuote_service_1 = require("../modules/realtime/liveQuote.service");
const ragSync_service_1 = require("../modules/rag/services/ragSync.service");
// Correct metadata fixes for international companies previously mislabeled
const ASSET_OVERRIDES = {
    '005930.KS': { companyName: 'Samsung Electronics', country: 'South Korea', sector: 'Technology', industry: 'Consumer Electronics & Semiconductors', exchange: 'KRX' },
    '000660.KS': { companyName: 'SK Hynix', country: 'South Korea', sector: 'Technology', industry: 'Memory Semiconductors', exchange: 'KRX' },
    '2222.SR': { companyName: 'Saudi Aramco', country: 'Saudi Arabia', sector: 'Energy', industry: 'Oil & Gas Production', exchange: 'Tadawul' },
    'TSM': { companyName: 'Taiwan Semiconductor Manufacturing Co (TSMC)', country: 'Taiwan', sector: 'Technology', industry: 'Semiconductor Foundry', exchange: 'NYSE' },
    'ASML': { companyName: 'ASML Holding N.V.', country: 'Netherlands', sector: 'Technology', industry: 'Semiconductor Lithography', exchange: 'NASDAQ' },
    '688825.SS': { companyName: 'CXMT (ChangXin Memory Technologies)', country: 'China', sector: 'Technology', industry: 'DRAM Semiconductors', exchange: 'SSE' },
    '601939.SS': { companyName: 'China Construction Bank', country: 'China', sector: 'Financial Services', industry: 'Commercial Banking', exchange: 'SSE' },
    'TCEHY': { companyName: 'Tencent Holdings', country: 'China', sector: 'Communication Services', industry: 'Internet & Gaming', exchange: 'OTC' },
    'SAP': { companyName: 'SAP SE', country: 'Germany', sector: 'Technology', industry: 'Enterprise Software', exchange: 'NYSE' },
    'SONY': { companyName: 'Sony Group Corporation', country: 'Japan', sector: 'Technology', industry: 'Consumer Electronics & Entertainment', exchange: 'NYSE' },
    'NVO': { companyName: 'Novo Nordisk A/S', country: 'Denmark', sector: 'Healthcare', industry: 'Pharmaceuticals', exchange: 'NYSE' },
    'BABA': { companyName: 'Alibaba Group Holding Ltd', country: 'China', sector: 'Consumer Cyclical', industry: 'E-Commerce & Cloud', exchange: 'NYSE' },
    'NVDA': { sector: 'Technology', industry: 'Semiconductors & AI Hardware' },
    'AAPL': { sector: 'Technology', industry: 'Consumer Electronics' },
    'MSFT': { sector: 'Technology', industry: 'Software & Cloud Infrastructure' },
    'GOOGL': { sector: 'Communication Services', industry: 'Internet & AI Services' },
    'GOOG': { sector: 'Communication Services', industry: 'Internet & AI Services' },
    'AMZN': { sector: 'Consumer Cyclical', industry: 'E-Commerce & Cloud Computing' },
    'META': { sector: 'Communication Services', industry: 'Social Media & AI' },
    'TSLA': { sector: 'Consumer Cyclical', industry: 'Electric Vehicles & Clean Energy' },
    'BRK-B': { sector: 'Financial Services', industry: 'Multi-Sector Conglomerate' },
    'LLY': { sector: 'Healthcare', industry: 'Pharmaceuticals' },
    'JPM': { sector: 'Financial Services', industry: 'Diversified Banking' },
    'WMT': { sector: 'Consumer Defensive', industry: 'Discount Retail Stores' },
    'V': { sector: 'Financial Services', industry: 'Payment Processing' },
    'INTC': { sector: 'Technology', industry: 'Semiconductors' },
    'XOM': { sector: 'Energy', industry: 'Integrated Oil & Gas' },
    'JNJ': { sector: 'Healthcare', industry: 'Medical Devices & Pharma' },
    'MA': { sector: 'Financial Services', industry: 'Payment Processing' },
    'ABBV': { sector: 'Healthcare', industry: 'Biopharmaceuticals' },
    'PLTR': { sector: 'Technology', industry: 'Enterprise AI & Defense Analytics' },
    'ORCL': { sector: 'Technology', industry: 'Enterprise Software & Database' },
    'CSCO': { sector: 'Technology', industry: 'Networking Hardware' },
    'CVX': { sector: 'Energy', industry: 'Oil & Gas' },
    'COST': { sector: 'Consumer Defensive', industry: 'Wholesale Clubs' },
    'BAC': { sector: 'Financial Services', industry: 'Diversified Banking' },
    'LRCX': { sector: 'Technology', industry: 'Semiconductor Equipment' },
    'KO': { sector: 'Consumer Defensive', industry: 'Beverages' },
    'AMAT': { sector: 'Technology', industry: 'Semiconductor Equipment' },
    'CAT': { sector: 'Industrials', industry: 'Heavy Machinery' },
    'MRK': { sector: 'Healthcare', industry: 'Pharmaceuticals' },
    'SPCX': { sector: 'Industrials', industry: 'Aerospace & Space Exploration' },
};
// Verified baseline financial metrics for prominent Indian equities
const INDIAN_FINANCIALS_SEED = {
    RELIANCE: {
        revenue: 10000000000000,
        netIncome: 790000000000,
        operatingCashFlow: 1400000000000,
        capitalExpenditure: 1100000000000,
        freeCashFlow: 300000000000,
        marketCap: 20000000000000,
        peRatio: 26.5,
        shareholdersEquity: 8000000000000,
        totalDebt: 3200000000000,
    },
    TCS: {
        revenue: 2400000000000,
        netIncome: 460000000000,
        operatingCashFlow: 440000000000,
        capitalExpenditure: 35000000000,
        freeCashFlow: 405000000000,
        marketCap: 14500000000000,
        peRatio: 31.2,
        shareholdersEquity: 950000000000,
        totalDebt: 80000000000,
    },
    INFY: {
        revenue: 1530000000000,
        netIncome: 260000000000,
        operatingCashFlow: 250000000000,
        capitalExpenditure: 25000000000,
        freeCashFlow: 225000000000,
        marketCap: 7500000000000,
        peRatio: 28.4,
        shareholdersEquity: 850000000000,
        totalDebt: 70000000000,
    },
    TATAMOTORS: {
        revenue: 4370000000000,
        netIncome: 318000000000,
        operatingCashFlow: 650000000000,
        capitalExpenditure: 320000000000,
        freeCashFlow: 330000000000,
        marketCap: 3500000000000,
        peRatio: 11.2,
        shareholdersEquity: 890000000000,
        totalDebt: 1200000000000,
    },
    TATASTEEL: {
        revenue: 2300000000000,
        netIncome: -40000000000,
        operatingCashFlow: 210000000000,
        capitalExpenditure: 180000000000,
        freeCashFlow: 30000000000,
        marketCap: 1900000000000,
        peRatio: 45.0,
        shareholdersEquity: 900000000000,
        totalDebt: 850000000000,
    },
    TITAN: {
        revenue: 510000000000,
        netIncome: 35000000000,
        operatingCashFlow: 32000000000,
        capitalExpenditure: 8000000000,
        freeCashFlow: 24000000000,
        marketCap: 2900000000000,
        peRatio: 82.0,
        shareholdersEquity: 120000000000,
        totalDebt: 110000000000,
    },
    TRENT: {
        revenue: 125000000000,
        netIncome: 14700000000,
        operatingCashFlow: 18000000000,
        capitalExpenditure: 6000000000,
        freeCashFlow: 12000000000,
        marketCap: 2400000000000,
        peRatio: 160.0,
        shareholdersEquity: 45000000000,
        totalDebt: 5000000000,
    },
    TATACONSUM: {
        revenue: 152000000000,
        netIncome: 13000000000,
        operatingCashFlow: 17000000000,
        capitalExpenditure: 4000000000,
        freeCashFlow: 13000000000,
        marketCap: 1100000000000,
        peRatio: 85.0,
        shareholdersEquity: 180000000000,
        totalDebt: 25000000000,
    },
    ADANIENT: {
        revenue: 1000000000000,
        netIncome: 32000000000,
        operatingCashFlow: 150000000000,
        capitalExpenditure: 120000000000,
        freeCashFlow: 30000000000,
        marketCap: 3400000000000,
        peRatio: 95.0,
        shareholdersEquity: 420000000000,
        totalDebt: 580000000000,
    },
    ADANIPORTS: {
        revenue: 270000000000,
        netIncome: 75000000000,
        operatingCashFlow: 130000000000,
        capitalExpenditure: 80000000000,
        freeCashFlow: 50000000000,
        marketCap: 2900000000000,
        peRatio: 38.0,
        shareholdersEquity: 550000000000,
        totalDebt: 450000000000,
    },
    OLAELEC: {
        revenue: 50000000000,
        netIncome: -15000000000,
        operatingCashFlow: -8000000000,
        capitalExpenditure: 12000000000,
        freeCashFlow: -20000000000,
        marketCap: 450000000000,
        peRatio: 0,
        shareholdersEquity: 38000000000,
        totalDebt: 22000000000,
    },
    HDFCBANK: {
        revenue: 2600000000000,
        netIncome: 640000000000,
        operatingCashFlow: 700000000000,
        capitalExpenditure: 50000000000,
        freeCashFlow: 650000000000,
        marketCap: 12500000000000,
        peRatio: 19.5,
        shareholdersEquity: 4200000000000,
        totalDebt: 7500000000000,
    },
    ICICIBANK: {
        revenue: 1600000000000,
        netIncome: 440000000000,
        operatingCashFlow: 500000000000,
        capitalExpenditure: 40000000000,
        freeCashFlow: 460000000000,
        marketCap: 8500000000000,
        peRatio: 18.2,
        shareholdersEquity: 2500000000000,
        totalDebt: 5200000000000,
    },
    SBIN: {
        revenue: 4200000000000,
        netIncome: 670000000000,
        operatingCashFlow: 600000000000,
        capitalExpenditure: 60000000000,
        freeCashFlow: 540000000000,
        marketCap: 7200000000000,
        peRatio: 10.8,
        shareholdersEquity: 3800000000000,
        totalDebt: 15000000000000,
    },
    WIPRO: {
        revenue: 890000000000,
        netIncome: 110000000000,
        operatingCashFlow: 130000000000,
        capitalExpenditure: 15000000000,
        freeCashFlow: 115000000000,
        marketCap: 2800000000000,
        peRatio: 24.5,
        shareholdersEquity: 700000000000,
        totalDebt: 180000000000,
    },
    HCLTECH: {
        revenue: 1100000000000,
        netIncome: 157000000000,
        operatingCashFlow: 180000000000,
        capitalExpenditure: 20000000000,
        freeCashFlow: 160000000000,
        marketCap: 4800000000000,
        peRatio: 29.8,
        shareholdersEquity: 680000000000,
        totalDebt: 60000000000,
    },
    MARUTI: {
        revenue: 1400000000000,
        netIncome: 134000000000,
        operatingCashFlow: 150000000000,
        capitalExpenditure: 75000000000,
        freeCashFlow: 75000000000,
        marketCap: 3800000000000,
        peRatio: 28.5,
        shareholdersEquity: 850000000000,
        totalDebt: 12000000000,
    },
    BHARTIARTL: {
        revenue: 1500000000000,
        netIncome: 74000000000,
        operatingCashFlow: 720000000000,
        capitalExpenditure: 330000000000,
        freeCashFlow: 390000000000,
        marketCap: 9200000000000,
        peRatio: 65.0,
        shareholdersEquity: 920000000000,
        totalDebt: 2100000000000,
    },
    ZOMATO: {
        revenue: 121000000000,
        netIncome: 3500000000,
        operatingCashFlow: 7000000000,
        capitalExpenditure: 2000000000,
        freeCashFlow: 5000000000,
        marketCap: 2300000000000,
        peRatio: 210.0,
        shareholdersEquity: 200000000000,
        totalDebt: 5000000000,
    },
};
async function seed80Companies() {
    console.log('\n===============================================================');
    console.log('🇮🇳 🌍 ASSETMIND AI: COMPREHENSIVE COMPANY & REAL-TIME SEEDER');
    console.log('===============================================================\n');
    await (0, database_1.connectDatabase)();
    const total = companies_catalog_1.TOP_80_COMPANIES.length;
    console.log(`📦 Catalog contains ${total} companies.`);
    let createdAssets = 0;
    let updatedAssets = 0;
    // 1. Phase 1: Register / Sync Catalog Companies into MongoDB
    console.log('\n🔹 Phase 1: Registering / Syncing 80+ Assets in MongoDB...');
    for (const comp of companies_catalog_1.TOP_80_COMPANIES) {
        const existing = await Asset_model_1.Asset.findOne({ symbol: comp.symbol });
        const logoUrl = company_service_1.CompanyService.getLogoUrl(comp.symbol);
        const website = `https://www.${comp.symbol.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
        if (!existing) {
            await Asset_model_1.Asset.create({
                symbol: comp.symbol,
                companyName: comp.name,
                exchange: comp.exchange,
                country: comp.country,
                sector: comp.sector,
                industry: comp.industry,
                logoUrl,
                website,
            });
            createdAssets++;
        }
        else {
            existing.companyName = comp.name;
            existing.exchange = comp.exchange;
            existing.country = comp.country;
            existing.sector = comp.sector;
            existing.industry = comp.industry;
            existing.logoUrl = existing.logoUrl || logoUrl;
            existing.website = existing.website || website;
            await existing.save();
            updatedAssets++;
        }
    }
    // Also fix overrides on existing assets in database
    for (const [sym, patch] of Object.entries(ASSET_OVERRIDES)) {
        const asset = await Asset_model_1.Asset.findOne({ symbol: sym });
        if (asset) {
            if (patch.companyName)
                asset.companyName = patch.companyName;
            if (patch.country)
                asset.country = patch.country;
            if (patch.sector)
                asset.sector = patch.sector;
            if (patch.industry)
                asset.industry = patch.industry;
            if (patch.exchange)
                asset.exchange = patch.exchange;
            if (!asset.logoUrl)
                asset.logoUrl = company_service_1.CompanyService.getLogoUrl(sym);
            await asset.save();
        }
    }
    console.log(`✔️ Assets Sync Complete: ${createdAssets} created, ${updatedAssets} updated.`);
    // 2. Phase 2: Seed Baseline Financial Metrics for Indian Companies
    console.log('\n🔹 Phase 2: Seeding Baseline Financial Metrics for Indian Equities...');
    let metricsCount = 0;
    for (const [symbol, metricsMap] of Object.entries(INDIAN_FINANCIALS_SEED)) {
        const asset = await Asset_model_1.Asset.findOne({ symbol });
        if (!asset)
            continue;
        for (const [metricName, metricValue] of Object.entries(metricsMap)) {
            await FinancialData_model_1.FinancialData.findOneAndUpdate({
                assetId: asset._id,
                symbol,
                metricName,
            }, {
                $set: {
                    assetId: asset._id,
                    symbol,
                    metricName,
                    metricValue,
                    currency: 'INR',
                    unit: metricName === 'peRatio' ? 'ratio' : 'raw',
                    reportingPeriod: 'TTM',
                    source: 'screener-in',
                    validationStatus: 'VALID',
                    collectedAt: new Date(),
                },
            }, { upsert: true });
            metricsCount++;
        }
    }
    console.log(`✔️ Seeded ${metricsCount} baseline financial metrics across Indian companies.`);
    // 3. Phase 3: Fetch Batch Live Real-time Quotes via Yahoo V8
    console.log('\n🔹 Phase 3: Fetching Live Real-Time Market Quotes for All Assets...');
    const allAssets = await Asset_model_1.Asset.find().lean();
    const allSymbols = allAssets.map((a) => a.symbol);
    const quotesMap = await (0, liveQuote_service_1.fetchBatchLiveQuotes)(allSymbols);
    console.log(`✔️ Retrieved live quotes for ${quotesMap.size} symbols.`);
    let persistedQuotes = 0;
    for (const [sym, quote] of quotesMap.entries()) {
        await (0, liveQuote_service_1.persistLiveQuote)(quote);
        // Also persist marketCap and peRatio into FinancialData if available
        const asset = allAssets.find((a) => a.symbol === sym);
        if (asset && quote.marketCap) {
            await FinancialData_model_1.FinancialData.findOneAndUpdate({ assetId: asset._id, symbol: sym, metricName: 'marketCap' }, {
                $set: {
                    assetId: asset._id,
                    symbol: sym,
                    metricName: 'marketCap',
                    metricValue: quote.marketCap,
                    currency: quote.currency,
                    unit: 'raw',
                    reportingPeriod: 'TTM',
                    source: quote.source,
                    validationStatus: 'VALID',
                    collectedAt: new Date(),
                },
            }, { upsert: true });
        }
        persistedQuotes++;
    }
    console.log(`✔️ Persisted ${persistedQuotes} live quotes to StockPrice & FinancialData.`);
    // 4. Phase 4: Sync RAG vectors for key Indian companies
    console.log('\n🔹 Phase 4: Vector Indexing Key Indian Equities into Qdrant for RAG...');
    const priorityIndianRag = ['TCS', 'INFY', 'TATAMOTORS', 'RELIANCE', 'ADANIENT', 'OLAELEC', 'TITAN'];
    for (const sym of priorityIndianRag) {
        try {
            const res = await ragSync_service_1.RagSyncService.syncAssetBySymbol(sym);
            console.log(`   🔗 Qdrant Index: ${res.chunksCount} chunks vectorized for ${sym}`);
        }
        catch (err) {
            console.warn(`   ⚠️ Qdrant indexing note for ${sym}:`, err.message);
        }
    }
    const finalIndianCount = await Asset_model_1.Asset.countDocuments({ country: 'India' });
    const finalTotalCount = await Asset_model_1.Asset.countDocuments();
    const finalSectors = await Asset_model_1.Asset.distinct('sector');
    console.log('\n===============================================================');
    console.log('🎉 80+ COMPANIES SEEDING & REAL-TIME SYNC COMPLETE!');
    console.log(`📊 Final Status:`);
    console.log(`   • Total Assets:         ${finalTotalCount}`);
    console.log(`   • 🇮🇳 Indian Companies:   ${finalIndianCount}`);
    console.log(`   • 🌍 Distinct Sectors:   ${finalSectors.length} (${finalSectors.join(', ')})`);
    console.log('===============================================================\n');
    await (0, database_1.disconnectDatabase)();
}
seed80Companies().catch((err) => {
    console.error('Fatal error in company seeder:', err);
    process.exit(1);
});
//# sourceMappingURL=seed-80-companies.js.map