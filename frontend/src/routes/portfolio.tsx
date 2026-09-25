import { createFileRoute, Link } from "@tanstack/react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { AppShell, Panel } from "@/components/app-shell";
import { findCompany, fmtChange, fmtINR } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — AssetMind AI" }, { name: "description", content: "A sample portfolio overview with holdings, allocation and performance." }, { property: "og:title", content: "Portfolio — AssetMind AI" }, { property: "og:description", content: "Holdings and sector allocation at a glance." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PortfolioPage,
});

const holdings = [["RELIANCE", 120], ["TCS", 60], ["HDFCBANK", 200], ["INFY", 150], ["TATAMOTORS", 250], ["ZOMATO", 800]] as const;
const shades = ["var(--primary)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

function PortfolioPage() {
  const rows = holdings.map(([t, qty]) => { const c = findCompany(t)!; return { c, qty, value: c.price * qty }; });
  const total = rows.reduce((s, r) => s + r.value, 0);
  const bySector = Object.entries(rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.c.sector]: (a[r.c.sector] ?? 0) + r.value }), {})).map(([name, value]) => ({ name, value: Math.round(value) }));
  return (
    <AppShell eyebrow="HOLDINGS / SAMPLE" title="Portfolio" subtitle="Sample holdings for demonstration">
      <div className="grid gap-4 sm:grid-cols-3">{([["Total value", fmtINR(total, 0)], ["Today", "+2.4%"], ["Holdings", `${rows.length}`]] as [string, string][]).map(([l, v]) => <Panel key={l}><p className="font-mono text-[9px] text-muted-foreground">{l.toUpperCase()}</p><p className="mt-1 font-mono text-2xl">{v}</p></Panel>)}</div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Panel title="HOLDINGS"><div className="divide-y divide-border">{rows.map(({ c, qty, value }) => <Link key={c.ticker} to="/company/$ticker" params={{ ticker: c.ticker }} className="flex items-center gap-3 py-3 hover:bg-primary/5"><div className="flex-1"><p className="text-sm">{c.name}</p><p className="font-mono text-[10px] text-muted-foreground">{qty} shares · {((value / total) * 100).toFixed(1)}%</p></div><span className="font-mono text-sm">{fmtINR(value, 0)}</span><span className={cn("w-16 text-right font-mono text-xs", c.change >= 0 ? "text-primary" : "text-destructive")}>{fmtChange(c.change)}</span></Link>)}</div></Panel>
        <Panel title="SECTOR ALLOCATION"><div className="h-52"><ResponsiveContainer><PieChart><Pie data={bySector} dataKey="value" innerRadius={50} outerRadius={80} stroke="var(--background)">{bySector.map((_, i) => <Cell key={i} fill={shades[i % shades.length]} />)}</Pie><Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} /></PieChart></ResponsiveContainer></div><ul className="mt-2 space-y-1 text-xs">{bySector.map((s, i) => <li key={s.name} className="flex items-center gap-2"><span className="size-2 rounded-sm" style={{ background: shades[i % shades.length] }} />{s.name}<span className="ml-auto font-mono">{((s.value / total) * 100).toFixed(0)}%</span></li>)}</ul></Panel>
      </div>
    </AppShell>
  );
}
