import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bot,
  Heart,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
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
} from "@/lib/api";
import { findCompany, fmtChange, fmtINR, useWatchlist } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/company/$ticker")({
  loader: ({ params }) => {
    const fallback = findCompany(params.ticker);
    return { ticker: params.ticker.toUpperCase(), fallback };
  },
  head: ({ loaderData }) => {
    const sym = loaderData?.ticker || "Equity";
    return {
      meta: [
        { title: `${sym} Financial Intelligence & AI Buy/Sell Analysis — AssetMind AI` },
        { name: "description", content: `Live market data, financial ratios, RAG evidence and AI analysis for ${sym}` },
      ],
    };
  },
  component: CompanyPage,
});

const TABS = [
  "Overview",
  "Financials",
  "Ratios & Risk",
  "News",
  "AI Buy Analysis",
  "AI Sell Analysis",
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
  const [loadingData, setLoadingData] = useState(true);

  // Real-time live quote state
  const [liveQuote, setLiveQuote] = useState<LiveQuote | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  // Real-time news state
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

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
        const [profData, priceData, metricsData] = await Promise.allSettled([
          apiClient.getCompanyProfile(ticker),
          apiClient.getPriceHistory(ticker, "1M"),
          apiClient.getFinancialMetrics(ticker),
        ]);

        if (isMounted) {
          if (profData.status === "fulfilled") setProfile(profData.value);
          if (priceData.status === "fulfilled") setPriceHistory(priceData.value);
          if (metricsData.status === "fulfilled") setMetrics(metricsData.value);
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
  const livePe = liveQuote?.pe ?? metrics?.valuation?.peRatio?.value ?? fallback.pe;
  const isLiveStream = streamConnected;

  // Chart data — use historical or fallback
  const chartData =
    priceHistory?.data && priceHistory.data.length > 0
      ? priceHistory.data.map((p) => ({
          date: new Date(p.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
          price: p.close,
        }))
      : fallback.trend.map((value, i) => ({
          date: `Day ${i * 5 + 1}`,
          price: value,
        }));

  const roeValue = metrics?.returnOnEquity?.value ?? fallback.margin;
  const deValue = metrics?.debtToEquity?.value ?? fallback.debtEquity;
  const fcfValue = metrics?.freeCashFlow?.value != null ? `₹${metrics.freeCashFlow.value} Cr` : "N/A";
  const mcapValue = liveQuote?.marketCap != null
    ? liveQuote.marketCap > 1e11
      ? `₹${(liveQuote.marketCap / 1e11).toFixed(2)}L Cr`
      : `₹${(liveQuote.marketCap / 1e7).toFixed(0)} Cr`
    : profile?.marketCapitalization != null
    ? `₹${(profile.marketCapitalization / 1000).toFixed(1)}K Cr`
    : fallback.marketCap;

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
                  priceChangePct >= 0 ? "text-primary" : "text-destructive"
                )}
              >
                {priceChangePct >= 0 ? (
                  <TrendingUp className="mr-1 size-4" />
                ) : (
                  <TrendingDown className="mr-1 size-4" />
                )}
                {priceChange !== null && (
                  <span className="mr-1.5">{priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}</span>
                )}
                ({fmtChange(priceChangePct)})
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
                {dayHigh != null && dayLow != null && (
                  <span>Day: <span className="font-mono text-foreground">{fmtINR(dayLow)} – {fmtINR(dayHigh)}</span></span>
                )}
                {weekHigh52 != null && weekLow52 != null && (
                  <span>52W: <span className="font-mono text-foreground">{fmtINR(weekLow52)} – {fmtINR(weekHigh52)}</span></span>
                )}
                {dayVolume != null && (
                  <span>Vol: <span className="font-mono text-foreground">{(dayVolume / 1_000_000).toFixed(2)}M</span></span>
                )}
                {livePe != null && (
                  <span>P/E: <span className="font-mono text-foreground">{livePe.toFixed(1)}x</span></span>
                )}
                {liveEps != null && (
                  <span>EPS: <span className="font-mono text-foreground">₹{liveEps.toFixed(2)}</span></span>
                )}
                {liveDivYield != null && (
                  <span>Yield: <span className="font-mono text-foreground">{liveDivYield.toFixed(2)}%</span></span>
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

        {/* Tab 1: Overview */}
        <div className="pt-6">
          {tab === "Overview" && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
                <div className="panel-soft rounded-lg border border-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-mono text-xs uppercase text-muted-foreground">
                      1-Month Price Trajectory ({priceHistory?.source || "NSE/Yahoo Finance"})
                    </p>
                    <span className="font-mono text-xs text-muted-foreground">
                      {chartData.length} Data Points
                    </span>
                  </div>
                  <div className="h-60 w-full">
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
                          formatter={(v: any) => [`₹${v}`, "Price"]}
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
                      ["Market Cap", mcapValue],
                      ["P/E Ratio", livePe != null ? `${livePe.toFixed(1)}x` : "N/A"],
                      ["Return on Equity", `${roeValue.toFixed(1)}%`],
                      ["Debt to Equity", deValue.toFixed(2)],
                      ["Free Cash Flow", fcfValue],
                      ["Exchange", exchange],
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

          {/* Tab 2: Financials */}
          {tab === "Financials" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="panel-soft rounded-md border border-border p-4">
                  <p className="font-mono text-xs text-muted-foreground">ANNUAL REVENUE</p>
                  <p className="mt-1 font-mono text-xl font-semibold">
                    {metrics?.profitability?.revenue?.value
                      ? `₹${metrics.profitability.revenue.value} Cr`
                      : fallback.revenue}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Fiscal {metrics?.fiscalPeriod || "FY24"}
                  </p>
                </div>

                <div className="panel-soft rounded-md border border-border p-4">
                  <p className="font-mono text-xs text-muted-foreground">NET INCOME</p>
                  <p className="mt-1 font-mono text-xl font-semibold text-primary">
                    {metrics?.profitability?.netIncome?.value
                      ? `₹${metrics.profitability.netIncome.value} Cr`
                      : "Profitable"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Consolidated earnings</p>
                </div>

                <div className="panel-soft rounded-md border border-border p-4">
                  <p className="font-mono text-xs text-muted-foreground">FREE CASH FLOW</p>
                  <p className="mt-1 font-mono text-xl font-semibold">
                    {metrics?.freeCashFlow?.value
                      ? `₹${metrics.freeCashFlow.value} Cr`
                      : "Strong"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Operating CF minus Capex</p>
                </div>

                <div className="panel-soft rounded-md border border-border p-4">
                  <p className="font-mono text-xs text-muted-foreground">OPERATING MARGIN</p>
                  <p className="mt-1 font-mono text-xl font-semibold">
                    {metrics?.profitability?.operatingProfitMargin?.value
                      ? `${metrics.profitability.operatingProfitMargin.value}%`
                      : `${fallback.margin}%`}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Core business margins</p>
                </div>
              </div>

              <div className="panel-soft rounded-lg border border-border p-4">
                <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Cash Flow & Debt Dynamics
                </h3>
                <div className="grid gap-3 md:grid-cols-2 text-xs">
                  <div className="rounded border border-border/70 p-3">
                    <span className="font-medium text-foreground">Debt Profile: </span>
                    <span className="text-muted-foreground">
                      {metrics?.riskAnalysisInputs?.debtLevels ||
                        `Debt to Equity is ${deValue.toFixed(2)}. ${deValue < 1 ? "Conservative capital structure." : "Moderate leverage."}`}
                    </span>
                  </div>
                  <div className="rounded border border-border/70 p-3">
                    <span className="font-medium text-foreground">Cash Flow Trends: </span>
                    <span className="text-muted-foreground">
                      {metrics?.riskAnalysisInputs?.cashFlowTrends ||
                        "Operating cash flow remains positive and provides capital expenditure coverage."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Ratios & Risk */}
          {tab === "Ratios & Risk" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="panel-soft rounded-md border border-border p-4">
                  <span className="font-mono text-xs text-muted-foreground">P/E RATIO</span>
                  <p className="mt-1 font-mono text-2xl font-bold">{livePe != null ? `${livePe.toFixed(1)}x` : "N/A"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Industry multiple comparison</p>
                </div>
                <div className="panel-soft rounded-md border border-border p-4">
                  <span className="font-mono text-xs text-muted-foreground">PRICE TO BOOK (P/B)</span>
                  <p className="mt-1 font-mono text-2xl font-bold">
                    {metrics?.valuation?.pbRatio?.value
                      ? `${metrics.valuation.pbRatio.value.toFixed(1)}x`
                      : "2.4x"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Book value per share basis</p>
                </div>
                <div className="panel-soft rounded-md border border-border p-4">
                  <span className="font-mono text-xs text-muted-foreground">DEBT / EQUITY</span>
                  <p className="mt-1 font-mono text-2xl font-bold">{deValue.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {deValue < 0.5 ? "Low Leverage Risk" : deValue < 1.5 ? "Moderate Leverage" : "High Leverage Risk"}
                  </p>
                </div>
              </div>

              {/* Risk Gauge Bars */}
              <div className="panel-soft rounded-lg border border-border p-4 space-y-4">
                <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Automated Risk Assessment Snapshot
                </h4>
                {[
                  {
                    label: "Financial Leverage Risk",
                    value: Math.min(100, Math.round(deValue * 45)),
                    status: deValue < 0.8 ? "Healthy" : "Elevated",
                  },
                  {
                    label: "Valuation Stretch Risk",
                    value: Math.min(100, Math.round((livePe ?? 0) * 1.8)),
                    status: (livePe ?? 0) > 35 ? "Premium Multiple" : "Reasonable",
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <Newspaper className="size-4 text-blue-400" /> Real-Time Financial News
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Live news from Yahoo Finance RSS, Google News, Economic Times · Sentiment scored · Updated every 5 minutes
                  </p>
                </div>
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
                  <span className="ml-1.5">Refresh</span>
                </Button>
              </div>

              {newsError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{newsError}</span>
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
                  {/* Scores Grid */}
                  {buyAnalysis.keyMetrics && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {Object.entries(buyAnalysis.keyMetrics).map(([k, v]) => (
                        <div key={k} className="panel-soft rounded-md border border-border p-3">
                          <p className="font-mono text-[10px] uppercase text-muted-foreground">
                            {k.replace(/([A-Z])/g, " $1")}
                          </p>
                          <p className="mt-1 font-mono text-lg font-semibold">{String(v)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Report Markdown Display */}
                  <div className="panel-soft rounded-lg border border-border p-6">
                    <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                      <span className="flex items-center gap-1.5 font-mono text-xs text-primary">
                        <CheckCircle2 className="size-4" /> Institutional Memo Generated
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(buyAnalysis.generatedAt).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 whitespace-pre-wrap leading-relaxed text-foreground/90">
                      {buyAnalysis.reportMarkdown}
                    </div>

                    {/* Sources & Citations */}
                    {buyAnalysis.sourceReferences && buyAnalysis.sourceReferences.length > 0 && (
                      <div className="mt-6 border-t border-border pt-4">
                        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                          Audited Primary Sources & Filings
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {buyAnalysis.sourceReferences.map((s, idx) => (
                            <span
                              key={idx}
                              className="rounded border border-border bg-secondary/40 px-2 py-1 font-mono text-[11px] text-muted-foreground"
                            >
                              {s.source} {s.reportingPeriod ? `(${s.reportingPeriod})` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
                  <div className="panel-soft rounded-lg border border-border p-6">
                    <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                      <span className="flex items-center gap-1.5 font-mono text-xs text-amber-500">
                        <FileText className="size-4" /> Sell Decision Report
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(sellAnalysis.generatedAt).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 whitespace-pre-wrap leading-relaxed text-foreground/90">
                      {sellAnalysis.reportMarkdown}
                    </div>
                  </div>
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
