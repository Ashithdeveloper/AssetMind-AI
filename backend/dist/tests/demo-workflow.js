"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const auth_service_1 = require("../modules/auth/auth.service");
const scraping_service_1 = require("../modules/scraping/scraping.service");
const stock_service_1 = require("../modules/stocks/stock.service");
const User_model_1 = require("../models/User.model");
async function runDemo() {
    console.log('\n===============================================================');
    console.log('🌟 ASSETMIND AI (PHASE 1) - END-TO-END DEMO WORKFLOW');
    console.log('===============================================================\n');
    await (0, database_1.connectDatabase)();
    try {
        // -------------------------------------------------------------
        // STEP 1: USER REGISTRATION
        // -------------------------------------------------------------
        console.log('STEP 1: User Registration (POST /api/auth/register)');
        const demoEmail = `analyst_${Date.now()}@assetmind.ai`;
        await User_model_1.User.deleteMany({ email: demoEmail });
        const registered = await auth_service_1.AuthService.register({
            name: 'Sarah Portfolio Manager',
            email: demoEmail,
            password: 'StrongPassword2026!',
        });
        console.log(`  ✔️ Registered User: ${registered.user.name} (${registered.user.email})`);
        console.log(`  ✔️ User ID: ${registered.user.id}`);
        console.log(`  ✔️ JWT Token: ${registered.token.substring(0, 30)}...`);
        // -------------------------------------------------------------
        // STEP 2: USER LOGIN
        // -------------------------------------------------------------
        console.log('\nSTEP 2: User Login (POST /api/auth/login)');
        const login = await auth_service_1.AuthService.login({
            email: demoEmail,
            password: 'StrongPassword2026!',
        });
        console.log(`  ✔️ Login Verified for: ${login.user.email}`);
        // -------------------------------------------------------------
        // STEP 3: USER PROFILE
        // -------------------------------------------------------------
        console.log('\nSTEP 3: Retrieve Authenticated Profile (GET /api/auth/me)');
        const profile = await auth_service_1.AuthService.getProfile(login.user.id);
        console.log(`  ✔️ Profile Data: Name="${profile.name}", Email="${profile.email}"`);
        // -------------------------------------------------------------
        // STEP 4: GET SUPPORTED SOURCES
        // -------------------------------------------------------------
        console.log('\nSTEP 4: Get Supported Data Sources (GET /api/scraping/sources)');
        const sources = scraping_service_1.ScrapingService.getSupportedSources();
        console.log(`  ✔️ Found ${sources.length} Configured Source Adapters:`);
        sources.forEach((s, idx) => {
            console.log(`     ${idx + 1}. [${s.id}] ${s.name} - ${s.baseUrl}`);
        });
        // -------------------------------------------------------------
        // STEP 5: TRIGGER STOCK SCRAPING & STORE IN LOCAL MONGODB
        // -------------------------------------------------------------
        const targetSymbol = 'MSFT';
        console.log(`\nSTEP 5: Trigger Stock Scraping for "${targetSymbol}" (POST /api/scraping/stocks)`);
        console.log(`  Provider: Playwright | Sources: yahoo-finance, stockanalysis, sec-edgar`);
        const job = await scraping_service_1.ScrapingService.triggerScrape({
            symbol: targetSymbol,
            sources: ['yahoo-finance', 'stockanalysis', 'sec-edgar'],
            scraperProvider: 'playwright',
        });
        console.log(`  ✔️ Scraping Job Completed!`);
        console.log(`     - Job ID: ${job._id}`);
        console.log(`     - Status: ${job.status}`);
        console.log(`     - Records Collected: ${job.recordsCollected}`);
        console.log(`     - Records Validated: ${job.recordsValidated}`);
        console.log(`     - Records Rejected: ${job.recordsRejected}`);
        if (job.errorMessage) {
            console.log(`     - Notice: ${job.errorMessage}`);
        }
        // -------------------------------------------------------------
        // STEP 6: RETRIEVE STORED DATA FROM MONGODB
        // -------------------------------------------------------------
        console.log(`\nSTEP 6: Retrieve Stored Stock Data (Stock Retrieval APIs)`);
        // A. Company Profile
        console.log(`\n  A. Company Profile (GET /api/stocks/${targetSymbol}):`);
        const assetProfile = await stock_service_1.StockService.getCompanyProfile(targetSymbol);
        console.log(`     - Company Name: ${assetProfile.companyName}`);
        console.log(`     - Symbol: ${assetProfile.symbol}`);
        console.log(`     - Latest Price: ${assetProfile.latestPrice?.price ? `$${assetProfile.latestPrice.price}` : 'N/A'}`);
        // B. Financial Metrics
        console.log(`\n  B. Financial Data & Key Ratios (GET /api/stocks/${targetSymbol}/financials):`);
        const financials = await stock_service_1.StockService.getFinancialData(targetSymbol);
        console.log(`     - Total Stored Metrics: ${financials.totalMetrics}`);
        for (const [metric, item] of Object.entries(financials.summary)) {
            console.log(`     • ${item.metricName}: ${item.metricValue} ${item.unit || ''} (Source: ${item.source})`);
        }
        // C. Available Sources
        console.log(`\n  C. Available Data Sources (GET /api/stocks/${targetSymbol}/sources):`);
        const availableSources = await stock_service_1.StockService.getAvailableSources(targetSymbol);
        console.log(`     - Contributing Sources: ${availableSources.sources.join(', ')}`);
        // D. Financial Documents
        console.log(`\n  D. Financial Documents (GET /api/stocks/${targetSymbol}/documents):`);
        const documents = await stock_service_1.StockService.getFinancialDocuments(targetSymbol);
        console.log(`     - Total Documents: ${documents.count}`);
        documents.documents.forEach((doc, i) => {
            console.log(`     • [${doc.documentType}] ${doc.title} (${doc.source})`);
        });
        console.log('\n===============================================================');
        console.log('🎉 DEMO WORKFLOW EXECUTED SUCCESSFULLY!');
        console.log('===============================================================\n');
    }
    catch (error) {
        console.error('❌ Demo workflow failed:', error);
    }
    finally {
        await (0, database_1.disconnectDatabase)();
    }
}
runDemo();
//# sourceMappingURL=demo-workflow.js.map