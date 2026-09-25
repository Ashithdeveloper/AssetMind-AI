"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScrapingBeeStockScraper = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../../../config/env");
const apiResponse_1 = require("../../../utils/apiResponse");
class ScrapingBeeStockScraper {
    provider = 'scrapingbee';
    apiKey;
    baseUrl = 'https://app.scrapingbee.com/api/v1/';
    constructor(apiKey) {
        this.apiKey = apiKey || env_1.env.SCRAPINGBEE_API_KEY;
    }
    async fetchHtml(url, waitForSelector) {
        if (!this.apiKey) {
            throw new apiResponse_1.AppError('ScrapingBee API key is not configured. Please set SCRAPINGBEE_API_KEY in your .env file.', 400, 'SCRAPINGBEE_KEY_MISSING');
        }
        try {
            const params = {
                api_key: this.apiKey,
                url,
                render_js: 'true',
                block_ads: 'true',
                block_resources: 'false',
                premium_proxy: 'false',
            };
            if (waitForSelector) {
                params.wait_for = waitForSelector;
            }
            const response = await axios_1.default.get(this.baseUrl, {
                params,
                timeout: 45000,
                headers: {
                    Accept: 'text/html',
                },
            });
            return response.data;
        }
        catch (error) {
            const statusCode = error.response?.status || 500;
            const message = error.response?.data?.message || error.message || 'ScrapingBee request failed';
            throw new apiResponse_1.AppError(`ScrapingBee error (${statusCode}): ${message}`, statusCode >= 400 && statusCode < 500 ? 400 : 502, 'SCRAPINGBEE_REQUEST_FAILED', { originalError: message, targetUrl: url });
        }
    }
}
exports.ScrapingBeeStockScraper = ScrapingBeeStockScraper;
//# sourceMappingURL=scrapingbee.scraper.js.map