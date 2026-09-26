import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Database,
  Building2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiClient, ScreenerSearchResultItem } from "@/lib/api";
import { fmtINR } from "@/lib/market-data";
import { cn } from "@/lib/utils";

interface ScreenerScoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

export function ScreenerScoutModal({
  open,
  onOpenChange,
  initialQuery = "",
}: ScreenerScoutModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScreenerSearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [scrapingSymbol, setScrapingSymbol] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeSuccess, setScrapeSuccess] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync initial query if passed
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  // Debounced auto-search when query changes
  useEffect(() => {
    if (!open) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(query.trim());
    }, 400);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, open]);

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setScrapeError(null);
    try {
      const res = await apiClient.searchScreener(searchTerm.trim());
      setResults(res.results || []);
      setHasSearched(true);
    } catch (err: unknown) {
      console.warn("Screener search failed:", err instanceof Error ? err.message : String(err));
      setResults([]);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeAndNavigate = async (item: ScreenerSearchResultItem) => {
    setScrapingSymbol(item.slug);
    setScrapeError(null);
    setScrapeSuccess(null);

    try {
      const res = await apiClient.scrapeScreenerCompany(item.slug);
      setScrapeSuccess(`Scraped ${res.company.companyName} successfully!`);

      // Update item in local results list so UI reflects database state
      setResults((prev) =>
        prev.map((r) =>
          r.slug === item.slug
            ? {
                ...r,
                isScraped: true,
                marketCap: res.company.marketCap ?? null,
                latestPrice: res.company.latestPrice ?? null,
                changePercent: res.company.changePercent ?? null,
                sector: res.company.sector ?? null,
                pe: res.company.pe ?? null,
              }
            : r,
        ),
      );

      // Brief pause to show success checkmark before navigating
      setTimeout(() => {
        onOpenChange(false);
        navigate({ to: "/company/$ticker", params: { ticker: item.slug } });
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setScrapeError(`Failed to scrape ${item.name}: ${msg}`);
    } finally {
      setScrapingSymbol(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl sm:rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight">
                Live Scraper & On-Demand Extractor
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Enter any Indian stock company name or symbol to search and scrape live financial
                statements.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search Input Bar */}
        <div className="mt-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter company name (e.g. Suzlon, Tata Motors, Ola Electric, Zomato)..."
              autoFocus
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {loading ? (
              <RefreshCw className="absolute right-3.5 top-3 size-4 animate-spin text-emerald-400" />
            ) : query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3.5 top-2.5 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* Quick preset suggestions */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400 pt-1">
            <span className="font-mono text-[10px] text-slate-500 uppercase">Try:</span>
            {["Suzlon Energy", "Tata Motors", "Ola Electric", "Zomato", "Mazagon Dock", "IRFC"].map(
              (name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setQuery(name)}
                  className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 font-medium hover:border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors"
                >
                  {name}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Feedback banners */}
        {scrapeError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="size-4 shrink-0 text-rose-400" />
            <span>{scrapeError}</span>
          </div>
        )}
        {scrapeSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            <span>{scrapeSuccess}</span>
          </div>
        )}

        {/* Search Results List */}
        <div className="mt-3 max-h-[360px] overflow-y-auto space-y-2.5 pr-1">
          {loading && results.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-emerald-400" />
              Searching live market index...
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 py-10 text-center">
              <Building2 className="mx-auto size-8 text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-300">No companies found</p>
              <p className="mt-1 text-xs text-slate-500">
                Try searching with another spelling, trading symbol, or official listed name.
              </p>
            </div>
          )}

          {results.map((item) => {
            const isScrapingThis = scrapingSymbol === item.slug;

            return (
              <div
                key={item.id || item.slug}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all",
                  item.isScraped
                    ? "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    : "border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/40",
                )}
              >
                {/* Left: Info */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-white">{item.name}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                      {item.symbol || item.slug}
                    </span>
                    {item.isScraped ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        <Database className="size-2.5" />
                        In Database
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                        <Sparkles className="size-2.5" />
                        New · Ready to Scrape
                      </span>
                    )}
                  </div>

                  {/* Metrics preview row */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    {item.latestPrice != null && (
                      <span>
                        Price:{" "}
                        <strong className="text-slate-200">{fmtINR(item.latestPrice)}</strong>
                      </span>
                    )}
                    {item.marketCap != null && (
                      <span>
                        MCap:{" "}
                        <strong className="text-slate-200">
                          ₹{item.marketCap.toLocaleString()} Cr
                        </strong>
                      </span>
                    )}
                    {item.pe != null && (
                      <span>
                        P/E: <strong className="text-slate-200">{item.pe.toFixed(1)}x</strong>
                      </span>
                    )}
                    {item.sector && (
                      <span className="truncate max-w-[150px] text-slate-400">{item.sector}</span>
                    )}
                  </div>
                </div>

                {/* Right: Action Button */}
                <div className="shrink-0 flex items-center gap-2">
                  {item.isScraped ? (
                    <Button
                      asChild
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
                      onClick={() => onOpenChange(false)}
                    >
                      <Link to="/company/$ticker" params={{ ticker: item.symbol || item.slug }}>
                        View Analysis
                        <ChevronRight className="ml-1 size-3.5" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={isScrapingThis}
                      onClick={() => handleScrapeAndNavigate(item)}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      {isScrapingThis ? (
                        <>
                          <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                          Scraping Statements...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1.5 size-3.5" />
                          Scrape & View Analysis
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info note */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-emerald-400" />
            Extracts Balance Sheet, P&L, Cash Flow, Quarterly reports & live valuation
          </span>
          <span className="font-mono text-[10px]">NSE & BSE Live Market Data</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
