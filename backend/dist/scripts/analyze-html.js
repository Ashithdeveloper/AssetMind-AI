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
const cheerio = __importStar(require("cheerio"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dumpDir = path.resolve(process.cwd(), 'html_dumps');
// =============================================
// 1. YAHOO FINANCE ANALYSIS
// =============================================
console.log('=== YAHOO FINANCE DOM ANALYSIS ===\n');
const yahooHtml = fs.readFileSync(path.join(dumpDir, 'yahoo_aapl.html'), 'utf-8');
const $y = cheerio.load(yahooHtml);
console.log('h1 tags:');
$y('h1').each((i, el) => {
    console.log(`  [${i}] ${$y(el).text().substring(0, 100)}`);
});
console.log('\ntitle tag:', $y('title').text().substring(0, 100));
console.log('\n[data-testid="quote-hdr"] text:');
$y('[data-testid="quote-hdr"]').each((i, el) => {
    console.log(`  [${i}] ${$y(el).text().substring(0, 100)}`);
});
console.log('\nfin-streamer[data-field="regularMarketPrice"]:');
$y('fin-streamer[data-field="regularMarketPrice"]').each((i, el) => {
    console.log(`  [${i}] text="${$y(el).text()}" value="${$y(el).attr('value')}"`);
});
console.log('\nfin-streamer[data-field="regularMarketChange"]:');
$y('fin-streamer[data-field="regularMarketChange"]').each((i, el) => {
    console.log(`  [${i}] text="${$y(el).text()}" value="${$y(el).attr('value')}"`);
});
console.log('\n[data-testid="qsp-price"]:');
$y('[data-testid="qsp-price"]').each((i, el) => {
    console.log(`  [${i}] text="${$y(el).text().substring(0, 60)}"`);
});
// Look for quote header sections
console.log('\nsection[data-testid="quote-price"]:');
$y('section[data-testid="quote-price"]').each((i, el) => {
    console.log(`  [${i}] HTML snippet: ${$y(el).html()?.substring(0, 200)}`);
});
// Look for all data-testid attrs
console.log('\nAll data-testid values (first 20):');
const testIds = [];
$y('[data-testid]').each((_, el) => {
    const tid = $y(el).attr('data-testid') || '';
    if (!testIds.includes(tid))
        testIds.push(tid);
});
testIds.slice(0, 30).forEach(tid => {
    const txt = $y(`[data-testid="${tid}"]`).first().text().substring(0, 80);
    console.log(`  ${tid}: "${txt}"`);
});
// =============================================
// 2. STOCKANALYSIS ANALYSIS
// =============================================
console.log('\n\n=== STOCKANALYSIS DOM ANALYSIS ===\n');
const saHtml = fs.readFileSync(path.join(dumpDir, 'stockanalysis_aapl.html'), 'utf-8');
const $sa = cheerio.load(saHtml);
console.log('h1 text:', $sa('h1').first().text().substring(0, 100));
console.log('\n.text-4xl elements:');
$sa('.text-4xl').each((i, el) => {
    console.log(`  [${i}] "${$sa(el).text().substring(0, 80)}" class="${$sa(el).attr('class')}"`);
});
console.log('\nKey stats rows (first 20):');
let count = 0;
$sa('tr').each((_, row) => {
    if (count >= 20)
        return;
    const tds = $sa(row).find('td');
    if (tds.length >= 2) {
        const label = $sa(tds[0]).text().trim();
        const value = $sa(tds[1]).text().trim();
        if (label && value) {
            console.log(`  "${label}" → "${value}"`);
            count++;
        }
    }
});
// Check for the flex/grid based metric layout
console.log('\ndiv.flex.justify-between (first 10):');
count = 0;
$sa('div.flex.justify-between').each((_, el) => {
    if (count >= 10)
        return;
    const text = $sa(el).text().trim().replace(/\s+/g, ' ');
    if (text.length > 5) {
        console.log(`  "${text.substring(0, 100)}"`);
        count++;
    }
});
// =============================================
// 3. COMPANIESMARKETCAP ANALYSIS
// =============================================
console.log('\n\n=== COMPANIESMARKETCAP DOM ANALYSIS (aapl) ===\n');
const cmcHtml = fs.readFileSync(path.join(dumpDir, 'companiesmarketcap_aapl.html'), 'utf-8');
const $cmc = cheerio.load(cmcHtml);
console.log('h1:', $cmc('h1').first().text().substring(0, 100));
console.log('title:', $cmc('title').text());
console.log('body text (first 300):', $cmc('body').text().replace(/\s+/g, ' ').substring(0, 300));
console.log('\n\n=== COMPANIESMARKETCAP DOM ANALYSIS (apple) ===\n');
const cmcAppleHtml = fs.readFileSync(path.join(dumpDir, 'companiesmarketcap_apple.html'), 'utf-8');
const $cmc2 = cheerio.load(cmcAppleHtml);
console.log('h1:', $cmc2('h1').first().text().substring(0, 100));
console.log('.company-name:', $cmc2('.company-name').first().text().substring(0, 100));
console.log('title:', $cmc2('title').text());
// Check available classes
console.log('\nAll info-box elements:');
$cmc2('.info-box').each((i, el) => {
    console.log(`  [${i}] "${$cmc2(el).text().replace(/\s+/g, ' ').trim().substring(0, 80)}"`);
});
console.log('\nAll divs with "market" text:');
count = 0;
$cmc2('div, p, span').each((_, el) => {
    if (count > 10)
        return;
    const txt = $cmc2(el).text().trim();
    if (txt.toLowerCase().includes('market cap') && txt.length < 200) {
        console.log(`  tag=${el.tagName} class="${$cmc2(el).attr('class') || ''}" → "${txt.substring(0, 120)}"`);
        count++;
    }
});
// =============================================
// 4. MACROTRENDS ANALYSIS
// =============================================
console.log('\n\n=== MACROTRENDS DOM ANALYSIS ===\n');
const mtHtml = fs.readFileSync(path.join(dumpDir, 'macrotrends_aapl.html'), 'utf-8');
const $mt = cheerio.load(mtHtml);
console.log('h1:', $mt('h1').first().text().substring(0, 100));
console.log('h2:', $mt('h2').first().text().substring(0, 100));
console.log('title:', $mt('title').text().substring(0, 100));
console.log('body text (first 400):', $mt('body').text().replace(/\s+/g, ' ').substring(0, 400));
console.log('\nDone!');
//# sourceMappingURL=analyze-html.js.map