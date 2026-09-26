import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — AssetMind AI" },
      {
        name: "description",
        content: "Sign in or create your AssetMind AI account for Indian stock market analytics.",
      },
      { property: "og:title", content: "Sign in — AssetMind AI" },
      {
        property: "og:description",
        content: "Access institutional-grade Indian financial intelligence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (mode === "in") {
        const res = await apiClient.login({ email, password });
        if (res?.token) {
          localStorage.setItem("assetmind_token", res.token);
          if (res.user) {
            localStorage.setItem("assetmind_user", JSON.stringify(res.user));
          }
          setSuccessMsg("Signed in successfully. Redirecting to workspace...");
          setTimeout(() => {
            navigate({ to: "/" });
          }, 600);
        }
      } else {
        const res = await apiClient.register({ name, email, password });
        if (res?.token) {
          localStorage.setItem("assetmind_token", res.token);
          if (res.user) {
            localStorage.setItem("assetmind_user", JSON.stringify(res.user));
          }
          setSuccessMsg("Account created successfully. Redirecting to workspace...");
          setTimeout(() => {
            navigate({ to: "/" });
          }, 600);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Authentication failed. Please verify credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      // Try demo login first, if user doesn't exist register demo user
      try {
        const res = await apiClient.login({
          email: "analyst@assetmind.ai",
          password: "AssetMind2026!",
        });
        if (res?.token) {
          localStorage.setItem("assetmind_token", res.token);
          if (res.user) {
            localStorage.setItem("assetmind_user", JSON.stringify(res.user));
          }
          setSuccessMsg("Signed in as Demo Equity Analyst. Entering workspace...");
          setTimeout(() => {
            navigate({ to: "/" });
          }, 600);
          return;
        }
      } catch {
        // Register demo user if not already present
        const regRes = await apiClient.register({
          name: "Equity Analyst",
          email: "analyst@assetmind.ai",
          password: "AssetMind2026!",
        });
        if (regRes?.token) {
          localStorage.setItem("assetmind_token", regRes.token);
          if (regRes.user) {
            localStorage.setItem("assetmind_user", JSON.stringify(regRes.user));
          }
          setSuccessMsg("Demo Analyst account initialized. Entering workspace...");
          setTimeout(() => {
            navigate({ to: "/" });
          }, 600);
        }
      }
    } catch (demoErr: any) {
      // Fallback local session if backend mock is offline
      localStorage.setItem("assetmind_token", "demo-analyst-jwt-token");
      localStorage.setItem(
        "assetmind_user",
        JSON.stringify({
          name: "Demo Equity Analyst",
          email: "analyst@assetmind.ai",
          role: "analyst",
        }),
      );
      setSuccessMsg("Active demo session established. Entering workspace...");
      setTimeout(() => {
        navigate({ to: "/" });
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      {/* Left Brand Panel */}
      <div className="hidden flex-col justify-between border-r border-border p-10 lg:flex panel-soft relative overflow-hidden">
        <div className="pointer-events-none absolute -left-20 -top-20 size-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 size-80 rounded-full bg-emerald-500/10 blur-3xl" />

        <Link to="/" className="flex items-center gap-2.5 z-10">
          <div className="grid size-9 place-items-center rounded-md border border-primary/40 bg-primary/15 font-mono text-base font-semibold text-primary">
            A
          </div>
          <div>
            <span className="font-display text-lg font-bold">AssetMind</span>
            <span className="ml-1 text-[11px] font-mono text-primary uppercase">AI</span>
          </div>
        </Link>

        <div className="z-10 max-w-lg space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary font-mono">
            <Sparkles className="size-3.5" /> INDIAN EQUITY RESEARCH PLATFORM
          </div>
          <h1 className="font-display text-4xl leading-tight font-medium">
            Institutional financial intelligence for NSE & BSE equities.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Consolidated audited financial statements directly from Screener.in, live tick-level
            Yahoo Finance pricing in ₹ (INR), and automated AI valuation models in one unified
            terminal.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2 font-mono text-xs">
            <div className="rounded border border-border/80 bg-background/50 p-2.5">
              <span className="text-muted-foreground block text-[10px] uppercase">
                Primary Coverage
              </span>
              <span className="text-foreground font-semibold">NSE & BSE Equities</span>
            </div>
            <div className="rounded border border-border/80 bg-background/50 p-2.5">
              <span className="text-muted-foreground block text-[10px] uppercase">
                Reporting Unit
              </span>
              <span className="text-primary font-semibold">₹ Crores (Cr)</span>
            </div>
          </div>
        </div>

        <div className="z-10 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-4">
          <span>Informational only · Not investment advice</span>
          <span className="font-mono text-[10px]">v2.4.0-IN</span>
        </div>
      </div>

      {/* Right Auth Form */}
      <div className="grid place-items-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          {/* Top Switcher */}
          <div className="flex rounded-md border border-border p-1 bg-card/60">
            <button
              type="button"
              onClick={() => {
                setMode("in");
                setErrorMsg(null);
              }}
              className={cn(
                "flex-1 rounded py-1.5 text-xs font-medium transition-all",
                mode === "in"
                  ? "bg-primary/20 text-primary border border-primary/30 shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("up");
                setErrorMsg(null);
              }}
              className={cn(
                "flex-1 rounded py-1.5 text-xs font-medium transition-all",
                mode === "up"
                  ? "bg-primary/20 text-primary border border-primary/30 shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Create Account
            </button>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              {mode === "in" ? "Welcome back" : "Create your analyst profile"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "in"
                ? "Enter your credentials to access your equity research terminal."
                : "Register for free to unlock AI financial theses, watchlists, and portfolio analysis."}
            </p>
          </div>

          {/* Feedback Banners */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMsg}</div>
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "up" && (
              <div className="space-y-1">
                <label
                  className="block text-xs font-medium text-muted-foreground"
                  htmlFor="login-name"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <input
                    id="login-name"
                    name="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="h-10 w-full rounded-md border border-border bg-card/60 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label
                className="block text-xs font-medium text-muted-foreground"
                htmlFor="login-email"
              >
                Work or Personal Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@domain.com"
                  className="h-10 w-full rounded-md border border-border bg-card/60 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  className="block text-xs font-medium text-muted-foreground"
                  htmlFor="login-password"
                >
                  Password
                </label>
                {mode === "in" && (
                  <span className="text-[11px] text-primary/80 hover:text-primary cursor-pointer">
                    Forgot password?
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "in" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-md border border-border bg-card/60 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full gap-2">
              {isLoading
                ? "Authenticating..."
                : mode === "in"
                  ? "Sign In to Terminal"
                  : "Complete Registration"}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/80" />
            </div>
            <span className="relative bg-background px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
              Quick Analyst Access
            </span>
          </div>

          {/* 1-Click Demo Login */}
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={handleDemoLogin}
            className="w-full border-primary/30 hover:bg-primary/10 text-primary text-xs font-mono"
          >
            <ShieldCheck className="size-4 mr-1 text-primary" />
            Sign in as Demo Analyst
          </Button>

          <p className="text-center text-[11px] text-muted-foreground leading-snug">
            By signing in, you agree to AssetMind's Terms of Service and data governance protocols.
          </p>
        </div>
      </div>
    </div>
  );
}
