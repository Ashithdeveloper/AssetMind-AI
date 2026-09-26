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
exports.MarketDiscoveryService = void 0;
const cheerio = __importStar(require("cheerio"));
const scrapers_1 = require("../scrapers");
const env_1 = require("../../../config/env");
class MarketDiscoveryService {
    /**
     * Dynamically scrape live Indian market leaders directly from Screener.in
     */
    static async discoverIndianCompanies(limit = 40) {
        const scraper = (0, scrapers_1.getScraper)(env_1.env.SCRAPER_PROVIDER);
        const discovered = [];
        try {
            // Screener.in Top 100 Market Capitalisation Screen (supports page 1 and page 2)
            const pagesToFetch = limit > 25 ? [1, 2] : [1];
            for (const pageNum of pagesToFetch) {
                if (discovered.length >= limit)
                    break;
                const url = `https://www.screener.in/screens/357644/top-100-companies-by-market-capitalisation/?page=${pageNum}`;
                const html = await scraper.fetchHtml(url, 'table.data-table, .data-table');
                const $ = cheerio.load(html);
                $('table.data-table tbody tr, table tbody tr').each((i, row) => {
                    if (discovered.length >= limit)
                        return false;
                    const nameLink = $(row).find('td a[href*="/company/"]').first();
                    if (nameLink.length > 0) {
                        const href = nameLink.attr('href') || '';
                        const name = nameLink.text().trim();
                        // Extract symbol from href: /company/RELIANCE/consolidated/ => RELIANCE
                        const match = href.match(/\/company\/([^/]+)/i);
                        const rawSymbol = match ? match[1] : '';
                        const symbol = rawSymbol.toUpperCase().replace(/\.NS$|\.BO$/i, '');
                        if (symbol && !discovered.find((d) => d.symbol === symbol)) {
                            discovered.push({
                                symbol,
                                name: name || symbol,
                                country: 'India',
                                exchange: 'NSE',
                                sourceRank: discovered.length + 1,
                                sourceUrl: href.startsWith('http') ? href : `https://www.screener.in${href}`,
                                discoverySource: `Screener.in (Live Market Screen P${pageNum})`,
                            });
                        }
                    }
                });
            }
        }
        catch (err) {
            console.warn('[Discovery] Screener.in live discovery warning:', err.message || err);
        }
        // Fallback if table did not load: extract directly from explore links
        if (discovered.length === 0) {
            try {
                const exploreUrl = 'https://www.screener.in/explore/';
                const html = await scraper.fetchHtml(exploreUrl, '#content, table');
                const $ = cheerio.load(html);
                $('a[href*="/company/"]').each((_, el) => {
                    if (discovered.length >= limit)
                        return false;
                    const href = $(el).attr('href') || '';
                    const name = $(el).text().trim();
                    const match = href.match(/\/company\/([^/]+)/i);
                    if (match && match[1]) {
                        const symbol = match[1].toUpperCase().replace(/\.NS$|\.BO$/i, '');
                        if (symbol && !discovered.find((d) => d.symbol === symbol)) {
                            discovered.push({
                                symbol,
                                name: name || symbol,
                                country: 'India',
                                exchange: 'NSE',
                                sourceRank: discovered.length + 1,
                                sourceUrl: `https://www.screener.in${href}`,
                                discoverySource: 'Screener.in Explore',
                            });
                        }
                    }
                });
            }
            catch (exploreErr) {
                console.warn('[Discovery] Screener.in explore fallback warning:', exploreErr.message || exploreErr);
            }
        }
        return discovered;
    }
    /**
     * Dynamically scrape live Global market leaders directly from CompaniesMarketCap
     */
    static async discoverGlobalCompanies(limit = 40) {
        const scraper = (0, scrapers_1.getScraper)(env_1.env.SCRAPER_PROVIDER);
        const discovered = [];
        try {
            const url = 'https://companiesmarketcap.com/';
            const html = await scraper.fetchHtml(url, 'table.default-table, .company-name');
            const $ = cheerio.load(html);
            $('table.default-table tbody tr, table tbody tr').each((_, row) => {
                if (discovered.length >= limit)
                    return false;
                const symbolElem = $(row).find('.company-code, div.company-code, span.company-code').first();
                const nameElem = $(row).find('.company-name, div.company-name').first();
                const linkElem = $(row).find('a[href*="/"]').first();
                let symbol = symbolElem.text().trim().toUpperCase();
                const name = nameElem.text().trim();
                const href = linkElem.attr('href') || '';
                if (!symbol && href) {
                    // e.g. /apple/marketcap/
                    const slugMatch = href.match(/^\/([^/]+)/);
                    if (slugMatch && slugMatch[1]) {
                        symbol = slugMatch[1].toUpperCase();
                    }
                }
                if (symbol && !discovered.find((d) => d.symbol === symbol)) {
                    discovered.push({
                        symbol,
                        name: name || symbol,
                        country: 'United States',
                        exchange: 'NASDAQ/NYSE',
                        sourceRank: discovered.length + 1,
                        sourceUrl: href.startsWith('http') ? href : `https://companiesmarketcap.com${href}`,
                        discoverySource: 'CompaniesMarketCap (Live Global Rankings)',
                    });
                }
            });
        }
        catch (err) {
            console.warn('[Discovery] CompaniesMarketCap live discovery warning:', err.message || err);
        }
        // Fallback: StockAnalysis biggest companies list
        if (discovered.length < 10) {
            try {
                const saUrl = 'https://stockanalysis.com/list/biggest-companies/';
                const html = await scraper.fetchHtml(saUrl, 'table');
                const $ = cheerio.load(html);
                $('table tbody tr').each((_, row) => {
                    if (discovered.length >= limit)
                        return false;
                    const symbolLink = $(row).find('td.sym a, td a[href*="/stocks/"]').first();
                    const nameTd = $(row).find('td.name, td:nth-child(3)').first();
                    const symbol = symbolLink.text().trim().toUpperCase();
                    const name = nameTd.text().trim();
                    if (symbol && !discovered.find((d) => d.symbol === symbol)) {
                        discovered.push({
                            symbol,
                            name: name || symbol,
                            country: 'United States',
                            exchange: 'NASDAQ',
                            sourceRank: discovered.length + 1,
                            sourceUrl: `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`,
                            discoverySource: 'StockAnalysis Biggest Companies Screen',
                        });
                    }
                });
            }
            catch (saErr) {
                console.warn('[Discovery] StockAnalysis discovery warning:', saErr.message || saErr);
            }
        }
        return discovered;
    }
    /**
     * Discover companies live strictly for Indian equities directly from Screener.in
     */
    static async discoverLiveCompanies(options = {}) {
        const limit = options.limit || 80;
        // Strictly Indian companies only
        return this.discoverIndianCompanies(limit);
    }
}
exports.MarketDiscoveryService = MarketDiscoveryService;
//# sourceMappingURL=marketDiscovery.service.js.map