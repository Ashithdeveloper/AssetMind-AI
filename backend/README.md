# AssetMind AI - Phase 1: Authentication + Stock Data Scraping + Validation + Storage

AssetMind AI is an AI-powered investment intelligence platform. **Phase 1** establishes a high-performance, modular backend foundation for authentication, multi-provider web scraping (Playwright & ScrapingBee), data validation/normalization, and local MongoDB storage with stock retrieval REST APIs.

---

## 🚀 Key Features

1. **Authentication System**:
   - User registration and login with bcrypt password hashing (10 salt rounds).
   - Stateless JWT tokens (configurable expiration) protecting sensitive endpoints.
   - User profile (`/api/auth/me`) and clean logout flow.
   - Comprehensive input validation using Zod schemas.

2. **Modular Stock Scraping Engine**:
   - Unified `StockScraper` interface (`fetchHtml`).
   - **Method 1: Playwright** (Headless browser automation with dynamic content rendering, custom selectors, and fallback).
   - **Method 2: ScrapingBee API** (Proxy-powered scraping with JS rendering support).
   - Configurable via `SCRAPER_PROVIDER` or per-request override.

3. **11 Source-Specific Scraping Adapters**:
   - [Yahoo Finance](https://finance.yahoo.com/)
   - [StockAnalysis.com](https://stockanalysis.com/)
   - [MarketScreener](https://www.marketscreener.com/)
   - [Macrotrends](https://www.macrotrends.net/)
   - [CompaniesMarketCap](https://companiesmarketcap.com/)
   - [TradingView](https://www.tradingview.com/)
   - [Investing.com](https://www.investing.com/)
   - [Morningstar](https://www.morningstar.com/)
   - [SEC EDGAR](https://www.sec.gov/edgar/) (with company regulatory filings and 10-K/10-Q disclosures)
   - [StockMarketCap](https://get.stockmarketcap.io/)
   - [Screener.in](https://www.screener.in/)

4. **Robust Validation and Normalization Pipeline**:
   - Canonical metric name mapping (`market_cap`, `P/E`, `fcf`, etc. mapped to standardized camelCase).
   - Number multiplier parsing (e.g. `3.45T`, `185.2B`, `45.6M`, `12.3K`, percentages, currency signs, negative brackets).
   - Symbol & currency normalization (ISO standard uppercase).
   - In-batch and cross-source duplicate detection.
   - Non-destructive handling of missing metrics (never invents fictitious data).

5. **Local MongoDB Database (Mongoose)**:
   - `Users`: Authentication and profile details.
   - `Assets`: Company meta, exchange, sector, industry, description.
   - `FinancialData`: Canonical financial metrics, reporting periods (`TTM`, `ANNUAL`, `2024-Q3`), currency, unit, validation status.
   - `StockPrices`: Realtime/historical prices, change, percent, volume.
   - `FinancialDocuments`: SEC filings, annual disclosures, and company reports.
   - `ScrapingJobs`: Scraping history, execution tracking, records collected/validated/rejected.

6. **Stock Data Retrieval REST APIs**:
   - Direct high-speed MongoDB queries without re-scraping on every user request.
   - Search by symbol or company name.
   - Filterable financials by metric, period, source, currency.
   - Historical prices and document retrieval.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js & TypeScript (ES2022)
- **Framework**: Express.js
- **Database**: MongoDB Community Edition & Mongoose
- **Authentication**: JSON Web Tokens (JWT) & bcryptjs
- **Scraping**: Playwright & ScrapingBee API (Axios + Cheerio)
- **Validation**: Zod
- **Security**: Helmet, CORS

---

## 📂 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts                  # MongoDB connection manager
│   │   └── env.ts                       # Environment variable loader
│   ├── middleware/
│   │   ├── auth.middleware.ts           # JWT authentication middleware
│   │   └── error.middleware.ts          # Central error and 404 handler
│   ├── models/
│   │   ├── Asset.model.ts               # Stock asset metadata schema
│   │   ├── FinancialData.model.ts       # Normalized financial metrics schema
│   │   ├── FinancialDocument.model.ts   # Filings and documents schema
│   │   ├── ScrapingJob.model.ts         # Scraping job status & history schema
│   │   ├── StockPrice.model.ts          # Stock prices schema
│   │   └── User.model.ts                # User credentials & profile schema
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts       # Auth handlers
│   │   │   ├── auth.routes.ts           # Auth route definitions
│   │   │   ├── auth.service.ts          # Register, login, profile logic
│   │   │   └── auth.validation.ts       # Zod schemas for auth
│   │   ├── scraping/
│   │   │   ├── scrapers/
│   │   │   │   ├── index.ts             # Scraper factory
│   │   │   │   ├── playwright.scraper.ts# Playwright browser engine
│   │   │   │   ├── scraper.interface.ts # Common scraper & raw data interfaces
│   │   │   │   └── scrapingbee.scraper.ts# ScrapingBee API engine
│   │   │   ├── sources/
│   │   │   │   ├── base.adapter.ts      # Number parsing & JSON-LD utilities
│   │   │   │   ├── companiesMarketCap.adapter.ts
│   │   │   │   ├── index.ts             # Source adapter registry
│   │   │   │   ├── investing.adapter.ts
│   │   │   │   ├── macrotrends.adapter.ts
│   │   │   │   ├── marketScreener.adapter.ts
│   │   │   │   ├── morningstar.adapter.ts
│   │   │   │   ├── screenerIn.adapter.ts
│   │   │   │   ├── secEdgar.adapter.ts
│   │   │   │   ├── source.adapter.interface.ts
│   │   │   │   ├── stockAnalysis.adapter.ts
│   │   │   │   ├── stockMarketCap.adapter.ts
│   │   │   │   ├── tradingView.adapter.ts
│   │   │   │   └── yahooFinance.adapter.ts
│   │   │   ├── validators/
│   │   │   │   └── financialData.validator.ts # Data validation & normalization
│   │   │   ├── scraping.controller.ts
│   │   │   ├── scraping.routes.ts
│   │   │   └── scraping.service.ts
│   │   └── stocks/
│   │       ├── stock.controller.ts
│   │       ├── stock.routes.ts
│   │       └── stock.service.ts
│   ├── routes/
│   │   └── index.ts                     # API master router
│   ├── tests/
│   │   ├── demo-workflow.ts             # End-to-end demo execution
│   │   └── test-all.ts                  # Comprehensive automated test suite
│   ├── utils/
│   │   └── apiResponse.ts               # Standard API response & error helper
│   ├── app.ts                           # Express application setup
│   └── server.ts                        # HTTP server entrypoint
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## ⚙️ Environment Variables

Create `.env` in the `backend/` directory:

```env
PORT=5000
NODE_ENV=development

# MongoDB Connection
MONGODB_URI=mongodb://127.0.0.1:27017/assetmind_ai

# JWT Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=1d

# Scraping Configuration
SCRAPER_PROVIDER=playwright   # 'playwright' or 'scrapingbee'
PLAYWRIGHT_HEADLESS=true
SCRAPINGBEE_API_KEY=your_scrapingbee_api_key_if_used
```

---

## 🏃 Running the Application

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Start Local MongoDB
Ensure your local MongoDB Community Server is active on port `27017`.

### 3. Seed & Scrape 80+ Indian & Global Companies
```bash
npm run seed:companies
```
Populates 81 top Indian (NSE) and Global (NASDAQ/NYSE) companies across sectors and begins batch scraping live financial metrics.

### 4. Run Automated Tests
```bash
npm test
```

### 5. Run End-to-End Demo Workflow
```bash
npm run demo
```

### 6. Start Development Server
```bash
npm run dev
```
The server will start at `http://localhost:5000` with automated background scraping enabled on startup and every 4 hours.

---

## 📡 REST API Documentation

### 1. Authentication Endpoints

#### Register User
`POST /api/auth/register`
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123!"
}
```

#### Login User
`POST /api/auth/login`
```json
{
  "email": "jane@example.com",
  "password": "Password123!"
}
```

#### Get Current User Profile (JWT Protected)
`GET /api/auth/me`
*Header*: `Authorization: Bearer <token>`

#### Logout
`POST /api/auth/logout`

---

### 2. Scraping Endpoints (JWT Protected)

#### Get Supported Sources
`GET /api/scraping/sources`

#### Trigger Stock Scraping
`POST /api/scraping/stocks`
```json
{
  "symbol": "AAPL",
  "sources": ["yahoo-finance", "stockanalysis", "sec-edgar"],
  "scraperProvider": "playwright"
}
```

#### Get Scraping Job Status
`GET /api/scraping/jobs/:jobId`

#### Get Scraping Job History
`GET /api/scraping/jobs?symbol=AAPL&status=COMPLETED&page=1&limit=10`

---

### 3. Stock Retrieval Endpoints

#### Search Stocks
`GET /api/stocks/search?q=apple`

#### Get Company Profile
`GET /api/stocks/AAPL`

#### Get Financial Metrics
`GET /api/stocks/AAPL/financials?metricName=marketCap&reportingPeriod=TTM`

#### Get Historical Stock Prices
`GET /api/stocks/AAPL/prices?limit=50`

#### Get Available Data Sources
`GET /api/stocks/AAPL/sources`

#### Get Financial Documents & Filings
`GET /api/stocks/AAPL/documents?documentType=10-K`
