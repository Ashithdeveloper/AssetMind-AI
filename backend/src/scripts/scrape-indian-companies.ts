import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { ScrapingService } from '../modules/scraping/scraping.service';
import { RagSyncService } from '../modules/rag/services/ragSync.service';
import { Asset } from '../models/Asset.model';
import { StockPrice } from '../models/StockPrice.model';
import { CompanyService } from '../modules/companies/company.service';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/assetmind_ai';

// Target Indian companies requested: IT based, Adani group, OLA, Conglomerates
const INDIAN_TARGETS = [
  // 1. IT Based Companies
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', sector: 'IT', industry: 'IT Services & Consulting', website: 'https://www.tcs.com' },
  { symbol: 'INFY', name: 'Infosys Limited', sector: 'IT', industry: 'Digital Services & Consulting', website: 'https://www.infosys.com' },
  { symbol: 'WIPRO', name: 'Wipro Limited', sector: 'IT', industry: 'IT, Consulting & Business Solutions', website: 'https://www.wipro.com' },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd', sector: 'IT', industry: 'Engineering & Software Services', website: 'https://www.hcltech.com' },

  // 2. Adani Group Companies
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', sector: 'Energy & Infrastructure', industry: 'Energy, Infrastructure & Mining', website: 'https://www.adanienterprises.com' },
  { symbol: 'ADANIPORTS', name: 'Adani Ports & Special Economic Zone Ltd', sector: 'Energy & Infrastructure', industry: 'Ports & Logistics', website: 'https://www.adaniports.com' },
  { symbol: 'ADANIGREEN', name: 'Adani Green Energy Ltd', sector: 'Energy & Infrastructure', industry: 'Renewable Solar & Wind Energy', website: 'https://www.adanigreenenergy.com' },
  { symbol: 'ADANIPOWER', name: 'Adani Power Ltd', sector: 'Energy & Infrastructure', industry: 'Power Generation & Utilities', website: 'https://www.adanipower.com' },

  // 3. OLA Company
  { symbol: 'OLAELEC', name: 'Ola Electric Mobility Ltd', sector: 'Electric Vehicles', industry: 'Electric Vehicles & Clean Mobility Tech', website: 'https://www.olaelectric.com' },

  // 4. Heavy Conglomerate & Automotive
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Energy & Infrastructure', industry: 'Energy, Petrochemicals & Telecom', website: 'https://www.ril.com' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', sector: 'Electric Vehicles', industry: 'Automotive & Electric Commercial Vehicles', website: 'https://www.tatamotors.com' },
];

async function runScraper() {
  console.log('\n===============================================================');
  console.log('🇮🇳 SCRAPING INDIAN EQUITIES: IT, ADANI GROUP & OLA ELECTRIC');
  console.log('===============================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log(`[Database] Connected to MongoDB: ${MONGODB_URI}`);

  try {
    for (const target of INDIAN_TARGETS) {
      console.log(`\n⏳ Scraping ${target.symbol} (${target.name}) via Screener.in...`);

      try {
        const job = await ScrapingService.triggerScrape({
          symbol: target.symbol,
          sources: ['screener-in'],
          scraperProvider: 'playwright',
        });

        console.log(`  ✅ Scraping completed for ${target.symbol}:`);
        console.log(`     Status: ${job.status}`);
        console.log(`     Records Collected: ${job.recordsCollected}, Validated: ${job.recordsValidated}`);

        // Update metadata with verified sector, website, logo, exchange
        const asset = await Asset.findOne({ symbol: target.symbol });
        if (asset) {
          asset.companyName = target.name;
          asset.sector = target.sector;
          asset.industry = target.industry;
          asset.exchange = 'NSE';
          asset.country = 'India';
          asset.website = target.website;
          asset.logoUrl = CompanyService.getLogoUrl(target.symbol);
          await asset.save();
        }

        // Synchronize vectors into Qdrant for RAG
        const syncRes = await RagSyncService.syncAssetBySymbol(target.symbol);
        console.log(`  🔗 Qdrant Index: ${syncRes.chunksCount} chunks vectorized for ${target.symbol}`);
      } catch (err: any) {
        console.error(`  ❌ Failed scraping ${target.symbol}:`, err.message);
      }
    }

    console.log('\n===============================================================');
    console.log('🎉 INDIAN COMPANIES SCRAPING & VECTOR INDEXING COMPLETE');
    console.log('===============================================================\n');
  } finally {
    await mongoose.disconnect();
    console.log('[Database] Disconnected from MongoDB.');
  }
}

runScraper().catch((err) => {
  console.error('Fatal scraping error:', err);
  process.exit(1);
});
