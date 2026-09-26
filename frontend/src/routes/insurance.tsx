import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Star } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { fmtINR, insurancePlans } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/insurance")({
  head: () => ({
    meta: [
      { title: "Insurance — AssetMind AI" },
      {
        name: "description",
        content: "Compare Indian term life, health, ULIP, and motor insurance plans by premium, cover, and claim ratio.",
      },
      { property: "og:title", content: "Insurance — AssetMind AI" },
      {
        property: "og:description",
        content: "Indian insurance plan comparison with premiums, cover, and claim settlement ratios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InsurancePage,
});

const types = ["All", "Term Life", "Health", "ULIP", "Motor"] as const;

function InsurancePage() {
  const [type, setType] = useState<(typeof types)[number]>("All");
  const [maxPremium, setMaxPremium] = useState(70000);

  const rows = useMemo(
    () => insurancePlans
      .filter((p) => (type === "All" || p.type === type) && p.premium <= maxPremium)
      .sort((a, b) => b.claimRatio - a.claimRatio),
    [type, maxPremium],
  );

  return (
    <AppShell eyebrow="PROTECT / INSURANCE" title="Insurance" subtitle={`${rows.length} plans · sorted by claim settlement ratio · demo data`}>
      <Panel title="YOUR CRITERIA">
        <div className="grid gap-5 md:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">Plan type</p><div className="mt-2 flex flex-wrap gap-1.5">{types.map((t) => <button key={t} onClick={() => setType(t)} className={cn("rounded px-2 py-1 text-xs ring-1 ring-border", type === t && "bg-primary/15 ring-primary/40")}>{t}</button>)}</div></div>
          <label className="block"><span className="text-xs text-muted-foreground">Max yearly premium: <span className="font-mono text-foreground">{fmtINR(maxPremium, 0)}</span></span><input type="range" min={5000} max={70000} step={1000} value={maxPremium} onChange={(e) => setMaxPremium(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" /></label>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.length === 0 ? <Panel className="md:col-span-2"><div className="py-10 text-center"><ShieldCheck className="mx-auto mb-3 size-5 text-muted-foreground" /><p className="font-display">No plans match</p><p className="mt-1 text-xs text-muted-foreground">Try raising your premium budget.</p></div></Panel> :
          rows.map((p) => <Panel key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-display">{p.name}</p><p className="font-mono text-[10px] text-muted-foreground">{p.insurer} · {p.type}</p></div>
              <span className="flex shrink-0 items-center gap-0.5 font-mono text-[10px] text-primary" aria-label={`${p.rating} star rating`}>{Array.from({ length: p.rating }).map((_, i) => <Star key={i} className="size-3 fill-current" />)}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-foreground/70">{p.summary}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div><p className="font-mono text-[9px] text-muted-foreground">PREMIUM</p><p className="mt-1 font-mono">{fmtINR(p.premium, 0)}/{p.premiumUnit}</p></div>
              <div><p className="font-mono text-[9px] text-muted-foreground">COVER</p><p className="mt-1 font-mono">{p.cover}</p></div>
              <div><p className="font-mono text-[9px] text-muted-foreground">CLAIM RATIO</p><p className="mt-1 font-mono text-primary">{p.claimRatio}%</p></div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="rounded px-2 py-0.5 font-mono text-[10px] text-foreground/70 ring-1 ring-border">{p.tenure}</span>
              <Button size="sm" variant="signal">Get quote</Button>
            </div>
          </Panel>)}
      </div>
    </AppShell>
  );
}
