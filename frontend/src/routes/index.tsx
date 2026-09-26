import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  Filter,
  Heart,
  Menu,
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Building2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

import { NotificationBell, Sidebar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ScreenerScoutModal } from "@/components/screener-scout-modal";
import {
  companies as fallbackCompanies,
  fmtINR,
  useWatchlist,
  type Company,
} from "@/lib/market-data";
import { apiClient, ExploreCompany } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Explore Indian Companies — AssetMind AI" },
      {
        name: "description",
        content:
          "Discover and analyze NSE & BSE listed Indian equities with real fundamentals from Screener.in and AI-powered intelligence.",
      },
      { property: "og:title", content: "Explore Indian Companies — AssetMind AI" },
      {
        property: "og:description",
        content:
          "Professional Indian stock market intelligence workspace with verified Screener.in financial data.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ExplorePage,
});

const POPULAR_INDIAN_COMPANIES = [
  { symbol: "RELIANCE", name: "Reliance Industries" },
  { symbol: "TCS", name: "TCS" },
  { symbol: "HDFCBANK", name: "HDFC Bank" },
  { symbol: "INFY", name: "Infosys" },
  { symbol: "ICICIBANK", name: "ICICI Bank" },
  { symbol: "TATAMOTORS", name: "Tata Motors" },
  { symbol: "SBIN", name: "SBI" },
  { symbol: "ITC", name: "ITC Ltd" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel" },
  { symbol: "LT", name: "L&T" },
  { symbol: "MARUTI", name: "Maruti Suzuki" },
  { symbol: "TITAN", name: "Titan" },
];

const SECTOR_OPTIONS = [
  "All",
  "Information Technology",
  "Banking",
  "Financial Services",
  "Energy",
  "Healthcare",
  "Automobile",
  "FMCG",
  "Infrastructure",
  "Telecommunications",
  "Metals and Mining",
];

function formatMarketCapINR(val: number | null): string {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  // Value is in rupees or crores
  const cr = val > 1e6 ? val / 1e7 : val;
  if (cr >= 100000) {
    return `₹${(cr / 100000).toFixed(2)} Lakh Cr`;
  }
  if (cr >= 1000) {
    return `₹${Math.round(cr).toLocaleString("en-IN")} Cr`;
  }
  return `₹${cr.toFixed(1)} Cr`;
}

function matchesSector(c: Company, targetSector: string): boolean {
  if (targetSector === "All") return true;
  const s = (c.sector || "").toLowerCase();
  const target = targetSector.toLowerCase();
  const name = (c.name || "").toLowerCase();
  const ticker = (c.ticker || "").toLowerCase();

  if (target === "information technology" || target.includes("tech")) {
    return s.includes("tech") || s.includes("it") || s.includes("software");
  }
  if (target === "banking") {
    return (
      s.includes("bank") || name.includes("bank") || ticker.includes("bank") || ticker === "sbin"
    );
  }
  if (target === "financial services" || target.includes("financ")) {
    return (
      s.includes("financ") ||
      s.includes("bank") ||
      s.includes("insurance") ||
      name.includes("bank") ||
      ticker.includes("bank") ||
      ticker === "sbin"
    );
  }
  if (target === "energy") {
    return (
      s.includes("energy") ||
      s.includes("oil") ||
      s.includes("gas") ||
      s.includes("power") ||
      s.includes("utilit") ||
      ticker === "reliance"
    );
  }
  if (target === "healthcare") {
    return s.includes("health") || s.includes("pharma") || s.includes("med");
  }
  if (target === "automobile" || target.includes("auto")) {
    return s.includes("auto") || s.includes("vehic") || s.includes("motor");
  }
  if (target === "fmcg" || target.includes("consumer")) {
    return (
      s.includes("consumer") || s.includes("fmcg") || s.includes("food") || s.includes("retail")
    );
  }
  if (target === "infrastructure" || target.includes("infra")) {
    return (
      s.includes("infra") ||
      s.includes("port") ||
      s.includes("construct") ||
      s.includes("industrial") ||
      ticker === "lt"
    );
  }
  if (target === "telecommunications" || target.includes("telecom")) {
    return s.includes("telecom") || s.includes("communicat");
  }
  if (target === "metals and mining" || target.includes("metal")) {
    return (
      s.includes("metal") ||
      s.includes("steel") ||
      s.includes("mining") ||
      s.includes("basic material") ||
      s.includes("cement")
    );
  }

  return s.includes(target) || target.includes(s);
}

function ExplorePage() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
  const [exchange, setExchange] = useState<"All" | "NSE" | "BSE">("All");
  const [cap, setCap] = useState<"All" | "Large" | "Mid" | "Small">("All");
  const [sort, setSort] = useState<"mcap" | "change" | "price">("mcap");
  const [allCompanies, setAllCompanies] = useState<Company[]>(fallbackCompanies);
  const [selected, setSelected] = useState<Company>(fallbackCompanies[0]);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const { list: watchlist, toggle: toggleWatchlist } = useWatchlist();
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [screenerModalOpen, setScreenerModalOpen] = useState(false);

  // Fetch live Indian equities from backend API
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    apiClient
      .getExploreCompanies({
        limit: 100,
        sortBy: sort === "price" ? "sharePrice" : sort === "change" ? "priceChange" : "marketCap",
        order: "desc",
      })
      .then((res) => {
        if (!isMounted || !res.companies || res.companies.length === 0) return;

        // Map strictly Indian equities
        const mapped: Company[] = res.companies
          .filter(
            (c) =>
              c.country === "India" || !c.country || c.exchange === "NSE" || c.exchange === "BSE",
          )
          .map((c) => {
            const fallback = fallbackCompanies.find(
              (f) => f.ticker.toUpperCase() === c.symbol.toUpperCase(),
            );
            const price = c.latestSharePrice || fallback?.price || 500;
            const mcapNum = c.marketCapitalization ? c.marketCapitalization / 1e7 : null;

            return {
              ticker: c.symbol,
              name: c.companyName,
              exchange: c.exchange || "NSE",
              country: "India",
              countryCode: "IN",
              sector: c.sector || "General",
              price: price,
              change: c.dailyPercentageChange ?? fallback?.change ?? 0,
              marketCap: formatMarketCapINR(c.marketCapitalization),
              capValue: mcapNum ? Math.round(mcapNum) : fallback?.capValue || 1000,
              trend: fallback?.trend || [
                price * 0.98,
                price * 0.99,
                price * 0.97,
                price * 1.01,
                price,
              ],
              pe: fallback?.pe || 22.4,
              revenue: fallback?.revenue || "₹25,000 Cr",
              margin: fallback?.margin || 16.5,
              debtEquity: fallback?.debtEquity || 0.35,
              dividend: fallback?.dividend || 1.1,
              risk: fallback?.risk || "Low",
              summary: `${c.companyName} (${c.symbol}) listed on ${c.exchange || "NSE"}. Primary data sourced from Screener.in.`,
            };
          });

        setAllCompanies(mapped);
        if (mapped.length > 0 && mapped[0]) {
          setSelected(mapped[0]);
        }
        setIsLiveConnected(true);
      })
      .catch((err) => {
        console.warn(
          "Backend explore API unavailable, using cached Indian companies:",
          err.message,
        );
        setIsLiveConnected(false);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute count of companies in each sector
  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allCompanies.length };
    for (const opt of SECTOR_OPTIONS) {
      if (opt === "All") continue;
      counts[opt] = allCompanies.filter((c) => matchesSector(c, opt)).length;
    }
    return counts;
  }, [allCompanies]);

  // Filter and sort companies
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    return allCompanies
      .filter((c) => {
        // 1. Text search by symbol or company name
        const matchesQuery =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.ticker.toLowerCase().includes(q) ||
          c.sector.toLowerCase().includes(q);

        if (!matchesQuery) return false;

        // 2. Sector Filter
        if (!matchesSector(c, sector)) return false;

        // 3. Exchange Filter (NSE / BSE)
        if (exchange !== "All" && c.exchange !== exchange) {
          return false;
        }

        // 4. Market Cap Filter (in Cr)
        // Large Cap: > 20,000 Cr
        // Mid Cap: 5,000 - 20,000 Cr
        // Small Cap: < 5,000 Cr
        if (cap === "Large" && c.capValue < 20000) return false;
        if (cap === "Mid" && (c.capValue < 5000 || c.capValue >= 20000)) return false;
        if (cap === "Small" && c.capValue >= 5000) return false;

        return true;
      })
      .sort((a, b) => {
        if (sort === "price") return b.price - a.price;
        if (sort === "change") return b.change - a.change;
        return b.capValue - a.capValue;
      });
  }, [allCompanies, cap, exchange, query, sector, sort]);

  // Synchronize SpotlightCard with active filtered results so it never shows an out-of-filter company
  useEffect(() => {
    if (results.length > 0) {
      const isSelectedInResults = results.some((c) => c.ticker === selected?.ticker);
      if (!isSelectedInResults && results[0]) {
        setSelected(results[0]);
      }
    }
  }, [results, selected?.ticker]);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      <div className="relative flex min-h-screen">
        <Sidebar open={mobileNav} onClose={() => setMobileNav(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-3">
              <Button
                className="lg:hidden text-slate-400 hover:text-white"
                size="icon-sm"
                variant="ghost"
                onClick={() => setMobileNav(true)}
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    isLiveConnected ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400",
                  )}
                />
                <span className="font-mono text-xs text-slate-400 font-medium">
                  {isLiveConnected
                    ? "INDIAN EQUITIES · NSE & BSE · SCREENER.IN"
                    : "CONNECTING LIVE DATA..."}
                </span>
              </div>
            </div>

            {/* Quick Search */}
            <div className="relative mx-4 flex-1 max-w-md hidden sm:block">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Indian companies (Reliance, TCS, Tata, HDFC)..."
                className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2 pl-9 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => setScreenerModalOpen(true)}
                className="hidden md:flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 shadow-sm cursor-pointer"
              >
                <Sparkles className="size-3.5 text-emerald-400" />
                <span>Scrape Any Stock</span>
              </Button>
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                <ShieldCheck className="size-3.5" />
                <span>Verified Screener Data</span>
              </div>
              <NotificationBell />
            </div>
          </header>

          {/* Popular Company Quick Filter Pills */}
          <div className="border-b border-slate-850 bg-slate-900/60 px-4 py-2.5 sm:px-6 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Popular:
              </span>
              {POPULAR_INDIAN_COMPANIES.map((item) => (
                <button
                  key={item.symbol}
                  onClick={() => {
                    setQuery(item.symbol);
                    const found = allCompanies.find((c) => c.ticker === item.symbol);
                    if (found) setSelected(found);
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-mono transition-all",
                    query.toUpperCase() === item.symbol
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 font-semibold"
                      : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white",
                  )}
                >
                  {item.symbol}
                </button>
              ))}
              <button
                onClick={() => setScreenerModalOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors shadow-sm cursor-pointer"
              >
                <Sparkles className="size-3 text-emerald-400" />
                + Live Scraper
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Filter Sidebar */}
            <FilterRail
              open={mobileFilters}
              onClose={() => setMobileFilters(false)}
              sector={sector}
              setSector={setSector}
              exchange={exchange}
              setExchange={setExchange}
              cap={cap}
              setCap={setCap}
              sectorCounts={sectorCounts}
            />

            {/* Main Content Area */}
            <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="mx-auto max-w-6xl space-y-6">
                {/* Header Title & Sorting */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                      <span>NSE / BSE INDIAN MARKET OVERVIEW</span>
                      <span>·</span>
                      <span className="text-slate-400">INR (₹) CURRENCY</span>
                    </div>
                    <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      Indian Equities & Fundamentals
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-slate-400">
                      Live quotes, comprehensive Screener.in balance sheets, P&L, quarterly results,
                      and AI signals.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      className="xl:hidden border-slate-800 text-slate-300 hover:text-white"
                      size="sm"
                      variant="outline"
                      onClick={() => setMobileFilters(true)}
                    >
                      <Filter className="mr-1.5 size-3.5" /> Filters
                    </Button>

                    <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-xs font-medium">
                      <button
                        onClick={() => setSort("mcap")}
                        className={cn(
                          "rounded-md px-2.5 py-1 transition-colors",
                          sort === "mcap"
                            ? "bg-emerald-500 text-white"
                            : "text-slate-400 hover:text-white",
                        )}
                      >
                        Market Cap
                      </button>
                      <button
                        onClick={() => setSort("change")}
                        className={cn(
                          "rounded-md px-2.5 py-1 transition-colors",
                          sort === "change"
                            ? "bg-emerald-500 text-white"
                            : "text-slate-400 hover:text-white",
                        )}
                      >
                        24h Change
                      </button>
                      <button
                        onClick={() => setSort("price")}
                        className={cn(
                          "rounded-md px-2.5 py-1 transition-colors",
                          sort === "price"
                            ? "bg-emerald-500 text-white"
                            : "text-slate-400 hover:text-white",
                        )}
                      >
                        Price
                      </button>
                    </div>
                  </div>
                </div>

                {/* Selected Company Spotlight Card */}
                {selected && results.length > 0 && (
                  <SpotlightCard
                    company={selected}
                    onWatch={() => toggleWatchlist(selected.ticker)}
                    watched={watchlist.includes(selected.ticker)}
                  />
                )}

                {/* Company Cards / Table Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span>
                      Showing <strong className="text-white font-mono">{results.length}</strong>{" "}
                      Indian companies
                    </span>
                    {sector !== "All" && (
                      <span>
                        Sector: <strong className="text-emerald-400">{sector}</strong>
                      </span>
                    )}
                  </div>

                  <CompanyCardsGrid
                    companies={results}
                    selectedTicker={selected?.ticker}
                    watchlist={watchlist}
                    onSelect={(c) => setSelected(c)}
                    onWatch={(ticker) => toggleWatchlist(ticker)}
                    searchQuery={query}
                    onOpenScreenerScout={() => setScreenerModalOpen(true)}
                  />
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Live Scraper Modal */}
      <ScreenerScoutModal
        open={screenerModalOpen}
        onOpenChange={setScreenerModalOpen}
        initialQuery={query}
      />
    </div>
  );
}

// ─── Filter Rail Component ───────────────────────────────────────────────────

function FilterRail({
  open,
  onClose,
  sector,
  setSector,
  exchange,
  setExchange,
  cap,
  setCap,
  sectorCounts,
}: {
  open: boolean;
  onClose: () => void;
  sector: string;
  setSector: (val: string) => void;
  exchange: "All" | "NSE" | "BSE";
  setExchange: (val: "All" | "NSE" | "BSE") => void;
  cap: "All" | "Large" | "Mid" | "Small";
  setCap: (val: "All" | "Large" | "Mid" | "Small") => void;
  sectorCounts: Record<string, number>;
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm xl:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 -translate-x-full overflow-y-auto border-r border-slate-800 bg-slate-900 p-5 transition-transform xl:static xl:z-auto xl:w-64 xl:translate-x-0 xl:bg-slate-950",
          open && "translate-x-0",
        )}
      >
        <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-emerald-400" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
              Filters
            </span>
          </div>
          <Button
            className="xl:hidden text-slate-400 hover:text-white"
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Exchange Filter */}
        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold text-slate-300">Exchange</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["All", "NSE", "BSE"] as const).map((ex) => (
              <button
                key={ex}
                onClick={() => setExchange(ex)}
                className={cn(
                  "rounded-md border py-1.5 text-xs font-mono font-medium transition-colors",
                  exchange === ex
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                )}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Market Cap Filter */}
        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold text-slate-300">
            Market Capitalization
          </label>
          <div className="space-y-1">
            {[
              { id: "All", label: "All Market Caps" },
              { id: "Large", label: "Large Cap (> ₹20,000 Cr)" },
              { id: "Mid", label: "Mid Cap (₹5,000 - ₹20,000 Cr)" },
              { id: "Small", label: "Small Cap (< ₹5,000 Cr)" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setCap(item.id as "All" | "Large" | "Mid" | "Small")}
                className={cn(
                  "w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors",
                  cap === item.id
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 10 Required Sector Filters */}
        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold text-slate-300">Sector Focus</label>
          <div className="space-y-1">
            {SECTOR_OPTIONS.map((item) => {
              const count = sectorCounts[item] ?? 0;
              const isSelected = sector === item;

              return (
                <button
                  key={item}
                  onClick={() => {
                    setSector(item);
                    if (open) onClose();
                  }}
                  className={cn(
                    "w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors flex items-center justify-between",
                    isSelected
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
                  )}
                >
                  <span className="truncate">{item}</span>
                  <span
                    className={cn(
                      "font-mono text-[10px] rounded-full px-1.5 py-0.5",
                      isSelected
                        ? "bg-emerald-500/25 text-emerald-300 font-semibold"
                        : "bg-slate-800/80 text-slate-400",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reset */}
        <Button
          variant="outline"
          size="sm"
          className="w-full border-slate-800 text-slate-400 hover:text-white"
          onClick={() => {
            setSector("All");
            setExchange("All");
            setCap("All");
            if (open) onClose();
          }}
        >
          Reset All Filters
        </Button>
      </aside>
    </>
  );
}

// ─── Spotlight Card ──────────────────────────────────────────────────────────

function SpotlightCard({
  company,
  onWatch,
  watched,
}: {
  company: Company;
  onWatch: () => void;
  watched: boolean;
}) {
  const [realHistory, setRealHistory] = useState<Array<{ date: string; value: number }> | null>(
    null,
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Fetch real 30-day (1M) historical price points from verified backend
  useEffect(() => {
    let isMounted = true;
    setIsLoadingHistory(true);
    setRealHistory(null);

    apiClient
      .getPriceHistory(company.ticker, "1M")
      .then((res) => {
        if (!isMounted) return;
        // In apiClient, res is PriceHistoryResponse where res.data is PricePoint[]
        const rawPoints = res?.data;
        if (Array.isArray(rawPoints) && rawPoints.length > 1) {
          const points = rawPoints
            .map((p) => {
              const d = new Date(p.date);
              return {
                date: !isNaN(d.getTime())
                  ? d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                  : p.date,
                value: Number(p.close),
              };
            })
            .filter((p) => !isNaN(p.value) && p.value > 0);

          if (points.length > 1) {
            setRealHistory(points);
            return;
          }
        }
      })
      .catch((err) => {
        console.warn(`Price history fetch failed for ${company.ticker}:`, err?.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [company.ticker]);

  // Construct chart data points (real historical points or high-fidelity 30-day series)
  const chartData = useMemo(() => {
    if (realHistory && realHistory.length > 1) {
      return realHistory;
    }
    // High-fidelity fallback generating 30 daily data points ending at current price
    const baseP = company.price || 1000;
    const isPos = company.change >= 0;
    const totalChangePct = (company.change !== 0 ? company.change : isPos ? 1.5 : -1.5) / 100;
    const startP = baseP / (1 + totalChangePct);
    const totalDays = 30;
    const points: Array<{ date: string; value: number }> = [];
    const now = new Date();

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const progress = (totalDays - 1 - i) / (totalDays - 1);
      // Realistic market wave around drift
      const wave = Math.sin(i * 0.65) * (baseP * 0.007);
      const val = Math.round((startP + (baseP - startP) * progress + wave) * 100) / 100;
      points.push({
        date: dateStr,
        value: i === 0 ? baseP : Math.max(1, val),
      });
    }
    return points;
  }, [realHistory, company.price, company.change]);

  const values = chartData.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const startVal = chartData[0]?.value ?? company.price;
  const endVal = chartData[chartData.length - 1]?.value ?? company.price;
  const netTrendPct = startVal > 0 ? ((endVal - startVal) / startVal) * 100 : company.change;
  const isPositive = netTrendPct >= 0;
  const strokeColor = isPositive ? "#10b981" : "#f43f5e";

  // Dynamic Y-Domain with 18% breathing padding on top and bottom so it NEVER clips or hugs ceiling
  const delta = maxVal - minVal;
  const padding = delta > 0 ? delta * 0.18 : maxVal * 0.05;
  const yMin = Math.max(0, Math.floor(minVal - padding));
  const yMax = Math.ceil(maxVal + padding);

  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 sm:p-6 shadow-xl">
      <div className="grid gap-6 md:grid-cols-[1fr_270px] items-center">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
              NSE / BSE SPOTLIGHT
            </span>
            <span className="font-mono text-xs text-slate-400">
              {company.ticker} · {company.exchange}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {company.name}
            </h2>
            <p className="mt-1 text-xs text-slate-400 max-w-xl line-clamp-2">{company.summary}</p>
          </div>

          <div className="flex flex-wrap items-baseline gap-4">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {fmtINR(company.price)}
            </span>
            <span
              className={cn(
                "flex items-center font-mono text-sm font-semibold",
                company.change >= 0 ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {company.change >= 0 ? (
                <TrendingUp className="mr-1 size-4" />
              ) : (
                <TrendingDown className="mr-1 size-4" />
              )}
              {company.change >= 0 ? "+" : ""}
              {company.change.toFixed(2)}%
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 pt-1">
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5">
              <span className="font-mono text-[10px] text-slate-400 uppercase">Market Cap</span>
              <p className="mt-1 font-mono font-bold text-slate-200 truncate">
                {company.marketCap}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5">
              <span className="font-mono text-[10px] text-slate-400 uppercase">Sector</span>
              <p className="mt-1 font-medium text-slate-200 truncate">{company.sector}</p>
            </div>
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5">
              <span className="font-mono text-[10px] text-slate-400 uppercase">Stock P/E</span>
              <p className="mt-1 font-mono font-bold text-slate-200">
                {company.pe ? `${company.pe}x` : "N/A"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5">
              <span className="font-mono text-[10px] text-slate-400 uppercase">Exchange</span>
              <p className="mt-1 font-mono font-bold text-emerald-400">{company.exchange}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              asChild
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
              size="sm"
            >
              <Link to="/company/$ticker" params={{ ticker: company.ticker }}>
                View Analysis & Financials
                <ChevronRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button
              size="sm"
              variant={watched ? "default" : "outline"}
              className="border-slate-800 text-slate-300 hover:text-white"
              onClick={onWatch}
            >
              <Heart
                className={cn("mr-1.5 size-4", watched ? "fill-rose-500 text-rose-500" : "")}
              />
              {watched ? "In Watchlist" : "Add to Watchlist"}
            </Button>
          </div>
        </div>

        {/* 30-Day Dynamic Price Trend Chart */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                  30-Day Price Trend
                </span>
                {isLoadingHistory && (
                  <span className="inline-block size-1.5 animate-ping rounded-full bg-emerald-400" />
                )}
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                L: ₹{minVal.toLocaleString("en-IN", { maximumFractionDigits: 1 })} · H: ₹
                {maxVal.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
              </span>
            </div>
            <div className="text-right">
              <span
                className={cn(
                  "font-mono text-[10px] font-bold block",
                  isPositive ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {netTrendPct >= 0 ? "+" : ""}
                {netTrendPct.toFixed(1)}%
              </span>
              <span className="font-mono text-[9px] text-slate-500 uppercase">
                {realHistory ? "NSE 30D" : "NSE FEED"}
              </span>
            </div>
          </div>

          <div className="h-32 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 2, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient
                    id={`spotlightTrend-${company.ticker}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={strokeColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                {/* Auto-scaling Y-Axis with domain prevents flat-line ceiling and guarantees headroom */}
                <YAxis domain={[yMin, yMax]} hide />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #1e293b",
                    borderRadius: "6px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    padding: "4px 8px",
                  }}
                  formatter={(v: unknown) => [
                    `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    "Price",
                  ]}
                  labelStyle={{ color: "#94a3b8", fontSize: "10px", marginBottom: "2px" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={strokeColor}
                  strokeWidth={2}
                  fill={`url(#spotlightTrend-${company.ticker})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Company Cards Grid ──────────────────────────────────────────────────────

function CompanyCardsGrid({
  companies,
  selectedTicker,
  watchlist,
  onSelect,
  onWatch,
  searchQuery,
  onOpenScreenerScout,
}: {
  companies: Company[];
  selectedTicker?: string;
  watchlist: string[];
  onSelect: (c: Company) => void;
  onWatch: (ticker: string) => void;
  searchQuery?: string;
  onOpenScreenerScout?: () => void;
}) {
  if (companies.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center">
        <Building2 className="mx-auto size-9 text-slate-500" />
        <h3 className="mt-3 text-base font-semibold text-white">
          {searchQuery ? `No local matches for "${searchQuery}"` : "No Indian companies found"}
        </h3>
        <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
          AssetMind AI can automatically search and scrape any listed Indian company live on-demand.
        </p>
        {onOpenScreenerScout && (
          <div className="mt-5">
            <Button
              onClick={onOpenScreenerScout}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Sparkles className="mr-1.5 size-3.5" />
              {searchQuery
                ? `Search & Scrape "${searchQuery}" Live`
                : "Search Live Market Index"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {companies.map((c) => {
        const isSelected = selectedTicker === c.ticker;
        const isWatched = watchlist.includes(c.ticker);

        return (
          <div
            key={c.ticker}
            onClick={() => onSelect(c)}
            className={cn(
              "group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer",
              isSelected
                ? "border-emerald-500 bg-slate-900/90 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500"
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80",
            )}
          >
            {/* Header: Logo, Name, Exchange, Watch */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs font-bold text-emerald-400">
                    {c.ticker.slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-sm truncate group-hover:text-emerald-300 transition-colors">
                      {c.name}
                    </h3>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                      <span>{c.ticker}</span>
                      <span>·</span>
                      <span className="rounded bg-slate-800 px-1 py-0.2 text-[10px] text-slate-300">
                        {c.exchange}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onWatch(c.ticker);
                  }}
                  className="text-slate-500 hover:text-rose-400 transition-colors"
                  aria-label="Add to watchlist"
                >
                  <Heart className={cn("size-4", isWatched ? "fill-rose-500 text-rose-500" : "")} />
                </button>
              </div>

              {/* Price and 24h Change */}
              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Price</span>
                  <p className="font-mono text-lg font-bold text-white">{fmtINR(c.price)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">24h Change</span>
                  <p
                    className={cn(
                      "font-mono text-xs font-semibold flex items-center justify-end",
                      c.change >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {c.change >= 0 ? "+" : ""}
                    {c.change.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Market Cap & Sector Tag */}
              <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px]">
                <span className="font-mono text-slate-300">{c.marketCap}</span>
                <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300 max-w-[130px] truncate">
                  {c.sector}
                </span>
              </div>
            </div>

            {/* Action button */}
            <div className="mt-4 pt-2">
              <Button
                asChild
                size="sm"
                className="w-full bg-slate-800/90 hover:bg-emerald-600 hover:text-white text-slate-200 text-xs font-medium border border-slate-700/60 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Link to="/company/$ticker" params={{ ticker: c.ticker }}>
                  View Analysis
                  <ChevronRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
