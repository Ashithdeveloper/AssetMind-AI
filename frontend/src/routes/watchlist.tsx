import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  ExternalLink,
  Heart,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { apiClient, ExploreCompany } from "@/lib/api";
import {
  Company,
  companies as fallbackCompanies,
  findCompany,
  fmtChange,
  fmtINR,
  getWatchlistMetaMap,
  normalizeTicker,
  saveWatchlistMeta,
  useWatchlist,
} from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — AssetMind AI" },
      {
        name: "description",
        content: "Track your saved Indian equities with live NSE/BSE price feeds and AI insights.",
      },
      { property: "og:title", content: "Watchlist — AssetMind AI" },
      { property: "og:description", content: "Your saved companies with live-style price moves." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WatchlistPage,
});

const POPULAR_SUGGESTIONS = [
  { ticker: "RELIANCE", name: "Reliance Industries", price: 2890.4 },
  { ticker: "TCS", name: "Tata Consultancy Services", price: 2084.0 },
  { ticker: "INFY", name: "Infosys Ltd", price: 1524.6 },
  { ticker: "HDFCBANK", name: "HDFC Bank Ltd", price: 1642.75 },
  { ticker: "TATAMOTORS", name: "Tata Motors Ltd", price: 964.8 },
];

function WatchlistPage() {
  const wl = useWatchlist();
  const [liveMap, setLiveMap] = useState<Record<string, ExploreCompany>>({});
  const [loadingLive, setLoadingLive] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "change" | "price" | "name">("default");

  // Fetch live market data for saved companies from backend explore / profile APIs
  const fetchLiveData = () => {
    if (wl.list.length === 0) return;
    setLoadingLive(true);

    apiClient
      .getExploreCompanies({ limit: 100 })
      .then((res) => {
        if (!res?.companies) return;
        const newMap: Record<string, ExploreCompany> = {};
        for (const c of res.companies) {
          const norm = normalizeTicker(c.symbol);
          newMap[norm] = c;
          // also cache metadata
          saveWatchlistMeta({
            ticker: norm,
            name: c.companyName,
            exchange: c.exchange || "NSE",
            price: c.latestSharePrice,
            change: c.dailyPercentageChange,
            sector: c.sector,
          });
        }
        setLiveMap((prev) => ({ ...prev, ...newMap }));

        // Check if any saved tickers are missing from explore batch
        const missingTickers = wl.list.filter((t) => !newMap[normalizeTicker(t)]);
        if (missingTickers.length > 0) {
          missingTickers.forEach((missing) => {
            apiClient
              .getCompanyProfile(missing)
              .then((prof) => {
                if (!prof) return;
                const norm = normalizeTicker(prof.symbol || missing);
                setLiveMap((prev) => ({
                  ...prev,
                  [norm]: {
                    id: prof.symbol,
                    companyName: prof.companyName || missing,
                    symbol: prof.symbol || missing,
                    exchange: prof.exchange || "NSE",
                    country: prof.country || "India",
                    sector: prof.sector || "Indian Equity",
                    logoUrl: prof.logoUrl || "",
                    latestSharePrice: prof.latestSharePrice || 0,
                    dailyPercentageChange: prof.dailyPercentageChange || 0,
                    marketCapitalization: prof.marketCapitalization || null,
                    currency: prof.currency || "INR",
                    lastUpdated: prof.lastUpdated || new Date().toISOString(),
                  },
                }));
                saveWatchlistMeta({
                  ticker: norm,
                  name: prof.companyName,
                  exchange: prof.exchange,
                  price: prof.latestSharePrice,
                  change: prof.dailyPercentageChange,
                  sector: prof.sector,
                });
              })
              .catch(() => {
                // Silently fallback to static or cached data
              });
          });
        }
      })
      .catch((err) => {
        console.warn("Watchlist: Explore API offline, using cached/fallback stock data:", err.message);
      })
      .finally(() => {
        setLoadingLive(false);
      });
  };

  useEffect(() => {
    fetchLiveData();
  }, [wl.list.length]);

  // Build the list of companies strictly from the user's saved tickers list
  const savedCompanies: Company[] = useMemo(() => {
    const metaMap = getWatchlistMetaMap();

    return wl.list.map((ticker) => {
      const norm = normalizeTicker(ticker);
      const live = liveMap[norm];
      const fallback = fallbackCompanies.find((c) => normalizeTicker(c.ticker) === norm);
      const cached = metaMap[norm];
      const baseComp = findCompany(norm);

      const price = live?.latestSharePrice || cached?.price || fallback?.price || baseComp.price;
      const change =
        live?.dailyPercentageChange ?? cached?.change ?? fallback?.change ?? baseComp.change;
      const name = live?.companyName || cached?.name || fallback?.name || baseComp.name;
      const exchange = live?.exchange || cached?.exchange || fallback?.exchange || baseComp.exchange;
      const sector = live?.sector || cached?.sector || fallback?.sector || baseComp.sector;

      return {
        ...baseComp,
        ticker: norm,
        name,
        exchange,
        sector,
        price,
        change,
        marketCap: live?.marketCapitalization
          ? `₹${Math.round(live.marketCapitalization / 1e7).toLocaleString("en-IN")} Cr`
          : fallback?.marketCap || baseComp.marketCap,
        trend: fallback?.trend || [price * 0.98, price * 0.99, price * 0.97, price * 1.01, price],
      };
    });
  }, [wl.list, liveMap]);

  // Filter and sort the saved rows
  const filteredRows = useMemo(() => {
    let res = savedCompanies;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      res = res.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.ticker.toLowerCase().includes(q) ||
          c.sector.toLowerCase().includes(q),
      );
    }

    if (sortBy === "change") {
      return [...res].sort((a, b) => b.change - a.change);
    }
    if (sortBy === "price") {
      return [...res].sort((a, b) => b.price - a.price);
    }
    if (sortBy === "name") {
      return [...res].sort((a, b) => a.name.localeCompare(b.name));
    }
    return res;
  }, [savedCompanies, search, sortBy]);

  // Overall statistics
  const gainers = savedCompanies.filter((c) => c.change > 0).length;
  const losers = savedCompanies.filter((c) => c.change < 0).length;
  const avgChange =
    savedCompanies.length > 0
      ? savedCompanies.reduce((acc, c) => acc + c.change, 0) / savedCompanies.length
      : 0;

  return (
    <AppShell
      eyebrow="PORTFOLIO RADAR / SAVED STOCKS"
      title="Watchlist"
      subtitle={`${wl.list.length} Indian ${wl.list.length === 1 ? "company" : "companies"} monitored`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchLiveData}
            disabled={loadingLive || wl.list.length === 0}
            className="border-border text-xs gap-1.5"
            title="Refresh latest stock quotes"
          >
            <RefreshCw className={cn("size-3.5", loadingLive && "animate-spin text-primary")} />
            <span>{loadingLive ? "Refreshing..." : "Refresh Quotes"}</span>
          </Button>
          {wl.list.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={wl.clear}
              className="text-muted-foreground hover:text-destructive text-xs gap-1"
              title="Clear all saved stocks"
            >
              <Trash2 className="size-3.5" />
              <span>Clear All</span>
            </Button>
          )}
        </div>
      }
    >
      {/* Overview Stats Bar */}
      {wl.list.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Panel className="p-3.5">
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              Total Saved
            </span>
            <p className="mt-1 font-mono text-xl font-bold">{wl.list.length}</p>
          </Panel>
          <Panel className="p-3.5">
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              Day Gainers
            </span>
            <p className="mt-1 font-mono text-xl font-bold text-emerald-400">
              {gainers} <span className="text-xs text-muted-foreground font-normal">advances</span>
            </p>
          </Panel>
          <Panel className="p-3.5">
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              Day Decliners
            </span>
            <p className="mt-1 font-mono text-xl font-bold text-rose-400">
              {losers} <span className="text-xs text-muted-foreground font-normal">declines</span>
            </p>
          </Panel>
          <Panel className="p-3.5">
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              Average Day Return
            </span>
            <p
              className={cn(
                "mt-1 font-mono text-xl font-bold flex items-center gap-1",
                avgChange >= 0 ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {avgChange >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
              {fmtChange(avgChange)}
            </p>
          </Panel>
        </div>
      )}

      {/* Filter and Search Controls */}
      {wl.list.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter saved stocks by name, ticker, or sector..."
              className="h-9 w-full rounded-md border border-border bg-card/60 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Sort:</span>
            {(
              [
                { id: "default", label: "Default" },
                { id: "change", label: "24h Move" },
                { id: "price", label: "Price" },
                { id: "name", label: "Name" },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                onClick={() => setSortBy(s.id)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors border",
                  sortBy === s.id
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {wl.list.length === 0 ? (
        <Panel>
          <div className="py-12 text-center max-w-md mx-auto">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 border border-primary/20 text-primary mx-auto mb-4">
              <Heart className="size-6" />
            </div>
            <h2 className="font-display text-xl font-bold">Your Watchlist is empty</h2>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Save stocks from the Explore page or any company terminal to monitor their live NSE/BSE
              prices, daily moves, and automated valuation models here in one place.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="sm" variant="signal" className="gap-1.5">
                <Link to="/">
                  <Building2 className="size-4" />
                  Explore Indian Stocks
                </Link>
              </Button>
            </div>

            <div className="mt-8 border-t border-border/60 pt-6">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
                Quick Add Popular Indian Equities:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {POPULAR_SUGGESTIONS.map((s) => (
                  <button
                    key={s.ticker}
                    type="button"
                    onClick={() =>
                      wl.add(s.ticker, {
                        name: s.name,
                        price: s.price,
                        exchange: "NSE",
                      })
                    }
                    className="flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1 text-xs font-mono transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary cursor-pointer"
                  >
                    <span>+ {s.ticker}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtINR(s.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      ) : filteredRows.length === 0 ? (
        <Panel>
          <div className="py-10 text-center">
            <p className="text-sm font-medium">No saved stocks match "{search}"</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSearch("")}
              className="mt-3 text-xs"
            >
              Clear Filter
            </Button>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((c) => (
            <Panel
              key={c.ticker}
              className="flex flex-col justify-between transition-all hover:border-primary/40"
            >
              <div>
                {/* Header: Company, Symbol, Exchange, Remove */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">{c.ticker}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.2 font-mono text-[9px] text-muted-foreground">
                        {c.exchange}
                      </span>
                      {c.sector && (
                        <span className="truncate text-[10px] text-muted-foreground font-mono">
                          · {c.sector}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 truncate font-display text-base font-semibold leading-tight">
                      {c.name}
                    </h3>
                  </div>

                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => wl.remove(c.ticker)}
                    className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
                    aria-label={`Remove ${c.name} from watchlist`}
                    title="Remove from watchlist"
                  >
                    <Heart className="size-4 fill-current text-rose-500" />
                  </Button>
                </div>

                {/* Price and 24h Change */}
                <div className="mt-4 flex items-baseline justify-between rounded-lg border border-border/60 bg-card/40 p-3">
                  <div>
                    <span className="block font-mono text-[10px] uppercase text-muted-foreground">
                      Live Share Price
                    </span>
                    <span className="font-mono text-xl font-bold tracking-tight">
                      {fmtINR(c.price)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block font-mono text-[10px] uppercase text-muted-foreground">
                      24h Return
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center font-mono text-xs font-bold",
                        c.change >= 0 ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {c.change >= 0 ? (
                        <TrendingUp className="mr-0.5 size-3" />
                      ) : (
                        <TrendingDown className="mr-0.5 size-3" />
                      )}
                      {fmtChange(c.change)}
                    </span>
                  </div>
                </div>

                {/* Market Cap & Quick Metrics */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-border/40 bg-secondary/30 px-2.5 py-1.5">
                    <span className="block font-mono text-[9px] text-muted-foreground uppercase">
                      Market Cap
                    </span>
                    <span className="font-mono font-medium text-foreground truncate block">
                      {c.marketCap}
                    </span>
                  </div>
                  <div className="rounded border border-border/40 bg-secondary/30 px-2.5 py-1.5">
                    <span className="block font-mono text-[9px] text-muted-foreground uppercase">
                      Stock P/E
                    </span>
                    <span className="font-mono font-medium text-foreground block">
                      {c.pe ? `${c.pe}x` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-3 border-t border-border/50">
                <Button asChild className="w-full justify-between" size="sm" variant="outline">
                  <Link to="/company/$ticker" params={{ ticker: c.ticker }}>
                    <span>Deep Analysis & Financials</span>
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </AppShell>
  );
}
