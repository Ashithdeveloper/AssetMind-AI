# AssetMind AI - Backend Core & API Services

AssetMind AI backend is an enterprise-grade financial data ingestion, quantitative analysis, real-time tracking, and RAG-powered intelligence engine built on Node.js, Express 5, TypeScript, MongoDB, and Qdrant.

---

## 🚀 Key Modules & Capabilities

1. **Authentication & Authorization**:
   - User registration and login with bcrypt password hashing (10 salt rounds).
   - Stateless JWT tokens (configurable expiration) protecting sensitive endpoints.
   - User profile management (`/api/auth/me`) and clean logout flow.
   - Comprehensive input validation using Zod schemas.

2. **Modular Multi-Source Scraping Engine**:
   - Unified `StockScraper` interface (`fetchHtml`).
   - **Method 1: Playwright** (Headless browser automation with dynamic content rendering and anti-bot headers).
   - **Method 2: ScrapingBee API** (Proxy-powered scraping fallback).
   - **11 Source-Specific Scraping Adapters**:
     - [Screener.in](https://www.screener.in/)
     - [Yahoo Finance](https://finance.yahoo.com/)
     - [StockAnalysis.com](https://stockanalysis.com/)
     - [MarketScreener](https://www.marketscreener.com/)
     - [Macrotrends](https://www.macrotrends.net/)
     - [CompaniesMarketCap](https://companiesmarketcap.com/)
     - [TradingView](https://www.tradingview.com/)
     - [Investing.com](https://www.investing.com/)
     - [Morningstar](https://www.morningstar.com/)
     - [SEC EDGAR](https://www.sec.gov/edgar/) (10-K, 10-Q disclosures)
     - [StockMarketCap](https://get.stockmarketcap.io/)

3. **Validation and Normalization Pipeline**:
   - Canonical metric name mapping (`market_cap`, `P/E`, `fcf`, etc. mapped to standardized camelCase).
   - Number multiplier parsing (`3.45T`, `185.2B`, `45,000 Cr`, negative brackets, percentages).
   - Symbol & currency normalization (ISO standard uppercase).
   - In-batch and cross-source duplicate detection with data quality scoring.

4. **Real-Time Market Engine & News Pipeline**:
   - Sub-60s automated quote refresh using Yahoo Finance API V8 for Indian (`.NS`, `.BO`) & global equities.
   - Multi-channel RSS news aggregator (Yahoo Finance, Google News, Economic Times, LiveMint).
   - Server-Sent Events (SSE) live streaming endpoints for ticker charts.

5. **Financial Knowledge RAG & Vector Engine**:
   - Vector storage and fast nearest-neighbor indexing with [Qdrant](https://qdrant.tech/).
   - Local on-device vector embeddings via `@xenova/transformers` (`all-MiniLM-L6-v2`).
   - Native integration with [Ollama](https://ollama.ai/) (`gpt-oss:20b-cloud`, `llama3`, `mistral`).
   - Evidence-grounded answers with precise document citations.

6. **Quantitative Analysis Engine**:
   - Algorithmic Buy/Sell scoring combining valuation, profitability, balance sheet health, and momentum.
   - Geopolitical and macro news risk analysis.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v20+) & TypeScript
- **Execution Engine**: `tsx`
- **Framework**: Express.js 5
- **Databases**: MongoDB (Mongoose ODM) & Qdrant Vector DB
- **Authentication**: JSON Web Tokens (JWT) & bcryptjs
- **Scraping**: Playwright, Cheerio, Axios, ScrapingBee API
- **Embeddings & AI**: `@xenova/transformers`, Ollama REST Client
- **Task Scheduling**: `node-cron`
- **Validation & Security**: Zod, Helmet, CORS

---

## 📂 Backend Project Structure

```
backend/
├── src/
│   ├── config/                          # MongoDB, env variables, Qdrant setup
│   ├── middleware/                      # Auth JWT middleware, error handlers
│   ├── models/                          # Mongoose schemas (Asset, FinancialData, User, etc.)
│   ├── modules/
│   │   ├── analysis/                    # Buy/Sell evaluation & geopolitical risk engine
│   │   ├── auth/                        # User registration, login, profile, JWT
│   │   ├── chat/                        # Conversational AI sessions & RAG orchestrator
│   │   ├── companies/                   # Company profiles, metrics, historical prices
│   │   ├── quality/                     # Data quality validator & deduplication
│   │   ├── rag/                         # Document chunking, vector sync, retrieval
│   │   ├── realtime/                    # Live quotes engine, RSS news parser, SSE
│   │   ├── scraping/                    # 11 source adapters, Playwright browser engine
│   │   ├── screener/                    # Multi-metric screener & live search
│   │   └── stocks/                      # Stock endpoints & management
│   ├── routes/                          # Master API index (/api)
│   ├── scripts/                         # Seeding, scraping batches, RAG sync
│   ├── tests/                           # Unit, integration, and workflow tests
│   ├── utils/                           # Standard API response & error formatters
│   ├── app.ts                           # Express app config & middleware
│   └── server.ts                        # HTTP server bootstrapper & scheduler
├── .env.example                         # Environment configuration template
├── package.json                         # Dependencies and npm scripts
├── tsconfig.json                        # TypeScript configuration
└── README.md                            # Backend documentation (this file)
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` in the `backend/` directory:

```bash
# On macOS/Linux:
cp .env.example .env

# On Windows PowerShell:
Copy-Item .env.example .env
```

Refer to `.env.example` for all configurable environment options.

---

## 🏃 Available Scripts

```bash
# Start backend in development mode with hot-reload
npm run dev

# Build TypeScript to JavaScript dist/
npm run build

# Start production build
npm start

# Run all automated tests
npm test

# Run RAG vector search & embedding tests
npm run test:rag

# Test deep financial analysis & company explorer
npm run test:explore

# Test Indian equity scraping & normalization
npm run test:india

# Run end-to-end demo workflow
npm run demo

# Seed 80+ top companies into database
npm run seed:companies

# Scrape Indian companies from Screener.in
npm run scrape:india

# Enrich existing company records
npm run enrich:companies

# Sync and vectorize documents into Qdrant
npm run sync:rag

# Crawl live market quotes
npm run crawl:market

# Check database statistics
npm run db:stats
```
