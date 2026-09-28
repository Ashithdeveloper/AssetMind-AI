# 💻 AssetMind AI — Frontend Web Application

> **High-Performance Financial Intelligence Dashboard, Interactive Market Visualizations & AI Investment Copilot**

Built with **React 19**, **TanStack Start**, **Tailwind CSS v4**, **Radix UI**, and **Recharts**.

---

## 🚀 Overview

The **AssetMind AI Frontend** is a modern, responsive web application designed for comprehensive financial analysis, portfolio management, real-time market monitoring, and AI-assisted equity research.

---

## 🌟 Key Pages & Views

| Route | View | Description |
|---|---|---|
| `/` | **Market Dashboard** | Real-time market indices, trending equities, portfolio glance, and live financial news feed. |
| `/company/:ticker` | **Deep Equity Research** | Comprehensive company fundamental analysis: interactive charts, financial statements (Income, Balance Sheet, Cash Flow), valuation ratios, buy/sell health scores, and news sentiment. |
| `/research` | **Stock Screener & Research** | Filter stocks across multiple valuation and fundamental metrics (P/E, ROCE, ROE, Market Cap, Debt/Equity) with on-demand scraping triggers. |
| `/portfolio` | **Portfolio Tracker** | Real-time equity holdings, P&L calculations, asset allocation, and performance metrics. |
| `/watchlist` | **Personal Watchlist** | Fast access to tracked stocks with live price updates and alerts. |
| `/guardian` | **Risk Sentinel ("Guardian")** | Autonomous risk analysis, portfolio concentration alerts, and volatility monitoring. |
| `/budget` | **Budget & Cash Flow** | Monthly cash flow, expense classification, and savings rate tracking. |
| `/mutual-funds` | **Mutual Funds** | Portfolio fund tracking and NAV metrics. |
| `/insurance` | **Insurance Manager** | Policy coverage tracking, premium due dates, and policy management. |
| `/assets` | **Net Worth & Asset Tracker**| Total net worth tracking across real estate, gold, equities, and cash balances. |
| `/login` | **Authentication** | Secure user login, session management, and profile access. |
| `/settings` | **Preferences & Settings** | Display preferences, API configurations, and account settings. |

---

## 🛠️ Technology Stack

- **Framework**: [React 19](https://react.dev/) + [TanStack Start](https://tanstack.com/start)
- **Routing**: [TanStack Router](https://tanstack.com/router) (file-based routing under `src/routes/`)
- **Server State & Caching**: [TanStack Query](https://tanstack.com/query)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + Custom Glassmorphism UI
- **Components**: [Radix UI](https://www.radix-ui.com/) primitives + Lucide Icons
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Forms & Validation**: React Hook Form + Zod
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/)

---

## 🏃 Getting Started Locally

### Prerequisites
- Node.js v20+
- Backend running on `http://localhost:5000` (see `../backend/README.md`)

### Setup & Launch

1. Install dependencies:
   ```bash
   npm install
   ```

2. Environment Configuration:
   ```bash
   # On macOS/Linux:
   cp .env.example .env

   # On Windows PowerShell:
   Copy-Item .env.example .env
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

5. Preview production build:
   ```bash
   npm run preview
   ```

---

## 📁 Source Directory Structure

```
frontend/src/
├── components/          # Reusable UI components & Radix wrappers
├── hooks/               # Custom React hooks (market data, media queries, etc.)
├── lib/
│   ├── api.ts           # Centralized Backend REST API client
│   ├── formatters.ts    # Currency, percentage, and date formatting utilities
│   └── market-data.ts   # Market status & calculation helpers
├── routes/              # TanStack file-based routes
│   ├── __root.tsx       # Root layout, navigation sidebar, and headers
│   ├── index.tsx        # Dashboard
│   ├── company.$ticker.tsx # Company detail view
│   ├── research.tsx     # Screener & research
│   └── ...              # Portfolio, Guardian, Assets, etc.
├── App.tsx              # App initialization
├── router.tsx           # Router configuration
└── styles.css           # Global CSS variables and design tokens
```
