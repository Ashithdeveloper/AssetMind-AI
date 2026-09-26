import { createFileRoute } from "@tanstack/react-router";
import { Gem } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell, Panel } from "@/components/app-shell";
import { fmtChange, fmtINR, realAssets } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "Real-World Assets — AssetMind AI" },
      {
        name: "description",
        content: "Track gold, silver, Indian real estate, and listed REITs in one place.",
      },
      { property: "og:title", content: "Real-World Assets — AssetMind AI" },
      {
        property: "og:description",
        content: "Gold, silver, real estate, and REIT prices for Indian investors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssetsPage,
});

const kinds = ["All", "Gold", "Silver", "Real Estate", "REIT"] as const;

function AssetsPage() {
  const [kind, setKind] = useState<(typeof kinds)[number]>("All");
  const rows = useMemo(() => realAssets.filter((a) => kind === "All" || a.kind === kind), [kind]);

  return (
    <AppShell eyebrow="DIVERSIFY / REAL-WORLD ASSETS" title="Real-World Assets" subtitle="Gold, silver, property, and REITs · demo data · informational only">
      <Panel title="ASSET TYPE">
        <div className="flex flex-wrap gap-1.5">{kinds.map((k) => <button key={k} onClick={() => setKind(k)} className={cn("rounded px-2 py-1 text-xs ring-1 ring-border", kind === k && "bg-primary/15 ring-primary/40")}>{k}</button>)}</div>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? <Panel className="sm:col-span-2 lg:col-span-3"><div className="py-10 text-center"><Gem className="mx-auto mb-3 size-5 text-muted-foreground" /><p className="font-display">No assets in this category</p></div></Panel> :
          rows.map((a) => <Panel key={a.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-display">{a.name}</p><p className="font-mono text-[10px] text-muted-foreground">{a.kind} · {a.unit}</p></div>
              <span className={cn("shrink-0 rounded px-2 py-0.5 font-mono text-[10px] ring-1 ring-border", a.liquidity === "High" ? "text-primary" : a.liquidity === "Low" ? "text-destructive" : "text-foreground/70")}>{a.liquidity} liquidity</span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-mono text-xl">{fmtINR(a.price)}</span>
              <span className={cn("font-mono text-sm", a.change >= 0 ? "text-primary" : "text-destructive")}>{fmtChange(a.change)}</span>
            </div>
            {a.yieldPct !== null && <p className="mt-1 font-mono text-[10px] text-primary">{a.yieldPct}% annual yield</p>}
            <p className="mt-3 text-xs leading-relaxed text-foreground/70">{a.summary}</p>
          </Panel>)}
      </div>
    </AppShell>
  );
}
