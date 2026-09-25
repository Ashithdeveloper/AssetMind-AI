import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — AssetMind AI" }, { name: "description", content: "Sign in or create your AssetMind AI account." }, { property: "og:title", content: "Sign in — AssetMind AI" }, { property: "og:description", content: "Access your financial research workspace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const navigate = useNavigate();
  const field = "panel-soft mt-1 h-10 w-full rounded-md border border-border px-3 text-sm text-foreground outline-none focus:border-primary";
  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-border p-10 lg:flex panel-soft">
        <Link to="/" className="flex items-center gap-2.5"><div className="grid size-8 place-items-center rounded-md border border-primary/40 bg-primary/15 font-mono text-sm text-primary">A</div><span className="font-display">AssetMind</span></Link>
        <div><p className="font-mono text-[10px] text-primary">FINANCIAL INTELLIGENCE</p><h1 className="mt-2 font-display text-4xl leading-tight">Research companies with clarity, not noise.</h1><p className="mt-4 max-w-md text-sm text-muted-foreground">Explore global companies, compare ratios, and ask an AI assistant — all in one workspace.</p></div>
        <p className="text-xs text-muted-foreground">Informational only. Not investment advice.</p>
      </div>
      <div className="grid place-items-center p-6">
        <form className="w-full max-w-sm space-y-4" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/" }); }}>
          <div className="flex rounded-md border border-border p-1">{(["in", "up"] as const).map((m) => <button type="button" key={m} onClick={() => setMode(m)} className={cn("flex-1 rounded py-1.5 text-sm text-muted-foreground", mode === m && "bg-primary/15 text-foreground")}>{m === "in" ? "Sign in" : "Create account"}</button>)}</div>
          <h2 className="font-display text-2xl">{mode === "in" ? "Welcome back" : "Start researching"}</h2>
          {mode === "up" && <label className="block text-xs text-muted-foreground">Full name<input required className={field} /></label>}
          <label className="block text-xs text-muted-foreground">Email<input required type="email" className={field} /></label>
          <label className="block text-xs text-muted-foreground">Password<input required type="password" minLength={6} className={field} /></label>
          <Button type="submit" className="w-full" variant="signal">{mode === "in" ? "Sign in" : "Create account"}</Button>
          <p className="text-center text-xs text-muted-foreground">Demo only — no account is stored yet.</p>
        </form>
      </div>
    </div>
  );
}
