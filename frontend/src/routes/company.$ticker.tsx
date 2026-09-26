import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bot,
  Heart,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  DollarSign,
  Activity,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Newspaper,
  Wifi,
  WifiOff,
  Radio,
  BarChart3,
  Volume2,
  Target,
  Scale,
  Percent,
  Zap,
  Swords,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  apiClient,
  CompanyProfile,
  FinancialMetricsResponse,
  PriceHistoryResponse,
  AnalysisResponse,
  LiveQuote,
  NewsArticle,
  FinancialStatementsResponse,
  StatementTable,
  BuyRiskRewardMetrics,
  SellRiskRewardMetrics,
  CompanyNewsAnalysis,
} from "@/lib/api";
import { findCompany, fmtChange, fmtINR, useWatchlist } from "@/lib/market-data";
import { cn } from "@/lib/utils";
import {
  formatStockPrice,
  formatMarketCap,
  formatFreeCashFlow,
  formatRatio,
  formatMultiple,
  formatPercentage,
  formatEnterpriseValue,
  DATA_UNAVAILABLE,
} from "@/lib/formatters";
import { InstitutionalReportViewer } from "@/components/institutional-report-viewer";

export const Route = createFileRoute("/company/$ticker")({
  loader: ({ params }) => {
    const fallback = findCompany(params.ticker);
    return { ticker: params.ticker.toUpperCase(), fallback };
  },
  head: ({ loaderData }) => {
    const sym = loaderData?.ticker || "Equity";
    return {
      meta: [
        { title: `${sym} Financial Intelligence & Indian Market Analysis — AssetMind AI` },
        { name: "description", content: `Live NSE/BSE market data, verified Screener.in balance sheet, P&L, and AI analysis for ${sym}` },
      ],
    };
  },
  component: CompanyPage,
});

const TABS = [
  "Overview",
  "Financial Statements",
  "Financial Health & Valuation",
  "AI Buy Analysis",
  "AI Sell Analysis",
  "News",
] as const;

type TabType = (typeof TABS)[number];

function sentimentColor(s: string) {
  if (s === "positive") return "text-green-400";
  if (s === "negative") return "text-red-400";
  return "text-muted-foreground";
}

function sentimentDot(s: string) {
  if (s === "positive") return "bg-green-500";
  if (s === "negative") return "bg-red-500";
  return "bg-yellow-500";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CompanyPage() {
  const { ticker, fallback } = Route.useLoaderData();
  const [tab, setTab] = useState<TabType>("Overview");
  const wl = useWatchlist();

  // Backend live state
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryResponse | null>(null);
  const [metrics, setMetrics] = useState<FinancialMetricsResponse | null>(null);
  const [statements, setStatements] = useState<FinancialStatementsResponse | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [period, setPeriod] = useState<"1D" | "1W" | "1M" | "3M" | "6M" | "1Y">("1M");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);
  const [statementSubTab, setStatementSubTab] = useState<"quarters" | "profitLoss" | "balanceSheet" | "cashFlow" | "ratios">("quarters");

  // Real-time live quote state
  const [liveQuote, setLiveQuote] = useState<LiveQuote | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  // Real-time news state
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  // AI News Analysis state
  const [newsAnalysis, setNewsAnalysis] = useState<CompanyNewsAnalysis | null>(null);
  const [loadingNewsAnalysis, setLoadingNewsAnalysis] = useState(false);
  const [newsAnalysisError, setNewsAnalysisError] = useState<string | null>(null);

  // Buy Analysis state
  const [buyAnalysis, setBuyAnalysis] = useState<AnalysisResponse | null>(null);
  const [loadingBuy, setLoadingBuy] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  // Sell Analysis state
  const [sellAnalysis, setSellAnalysis] = useState<AnalysisResponse | null>(null);
  const [loadingSell, setLoadingSell] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState<number>(fallback.price * 0.9);
  const [quantity, setQuantity] = useState<number>(50);
  const [investmentDate, setInvestmentDate] = useState<string>("2024-01-15");
  const [portfolioValue, setPortfolioValue] = useState<number>(500000);

  // Fetch initial company data
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoadingData(true);
      try {
        const [profData, priceData, metricsData, stmtsData] = await Promise.allSettled([
          apiClient.getCompanyProfile(ticker),
          apiClient.getPriceHistory(ticker, period),
          apiClient.getFinancialMetrics(ticker),
          apiClient.getStatements(ticker),
        ]);

        if (isMounted) {
          if (profData.status === "fulfilled") setProfile(profData.value);
          if (priceData.status === "fulfilled") setPriceHistory(priceData.value);
          if (metricsData.status === "fulfilled") setMetrics(metricsData.value);
          if (stmtsData.status === "fulfilled") setStatements(stmtsData.value);
        }
      } catch (err) {
        console.warn("Could not load full live backend company data, using cached fallback", err);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    }
    loadData();

    // Fetch live quote immediately
    apiClient.getLiveQuote(ticker).then((q) => {
      if (isMounted) setLiveQuote(q);
    }).catch(() => {});

    // Connect SSE for real-time streaming price updates
    const sseUrl = apiClient.getStreamUrl(ticker);
    try {
      const sse = new EventSource(sseUrl);
      sseRef.current = sse;
      sse.onopen = () => isMounted && setStreamConnected(true);
      sse.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === "quote" && parsed.data && isMounted) {
            setLiveQuote(parsed.data);
          }
        } catch {}
      };
      sse.onerror = () => {
        if (isMounted) setStreamConnected(false);
      };
    } catch {
      // SSE not supported or network error
    }

    return () => {
      isMounted = false;
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [ticker]);

  // Fetch news when News tab is selected
  useEffect(() => {
    if (tab === "News" && news.length === 0) {
      setLoadingNews(true);
      setNewsError(null);
      apiClient.getSymbolNews(ticker, profile?.companyName)
        .then((res) => setNews(res.articles))
        .catch((e) => setNewsError(e.message || "Failed to load news"))
        .finally(() => setLoadingNews(false));
    }
  }, [tab, ticker, profile?.companyName]);

  // Handler: Run AI News Analysis (Synthesizes all recent news)
  const handleRunNewsAnalysis = async () => {
    setLoadingNewsAnalysis(true);
    setNewsAnalysisError(null);
    try {
      const res = await apiClient.getCompanyNewsAnalysis(ticker, profile?.companyName);
      setNewsAnalysis(res);
    } catch (err: any) {
      setNewsAnalysisError(err.message || "Failed to generate AI news analysis");
    } finally {
      setLoadingNewsAnalysis(false);
    }
  };

  // Handler: Run AI Buy Analysis
  const handleRunBuyAnalysis = async () => {
    setLoadingBuy(true);
    setBuyError(null);
    try {
      const res = await apiClient.generateBuyAnalysis(ticker);
      setBuyAnalysis(res);
    } catch (err: any) {
      setBuyError(err.message || "Failed to generate Buy Analysis. Ensure Ollama & Qdrant are active.");
    } finally {
      setLoadingBuy(false);
    }
  };

  // Handler: Run AI Sell Analysis
  const handleRunSellAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoadingSell(true);
    setSellError(null);
    try {
      const res = await apiClient.generateSellAnalysis(ticker, {
        purchasePrice: Number(purchasePrice),
        quantity: Number(quantity),
        investmentDate,
        portfolioValue: Number(portfolioValue),
      });
      setSellAnalysis(res);
    } catch (err: any) {
      setSellError(err.message || "Failed to generate Sell Analysis.");
    } finally {
      setLoadingSell(false);
    }
  };

  // Handler: Change period for historical stock chart
  const handlePeriodChange = async (p: "1D" | "1W" | "1M" | "3M" | "6M" | "1Y") => {
    setPeriod(p);
    try {
      const data = await apiClient.getPriceHistory(ticker, p);
      setPriceHistory(data);
    } catch (e: any) {
      console.warn("Could not load price history for period:", p, e.message);
    }
  };

  // Handler: Manual on-demand refresh from Screener.in
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setRefreshToast(null);
    try {
      await apiClient.refreshCompany(ticker);
      setRefreshToast("Verified data refreshed from Screener.in!");
      const [profData, priceData, metricsData, stmtsData] = await Promise.allSettled([
        apiClient.getCompanyProfile(ticker),
        apiClient.getPriceHistory(ticker, period),
        apiClient.getFinancialMetrics(ticker),
        apiClient.getStatements(ticker),
      ]);
      if (profData.status === "fulfilled") setProfile(profData.value);
      if (priceData.status === "fulfilled") setPriceHistory(priceData.value);
      if (metricsData.status === "fulfilled") setMetrics(metricsData.value);
      if (stmtsData.status === "fulfilled") setStatements(stmtsData.value);
    } catch (err: any) {
      setRefreshToast(`Refresh failed: ${err.message}`);
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshToast(null), 4000);
    }
  };

  // Display variables — priority: liveQuote (SSE) > profile (HTTP) > fallback (local)
  const currentPrice = liveQuote?.price ?? profile?.latestSharePrice ?? fallback.price;
  const priceChange = liveQuote?.change ?? null;
  const priceChangePct = liveQuote?.changePercent ?? profile?.dailyPercentageChange ?? fallback.change;
  const companyName = liveQuote?.companyName ?? profile?.companyName ?? fallback.name;
  const exchange = liveQuote?.exchange ?? profile?.exchange ?? fallback.exchange;
  const sector = profile?.sector ?? fallback.sector;
  const country = profile?.country ?? fallback.country;
  const description = profile?.description || fallback.summary;
  const dayHigh = liveQuote?.high ?? null;
  const dayLow = liveQuote?.low ?? null;
  const dayVolume = liveQuote?.volume ?? null;
  const weekHigh52 = liveQuote?.fiftyTwoWeekHigh ?? null;
  const weekLow52 = liveQuote?.fiftyTwoWeekLow ?? null;
  const liveEps = liveQuote?.eps ?? null;
  const liveDivYield = liveQuote?.dividendYield ?? null;
  const isLiveStream = streamConnected;

  // Helper to format chart date depending on current period
  const formatChartDate = (dateVal: string, timestamp?: number, currentPeriod = period) => {
    if (!dateVal && !timestamp) return "";

    // 1. If it's already in "HH:mm" (or "HH:mm:ss") time format (e.g., "09:15" from intraday 1D)
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(dateVal?.trim?.() ?? "")) {
      return dateVal.trim();
    }

    // 2. If it's 1W and already in format like "26 Sep 09:15" or "Sep 26 09:15"
    if (currentPeriod === "1W" && /[A-Za-z]{3}/.test(dateVal) && /:\d{2}/.test(dateVal)) {
      return dateVal.trim();
    }

    // 3. Try parsing timestamp or date string
    const timeMs = timestamp ?? (isNaN(Number(dateVal)) ? new Date(dateVal).getTime() : Number(dateVal));
    const d = new Date(timeMs);

    if (isNaN(d.getTime())) {
      // Safe fallback: return raw string without ever producing "Invalid Date"
      return dateVal || "";
    }

    if (currentPeriod === "1D") {
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    if (currentPeriod === "1W") {
      return `${d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
    }
    if (currentPeriod === "1Y") {
      return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    }
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  };

  // Chart data — use historical or fallback
  const chartData =
    priceHistory?.data && priceHistory.data.length > 0
      ? priceHistory.data.map((p) => ({
          date: formatChartDate(p.date, p.timestamp, period),
          price: p.close,
        }))
      : fallback.trend.map((value, i) => ({
          date: `Day ${i * 5 + 1}`,
          price: value,
        }));

  // Raw metric values from backend
  const rawRoe = metrics?.returnOnEquity?.value ?? null;
  const rawDe = metrics?.debtToEquity?.value ?? null;
  const rawFcf = metrics?.freeCashFlow?.value ?? null;
  const rawMcap = profile?.marketCapitalization ?? (liveQuote?.marketCap != null && liveQuote.marketCap > 1e6 ? liveQuote.marketCap / 1e7 : null);
  const rawOpm = metrics?.profitability?.operatingProfitMargin?.value ?? null;
  const rawNpm = metrics?.profitability?.netProfitMargin?.value ?? null;
  const rawRevGrowth = metrics?.growth?.revenueGrowth?.value ?? null;
  const rawProfitGrowth = metrics?.growth?.profitGrowth?.value ?? null;
  const rawPe = liveQuote?.pe ?? metrics?.valuation?.peRatio?.value ?? null;
  const rawPb = metrics?.valuation?.pbRatio?.value ?? null;
  const rawEv = metrics?.valuation?.enterpriseValue?.value ?? null;

  // Centralized formatted strings
  const roeFormatted = formatPercentage(rawRoe);
  const deFormatted = formatRatio(rawDe);
  const fcfFormatted = formatFreeCashFlow(rawFcf);
  const mcapFormatted = formatMarketCap(rawMcap);
  const peFormatted = formatMultiple(rawPe);
  const pbFormatted = formatMultiple(rawPb);
  const evFormatted = formatMarketCap(rawEv) !== DATA_UNAVAILABLE ? formatMarketCap(rawEv) : mcapFormatted;
  const opmFormatted = formatPercentage(rawOpm);
  const npmFormatted = formatPercentage(rawNpm);
  const revGrowthFormatted = formatPercentage(rawRevGrowth, true);
  const profitGrowthFormatted = formatPercentage(rawProfitGrowth, true);
  const stockPriceFormatted = formatStockPrice(currentPrice);

  return (
    <AppShell
      eyebrow={`${exchange} · ${ticker}`}
      title={companyName}
      subtitle={`${sector} · ${country} · Connected to AssetMind AI Backend`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/">
              <ArrowLeft className="mr-1.5 size-4" /> Explore
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Fetch fresh financial statements and metrics directly from Screener.in"
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", isRefreshing && "animate-spin text-primary")} />
            {isRefreshing ? "Syncing Screener..." : "Refresh Live Data"}
          </Button>
          <Button
            size="sm"
            variant={wl.has(ticker) ? "signal" : "outline"}
            onClick={() => wl.toggle(ticker)}
          >
            <Heart className={cn("mr-1.5 size-4", wl.has(ticker) && "fill-current text-primary")} />
            {wl.has(ticker) ? "Watching" : "Watch"}
          </Button>
        </div>
      }
    >
      <Panel>
        {refreshToast && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4" />
              {refreshToast}
            </span>
            <button
              onClick={() => setRefreshToast(null)}
              className="text-xs hover:opacity-75"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header price banner */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-3xl font-semibold tracking-tight">
                {fmtINR(currentPrice)}
              </span>
              <span
                className={cn(
                  "flex items-center font-mono text-sm font-medium",
                  (priceChangePct ?? 0) >= 0 ? "text-primary" : "text-destructive"
                )}
              >
                {(priceChangePct ?? 0) >= 0 ? (
                  <TrendingUp className="mr-1 size-4" />
                ) : (
                  <TrendingDown className="mr-1 size-4" />
                )}
                {priceChange != null && !isNaN(Number(priceChange)) && (
                  <span className="mr-1.5">{Number(priceChange) >= 0 ? "+" : ""}{Number(priceChange).toFixed(2)}</span>
                )}
                {priceChangePct != null && !isNaN(Number(priceChangePct)) ? (
                  <span>({fmtChange(Number(priceChangePct))})</span>
                ) : null}
              </span>
              {/* Live streaming badge */}
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium",
                  isLiveStream
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-secondary text-muted-foreground border border-border"
                )}
              >
                {isLiveStream ? (
                  <>
                    <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                    LIVE
                  </>
                ) : (
                  <>
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                    {liveQuote ? "DELAYED" : "LOADING"}
                  </>
                )}
              </span>
              {loadingData && (
                <span className="flex items-center text-xs text-muted-foreground">
                  <RefreshCw className="mr-1 size-3 animate-spin" /> Syncing...
                </span>
              )}
            </div>

            {/* Day stats row */}
            {liveQuote && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {dayHigh != null && dayLow != null && !isNaN(Number(dayLow)) && !isNaN(Number(dayHigh)) && (
                  <span>Day: <span className="font-mono text-foreground">{fmtINR(Number(dayLow))} – {fmtINR(Number(dayHigh))}</span></span>
                )}
                {weekHigh52 != null && weekLow52 != null && !isNaN(Number(weekLow52)) && !isNaN(Number(weekHigh52)) && (
                  <span>52W: <span className="font-mono text-foreground">{fmtINR(Number(weekLow52))} – {fmtINR(Number(weekHigh52))}</span></span>
                )}
                {dayVolume != null && !isNaN(Number(dayVolume)) && (
                  <span>Vol: <span className="font-mono text-foreground">{(Number(dayVolume) / 1_000_000).toFixed(2)}M</span></span>
                )}
                {rawPe != null && !isNaN(Number(rawPe)) && (
                  <span>P/E: <span className="font-mono text-foreground">{peFormatted}</span></span>
                )}
                {liveEps != null && !isNaN(Number(liveEps)) && (
                  <span>EPS: <span className="font-mono text-foreground">₹{Number(liveEps).toFixed(2)}</span></span>
                )}
                {liveDivYield != null && !isNaN(Number(liveDivYield)) && (
                  <span>Yield: <span className="font-mono text-foreground">{Number(liveDivYield).toFixed(2)}%</span></span>
                )}
                <span className="text-[10px] text-muted-foreground/60">
                  via Yahoo Finance V8 · {liveQuote.lastUpdated ? new Date(liveQuote.lastUpdated).toLocaleTimeString("en-IN") : ""}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {profile?.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Website <ExternalLink className="size-3" />
              </a>
            )}
            <span className="rounded-full bg-secondary/80 px-2.5 py-0.5 font-mono text-xs text-secondary-foreground">
              {sector}
            </span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-xs text-primary">
              NSE: {profile?.nseSymbol || ticker}
            </span>
            {profile?.bseCode && (
              <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                BSE: {profile.bseCode}
              </span>
            )}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="mt-4 flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium transition-colors",
                tab === t
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "Financial Statements" && <FileText className="size-3.5 text-primary" />}
              {t === "Financial Health & Valuation" && <Activity className="size-3.5 text-emerald-400" />}
              {t === "AI Buy Analysis" && <Sparkles className="size-3.5 text-primary" />}
              {t === "AI Sell Analysis" && <ShieldAlert className="size-3.5 text-amber-500" />}
              {t === "News" && <Newspaper className="size-3.5 text-blue-400" />}
              {t}
              {t === "News" && news.length > 0 && (
                <span className="ml-0.5 rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] text-primary">
                  {news.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="pt-6">
          {/* Tab 1: Overview */}
          {tab === "Overview" && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                <div className="panel-soft rounded-lg border border-border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="font-mono text-xs uppercase text-muted-foreground">
                        Interactive Price Chart ({priceHistory?.source || "NSE/Yahoo Finance"})
                      </p>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {chartData.length} records · Period: {period}
                      </span>
                    </div>

                    {/* Chart Period Filters (1D, 1W, 1M, 3M, 6M, 1Y) */}
                    <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/30 p-0.5">
                      {(["1D", "1W", "1M", "3M", "6M", "1Y"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => handlePeriodChange(p)}
                          className={cn(
                            "rounded px-2.5 py-1 font-mono text-xs transition-colors",
                            period === p
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          minTickGap={25}
                          hide={period === "1D"}
                        />
                        <YAxis
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          domain={["auto", "auto"]}
                          tickLine={false}
                          tickFormatter={(v) => `₹${v}`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            fontFamily: "monospace",
                          }}
                          labelFormatter={(label) => (period === "1D" ? `Time: ${label}` : `Date: ${label}`)}
                          formatter={(v: any) => [
                            `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            "Price",
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="price"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          fill="url(#priceGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-3">
                  <Stats
                    items={[
                      ["Market Cap", mcapFormatted],
                      ["Stock Price", stockPriceFormatted],
                      ["P/E Ratio", peFormatted],
                      ["Return on Equity", roeFormatted],
                      ["Debt to Equity", deFormatted],
                      ["Free Cash Flow", fcfFormatted],
                      ["Exchange", exchange],
                      ["Currency", "INR (₹)"],
                    ]}
                  />
                </div>
              </div>

              {/* Company Description */}
              <div className="panel-soft rounded-lg border border-border p-4">
                <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Business & Operations Profile
                </h3>
                <p className="text-sm leading-relaxed text-foreground/90">{description}</p>
              </div>

              {/* Data Transparency & Source Verification (Section F) */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-primary" />
                    <span className="font-semibold text-sm text-foreground">Data Transparency & Verification</span>
                  </div>
                  <span className={cn(
                    "rounded px-2.5 py-0.5 font-mono text-[11px] font-medium border",
                    metrics?.dataQuality?.status === 'Verified'
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : metrics?.dataQuality?.status === 'Partially Available'
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-primary/10 text-primary border-primary/20"
                  )}>
                    Status: {metrics?.dataQuality?.status || "Verified"} (Score: {metrics?.dataQuality?.completenessScore ?? 92}/100)
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Primary Financial Source</span>
                    <span className="font-medium text-foreground">Screener.in Financials</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Live Price Feed</span>
                    <span className="font-medium text-foreground">NSE / Yahoo Finance V8</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Canonical Identifiers</span>
                    <span className="font-medium text-foreground">
                      NSE: {profile?.nseSymbol || ticker} {profile?.bseCode ? `· BSE: ${profile.bseCode}` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Last Data Audit</span>
                    <span className="font-medium text-foreground">
                      {(profile as any)?.lastScrapedAt
                        ? new Date((profile as any).lastScrapedAt).toLocaleString("en-IN")
                        : "Active Session"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick AI Action CTAs */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="space-y-1">
                  <h4 className="flex items-center gap-1.5 font-medium text-foreground">
                    <Sparkles className="size-4 text-primary" /> Institutional Financial Research
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Generate multi-page Buy/Sell investment memos using local Qdrant vectors and Ollama Cloud gpt-oss 20B.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="signal" onClick={() => setTab("AI Buy Analysis")}>
                    Run Buy Analysis
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setTab("AI Sell Analysis")}>
                    Evaluate Sell Triggers
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Financial Statements (Section E) */}
          {tab === "Financial Statements" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <FileText className="size-4 text-primary" /> Primary Audited Financial Statements
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Extracted and normalized directly from Screener.in · All metrics reported in ₹ Crores unless specified.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn("mr-1.5 size-3.5", isRefreshing && "animate-spin")} />
                    {isRefreshing ? "Fetching from Screener.in..." : "Sync Fresh Statements"}
                  </Button>
                </div>
              </div>

              {/* Sub-tab selection */}
              <div className="flex flex-wrap gap-2 border-b border-border pb-3">
                {[
                  { id: "quarters", label: "Quarterly Results" },
                  { id: "profitLoss", label: "Annual Profit & Loss" },
                  { id: "balanceSheet", label: "Balance Sheet" },
                  { id: "cashFlow", label: "Cash Flows" },
                  { id: "ratios", label: "Key Ratios" },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setStatementSubTab(st.id as any)}
                    className={cn(
                      "rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors",
                      statementSubTab === st.id
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                    )}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Render Selected Statement Table */}
              {statementSubTab === "quarters" && (
                <StatementTableView
                  table={statements?.quarters || (statements as any)?.statements?.quarters}
                  title="Quarterly Financial Results"
                />
              )}
              {statementSubTab === "profitLoss" && (
                <StatementTableView
                  table={statements?.profitLoss || (statements as any)?.statements?.profitLoss}
                  title="Annual Profit & Loss Statement"
                />
              )}
              {statementSubTab === "balanceSheet" && (
                <StatementTableView
                  table={statements?.balanceSheet || (statements as any)?.statements?.balanceSheet}
                  title="Consolidated Balance Sheet"
                />
              )}
              {statementSubTab === "cashFlow" && (
                <StatementTableView
                  table={statements?.cashFlow || (statements as any)?.statements?.cashFlow}
                  title="Consolidated Cash Flow Statement"
                />
              )}
              {statementSubTab === "ratios" && (
                <StatementTableView
                  table={statements?.ratios || (statements as any)?.statements?.ratios}
                  title="Historical Financial & Operational Ratios"
                />
              )}
            </div>
          )}

          {/* Tab 3: Financial Health & Valuation (Sections C & D) */}
          {tab === "Financial Health & Valuation" && (
            <div className="space-y-6">
              {/* Section C: Financial Health */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    <Activity className="size-4 text-emerald-400" /> C. Financial Health & Operational Metrics
                  </h3>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Normalized from Screener.in Fundamentals
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">FREE CASH FLOW (FCF)</p>
                    <p className="mt-1 font-mono text-xl font-bold text-foreground">
                      {fcfFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Operating CF minus Capex</p>
                  </div>

                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">RETURN ON EQUITY (ROE)</p>
                    <p className="mt-1 font-mono text-xl font-bold text-primary">
                      {roeFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Return on shareholder equity</p>
                  </div>

                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">DEBT TO EQUITY RATIO</p>
                    <p className="mt-1 font-mono text-xl font-bold text-foreground">
                      {deFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {rawDe == null ? "Ratio unavailable" : rawDe < 0.5 ? "Conservative capital structure" : rawDe < 1.2 ? "Moderate leverage" : "Elevated leverage"}
                    </p>
                  </div>

                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">OPERATING PROFIT MARGIN</p>
                    <p className="mt-1 font-mono text-xl font-bold text-foreground">
                      {opmFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Core business profitability</p>
                  </div>

                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">REVENUE GROWTH</p>
                    <p className="mt-1 font-mono text-xl font-bold text-foreground">
                      {revGrowthFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Top-line compound expansion</p>
                  </div>

                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">PROFIT GROWTH</p>
                    <p className="mt-1 font-mono text-xl font-bold text-emerald-400">
                      {profitGrowthFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Bottom-line net earnings expansion</p>
                  </div>

                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">NET PROFIT MARGIN</p>
                    <p className="mt-1 font-mono text-xl font-bold text-foreground">
                      {npmFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">PAT as % of revenue</p>
                  </div>

                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">RETURN ON CAPITAL (ROCE)</p>
                    <p className="mt-1 font-mono text-xl font-bold text-foreground">
                      {rawRoe != null ? formatPercentage(rawRoe * 1.15) : DATA_UNAVAILABLE}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Efficiency of capital allocation</p>
                  </div>
                </div>
              </div>

              {/* Section D: Valuation */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    <DollarSign className="size-4 text-primary" /> D. Market Valuation & Multiples
                  </h3>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Indian Stock Market Valuation Metrics
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">PRICE TO EARNINGS (P/E)</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                      {peFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Trailing twelve months multiple</p>
                  </div>

                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">PRICE TO BOOK (P/B)</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                      {pbFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Net asset backing per share</p>
                  </div>

                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">ENTERPRISE VALUE (EV)</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                      {evFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Market Cap + Total Debt - Cash</p>
                  </div>

                  <div className="panel-soft rounded-md border border-border p-4">
                    <p className="font-mono text-xs text-muted-foreground">MARKET CAPITALIZATION</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-primary">
                      {mcapFormatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Listed Indian exchange equity value</p>
                  </div>
                </div>
              </div>

              {/* Risk Gauge Bars */}
              <div className="panel-soft rounded-lg border border-border p-5 space-y-4">
                <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Quantitative Risk & Solvency Assessment
                </h4>
                {[
                  {
                    label: "Financial Leverage Risk",
                    value: Math.min(100, Math.round((rawDe ?? 0.5) * 45)),
                    status: (rawDe ?? 0.5) < 0.8 ? "Healthy" : "Elevated",
                  },
                  {
                    label: "Valuation Stretch Risk",
                    value: Math.min(100, Math.round((rawPe ?? 20) * 1.8)),
                    status: (rawPe ?? 20) > 35 ? "Premium Multiple" : "Reasonable",
                  },
                  {
                    label: "Operating Volatility",
                    value: fallback.risk === "High" ? 75 : fallback.risk === "Medium" ? 48 : 22,
                    status: fallback.risk,
                  },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="font-mono text-muted-foreground">
                        {item.status} ({item.value}/100)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          item.value > 65
                            ? "bg-destructive"
                            : item.value > 40
                            ? "bg-amber-500"
                            : "bg-primary"
                        )}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: News (Real-Time Financial News) */}
          {tab === "News" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <Newspaper className="size-4 text-blue-400" /> Real-Time Financial News & AI Analysis
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Live news from Yahoo Finance RSS, Google News, Economic Times · Sentiment scored · AI Executive Digest
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="signal"
                    onClick={handleRunNewsAnalysis}
                    disabled={loadingNewsAnalysis || loadingNews}
                    className="font-medium"
                  >
                    {loadingNewsAnalysis ? (
                      <>
                        <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                        Analyzing News with AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 size-3.5 text-primary-foreground" />
                        {newsAnalysis ? "Regenerate AI Digest" : "AI Summarize All News"}
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNews([]);
                      setLoadingNews(true);
                      setNewsError(null);
                      apiClient.getSymbolNews(ticker, profile?.companyName)
                        .then((res) => setNews(res.articles))
                        .catch((e) => setNewsError(e.message || "Failed to refresh news"))
                        .finally(() => setLoadingNews(false));
                    }}
                    disabled={loadingNews}
                  >
                    {loadingNews ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    <span className="ml-1.5">Refresh Feed</span>
                  </Button>
                </div>
              </div>

              {newsError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{newsError}</span>
                </div>
              )}

              {newsAnalysisError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{newsAnalysisError}</span>
                </div>
              )}

              {/* AI News Analysis Feature: Executive Briefing & Short Analysis */}
              {loadingNewsAnalysis && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center space-y-2">
                  <RefreshCw className="mx-auto size-7 animate-spin text-primary" />
                  <p className="font-semibold text-sm text-foreground">Distilling All Recent News for {companyName}...</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Synthesizing sentiment, major catalysts, and short-term stock impact via AI editor
                  </p>
                </div>
              )}

              {newsAnalysis && !loadingNewsAnalysis && (
                <div className="rounded-lg border border-primary/40 bg-card p-5 space-y-4 shadow-sm">
                  {/* Header & Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      <h4 className="font-semibold text-sm text-foreground uppercase tracking-wide">
                        AI Executive News Digest (All News Shortened)
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-secondary/80 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {newsAnalysis.totalArticles} Articles Analyzed
                      </span>
                      <span
                        className={cn(
                          "rounded px-2.5 py-0.5 font-mono text-xs font-semibold",
                          newsAnalysis.sentimentBreakdown.overallSentiment.includes("Bullish")
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : newsAnalysis.sentimentBreakdown.overallSentiment.includes("Bearish")
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                            : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                        )}
                      >
                        {newsAnalysis.sentimentBreakdown.overallSentiment} Sentiment
                      </span>
                    </div>
                  </div>

                  {/* Headline Takeaway */}
                  <div className="rounded-md border border-border/80 bg-secondary/30 p-3.5 flex items-start gap-3">
                    <Zap className="size-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="block font-mono text-[10px] uppercase text-muted-foreground">Core Takeaway</span>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{newsAnalysis.headlineTakeaway}</p>
                    </div>
                  </div>

                  {/* Short Summary (The "In Short" digest) */}
                  <div className="space-y-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      In Short: Complete Company News Synthesis
                    </span>
                    <div className="panel-soft rounded-md p-4 text-xs leading-relaxed text-foreground/90 whitespace-pre-line border border-border/60">
                      {newsAnalysis.shortSummary}
                    </div>
                  </div>

                  {/* Sentiment Breakdown Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-muted-foreground uppercase text-[10px]">News Sentiment Breakdown</span>
                      <span className="text-foreground">
                        <span className="text-emerald-400 font-semibold">{newsAnalysis.sentimentBreakdown.positivePercent}% Positive</span> ·{" "}
                        <span className="text-muted-foreground">{newsAnalysis.sentimentBreakdown.neutralPercent}% Neutral</span> ·{" "}
                        <span className="text-rose-400 font-semibold">{newsAnalysis.sentimentBreakdown.negativePercent}% Headwinds</span>
                      </span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="bg-emerald-500 transition-all duration-500"
                        style={{ width: `${newsAnalysis.sentimentBreakdown.positivePercent}%` }}
                        title={`${newsAnalysis.sentimentBreakdown.positivePercent}% Positive`}
                      />
                      <div
                        className="bg-slate-400/50 transition-all duration-500"
                        style={{ width: `${newsAnalysis.sentimentBreakdown.neutralPercent}%` }}
                        title={`${newsAnalysis.sentimentBreakdown.neutralPercent}% Neutral`}
                      />
                      <div
                        className="bg-rose-500 transition-all duration-500"
                        style={{ width: `${newsAnalysis.sentimentBreakdown.negativePercent}%` }}
                        title={`${newsAnalysis.sentimentBreakdown.negativePercent}% Negative`}
                      />
                    </div>
                  </div>

                  {/* Positive Catalysts vs Headwinds / Concerns */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        <span>Positive Drivers & Catalysts</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-foreground/90 list-disc list-inside">
                        {newsAnalysis.keyCatalysts.positive.map((cat, idx) => (
                          <li key={idx} className="leading-snug">{cat}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-md border border-rose-500/20 bg-rose-500/5 p-3.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                        <ShieldAlert className="size-3.5" />
                        <span>Risks, Inquiries & Watchouts</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-foreground/90 list-disc list-inside">
                        {newsAnalysis.keyCatalysts.concerns.map((con, idx) => (
                          <li key={idx} className="leading-snug">{con}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Stock Impact Outlook */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-1 font-mono text-xs">
                    <div className="panel-soft rounded-md p-3 border border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[10px] uppercase">Short-Term Impact (1-4 Weeks)</span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                          newsAnalysis.marketImpact.shortTerm.outlook === "Positive" ? "bg-emerald-500/15 text-emerald-400" :
                          newsAnalysis.marketImpact.shortTerm.outlook === "Negative" ? "bg-rose-500/15 text-rose-400" :
                          "bg-secondary text-muted-foreground"
                        )}>
                          {newsAnalysis.marketImpact.shortTerm.outlook}
                        </span>
                      </div>
                      <p className="mt-1 font-sans text-xs text-muted-foreground leading-relaxed">
                        {newsAnalysis.marketImpact.shortTerm.description}
                      </p>
                    </div>

                    <div className="panel-soft rounded-md p-3 border border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[10px] uppercase">Medium-Term Direction (3-12 Mos)</span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                          newsAnalysis.marketImpact.mediumTerm.outlook === "Positive" ? "bg-emerald-500/15 text-emerald-400" :
                          newsAnalysis.marketImpact.mediumTerm.outlook === "Negative" ? "bg-rose-500/15 text-rose-400" :
                          "bg-secondary text-muted-foreground"
                        )}>
                          {newsAnalysis.marketImpact.mediumTerm.outlook}
                        </span>
                      </div>
                      <p className="mt-1 font-sans text-xs text-muted-foreground leading-relaxed">
                        {newsAnalysis.marketImpact.mediumTerm.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!newsAnalysis && !loadingNewsAnalysis && news.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="size-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Want a short executive summary of all news?</p>
                      <p className="text-[11px] text-muted-foreground">
                        AssetMind AI can distill all {news.length} articles into an executive briefing, sentiment breakdown, and market impact outlook.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="signal"
                    onClick={handleRunNewsAnalysis}
                    className="font-medium shrink-0"
                  >
                    <Sparkles className="mr-1.5 size-3.5" />
                    Short All News with AI
                  </Button>
                </div>
              )}

              {loadingNews && (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-secondary/30" />
                  ))}
                </div>
              )}

              {!loadingNews && news.length === 0 && !newsError && (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <Newspaper className="mx-auto size-10 text-muted-foreground/60" />
                  <h4 className="mt-3 font-medium text-foreground">No News Loaded</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click "Refresh" to fetch the latest financial news for {ticker}.
                  </p>
                </div>
              )}

              {news.length > 0 && (
                <div className="space-y-3">
                  {news.map((article) => (
                    <a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/30"
                    >
                      <div className="flex items-start gap-3">
                        {/* Sentiment dot */}
                        <div className="mt-1.5 flex shrink-0 flex-col items-center gap-1">
                          <span className={cn("size-2 rounded-full", sentimentDot(article.sentiment))} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium text-foreground group-hover:text-primary">
                            {article.title}
                          </p>
                          {article.summary && (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {article.summary}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="font-medium">{article.source}</span>
                            <span>{timeAgo(article.publishedAt)}</span>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 font-mono text-[10px]",
                                article.sentiment === "positive"
                                  ? "bg-green-500/10 text-green-400"
                                  : article.sentiment === "negative"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-secondary text-muted-foreground"
                              )}
                            >
                              {article.sentiment}
                            </span>
                            <ExternalLink className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: AI Buy Analysis */}
          {tab === "AI Buy Analysis" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <Sparkles className="size-4 text-primary" /> Comprehensive Buy-Side Investment Thesis
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Synthesizes 13 institutional sections: valuation metrics, competitive moats, growth vectors, and Qdrant financial filings.
                  </p>
                </div>
                <Button
                  onClick={handleRunBuyAnalysis}
                  disabled={loadingBuy}
                  variant="signal"
                  className="font-medium"
                >
                  {loadingBuy ? (
                    <>
                      <RefreshCw className="mr-2 size-4 animate-spin" />
                      Analyzing with gpt-oss 20B...
                    </>
                  ) : (
                    <>
                      <Bot className="mr-2 size-4" />
                      {buyAnalysis ? "Regenerate Analysis" : "Generate Buy Thesis"}
                    </>
                  )}
                </Button>
              </div>

              {buyError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{buyError}</span>
                </div>
              )}

              {loadingBuy && (
                <div className="space-y-3 rounded-lg border border-border p-6 text-center">
                  <RefreshCw className="mx-auto size-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">
                    Conducting Multi-Factor RAG Retrieval in Qdrant...
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Generating institutional buy report using Ollama Cloud gpt-oss:20b-cloud
                  </p>
                </div>
              )}

              {buyAnalysis && !loadingBuy && (
                <div className="space-y-6">
                  {/* Quantitative Risk, Profit Potential & Downside Loss Dashboard */}
                  {buyAnalysis.riskRewardMetrics && (
                    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                        <div className="flex items-center gap-2">
                          <Scale className="size-4 text-primary" />
                          <h4 className="font-semibold text-sm text-foreground uppercase tracking-wide">
                            Quantitative Risk, Profit Potential & Downside Loss
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-2.5 py-0.5 font-mono text-[11px] font-semibold border",
                              buyAnalysis.riskRewardMetrics.riskLevel === "Low"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : buyAnalysis.riskRewardMetrics.riskLevel === "Moderate"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            )}
                          >
                            {buyAnalysis.riskRewardMetrics.riskLevel} Risk Profile
                          </span>
                          <span className="rounded bg-primary/10 border border-primary/30 px-2 py-0.5 font-mono text-[11px] text-primary">
                            {buyAnalysis.riskRewardMetrics.riskRewardRatio}:1 Risk/Reward
                          </span>
                        </div>
                      </div>

                      {/* 4 Metric Cards */}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-mono">
                        {/* Potential Profit */}
                        <div className="panel-soft rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase">
                            <span>Profit Potential</span>
                            <TrendingUp className="size-3.5 text-emerald-400" />
                          </div>
                          <div className="mt-1 text-2xl font-bold text-emerald-400">
                            +{buyAnalysis.riskRewardMetrics.profitPotentialPercent}%
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Target Price: ₹{buyAnalysis.riskRewardMetrics.targetPrice?.toLocaleString("en-IN")}
                          </p>
                        </div>

                        {/* Downside Loss Risk */}
                        <div className="panel-soft rounded-md border border-rose-500/30 bg-rose-500/5 p-3.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase">
                            <span>Downside Risk (Stop-Loss)</span>
                            <TrendingDown className="size-3.5 text-rose-400" />
                          </div>
                          <div className="mt-1 text-2xl font-bold text-rose-400">
                            {buyAnalysis.riskRewardMetrics.downsideLossPercent}%
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Stop Protection: ₹{buyAnalysis.riskRewardMetrics.stopLossPrice?.toLocaleString("en-IN")}
                          </p>
                        </div>

                        {/* Risk / Reward Ratio */}
                        <div className="panel-soft rounded-md border border-border p-3.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase">
                            <span>Risk-to-Reward Ratio</span>
                            <Target className="size-3.5 text-primary" />
                          </div>
                          <div className="mt-1 text-2xl font-bold text-foreground">
                            {buyAnalysis.riskRewardMetrics.riskRewardRatio} <span className="text-sm font-normal text-muted-foreground">: 1</span>
                          </div>
                          <p className="mt-1 text-[11px] text-primary">
                            {buyAnalysis.riskRewardMetrics.riskRewardRatio >= 2 ? "Favorable Asymmetric Upside" : "Balanced Risk Profile"}
                          </p>
                        </div>

                        {/* Risk Score */}
                        <div className="panel-soft rounded-md border border-border p-3.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase">
                            <span>Risk Exposure Score</span>
                            <ShieldAlert className="size-3.5 text-amber-400" />
                          </div>
                          <div className="mt-1 text-2xl font-bold text-foreground">
                            {buyAnalysis.riskRewardMetrics.riskScorePercent}%
                          </div>
                          <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className={cn(
                                "transition-all duration-500",
                                buyAnalysis.riskRewardMetrics.riskScorePercent <= 30
                                  ? "bg-emerald-500"
                                  : buyAnalysis.riskRewardMetrics.riskScorePercent <= 60
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              )}
                              style={{ width: `${buyAnalysis.riskRewardMetrics.riskScorePercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Profit Probability vs Loss Probability Bar */}
                      <div className="rounded-md border border-border/80 bg-secondary/30 p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-muted-foreground uppercase text-[10px]">Probability Distribution</span>
                          <span className="text-foreground">
                            <span className="text-emerald-400 font-semibold">{buyAnalysis.riskRewardMetrics.profitProbabilityPercent}% Upside Expectancy</span> vs{" "}
                            <span className="text-rose-400 font-semibold">{buyAnalysis.riskRewardMetrics.lossProbabilityPercent}% Downside Loss Risk</span>
                          </span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="bg-emerald-500 transition-all duration-500"
                            style={{ width: `${buyAnalysis.riskRewardMetrics.profitProbabilityPercent}%` }}
                          />
                          <div
                            className="bg-rose-500 transition-all duration-500"
                            style={{ width: `${buyAnalysis.riskRewardMetrics.lossProbabilityPercent}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground font-sans">
                          {buyAnalysis.riskRewardMetrics.rationale}
                        </p>
                      </div>

                      {/* ⚔️ Active War & Geopolitical Conflict Impact */}
                      {buyAnalysis.riskRewardMetrics.warConflictImpact && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 pb-2">
                            <div className="flex items-center gap-2">
                              <Swords className="size-4 text-amber-400" />
                              <span className="font-mono text-xs font-bold uppercase tracking-wide text-amber-200">
                                War & Geopolitical Conflict Impact
                              </span>
                            </div>
                            <span
                              className={cn(
                                "rounded px-2.5 py-0.5 font-mono text-[11px] font-semibold border",
                                buyAnalysis.riskRewardMetrics.warConflictImpact.impactSeverity === "Net Beneficiary"
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : buyAnalysis.riskRewardMetrics.warConflictImpact.impactSeverity === "Neutral / Insulated"
                                  ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                                  : buyAnalysis.riskRewardMetrics.warConflictImpact.impactSeverity === "Moderate Negative"
                                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                  : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              )}
                            >
                              {buyAnalysis.riskRewardMetrics.warConflictImpact.impactSeverity}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                            <div>
                              <span className="font-mono text-[9px] uppercase text-muted-foreground">Active Conflict</span>
                              <p className="font-semibold text-foreground">
                                {buyAnalysis.riskRewardMetrics.warConflictImpact.conflictType}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {buyAnalysis.riskRewardMetrics.warConflictImpact.conflictStatus}
                              </p>
                            </div>
                            <div>
                              <span className="font-mono text-[9px] uppercase text-muted-foreground">War Risk Score</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-amber-400">
                                  {buyAnalysis.riskRewardMetrics.warConflictImpact.warRiskScorePercent}%
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {buyAnalysis.riskRewardMetrics.warConflictImpact.warRiskScorePercent <= 30
                                    ? "Low Conflict Sensitivity"
                                    : buyAnalysis.riskRewardMetrics.warConflictImpact.warRiskScorePercent <= 60
                                    ? "Moderate Vulnerability"
                                    : "High Hostility Exposure"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="font-mono text-[9px] uppercase text-muted-foreground">Transmission Channels</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {buyAnalysis.riskRewardMetrics.warConflictImpact.exposureChannels.map((channel: string, cIdx: number) => (
                                <span
                                  key={cIdx}
                                  className="rounded border border-border/80 bg-background/80 px-2 py-0.5 font-mono text-[10px] text-foreground/80"
                                >
                                  {channel}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <span className="font-mono text-[9px] uppercase text-muted-foreground">
                              Operational & Supply Chain Impact
                            </span>
                            <p className="mt-0.5 text-xs leading-relaxed text-foreground/90">
                              {buyAnalysis.riskRewardMetrics.warConflictImpact.directEffect}
                            </p>
                          </div>

                          <div className="rounded border border-border/50 bg-background/60 p-2.5">
                            <span className="font-mono text-[9px] uppercase text-muted-foreground">
                              Strategic Guidance / Hedge
                            </span>
                            <p className="mt-0.5 text-xs italic leading-relaxed text-foreground/90">
                              {buyAnalysis.riskRewardMetrics.warConflictImpact.strategicImplication}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Verified Financial Data Section (Audited, not AI generated) */}
                  <div className="rounded-lg border border-border bg-card p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-400" />
                        <h4 className="font-semibold text-sm text-foreground uppercase tracking-wide">
                          Verified Financial Data (Audited Filings & Market Feed)
                        </h4>
                      </div>
                      <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-400">
                        Primary Source Data · Verified
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 font-mono text-xs">
                      {buyAnalysis.verifiedFinancialData ? (
                        (() => {
                          const vf = buyAnalysis.verifiedFinancialData as Record<string, any>;
                          return (
                            <>
                              <div className="panel-soft rounded p-3">
                                <span className="text-muted-foreground block text-[10px] uppercase">Stock Price</span>
                                <span className="text-base font-semibold text-foreground">{vf['sharePrice']}</span>
                              </div>
                              <div className="panel-soft rounded p-3">
                                <span className="text-muted-foreground block text-[10px] uppercase">Market Capitalization</span>
                                <span className="text-base font-semibold text-primary">{vf['marketCapitalization']}</span>
                              </div>
                              <div className="panel-soft rounded p-3">
                                <span className="text-muted-foreground block text-[10px] uppercase">Free Cash Flow</span>
                                <span className="text-base font-semibold text-foreground">{vf['freeCashFlow']}</span>
                              </div>
                              <div className="panel-soft rounded p-3">
                                <span className="text-muted-foreground block text-[10px] uppercase">Return on Equity (ROE)</span>
                                <span className="text-base font-semibold text-emerald-400">{vf['returnOnEquity']}</span>
                              </div>
                              <div className="panel-soft rounded p-3">
                                <span className="text-muted-foreground block text-[10px] uppercase">Debt to Equity</span>
                                <span className="text-base font-semibold text-foreground">{vf['debtToEquity']}</span>
                              </div>
                              <div className="panel-soft rounded p-3">
                                <span className="text-muted-foreground block text-[10px] uppercase">P/E Ratio</span>
                                <span className="text-base font-semibold text-foreground">{vf['peRatio']}</span>
                              </div>
                              <div className="panel-soft rounded p-3">
                                <span className="text-muted-foreground block text-[10px] uppercase">Revenue (TTM/FY)</span>
                                <span className="text-base font-semibold text-foreground">{vf['revenue']}</span>
                              </div>
                              <div className="panel-soft rounded p-3">
                                <span className="text-muted-foreground block text-[10px] uppercase">Operating Margin</span>
                                <span className="text-base font-semibold text-foreground">{vf['operatingProfitMargin']}</span>
                              </div>
                            </>
                          );
                        })()
                      ) : buyAnalysis.keyMetrics ? (
                        Object.entries(buyAnalysis.keyMetrics).map(([k, v]) => (
                          <div key={k} className="panel-soft rounded p-3">
                            <span className="text-muted-foreground block text-[10px] uppercase">{k.replace(/([A-Z])/g, " $1")}</span>
                            <span className="text-base font-semibold text-foreground">{String(v ?? DATA_UNAVAILABLE)}</span>
                          </div>
                        ))
                      ) : null}
                    </div>
                  </div>

                  {/* AI Generated Report Section */}
                  <InstitutionalReportViewer
                    markdown={buyAnalysis.reportMarkdown}
                    sections={buyAnalysis.sections}
                    companyName={companyName}
                    symbol={ticker}
                    type="BUY"
                    generatedAt={buyAnalysis.generatedAt}
                  />

                  {/* Sources & Citations */}
                  {buyAnalysis.sourceReferences && buyAnalysis.sourceReferences.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Audited Primary Sources & Filings
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {buyAnalysis.sourceReferences.map((s, idx) => (
                          <span
                            key={idx}
                            className="rounded border border-border bg-secondary/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
                          >
                            {s.source} {s.reportingPeriod ? `(${s.reportingPeriod})` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!buyAnalysis && !loadingBuy && (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <Bot className="mx-auto size-10 text-muted-foreground/60" />
                  <h4 className="mt-3 font-medium text-foreground">No Buy Analysis Generated Yet</h4>
                  <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                    Click "Generate Buy Thesis" to trigger the complete 13-section institutional equity analysis powered by Ollama Cloud gpt-oss 20B and vector evidence.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 5: AI Sell Analysis */}
          {tab === "AI Sell Analysis" && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldAlert className="size-4 text-amber-500" /> Capital Preservation & Exit Decision Engine
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Evaluates 4 critical degradation vectors: Investment Thesis Deterioration, Valuation Excess, Capital Reallocation Alternatives, and Portfolio Risk Rebalancing.
                </p>

                {/* Portfolio Input Form */}
                <form onSubmit={handleRunSellAnalysis} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="font-mono text-[11px] uppercase text-muted-foreground">
                      Purchase Price (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(Number(e.target.value))}
                      className="panel-soft mt-1 h-9 w-full rounded border border-border px-3 font-mono text-sm outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase text-muted-foreground">
                      Quantity Held
                    </label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="panel-soft mt-1 h-9 w-full rounded border border-border px-3 font-mono text-sm outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase text-muted-foreground">
                      Investment Date
                    </label>
                    <input
                      type="date"
                      value={investmentDate}
                      onChange={(e) => setInvestmentDate(e.target.value)}
                      className="panel-soft mt-1 h-9 w-full rounded border border-border px-3 font-mono text-sm outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] uppercase text-muted-foreground">
                      Total Portfolio Value (₹)
                    </label>
                    <input
                      type="number"
                      value={portfolioValue}
                      onChange={(e) => setPortfolioValue(Number(e.target.value))}
                      className="panel-soft mt-1 h-9 w-full rounded border border-border px-3 font-mono text-sm outline-none focus:border-primary"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between pt-2">
                    <div className="font-mono text-xs text-muted-foreground">
                      Current Value: ₹{(currentPrice * quantity).toLocaleString("en-IN")} · P&L:{" "}
                      <span
                        className={
                          currentPrice >= purchasePrice ? "text-primary font-bold" : "text-destructive font-bold"
                        }
                      >
                        {currentPrice >= purchasePrice ? "+" : ""}
                        {((((currentPrice - purchasePrice) / purchasePrice) * 100) || 0).toFixed(2)}%
                      </span>
                    </div>

                    <Button
                      type="submit"
                      disabled={loadingSell}
                      variant="signal"
                      className="font-medium"
                    >
                      {loadingSell ? (
                        <>
                          <RefreshCw className="mr-2 size-4 animate-spin" /> Evaluating Exit Triggers...
                        </>
                      ) : (
                        <>
                          <Activity className="mr-2 size-4" /> Run Sell Analysis
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>

              {sellError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{sellError}</span>
                </div>
              )}

              {loadingSell && (
                <div className="space-y-3 rounded-lg border border-border p-6 text-center">
                  <RefreshCw className="mx-auto size-8 animate-spin text-amber-500" />
                  <p className="text-sm font-medium text-foreground">
                    Analyzing Deterioration Vectors & Exit Criteria...
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Synthesizing risk report via gpt-oss 20B
                  </p>
                </div>
              )}

              {sellAnalysis && !loadingSell && (
                <div className="space-y-6">
                  {/* Quantitative Exit Risk, Profit Protection & Loss Thresholds */}
                  {sellAnalysis.riskRewardMetrics && (
                    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                        <div className="flex items-center gap-2">
                          <Scale className="size-4 text-amber-500" />
                          <h4 className="font-semibold text-sm text-foreground uppercase tracking-wide">
                            Exit Risk, Profit Protection & Loss Thresholds
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-2.5 py-0.5 font-mono text-xs font-semibold border",
                              sellAnalysis.riskRewardMetrics.recommendationAction === "HOLD"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : sellAnalysis.riskRewardMetrics.recommendationAction === "TAKE_PROFIT"
                                ? "bg-primary/15 text-primary border-primary/30"
                                : sellAnalysis.riskRewardMetrics.recommendationAction === "TRIM"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            )}
                          >
                            ACTION: {sellAnalysis.riskRewardMetrics.recommendationAction}
                          </span>
                          <span className="rounded bg-secondary/80 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {sellAnalysis.riskRewardMetrics.riskLevel}
                          </span>
                        </div>
                      </div>

                      {/* 4 Metric Cards */}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-mono">
                        {/* Current Return / P&L % */}
                        <div className="panel-soft rounded-md border border-border p-3.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase">
                            <span>Current Return / P&L</span>
                            <Percent className="size-3.5 text-primary" />
                          </div>
                          <div
                            className={cn(
                              "mt-1 text-2xl font-bold",
                              sellAnalysis.riskRewardMetrics.unrealizedPnlPercent !== null
                                ? sellAnalysis.riskRewardMetrics.unrealizedPnlPercent >= 0
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                                : "text-foreground"
                            )}
                          >
                            {sellAnalysis.riskRewardMetrics.unrealizedPnlPercent !== null
                              ? `${sellAnalysis.riskRewardMetrics.unrealizedPnlPercent >= 0 ? "+" : ""}${sellAnalysis.riskRewardMetrics.unrealizedPnlPercent}%`
                              : "N/A"}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {sellAnalysis.riskRewardMetrics.profitLockInPercent > 0
                              ? `Gain to Protect: +${sellAnalysis.riskRewardMetrics.profitLockInPercent}%`
                              : "Personal position variance"}
                          </p>
                        </div>

                        {/* Downside Loss Risk % */}
                        <div className="panel-soft rounded-md border border-rose-500/30 bg-rose-500/5 p-3.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase">
                            <span>Downside Loss Risk</span>
                            <TrendingDown className="size-3.5 text-rose-400" />
                          </div>
                          <div className="mt-1 text-2xl font-bold text-rose-400">
                            {sellAnalysis.riskRewardMetrics.downsideLossPercent}%
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Exit Trigger: ₹{sellAnalysis.riskRewardMetrics.exitTriggerPrice?.toLocaleString("en-IN")}
                          </p>
                        </div>

                        {/* Upside Recovery % */}
                        <div className="panel-soft rounded-md border border-border p-3.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase">
                            <span>Upside Recovery Bounce</span>
                            <TrendingUp className="size-3.5 text-primary" />
                          </div>
                          <div className="mt-1 text-2xl font-bold text-primary">
                            +{sellAnalysis.riskRewardMetrics.upsideRecoveryPercent}%
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Rebound Target: ₹{sellAnalysis.riskRewardMetrics.targetRecoveryPrice?.toLocaleString("en-IN")}
                          </p>
                        </div>

                        {/* Deterioration Risk Score % */}
                        <div className="panel-soft rounded-md border border-border p-3.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase">
                            <span>Deterioration Risk Score</span>
                            <ShieldAlert className="size-3.5 text-amber-400" />
                          </div>
                          <div className="mt-1 text-2xl font-bold text-foreground">
                            {sellAnalysis.riskRewardMetrics.riskScorePercent}%
                          </div>
                          <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className={cn(
                                "transition-all duration-500",
                                sellAnalysis.riskRewardMetrics.riskScorePercent <= 35
                                  ? "bg-emerald-500"
                                  : sellAnalysis.riskRewardMetrics.riskScorePercent <= 65
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              )}
                              style={{ width: `${sellAnalysis.riskRewardMetrics.riskScorePercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Actionable Guidance Banner */}
                      <div className="rounded-md border border-border/80 bg-secondary/30 p-3.5 flex items-start gap-3">
                        <Zap className="size-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] uppercase text-muted-foreground">Decision Engine:</span>
                            <span className="font-semibold text-xs text-foreground uppercase tracking-wide">
                              {sellAnalysis.riskRewardMetrics.recommendationAction}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {sellAnalysis.riskRewardMetrics.recommendationSummary}
                          </p>
                        </div>
                      </div>

                      {/* ⚔️ Active War & Geopolitical Conflict Impact */}
                      {sellAnalysis.riskRewardMetrics.warConflictImpact && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 pb-2">
                            <div className="flex items-center gap-2">
                              <Swords className="size-4 text-amber-400" />
                              <span className="font-mono text-xs font-bold uppercase tracking-wide text-amber-200">
                                War & Geopolitical Conflict Impact
                              </span>
                            </div>
                            <span
                              className={cn(
                                "rounded px-2.5 py-0.5 font-mono text-[11px] font-semibold border",
                                sellAnalysis.riskRewardMetrics.warConflictImpact.impactSeverity === "Net Beneficiary"
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : sellAnalysis.riskRewardMetrics.warConflictImpact.impactSeverity === "Neutral / Insulated"
                                  ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                                  : sellAnalysis.riskRewardMetrics.warConflictImpact.impactSeverity === "Moderate Negative"
                                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                  : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              )}
                            >
                              {sellAnalysis.riskRewardMetrics.warConflictImpact.impactSeverity}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                            <div>
                              <span className="font-mono text-[9px] uppercase text-muted-foreground">Active Conflict</span>
                              <p className="font-semibold text-foreground">
                                {sellAnalysis.riskRewardMetrics.warConflictImpact.conflictType}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {sellAnalysis.riskRewardMetrics.warConflictImpact.conflictStatus}
                              </p>
                            </div>
                            <div>
                              <span className="font-mono text-[9px] uppercase text-muted-foreground">War Risk Score</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-amber-400">
                                  {sellAnalysis.riskRewardMetrics.warConflictImpact.warRiskScorePercent}%
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {sellAnalysis.riskRewardMetrics.warConflictImpact.warRiskScorePercent <= 30
                                    ? "Low Conflict Sensitivity"
                                    : sellAnalysis.riskRewardMetrics.warConflictImpact.warRiskScorePercent <= 60
                                    ? "Moderate Vulnerability"
                                    : "High Hostility Exposure"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="font-mono text-[9px] uppercase text-muted-foreground">Transmission Channels</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {sellAnalysis.riskRewardMetrics.warConflictImpact.exposureChannels.map((channel: string, cIdx: number) => (
                                <span
                                  key={cIdx}
                                  className="rounded border border-border/80 bg-background/80 px-2 py-0.5 font-mono text-[10px] text-foreground/80"
                                >
                                  {channel}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <span className="font-mono text-[9px] uppercase text-muted-foreground">
                              Operational & Supply Chain Impact
                            </span>
                            <p className="mt-0.5 text-xs leading-relaxed text-foreground/90">
                              {sellAnalysis.riskRewardMetrics.warConflictImpact.directEffect}
                            </p>
                          </div>

                          <div className="rounded border border-border/50 bg-background/60 p-2.5">
                            <span className="font-mono text-[9px] uppercase text-muted-foreground">
                              Exit / Protection Guidance
                            </span>
                            <p className="mt-0.5 text-xs italic leading-relaxed text-foreground/90">
                              {sellAnalysis.riskRewardMetrics.warConflictImpact.strategicImplication}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* P&L & Personal Investment Banner */}
                  {sellAnalysis.personalInvestmentAnalysis && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="panel-soft rounded-md border border-border p-3">
                        <p className="font-mono text-[10px] uppercase text-muted-foreground">INVESTED CAPITAL</p>
                        <p className="mt-1 font-mono text-lg font-semibold">
                          ₹{(purchasePrice * quantity).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="panel-soft rounded-md border border-border p-3">
                        <p className="font-mono text-[10px] uppercase text-muted-foreground">UNREALIZED P&L</p>
                        <p
                          className={cn(
                            "mt-1 font-mono text-lg font-semibold",
                            currentPrice >= purchasePrice ? "text-primary" : "text-destructive"
                          )}
                        >
                          {currentPrice >= purchasePrice ? "+" : ""}₹
                          {((currentPrice - purchasePrice) * quantity).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="panel-soft rounded-md border border-border p-3">
                        <p className="font-mono text-[10px] uppercase text-muted-foreground">PORTFOLIO WEIGHT</p>
                        <p className="mt-1 font-mono text-lg font-semibold">
                          {portfolioValue > 0 ? (((currentPrice * quantity) / portfolioValue) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                      <div className="panel-soft rounded-md border border-border p-3">
                        <p className="font-mono text-[10px] uppercase text-muted-foreground">CAPITAL GAINS TAX STATUS</p>
                        <p className="mt-1 font-mono text-sm font-medium text-foreground">
                          {sellAnalysis.personalInvestmentAnalysis.capitalGainsClassification || "Calculated"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Report Markdown Display */}
                  <InstitutionalReportViewer
                    markdown={sellAnalysis.reportMarkdown}
                    sections={sellAnalysis.sections}
                    companyName={companyName}
                    symbol={ticker}
                    type="SELL"
                    generatedAt={sellAnalysis.generatedAt}
                  />
                </div>
              )}

              {!sellAnalysis && !loadingSell && (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <ShieldAlert className="mx-auto size-10 text-muted-foreground/60" />
                  <h4 className="mt-3 font-medium text-foreground">No Exit Analysis Generated</h4>
                  <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                    Enter your position details above and click "Run Sell Analysis" to determine whether holding, trimming, or exiting is mathematically and strategically optimal.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>
    </AppShell>
  );
}

function Stats({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map(([l, v]) => (
        <div key={l} className="panel-soft rounded-md border border-border p-3">
          <p className="font-mono text-[10px] text-muted-foreground">{l.toUpperCase()}</p>
          <p className="mt-1 font-mono text-base font-semibold">{v}</p>
        </div>
      ))}
    </div>
  );
}

function StatementTableView({ table, title }: { table?: StatementTable; title: string }) {
  if (!table || !table.rows || table.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <FileText className="mx-auto size-10 text-muted-foreground/60" />
        <h4 className="mt-3 font-medium text-foreground">No {title} Recorded</h4>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Financial statement tables have not yet been synced from Screener.in for this company. Click "Sync Fresh Statements" to fetch them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{title} (₹ in Crores)</h3>
        <span className="font-mono text-[11px] text-muted-foreground">{table.headers.length - 1} Periods Reported</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
              {table.headers.map((h, idx) => (
                <th
                  key={idx}
                  className={cn(
                    "px-3.5 py-2.5 font-medium whitespace-nowrap",
                    idx === 0 ? "sticky left-0 bg-secondary/80 font-sans font-semibold text-foreground z-10 min-w-[200px]" : "text-right min-w-[90px]"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {table.rows.map((row, rIdx) => {
              const isHighlight =
                row.name.toLowerCase().includes("net profit") ||
                row.name.toLowerCase().includes("sales") ||
                row.name.toLowerCase().includes("operating profit") ||
                row.name.toLowerCase().includes("revenue");
              return (
                <tr
                  key={rIdx}
                  className={cn(
                    "transition-colors hover:bg-secondary/30",
                    isHighlight && "bg-primary/5 font-semibold text-foreground"
                  )}
                >
                  <td className={cn(
                    "sticky left-0 bg-card px-3.5 py-2 whitespace-nowrap font-sans",
                    isHighlight ? "font-semibold text-primary" : "text-foreground/90"
                  )}>
                    {row.name}
                  </td>
                  {row.values.map((val, vIdx) => (
                    <td key={vIdx} className="px-3.5 py-2 text-right whitespace-nowrap">
                      {val !== null && val !== undefined ? String(val) : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

