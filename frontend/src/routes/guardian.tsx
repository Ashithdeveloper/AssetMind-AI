import { createFileRoute } from "@tanstack/react-router";
import { BrainCircuit, Gauge, Hand, Layers, ShieldAlert, TrendingUp, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell, Panel } from "@/components/app-shell";
import { findCompany, fmtINR } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guardian")({
  head: () => ({
    meta: [
      { title: "Behavioral Guardian — AssetMind AI" },
      { name: "description", content: "Understand Active Behavioral Risk and the Investment Behavioral Guardian that mitigates bias-driven capital loss." },
      { property: "og:title", content: "Behavioral Guardian — AssetMind AI" },
      { property: "og:description", content: "A framework for measuring and guarding against behavioral risk in investing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuardianPage,
});

type Row = { label: string; quantitative: string; behavioral: string };

const rows: Row[] = [
  {
    label: "Category",
    quantitative: "Volatility & Tracking Error",
    behavioral: "Bias & Emotional Drift",
  },
  {
    label: "What it Measures",
    quantitative: "Statistical deviation of returns from a benchmark — tracking error, beta, value-at-risk.",
    behavioral: "Tendency to abandon a rational plan under stress — loss aversion, herding, recency bias.",
  },
  {
    label: "Behavioral Catalyst",
    quantitative: "Market-structure shocks — earnings misses, macro surprises, rate moves.",
    behavioral: "Fear / greed cycles — panic selling, FOMO chasing, anchoring to an entry price.",
  },
  {
    label: "Guardian Mitigation",
    quantitative: "Algorithmic rebalancing bands, position-size limits, stop-loss overlays.",
    behavioral: "Pre-commitment rules, cooling-off periods, structured de-biasing checklists.",
  },
];

const pillars = [
  {
    icon: Gauge,
    title: "Algorithmic Guardrails",
    body: "Automated position-size limits, rebalancing bands, and drawdown circuit-breakers that enforce discipline before emotion can override a plan.",
  },
  {
    icon: Layers,
    title: "Strategic Diversification",
    body: "Capital spread across asset classes, sectors, and uncorrelated strategies so no single bias or blow-up can sink the whole portfolio.",
  },
  {
    icon: BrainCircuit,
    title: "De-Biasing Process",
    body: "Decision journals, pre-mortems, and cooling-off rules that surface hidden assumptions and force a second look before conviction trades.",
  },
];

type PastDip = {
  year: string;
  drop: number;
  trigger: string;
  recoveredIn: string;
};

type PanicCase = {
  ticker: string;
  dropPct: number;
  reason: string;
  catalystType: string;
  recoveryPct: number;
  recoveryNote: string;
  recoveryWindow: string;
  history: PastDip[];
};

const panicCases: PanicCase[] = [
  {
    ticker: "SBIN",
    dropPct: -6.4,
    reason: "Broader PSU-bank sell-off after a cautious RBI policy commentary — not a company-specific event.",
    catalystType: "Sector-wide · RBI policy",
    recoveryPct: 78,
    recoveryNote: "In the last 9 comparable dips over 10 years, SBIN recovered to pre-drop levels within 4–9 months.",
    recoveryWindow: "4–9 months",
    history: [
      { year: "2023", drop: -7.1, trigger: "RBI rate-hike fears", recoveredIn: "5 months" },
      { year: "2022", drop: -9.4, trigger: "Global bank sector rout", recoveredIn: "7 months" },
      { year: "2020", drop: -38.0, trigger: "COVID crash", recoveredIn: "9 months" },
      { year: "2018", drop: -8.2, trigger: "IL&FS debt crisis", recoveredIn: "6 months" },
      { year: "2016", drop: -6.8, trigger: "Asset-quality review", recoveredIn: "4 months" },
    ],
  },
  {
    ticker: "ONGC",
    dropPct: -8.1,
    reason: "Brent crude fell sharply on demand fears, dragging all upstream energy stocks down together.",
    catalystType: "Commodity-driven · Crude oil",
    recoveryPct: 71,
    recoveryNote: "Historically ONGC has bounced back in 7 of 10 crude-driven corrections, aided by its 4%+ dividend cushion.",
    recoveryWindow: "5–10 months",
    history: [
      { year: "2023", drop: -6.5, trigger: "Crude demand slowdown", recoveredIn: "6 months" },
      { year: "2020", drop: -45.0, trigger: "Oil price collapse + COVID", recoveredIn: "10 months" },
      { year: "2018", drop: -11.0, trigger: "Global energy selloff", recoveredIn: "8 months" },
      { year: "2015", drop: -9.2, trigger: "Oil bear market", recoveredIn: "7 months" },
    ],
  },
  {
    ticker: "TATAMOTORS",
    dropPct: -5.2,
    reason: "Profit-booking after a strong quarterly run and JLR margin worries flagged by a broker note.",
    catalystType: "Profit-booking · Broker downgrade",
    recoveryPct: 74,
    recoveryNote: "Similar post-rally pullbacks recovered within 2–6 months in 8 of the last 11 instances.",
    recoveryWindow: "2–6 months",
    history: [
      { year: "2024", drop: -6.0, trigger: "JLR demand concerns", recoveredIn: "3 months" },
      { year: "2022", drop: -12.5, trigger: "Semiconductor shortage fears", recoveredIn: "5 months" },
      { year: "2020", drop: -52.0, trigger: "COVID + auto slowdown", recoveredIn: "8 months" },
      { year: "2019", drop: -7.8, trigger: "Brexit + JLR losses", recoveredIn: "4 months" },
      { year: "2016", drop: -8.1, trigger: "Demonetization", recoveredIn: "3 months" },
    ],
  },
  {
    ticker: "ZOMATO",
    dropPct: -11.3,
    reason: "High-valuation tech names sold off globally after a rise in bond yields — a sentiment move, not a business change.",
    catalystType: "Sentiment-driven · Yield spike",
    recoveryPct: 62,
    recoveryNote: "Volatile growth stocks recover less reliably — but panic exits have locked in losses far more often than they avoided them.",
    recoveryWindow: "3–12 months",
    history: [
      { year: "2024", drop: -9.5, trigger: "Tech valuation reset", recoveredIn: "4 months" },
      { year: "2022", drop: -28.0, trigger: "Growth-to-value rotation", recoveredIn: "9 months" },
      { year: "2022", drop: -15.2, trigger: "Lock-up expiry sell-off", recoveredIn: "6 months" },
    ],
  },
];

type PricePoint = { label: string; price: number; dip?: boolean };

// Build a deterministic monthly price series for a case so the chart shows
// every historical dip followed by its recovery — the visual evidence that
// "dips recover" is meant to build courage.
function buildPriceSeries(c: PanicCase): PricePoint[] {
  const pts: PricePoint[] = [];
  // earliest history year -> 0; walk chronologically; each event: dip then recover
  let price = 100;
  pts.push({ label: "start", price: 100 });
  const chron = [...c.history].sort((a, b) => Number(a.year) - Number(b.year));
  chron.forEach((d, i) => {
    price = price * (1 + d.drop / 100);
    pts.push({ label: `${d.year} dip`, price: Number(price.toFixed(1)), dip: true });
    price = 100; // recovered to pre-drop level
    pts.push({ label: `${d.year} rec`, price: 100 });
    if (i < chron.length - 1) pts.push({ label: "", price: 100 });
  });
  // current drop (today)
  price = 100 * (1 + c.dropPct / 100);
  pts.push({ label: "now", price: Number(price.toFixed(1)), dip: true });
  return pts;
}

function PriceChart({ data }: { data: PricePoint[] }) {
  return (
    <div className="mt-3 h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="guardianPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} interval={0} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} />
          <YAxis tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} domain={["dataMin - 8", "dataMax + 8"]} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: "var(--color-muted-foreground)", fontSize: 9 }}
            formatter={(v: number) => [`${v}`, "Price"]}
          />
          <Area type="monotone" dataKey="price" stroke="var(--color-primary)" strokeWidth={1.5} fill="url(#guardianPrice)" dot={{ r: 2, fill: "var(--color-primary)" }} activeDot={{ r: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PanicSellCheck() {
  const [selected, setSelected] = useState<PanicCase | null>(null);
  const [held, setHeld] = useState(false);
  const company = selected ? findCompany(selected.ticker) : null;

  return (
    <Panel title="PANIC-SELL CHECK · SIMULATION">
      <p className="mb-4 text-xs leading-relaxed text-foreground/70">
        Try to sell a falling stock in panic. The Guardian steps in first — explaining <em>why</em> it is
        falling and how often it has historically recovered, before you make an irreversible decision.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {panicCases.map((p) => {
          const c = findCompany(p.ticker)!;
          return (
            <button
              key={p.ticker}
              onClick={() => { setSelected(p); setHeld(false); }}
              className={cn(
                "rounded-md border p-3 text-left transition-colors",
                selected?.ticker === p.ticker ? "border-destructive/60 bg-destructive/10" : "border-border hover:border-destructive/40",
              )}
            >
              <p className="font-display text-sm">{c.name}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">{p.ticker} · {fmtINR(c.price)}</p>
              <p className="mt-1 font-mono text-sm text-destructive">{p.dropPct.toFixed(1)}% today</p>
              <span className="mt-2 inline-block rounded-sm border border-destructive/40 px-2 py-0.5 font-mono text-[9px] text-destructive">
                SELL IN PANIC
              </span>
            </button>
          );
        })}
      </div>

      {selected && company && (
        <div className="mt-4 animate-rise rounded-md border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-primary">
            <Hand className="size-4" />
            <span className="font-mono text-[10px]">GUARDIAN INTERVENTION — PAUSE BEFORE YOU SELL</span>
          </div>

          {/* 1 — REASON */}
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <TriangleAlert className="size-4 text-destructive" />
              <span className="font-mono text-[10px] text-destructive">1 · WHY IT IS FALLING</span>
              <span className="ml-auto rounded-sm border border-border px-2 py-0.5 font-mono text-[9px] text-muted-foreground">{selected.catalystType}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">{selected.reason}</p>
          </div>

          {/* 2 — PATTERN WHEN THIS HAPPENED EARLIER */}
          <div className="mt-4 rounded-md border border-border bg-card/40 p-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span className="font-mono text-[10px] text-muted-foreground">2 · PATTERN — WHEN THIS HAPPENED EARLIER</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/70">
              {company.name} has weathered {selected.history.length} similar dips over the last decade. Here is what each looked like and how long it took to come back.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="font-mono text-[9px] uppercase text-muted-foreground">
                    <th className="border-b border-border pb-1 pr-3 font-normal">Year</th>
                    <th className="border-b border-border pb-1 pr-3 font-normal">Fall</th>
                    <th className="border-b border-border pb-1 pr-3 font-normal">Trigger</th>
                    <th className="border-b border-border pb-1 font-normal">Recovered in</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.history.map((d, i) => (
                    <tr key={i} className="text-xs">
                      <td className="border-b border-border/50 py-1.5 pr-3 font-mono text-muted-foreground">{d.year}</td>
                      <td className="border-b border-border/50 py-1.5 pr-3 font-mono text-destructive">{d.drop.toFixed(1)}%</td>
                      <td className="border-b border-border/50 py-1.5 pr-3 text-foreground/80">{d.trigger}</td>
                      <td className="border-b border-border/50 py-1.5 font-mono text-primary">{d.recoveredIn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2.5 — PRICE PATTERN GRAPH */}
          <div className="mt-4 rounded-md border border-border bg-card/40 p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <span className="font-mono text-[10px] text-muted-foreground">PRICE PATTERN — DIPS & RECOVERIES</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/70">
              Every line below that dropped came back to its pre-drop level. The final point is today's panic dip — the same kind that recovered before.
            </p>
            <PriceChart data={buildPriceSeries(selected)} />
          </div>

          {/* 3 — POSSIBILITY OF RECOVERY */}
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <span className="font-mono text-[10px] text-muted-foreground">3 · POSSIBILITY OF RECOVERY</span>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="font-mono text-3xl text-primary">{selected.recoveryPct}%</p>
              <span className="mb-1 font-mono text-[10px] text-muted-foreground">recovered within {selected.recoveryWindow}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/70">{selected.recoveryNote}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-muted">
              <div className="h-full bg-primary" style={{ width: `${selected.recoveryPct}%` }} />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={() => setHeld(true)}
              className="rounded-md bg-primary px-4 py-2 font-mono text-[11px] text-primary-foreground hover:opacity-90"
            >
              HOLD — FOLLOW MY PLAN
            </button>
            <button
              onClick={() => setSelected(null)}
              className="rounded-md border border-border px-4 py-2 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              SELL ANYWAY
            </button>
          </div>
          {held && (
            <p className="mt-3 animate-rise rounded-md border border-primary/40 bg-primary/10 p-3 text-xs leading-relaxed text-foreground/80">
              Good call. You just avoided realizing a {Math.abs(selected.dropPct).toFixed(1)}% loss driven by emotion.
              The Guardian logged this decision in your journal — review it in 30 days. (Demo simulation, not investment advice.)
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

function GuardianPage() {
  return (
    <AppShell
      eyebrow="RISK FRAMEWORK / BEHAVIORAL GUARDIAN"
      title="Investment Behavioral Guardian"
      subtitle="Demo framework · informational only · not investment advice"
    >
      {/* Hero — Active Behavioral Risk definition + severe-loss warning */}
      <section className="panel-glass animate-rise overflow-hidden rounded-lg border border-border">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            <span className="font-mono text-[10px] text-primary">ACTIVE BEHAVIORAL RISK</span>
            <h2 className="mt-2 font-display text-2xl leading-tight sm:text-3xl">
              The risk that human bias deviates from your benchmark.
            </h2>
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-foreground/75">
              Active Behavioral Risk is the gap between what a disciplined strategy should return
              and what an investor actually captures once fear, greed, and anchoring take the wheel.
              Unlike market volatility, this risk is self-inflicted — and compounding. Repeated
              bias-driven exits and entries erode long-term returns far more than fees or taxes.
            </p>
          </div>
          <aside className="panel-soft flex flex-col justify-center rounded-md border border-destructive/40 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="size-5" />
              <span className="font-mono text-[10px]">SEVERE-CAPITAL-LOSS WARNING</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-foreground/80">
              Unchecked behavioral risk can lead to severe and irreversible capital loss.
              No framework eliminates risk entirely; it only makes the deviation measurable and
              the response disciplined.
            </p>
          </aside>
        </div>
      </section>

      {/* Panic-sell simulator */}
      <PanicSellCheck />

      {/* Comparison — Quantitative vs Psychological */}
      <Panel title="RISK COMPARISON">
        <div className="grid gap-4 lg:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]">
          {/* header row */}
          <div className="hidden lg:block" />
          <div className="panel-soft rounded-md border border-border p-3">
            <span className="font-mono text-[10px] text-primary">QUANTITATIVE ACTIVE RISK</span>
            <p className="mt-1 font-display text-sm">Statistical, market-driven</p>
          </div>
          <div className="panel-soft rounded-md border border-border p-3">
            <span className="font-mono text-[10px] text-destructive">PSYCHOLOGICAL BEHAVIORAL RISK</span>
            <p className="mt-1 font-display text-sm">Emotional, self-driven</p>
          </div>

          {rows.map((r) => (
            <div key={r.label} className="contents">
              <p className="font-mono text-[10px] text-muted-foreground lg:py-3 lg:pt-3">{r.label}</p>
              <div className="rounded-md border border-border p-3 text-sm text-foreground/80 lg:bg-card/40">{r.quantitative}</div>
              <div className="rounded-md border border-border p-3 text-sm text-foreground/80 lg:bg-card/40">{r.behavioral}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* 3-pillar breakdown */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="size-4 text-primary" />
          <p className="font-mono text-[10px] text-muted-foreground">THE GUARDIAN · THREE PILLARS</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }, i) => (
            <Panel key={title} className={cn("animate-rise", i === 1 && "[animation-delay:80ms]", i === 2 && "[animation-delay:160ms]")}>
              <div className="mb-3 grid size-10 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="font-display text-lg">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-foreground/75">{body}</p>
            </Panel>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
