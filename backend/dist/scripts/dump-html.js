"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const scrapers_1 = require("../modules/scraping/scrapers");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Saves raw HTML from each source to analyze DOM structure
 */
async function dumpHtml() {
    const scraper = (0, scrapers_1.getScraper)('playwright');
    const outDir = path.resolve(process.cwd(), 'html_dumps');
    if (!fs.existsSync(outDir))
        fs.mkdirSync(outDir, { recursive: true });
    const pages = [
        { name: 'yahoo_aapl', url: 'https://finance.yahoo.com/quote/AAPL/' },
        { name: 'stockanalysis_aapl', url: 'https://stockanalysis.com/stocks/aapl/' },
        { name: 'companiesmarketcap_aapl', url: 'https://companiesmarketcap.com/aapl/marketcap/' },
        { name: 'companiesmarketcap_apple', url: 'https://companiesmarketcap.com/apple/marketcap/' },
        { name: 'macrotrends_aapl', url: 'https://www.macrotrends.net/stocks/charts/AAPL/apple/financial-statements' },
    ];
    for (const p of pages) {
        console.log(`Fetching ${p.name}: ${p.url}`);
        try {
            const html = await scraper.fetchHtml(p.url);
            const filePath = path.join(outDir, `${p.name}.html`);
            fs.writeFileSync(filePath, html);
            console.log(`  Saved ${html.length} chars → ${filePath}`);
        }
        catch (err) {
            console.log(`  ERROR: ${err.message}`);
        }
    }
    const pw = scraper;
    if (pw.close)
        await pw.close();
    console.log('\nDone! Check html_dumps/ folder');
}
dumpHtml().catch(console.error);
//# sourceMappingURL=dump-html.js.map