import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

import { AppShell, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { companies, fmtChange, fmtINR, useWatchlist } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — AssetMind AI" },
      {
        name: "description",
        content: "Track the companies you follow in one place.",
      },
      { property: "og:title", content: "Watchlist — AssetMind AI" },
      { property: "og:description", content: "Your saved companies with live-style price moves." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const wl = useWatchlist();
  const rows = companies.filter((c) => wl.has(c.ticker));
  return (
    <AppShell eyebrow="SAVED / TRACKING" title="Watchlist" subtitle={`${rows.length} companies saved`}>
      {rows.length === 0 ? <Panel><div className="py-10 text-center"><Heart className="mx-auto mb-3 size-5 text-muted-foreground" /><p className="font-display">Nothing saved yet</p><Button asChild className="mt-4" size="sm" variant="signal"><Link to="/">Explore companies</Link></Button></div></Panel> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((c) => <Panel key={c.ticker}>
          <div className="flex items-start justify-between"><div><p className="font-display">{c.name}</p><p className="font-mono text-[10px] text-muted-foreground">{c.ticker} · {c.exchange}</p></div><Button size="icon-sm" variant="ghost" onClick={() => wl.toggle(c.ticker)} aria-label={`Remove ${c.name}`}><Heart className="fill-current text-primary" /></Button></div>
          <div className="mt-4 flex items-baseline justify-between"><span className="font-mono text-xl">{fmtINR(c.price)}</span><span className={cn("font-mono text-sm", c.change >= 0 ? "text-primary" : "text-destructive")}>{fmtChange(c.change)}</span></div>
          <Button asChild className="mt-4 w-full" size="sm" variant="outline"><Link to="/company/$ticker" params={{ ticker: c.ticker }}>View analysis</Link></Button>
        </Panel>)}</div>}
    </AppShell>
  );
}
