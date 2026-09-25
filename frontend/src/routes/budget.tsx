import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AppShell, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { companies, fmtChange, fmtINR } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/budget")({
  head: () => ({ meta: [{ title: "Budget Scout — AssetMind AI" }, { name: "description", content: "Find companies that fit your budget, risk level, and sector interests." }, { property: "og:title", content: "Budget Scout — AssetMind AI" }, { property: "og:description", content: "Budget-based company discovery." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: BudgetPage,
});

const risks = ["Any", "Low", "Medium", "High"] as const;

function BudgetPage() {
  const [budget, setBudget] = useState(2000);
  const [risk, setRisk] = useState<(typeof risks)[number]>("Any");
  const [dividendOnly, setDividendOnly] = useState(false);
  const matches = useMemo(() => companies.filter((c) => c.price <= budget && (risk === "Any" || c.risk === risk) && (!dividendOnly || c.dividend > 0)).sort((a, b) => a.price - b.price), [budget, risk, dividendOnly]);

  return (
    <AppShell eyebrow="DISCOVERY / BUDGET" title="Budget Scout" subtitle="Companies whose share price fits your budget · informational only">
      <Panel title="YOUR CRITERIA">
        <div className="grid gap-5 md:grid-cols-3">
          <label className="block"><span className="text-xs text-muted-foreground">Budget per share: <span className="font-mono text-foreground">{fmtINR(budget, 0)}</span></span><input type="range" min={100} max={5000} step={100} value={Math.min(budget, 5000)} onChange={(e) => setBudget(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" /></label>
          <div><p className="text-xs text-muted-foreground">Risk level</p><div className="mt-2 flex gap-1.5">{risks.map((r) => <button key={r} onClick={() => setRisk(r)} className={cn("rounded px-2 py-1 text-xs ring-1 ring-border", risk === r && "bg-primary/15 ring-primary/40")}>{r}</button>)}</div></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dividendOnly} onChange={(e) => setDividendOnly(e.target.checked)} className="accent-[var(--primary)]" /> Dividend payers only</label>
        </div>
      </Panel>
      <Panel title={`${matches.length} MATCHES`}>
        {matches.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No matches. Try raising your budget.</p> :
          <div className="divide-y divide-border">{matches.map((c) => <div key={c.ticker} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1"><p className="text-sm">{c.name}</p><p className="font-mono text-[10px] text-muted-foreground">{c.ticker} · {c.sector} · risk {c.risk}</p></div>
            <span className="font-mono text-sm">{fmtINR(c.price)}</span>
            <span className="font-mono text-xs text-muted-foreground">{Math.floor(budget / c.price)} shares</span>
            <span className={cn("w-16 text-right font-mono text-xs", c.change >= 0 ? "text-primary" : "text-destructive")}>{fmtChange(c.change)}</span>
            <Button asChild size="sm" variant="signal"><Link to="/company/$ticker" params={{ ticker: c.ticker }}>Analyze</Link></Button>
          </div>)}</div>}
      </Panel>
    </AppShell>
  );
}
