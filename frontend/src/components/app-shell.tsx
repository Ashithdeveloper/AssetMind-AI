import { Link } from "@tanstack/react-router";
import { Bell, Bot, BriefcaseBusiness, CircleDollarSign, Gem, Heart, LayoutDashboard, Menu, PiggyBank, Settings, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Explore Stocks", icon: LayoutDashboard, to: "/" },
  { label: "Mutual Funds", icon: PiggyBank, to: "/mutual-funds" },
  { label: "Insurance", icon: ShieldCheck, to: "/insurance" },
  { label: "Real Assets", icon: Gem, to: "/assets" },
  { label: "Portfolio", icon: BriefcaseBusiness, to: "/portfolio" },
  { label: "Watchlist", icon: Heart, to: "/watchlist" },
  { label: "AI Research", icon: Bot, to: "/research" },
  { label: "Budget Scout", icon: CircleDollarSign, to: "/budget" },
  { label: "Behavioral Guardian", icon: ShieldAlert, to: "/guardian" },
] as const;

const linkCls = "flex w-full items-center gap-3 rounded-md border border-transparent px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const activeCls = "border-primary/30 bg-primary/15 text-foreground";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <>
    {open && <button className="fixed inset-0 z-40 bg-background/70 lg:hidden" onClick={onClose} aria-label="Close navigation overlay" />}
    <aside className={cn("panel-glass fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 -translate-x-full flex-col border-r border-border transition-transform lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:translate-x-0", open && "translate-x-0")}>
      <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-5">
        <Link to="/" className="flex min-w-0 items-center gap-2.5"><div className="grid size-8 shrink-0 place-items-center rounded-md border border-primary/40 bg-primary/15 font-mono text-sm text-primary">A</div><div className="min-w-0"><p className="truncate font-display text-[15px]">AssetMind</p><p className="font-mono text-[9px] text-muted-foreground">AI RESEARCH</p></div></Link>
        <Button className="lg:hidden" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close navigation"><X /></Button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-2 pb-2 font-mono text-[9px] text-muted-foreground">WORKSPACE</p>
        {navItems.map(({ label, icon: Icon, to }) => (
          <Link key={to} to={to} onClick={onClose} className={linkCls} activeProps={{ className: activeCls }} activeOptions={{ exact: to === "/" }}>
            <Icon className="size-4" />{label}
          </Link>
        ))}
        <p className="px-2 pb-2 pt-4 font-mono text-[9px] text-muted-foreground">SYSTEM</p>
        <Link to="/settings" onClick={onClose} className={linkCls} activeProps={{ className: activeCls }}><Settings className="size-4" />Settings</Link>
      </nav>
    </aside>
  </>;
}

export function AppShell({ eyebrow, title, subtitle, actions, children }: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const [nav, setNav] = useState(false);
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar open={nav} onClose={() => setNav(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="panel-glass sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border px-3 sm:px-5">
          <Button className="lg:hidden" size="icon-sm" variant="ghost" onClick={() => setNav(true)} aria-label="Open navigation"><Menu /></Button>
          <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
          <LiveClock />
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <Link to="/login" className="grid size-8 place-items-center rounded-md border border-border bg-secondary font-mono text-[10px]">JM</Link>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-[1180px] space-y-5">
            <div className="animate-rise flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0"><p className="mb-1 font-mono text-[10px] text-primary">{eyebrow}</p><h1 className="font-display text-2xl">{title}</h1>{subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}</div>
              {actions}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const ist = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const hh = String(ist.getHours()).padStart(2, "0");
      const mm = String(ist.getMinutes()).padStart(2, "0");
      const ss = String(ist.getSeconds()).padStart(2, "0");
      // NSE/BSE hours 09:15–15:30 IST
      const mins = ist.getHours() * 60 + ist.getMinutes();
      const open = mins >= 555 && mins <= 930;
      setNow(`${open ? "MARKETS OPEN" : "MARKETS CLOSED"} · ${hh}:${mm}:${ss} IST`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-[11px] text-foreground/70">{now || "—"}</span>;
}

export function Panel({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return <section className={cn("panel-glass animate-rise rounded-lg border border-border p-4 sm:p-5", className)}>{title && <h2 className="mb-3 font-mono text-[9px] text-muted-foreground">{title}</h2>}{children}</section>;
}

const notices = [
  { t: "RELIANCE up 1.2% today", d: "On your watchlist" },
  { t: "Helix Biomed trial update", d: "Phase III data expected next week" },
  { t: "Weekly digest ready", d: "5 companies moved over 2%" },
];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  return (
    <div className="relative">
      <Button size="icon-sm" variant="ghost" aria-label="Notifications" aria-expanded={open} onClick={() => { setOpen(!open); setRead(true); }}>
        <Bell />{!read && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />}
      </Button>
      {open && <>
        <button className="fixed inset-0 z-40 cursor-default" aria-label="Close notifications" onClick={() => setOpen(false)} />
        <div className="panel-glass absolute right-0 z-50 mt-2 w-72 rounded-lg border border-border p-2 shadow-lg">
          <p className="px-2 py-1 font-mono text-[9px] text-muted-foreground">NOTIFICATIONS</p>
          {notices.map((n) => <div key={n.t} className="rounded-md px-2 py-2 hover:bg-accent"><p className="text-sm">{n.t}</p><p className="text-xs text-muted-foreground">{n.d}</p></div>)}
        </div>
      </>}
    </div>
  );
}
