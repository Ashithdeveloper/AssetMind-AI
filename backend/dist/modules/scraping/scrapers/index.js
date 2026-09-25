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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScraper = void 0;
const playwright_scraper_1 = require("./playwright.scraper");
const scrapingbee_scraper_1 = require("./scrapingbee.scraper");
const env_1 = require("../../../config/env");
let playwrightInstance = null;
let scrapingBeeInstance = null;
const getScraper = (provider) => {
    const chosenProvider = provider || env_1.env.SCRAPER_PROVIDER;
    if (chosenProvider === 'scrapingbee') {
        if (!scrapingBeeInstance) {
            scrapingBeeInstance = new scrapingbee_scraper_1.ScrapingBeeStockScraper();
        }
        return scrapingBeeInstance;
    }
    if (!playwrightInstance) {
        playwrightInstance = new playwright_scraper_1.PlaywrightStockScraper();
    }
    return playwrightInstance;
};
exports.getScraper = getScraper;
__exportStar(require("./scraper.interface"), exports);
__exportStar(require("./playwright.scraper"), exports);
__exportStar(require("./scrapingbee.scraper"), exports);
//# sourceMappingURL=index.js.map