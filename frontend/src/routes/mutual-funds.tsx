import { createFileRoute } from "@tanstack/react-router";
import { PiggyBank, Star } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { fmtChange, fmtINR, mutualFunds } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mutual-funds")({
  head: () => ({ meta: [{ title: "Mutual Funds — AssetMind AI" }, { name: "description", content: "Explore Indian mutual funds by category, returns, risk, and SIP amount." }, { property: "og:title", content: "Mutual Funds — AssetMind AI" }, { property: "og:description", content: "Indian mutual fund discovery with returns, expense ratios, and SIP details." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MutualFundsPage,
});

const categories = ["All", "Equity", "Debt", "Hybrid", "Index"] as const;
const sorts = [
  { key: "returns1y", label: "1Y return" },
  { key: "returns3y", label: "3Y return" },
  { key: "returns5y", label: "5Y return" },
  { key: "expense", label: "Lowest cost" },
] as const;

function MutualFundsPage() {
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [sort, setSort] = useState<(typeof sorts)[number]["key"]>("returns1y");
  const [sip, setSip] = useState(5000);

  const rows = useMemo(
    () => mutualFunds
      .filter((f) => (category === "All" || f.category === category) && f.minSip <= sip)
      .sort((a, b) => (sort === "expense" ? a.expense - b.expense : b[sort] - a[sort])),
    [category, sort, sip],
  );

  return (
    <AppShell eyebrow="INVEST / MUTUAL FUNDS" title="Mutual Funds" subtitle={`${rows.length} funds · demo data · informational only`}>
      <Panel title="YOUR CRITERIA">
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Category</p><div className="mt-2 flex flex-wrap gap-1.5">{categories.map((c) => <button key={c} onClick={() => setCategory(c)} className={cn("rounded px-2 py-1 text-xs ring-1 ring-border", category === c && "bg-primary/15 ring-primary/40")}>{c}</button>)}</div></div>
          <div><p className="text-xs text-muted-foreground">Sort by</p><div className="mt-2 flex flex-wrap gap-1.5">{sorts.map((s) => <button key={s.key} onClick={() => setSort(s.key)} className={cn("rounded px-2 py-1 text-xs ring-1 ring-border", sort === s.key && "bg-primary/15 ring-primary/40")}>{s.label}</button>)}</div></div>
          <label className="block"><span className="text-xs text-muted-foreground">Monthly SIP you can start: <span className="font-mono text-foreground">{fmtINR(sip, 0)}</span></span><input type="range" min={100} max={25000} step={100} value={sip} onChange={(e) => setSip(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" /></label>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.length === 0 ? <Panel className="md:col-span-2"><div className="py-10 text-center"><PiggyBank className="mx-auto mb-3 size-5 text-muted-foreground" /><p className="font-display">No funds match</p><p className="mt-1 text-xs text-muted-foreground">Try a higher SIP amount or a different category.</p></div></Panel> :
          rows.map((f) => <Panel key={f.code}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-display">{f.name}</p><p className="font-mono text-[10px] text-muted-foreground">{f.amc} · {f.category}</p></div>
              <span className="flex shrink-0 items-center gap-0.5 font-mono text-[10px] text-primary" aria-label={`${f.rating} star rating`}>{Array.from({ length: f.rating }).map((_, i) => <Star key={i} className="size-3 fill-current" />)}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-foreground/70">{f.summary}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div><p className="font-mono text-[9px] text-muted-foreground">NAV</p><p className="mt-1 font-mono">{fmtINR(f.nav)}</p><p className={cn("font-mono text-[10px]", f.change >= 0 ? "text-primary" : "text-destructive")}>{fmtChange(f.change)}</p></div>
              <div><p className="font-mono text-[9px] text-muted-foreground">RETURNS 1Y / 3Y / 5Y</p><p className="mt-1 font-mono text-primary">{f.returns1y}% · {f.returns3y}% · {f.returns5y}%</p></div>
              <div><p className="font-mono text-[9px] text-muted-foreground">EXPENSE / MIN SIP</p><p className="mt-1 font-mono">{f.expense}% · {fmtINR(f.minSip, 0)}</p></div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className={cn("rounded px-2 py-0.5 font-mono text-[10px] ring-1 ring-border", f.risk === "Low" ? "text-primary" : f.risk === "High" ? "text-destructive" : "text-foreground/70")}>{f.risk} risk · AUM {f.aum}</span>
              <Button size="sm" variant="signal">Start SIP</Button>
            </div>
          </Panel>)}
      </div>
    </AppShell>
  );
}
