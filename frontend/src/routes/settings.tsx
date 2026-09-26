import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { applyTheme, isThemeId, themes, type ThemeId } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AssetMind AI" },
      {
        name: "description",
        content: "Manage your profile, alerts and research preferences.",
      },
      { property: "og:title", content: "Settings — AssetMind AI" },
      { property: "og:description", content: "Account and preference settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Toggle({ label, desc, on, set }: { label: string; desc: string; on: boolean; set: (v: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div><button role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} className={cn("h-5 w-9 shrink-0 rounded-full border border-border bg-secondary p-0.5 transition-colors", on && "bg-primary")}><span className={cn("block size-3.5 rounded-full bg-foreground transition-transform", on && "translate-x-4")} /></button></div>;
}

function SettingsPage() {
  const [name, setName] = useState("Jordan Mehta");
  const [email, setEmail] = useState("jordan@example.com");
  const [alerts, setAlerts] = useState(true);
  const [digest, setDigest] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [theme, setTheme] = useState<ThemeId>("emerald");
  const [saved, setSaved] = useState(false);
  useEffect(() => { const v = localStorage.getItem("assetmind-settings"); if (v) { const o = JSON.parse(v); setName(o.name ?? "Jordan Mehta"); setEmail(o.email ?? "jordan@example.com"); setAlerts(o.alerts ?? true); setDigest(o.digest ?? false); setCurrency(o.currency ?? "INR"); if (isThemeId(o.theme)) { setTheme(o.theme); applyTheme(o.theme); } } }, []);
  useEffect(() => { const v = localStorage.getItem("assetmind-settings"); if (v) { const o = JSON.parse(v); localStorage.setItem("assetmind-settings", JSON.stringify({ ...o, alerts, digest, theme })); } }, [alerts, digest, theme]);
  const chooseTheme = (nextTheme: ThemeId) => { setTheme(nextTheme); applyTheme(nextTheme); const current = localStorage.getItem("assetmind-settings"); const settings = current ? JSON.parse(current) : { name, email, alerts, digest, currency }; localStorage.setItem("assetmind-settings", JSON.stringify({ ...settings, theme: nextTheme })); };
  const themeGroups = [
    { label: "LIGHT", options: themes.filter((option) => option.mode === "light") },
    { label: "DARK", options: themes.filter((option) => option.mode === "dark") },
  ];
  const field = "panel-soft mt-1 h-9 w-full rounded-md border border-border px-3 text-sm outline-none";
  return (
    <AppShell eyebrow="SYSTEM / PREFERENCES" title="Settings">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="PROFILE">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); localStorage.setItem("assetmind-settings", JSON.stringify({ name, email, alerts, digest, currency, theme })); setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
            <label className="block text-xs text-muted-foreground">Full name<input className={field} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="block text-xs text-muted-foreground">Email<input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block text-xs text-muted-foreground">Display currency<select className={field} value={currency} onChange={(e) => setCurrency(e.target.value)}>{["USD", "EUR", "INR", "GBP", "JPY"].map((c) => <option key={c}>{c}</option>)}</select></label>
            <Button type="submit" size="sm" variant="signal">{saved ? "Saved" : "Save changes"}</Button>
          </form>
        </Panel>
        <Panel title="NOTIFICATIONS">
          <div className="divide-y divide-border">
            <Toggle label="Price alerts" desc="Notify me when watchlist moves over 3%" on={alerts} set={setAlerts} />
            <Toggle label="Weekly digest" desc="A Monday summary of your watchlist" on={digest} set={setDigest} />
          </div>
        </Panel>
        <div className="lg:col-span-2">
          <Panel title="APPEARANCE">
            <div>
              <p className="text-sm font-medium">Website colour</p>
              <p className="mt-1 text-xs text-muted-foreground">Choose the palette that feels most comfortable to you.</p>
            </div>
            <div className="mt-4 space-y-5" role="radiogroup" aria-label="Website colour theme">
              {themeGroups.map((group) => <div key={group.label}>
                <p className="mb-2 font-mono text-[10px] text-muted-foreground">{group.label}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {group.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      data-theme-option={option.id}
                      role="radio"
                      aria-checked={theme === option.id}
                      onClick={() => chooseTheme(option.id)}
                      className={cn("rounded-md border bg-card p-3 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", theme === option.id ? "border-primary ring-1 ring-primary" : "border-border")}
                    >
                      <span className="mb-3 flex gap-1.5" aria-hidden="true">
                        <span className="theme-swatch size-5 rounded-sm" />
                        <span className="theme-swatch-deep size-5 rounded-sm border border-border" />
                        <span className="theme-swatch-text size-5 rounded-sm" />
                      </span>
                      <span className="block text-sm font-medium text-foreground">{option.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>)}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
