import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  CircleDollarSign,
  Filter,
  Heart,
  Menu,
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { NotificationBell, Sidebar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { companies as fallbackCompanies, fmtINR, useWatchlist, type Company } from "@/lib/market-data";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Explore Companies — AssetMind AI" },
      {
        name: "description",
        content: "Explore featured companies, financial signals, market data, and AI-assisted research in AssetMind AI.",
      },
      { property: "og:title", content: "Explore Companies — AssetMind AI" },
      {
        property: "og:description",
        content: "A professional financial intelligence workspace for company discovery and analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
  const [country, setCountry] = useState("All");
  const [cap, setCap] = useState("All");
  const [sort, setSort] = useState<"change" | "price">("change");
  const [allCompanies, setAllCompanies] = useState<Company[]>(fallbackCompanies);
  const [selected, setSelected] = useState<Company>(fallbackCompanies[0]);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const { list: watchlist, toggle: toggleWatchlist } = useWatchlist();
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);

  // Connect directly with backend API
  useEffect(() => {
    let isMounted = true;
    const params: Parameters<typeof apiClient.getExploreCompanies>[0] = {
        sortBy: sort === "price" ? "sharePrice" : "priceChange",
        order: "desc",
      };
      if (sector !== "All") params.sector = sector;
      apiClient
      .getExploreCompanies(params)
      .then((res) => {
        if (!isMounted || !res.companies || res.companies.length === 0) return;

        const liveMapped: Company[] = res.companies.map((c) => {
          const fallback = fallbackCompanies.find((f) => f.ticker.toUpperCase() === c.symbol.toUpperCase());
          const price = c.latestSharePrice || fallback?.price || 100;
          return {
            ticker: c.symbol,
            name: c.companyName,
            exchange: c.exchange || "NSE",
            country: c.country || "India",
            countryCode: c.country === "India" ? "IN" : "US",
            sector: c.sector || "IT",
            price: price,
            change: c.dailyPercentageChange || fallback?.change || 0,
            marketCap: c.marketCapitalization
              ? `₹${(c.marketCapitalization / 1e7).toFixed(1)} Cr`
              : fallback?.marketCap || "₹10,000 Cr",
            capValue: c.marketCapitalization ? Math.round(c.marketCapitalization / 1e10) : fallback?.capValue || 100,
            trend: fallback?.trend || [price * 0.95, price * 0.97, price * 0.98, price * 0.99, price],
            pe: fallback?.pe || 24.5,
            revenue: fallback?.revenue || "₹50K Cr",
            margin: fallback?.margin || 18.5,
            debtEquity: fallback?.debtEquity || 0.45,
            dividend: fallback?.dividend || 1.2,
            risk: fallback?.risk || "Low",
            summary: `${c.companyName} (${c.symbol}) listed on ${c.exchange}. Operating in ${c.sector}.`,
          };
        });

        setAllCompanies(liveMapped);
        const first = liveMapped[0];
        if (first) {
          setSelected(first);
        }
        setIsLiveConnected(true);
      })
      .catch((err) => {
        console.warn("Backend explore API unavailable, using rich fallback data:", err.message);
        setIsLiveConnected(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sector, sort]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allCompanies
      .filter((company) =>
        (!normalized || [company.name, company.ticker, company.sector].some((value) => value.toLowerCase().includes(normalized))) &&
        (sector === "All" || company.sector.toLowerCase() === sector.toLowerCase()) &&
        (country === "All" || company.exchange === country) &&
        (cap === "All" || (cap === "Mega" ? company.capValue >= 500 : cap === "Large" ? company.capValue >= 100 && company.capValue < 500 : company.capValue < 100)),
      )
      .sort((a, b) => (sort === "price" ? b.price - a.price : b.change - a.change));
  }, [allCompanies, cap, country, query, sector, sort]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="relative flex min-h-screen">
        <Sidebar open={mobileNav} onClose={() => setMobileNav(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="panel-glass sticky top-0 z-30 grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 sm:px-5">
            <Button className="lg:hidden" size="icon-sm" variant="ghost" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></Button>
            <div className="hidden items-center gap-2.5 xl:flex">
              <span className={cn("size-2 rounded-full", isLiveConnected ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-primary shadow-[0_0_10px_var(--primary)]")} />
              <span className="font-mono text-[11px] text-foreground/70">
                {isLiveConnected ? "LIVE BACKEND CONNECTED · NSE/BSE" : "MARKETS OPEN · 14:32 IST"}
              </span>
            </div>
            <label className="panel-soft mx-auto flex h-9 w-full max-w-xl min-w-0 items-center gap-2 rounded-md border border-border px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Search company (TCS, Adani, OLA, Reliance)..." aria-label="Search companies" />
              {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X className="size-4 text-muted-foreground" /></button>}
            </label>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden text-right sm:block"><p className="font-mono text-[9px] text-muted-foreground">PORTFOLIO</p><p className="font-mono text-xs">₹1,08,42,600 <span className="text-primary">+2.4%</span></p></div>
              <NotificationBell />
              <Link to="/settings" aria-label="Account settings" className="grid size-8 place-items-center rounded-md border border-border bg-secondary font-mono text-[10px]">JM</Link>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <FilterRail open={mobileFilters} onClose={() => setMobileFilters(false)} sector={sector} setSector={setSector} country={country} setCountry={setCountry} cap={cap} setCap={setCap} />
            <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mx-auto max-w-[1180px] space-y-5">
                <div className="animate-rise grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="font-mono text-[10px] text-primary">INDIAN EQUITIES / IT · ADANI GROUP · OLA ELECTRIC</p>
                      {isLiveConnected && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400 border border-emerald-500/20">
                          <Sparkles className="size-3" /> Live Verified Data
                        </span>
                      )}
                    </div>
                    <h1 className="truncate font-display text-2xl">Explore Companies</h1>
                    <p className="mt-1 text-xs text-muted-foreground">{results.length} companies listed · Featuring IT Giants, Adani Group, and OLA Mobility</p>
                  </div>
                  <div className="flex gap-2">
                    <Button className="xl:hidden" size="sm" variant="outline" onClick={() => setMobileFilters(true)}><Filter /> Filters</Button>
                    <Button size="sm" variant="outline" onClick={() => setSort((value) => value === "change" ? "price" : "change")}><SlidersHorizontal /><span className="hidden sm:inline">Sort:</span> {sort === "change" ? "Momentum" : "Price"}</Button>
                  </div>
                </div>

                <Spotlight company={selected} onWatch={() => toggleWatchlist(selected.ticker)} watched={watchlist.includes(selected.ticker)} />
                <CompanyTable companies={results} selected={selected.ticker} watchlist={watchlist} onSelect={setSelected} onWatch={toggleWatchlist} />
              </div>
            </main>
            <InsightRail companies={allCompanies} watchlist={watchlist} selected={selected} onSelect={setSelected} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterRail({ open, onClose, sector, setSector, country, setCountry, cap, setCap }: { open: boolean; onClose: () => void; sector: string; setSector: (value: string) => void; country: string; setCountry: (value: string) => void; cap: string; setCap: (value: string) => void }) {
  return <>
    {open && <button className="fixed inset-0 z-40 bg-background/70 xl:hidden" onClick={onClose} aria-label="Close filters overlay" />}
    <aside className={cn("panel-soft fixed inset-y-0 left-0 z-50 w-64 -translate-x-full overflow-y-auto border-r border-border p-4 transition-transform lg:left-60 xl:static xl:z-auto xl:w-56 xl:translate-x-0", open && "translate-x-0")}>
      <div className="mb-4 flex items-center justify-between"><p className="font-mono text-[9px] text-muted-foreground">FILTERS</p><Button className="xl:hidden" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close filters"><X /></Button></div>
      <FilterGroup title="Sector / Category" items={["All", "IT", "Energy & Infrastructure", "Electric Vehicles", "Banking & Finance", "Healthcare", "Manufacturing", "Technology"]} value={sector} setValue={setSector} />
      <FilterGroup title="Market cap" items={["All", "Mega", "Large", "Mid"]} value={cap} setValue={setCap} />
      <FilterGroup title="Exchange" items={["All", "NSE", "BSE"]} value={country} setValue={setCountry} />
      <Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => { setSector("All"); setCountry("All"); setCap("All"); }}>Reset filters</Button>
    </aside>
  </>;
}

function FilterGroup({ title, items, value, setValue }: { title: string; items: string[]; value: string; setValue: (value: string) => void }) {
  return <div className="mb-5"><p className="mb-2 text-[11px] text-muted-foreground">{title}</p><div className="flex flex-wrap gap-1.5">{items.map((item) => <button key={item} onClick={() => setValue(item)} className={cn("rounded px-2 py-1 text-[11px] text-muted-foreground ring-1 ring-border transition-colors", value === item && "bg-primary/15 text-foreground ring-primary/40")}>{item}</button>)}</div></div>;
}

function Spotlight({ company, onWatch, watched }: { company: Company; onWatch: () => void; watched: boolean }) {
  const chartData = company.trend.map((value, index) => ({ index, value }));
  return <section className="panel-glass animate-rise rounded-lg border border-border p-4 [animation-delay:80ms] sm:p-5">
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] text-primary">SPOTLIGHT</span>
          <span className="font-mono text-[10px] text-muted-foreground">{company.name.toUpperCase()} · {company.ticker}</span>
        </div>
        <h2 className="mt-2 font-display text-xl">{company.name}</h2>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="font-mono text-3xl">{fmtINR(company.price)}</span>
          <span className={cn("font-mono text-sm", company.change >= 0 ? "text-primary" : "text-destructive")}>
            {company.change >= 0 ? "▲" : "▼"} {company.change >= 0 ? "+" : ""}{company.change.toFixed(2)}%
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
          {[["MARKET CAP", company.marketCap], ["SECTOR", company.sector], ["COUNTRY", company.country], ["EXCHANGE", company.exchange]].map(([label, value]) => (
            <div key={label}>
              <p className="font-mono text-[9px] text-muted-foreground">{label}</p>
              <p className="mt-1 truncate">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <Button asChild size="sm" variant="signal">
            <Link to="/company/$ticker" params={{ ticker: company.ticker }}>
              <Bot className="size-4 mr-1" /> Open Buy & Sell AI Analysis
            </Link>
          </Button>
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[9px] text-muted-foreground">30-DAY TREND</span>
          <Button size="icon-sm" variant={watched ? "signal" : "ghost"} onClick={onWatch} aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}>
            <Heart className={cn(watched && "fill-current")} />
          </Button>
        </div>
        <div className="h-28 rounded-md border border-border bg-background/40 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="url(#trendFill)" isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </section>;
}

function CompanyTable({ companies: rows, selected, watchlist, onSelect, onWatch }: { companies: Company[]; selected: string; watchlist: string[]; onSelect: (company: Company) => void; onWatch: (ticker: string) => void }) {
  return <section className="panel-glass animate-rise overflow-hidden rounded-lg border border-border [animation-delay:140ms]">
    <div className="hidden grid-cols-[1.6fr_.8fr_.8fr_.8fr_1fr_.45fr_.8fr] gap-3 border-b border-border px-5 py-2.5 font-mono text-[9px] text-muted-foreground md:grid">
      <span>COMPANY</span>
      <span className="text-right">PRICE</span>
      <span className="text-right">CHANGE</span>
      <span className="text-right">MKT CAP</span>
      <span>SECTOR</span>
      <span>WATCH</span>
      <span className="text-right">ACTION</span>
    </div>
    {rows.length === 0 ? (
      <div className="grid min-h-52 place-items-center px-5 text-center">
        <div>
          <Search className="mx-auto mb-3 size-5 text-muted-foreground" />
          <p className="font-display">No companies found</p>
          <p className="mt-1 text-xs text-muted-foreground">Try searching for TCS, Adani, OLA, or Reliance.</p>
        </div>
      </div>
    ) : (
      <div className="divide-y divide-border">
        {rows.map((company) => (
          <div key={company.ticker} className={cn("grid gap-3 px-4 py-3 transition-colors hover:bg-primary/5 md:grid-cols-[1.6fr_.8fr_.8fr_.8fr_1fr_.45fr_.8fr] md:items-center md:px-5", selected === company.ticker && "bg-primary/5")}>
            <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => onSelect(company)}>
              <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-secondary font-mono text-[9px] font-bold text-primary">
                {company.ticker.slice(0, 3)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{company.name}</span>
                <span className="block font-mono text-[9px] text-muted-foreground">{company.ticker} · {company.exchange} · {company.countryCode}</span>
              </span>
            </button>
            <div className="grid grid-cols-3 gap-3 md:contents">
              <span className="font-mono text-xs md:text-right">
                <small className="block font-sans text-[9px] text-muted-foreground md:hidden">PRICE</small>
                {fmtINR(company.price)}
              </span>
              <span className={cn("font-mono text-xs md:text-right", company.change >= 0 ? "text-primary" : "text-destructive")}>
                <small className="block font-sans text-[9px] text-muted-foreground md:hidden">CHANGE</small>
                {company.change >= 0 ? "+" : ""}{company.change.toFixed(2)}%
              </span>
              <span className="font-mono text-xs text-foreground/70 md:text-right">
                <small className="block font-sans text-[9px] text-muted-foreground md:hidden">MKT CAP</small>
                {company.marketCap}
              </span>
            </div>
            <span className="hidden text-xs text-foreground/75 md:block">{company.sector}</span>
            <Button size="icon-sm" variant="ghost" onClick={() => onWatch(company.ticker)} aria-label={watchlist.includes(company.ticker) ? `Remove ${company.name} from watchlist` : `Add ${company.name} to watchlist`}>
              <Heart className={cn(watchlist.includes(company.ticker) && "fill-current text-primary")} />
            </Button>
            <Button asChild size="sm" variant="signal">
              <Link to="/company/$ticker" params={{ ticker: company.ticker }}>
                View Analysis
              </Link>
            </Button>
          </div>
        ))}
      </div>
    )}
  </section>;
}

function InsightRail({ companies, watchlist, selected, onSelect }: { companies: Company[]; watchlist: string[]; selected: Company; onSelect: (company: Company) => void }) {
  const watched = companies.filter((company) => watchlist.includes(company.ticker)).slice(0, 3);
  return <aside className="panel-soft hidden w-72 shrink-0 space-y-4 overflow-y-auto border-l border-border p-4 2xl:block">
    <Insight title="WATCHLIST">
      <div className="space-y-3">
        {watched.length === 0 ? (
          <p className="text-xs text-muted-foreground">Click heart icon to pin companies</p>
        ) : (
          watched.map((company) => (
            <button key={company.ticker} onClick={() => onSelect(company)} className="flex w-full items-center justify-between text-left">
              <span>
                <span className="block text-xs font-medium">{company.name}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{company.ticker}</span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-xs">{fmtINR(company.price)}</span>
                <span className={cn("block font-mono text-[9px]", company.change >= 0 ? "text-primary" : "text-destructive")}>
                  {company.change >= 0 ? "+" : ""}{company.change}%
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </Insight>
    <Insight title="AI RESEARCH">
      <p className="text-xs leading-relaxed text-foreground/70">
        {selected.name}'s fundamentals and cash flow metrics are synchronized with Qdrant knowledge base and Ollama Cloud <span className="font-mono text-primary">gpt-oss:20b-cloud</span>.
      </p>
      <Button asChild className="mt-3 w-full" size="sm" variant="signal">
        <Link to="/company/$ticker" params={{ ticker: selected.ticker }}>
          <Bot className="size-4 mr-1" /> Open Buy / Sell Analysis
        </Link>
      </Button>
    </Insight>
    <Insight title="FEATURED INDIAN PILLARS">
      <div className="space-y-2 text-xs">
        <div className="flex justify-between items-center"><span className="text-muted-foreground">IT Leaders</span><span className="font-mono text-[11px] text-primary">TCS, INFY, WIPRO</span></div>
        <div className="flex justify-between items-center"><span className="text-muted-foreground">Adani Group</span><span className="font-mono text-[11px] text-primary">ADANIENT, PORTS</span></div>
        <div className="flex justify-between items-center"><span className="text-muted-foreground">EV Mobility</span><span className="font-mono text-[11px] text-primary">OLAELEC, TATA</span></div>
      </div>
    </Insight>
    <Insight title="MARKET PULSE">
      <div className="space-y-2 font-mono text-[10px]">
        <p className="flex justify-between"><span className="text-muted-foreground">NIFTY 50</span><span className="text-primary">+0.84%</span></p>
        <p className="flex justify-between"><span className="text-muted-foreground">SENSEX</span><span className="text-primary">+1.12%</span></p>
        <p className="flex justify-between"><span className="text-muted-foreground">INDIA VIX</span><span>14.28</span></p>
      </div>
    </Insight>
  </aside>;
}

function Insight({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel-glass rounded-lg border border-border p-4"><h2 className="mb-3 font-mono text-[9px] text-muted-foreground">{title}</h2>{children}</section>;
}