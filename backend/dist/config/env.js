"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from .env file
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
exports.env = {
    PORT: parseInt(process.env.PORT || '5000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/assetmind_ai',
    JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_for_assetmind_ai_development_2026',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
    SCRAPINGBEE_API_KEY: process.env.SCRAPINGBEE_API_KEY || '',
    SCRAPER_PROVIDER: (process.env.SCRAPER_PROVIDER || 'playwright'),
    PLAYWRIGHT_HEADLESS: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    // Scheduled Scraping Settings
    AUTO_SCRAPE_ENABLED: process.env.AUTO_SCRAPE_ENABLED !== 'false',
    AUTO_SCRAPE_INTERVAL_HOURS: parseInt(process.env.AUTO_SCRAPE_INTERVAL_HOURS || '4', 10),
    AUTO_SCRAPE_SYMBOLS: (process.env.AUTO_SCRAPE_SYMBOLS || 'TCS,INFY,WIPRO,HCLTECH,ADANIENT,ADANIPORTS,ADANIGREEN,ADANIPOWER,OLAELEC,RELIANCE,TATAMOTORS')
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
};
//# sourceMappingURL=env.js.map