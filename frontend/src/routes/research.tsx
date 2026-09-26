import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  Send,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  TrendingUp,
  TrendingDown,
  Layers,
  Database,
  Radio,
  Clock,
  CheckCircle2,
  Newspaper,
  Compass,
  Copy,
  Search,
  AlertCircle,
  Info,
  SlidersHorizontal,
  X,
  Swords,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { AppShell, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  apiClient,
  ChatMessage,
  ChatSession,
  ChatStockSnapshot,
  ChatEvidenceItem,
  ChatNewsItem,
  AnalysisResponse,
} from "@/lib/api";
import { fmtINR } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/research")({
  validateSearch: z.object({
    q: z.string().optional(),
    session: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "AI Financial Research Assistant — AssetMind AI" },
      {
        name: "description",
        content:
          "Conversational AI equity analyst powered by Qdrant Vector RAG, Real-Time NSE/BSE stock quotes, and Ollama 20B inference.",
      },
    ],
  }),
  component: ResearchPage,
});

// ─── Utilities: Clean Markdown for Previews ───────────────────────────────────

function stripMarkdownForPreview(text: string): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\|/g, " ")
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[Source:[^\]]+\]/gi, "")
    .replace(/\[Live[^\]]+\]/gi, "")
    .replace(/---+/g, " ")
    .replace(/\\([a-zA-Z])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 65);
}

// ─── Markdown Parser & Rich Block Renderer ────────────────────────────────────

type ChatBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; text: string }
  | { type: "bullet_list"; items: string[] }
  | { type: "divider" }
  | { type: "paragraph"; text: string };

function parseChatMarkdown(content: string): ChatBlock[] {
  if (!content) return [];

  // Normalize line endings
  const rawLines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ChatBlock[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const rawLine = rawLines[i] ?? "";
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    // 1. Divider rule: --- or ***
    if (line === "---" || line === "***" || line === "___") {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    // 2. Markdown Table Detection: Starts and ends with | or contains multiple |
    if (line.startsWith("|") && (line.endsWith("|") || line.includes("|"))) {
      const tableLines: string[] = [];
      while (
        i < rawLines.length &&
        rawLines[i] &&
        rawLines[i].trim().startsWith("|")
      ) {
        tableLines.push(rawLines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        // Extract headers from first row
        const headerRow = tableLines[0] || "";
        const headers = headerRow
          .split("|")
          .map((h) => h.trim())
          .filter(Boolean);

        const rows: string[][] = [];
        for (let r = 1; r < tableLines.length; r++) {
          const rowLine = tableLines[r] || "";
          // Skip divider row like |---|---|
          if (rowLine.replace(/[|\s-:]/g, "").length === 0) {
            continue;
          }
          const cells = rowLine
            .split("|")
            .map((c) => c.trim())
            .filter((_, idx, arr) => !(idx === 0 && arr[0] === "") && !(idx === arr.length - 1 && arr[arr.length - 1] === ""));

          if (cells.length > 0) {
            rows.push(cells);
          }
        }

        if (headers.length > 0 && rows.length > 0) {
          blocks.push({ type: "table", headers, rows });
          continue;
        }
      }
    }

    // 3. Headings: ###, ####, ##, # or standalone **Title:**
    if (/^#{1,4}\s+/.test(line)) {
      const level = line.match(/^#{1,4}/)![0].length;
      const text = line.replace(/^#{1,4}\s+/, "").trim();
      blocks.push({ type: "heading", level, text });
      i++;
      continue;
    }

    // 4. Callout notes: (Note: ...) or > ...
    if (
      line.startsWith("> ") ||
      (line.startsWith("(") && line.toLowerCase().includes("note:") && line.endsWith(")"))
    ) {
      const calloutText = line.startsWith("> ") ? line.slice(2) : line.slice(1, -1);
      blocks.push({ type: "callout", text: calloutText });
      i++;
      continue;
    }

    // 5. Bullet Lists: Contiguous lines starting with -, *, •, or numbers
    if (/^([-*•]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      while (i < rawLines.length && /^([-*•]|\d+\.)\s+/.test(rawLines[i].trim())) {
        items.push(rawLines[i].trim().replace(/^([-*•]|\d+\.)\s+/, ""));
        i++;
      }
      blocks.push({ type: "bullet_list", items });
      continue;
    }

    // 6. Normal Paragraph (strip leading backslashes from markdown escaping)
    const cleanedLine = line.replace(/^\\([a-zA-Z])/, "$1");
    blocks.push({ type: "paragraph", text: cleanedLine });
    i++;
  }

  return blocks;
}

// ─── Inline Tokens Formatter (Bolds, Italics, Tags, Line Breaks) ──────────────

function formatInlineTokens(text: string): React.ReactNode {
  if (!text) return null;

  // Handle <br> or <br/> tags inside cell/text
  const brSegments = text.split(/<br\s*\/?>/gi);
  if (brSegments.length > 1) {
    return (
      <>
        {brSegments.map((segment, segIdx) => (
          <React.Fragment key={segIdx}>
            {segIdx > 0 && <br />}
            {formatSingleInlineSegment(segment)}
          </React.Fragment>
        ))}
      </>
    );
  }

  return formatSingleInlineSegment(text);
}

function formatSingleInlineSegment(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|\[Source:[^\]]+\]|\[Live[^\]]+\]|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={match.index} className="italic text-muted-foreground">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-secondary/80 px-1 py-0.5 font-mono text-xs text-primary"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[Source:") || token.startsWith("[Live")) {
      parts.push(
        <span
          key={match.index}
          className="inline-flex items-center rounded border border-primary/30 bg-primary/10 px-1.5 py-0.2 font-mono text-[10px] text-primary"
        >
          {token.slice(1, -1)}
        </span>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

// ─── Financial Table Component ────────────────────────────────────────────────

function FinancialTableBlock({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border/80 bg-slate-950/80 shadow-sm">
      <div
        className="w-full overflow-x-auto no-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border/80 bg-slate-900/90 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    "px-3.5 py-2.5 whitespace-nowrap select-none",
                    i === 0 ? "text-left" : "text-left"
                  )}
                >
                  {formatInlineTokens(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="transition-colors hover:bg-slate-900/60"
              >
                {row.map((cell, cIdx) => {
                  const isFirst = cIdx === 0;
                  return (
                    <td
                      key={cIdx}
                      className={cn(
                        "px-3.5 py-2.5 align-top leading-relaxed text-slate-200",
                        isFirst ? "font-semibold text-foreground" : ""
                      )}
                    >
                      {formatInlineTokens(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {headers.length > 3 && (
        <div className="flex items-center justify-between border-t border-border/30 bg-slate-900/40 px-3 py-1 font-mono text-[9px] text-muted-foreground">
          <span>↔ Scroll horizontally to view full financial comparison</span>
          <span>{rows.length} entries</span>
        </div>
      )}
    </div>
  );
}

// ─── RenderChatBlocks ─────────────────────────────────────────────────────────

function RenderChatBlocks({ content }: { content: string }) {
  const blocks = useMemo(() => parseChatMarkdown(content), [content]);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading":
            return (
              <h4
                key={idx}
                className={cn(
                  "font-display font-semibold tracking-wide text-foreground",
                  block.level <= 2
                    ? "mt-4 text-base text-primary"
                    : "mt-3 text-sm text-foreground/95"
                )}
              >
                {formatInlineTokens(block.text)}
              </h4>
            );

          case "table":
            return (
              <FinancialTableBlock
                key={idx}
                headers={block.headers}
                rows={block.rows}
              />
            );

          case "callout":
            return (
              <div
                key={idx}
                className="my-2.5 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200/90"
              >
                <Info className="mt-0.5 size-4 shrink-0 text-amber-400" />
                <div className="flex-1 italic">{formatInlineTokens(block.text)}</div>
              </div>
            );

          case "bullet_list":
            return (
              <div key={idx} className="my-1.5 space-y-1.5 pl-1">
                {block.items.map((item, bIdx) => (
                  <div key={bIdx} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="flex-1">{formatInlineTokens(item)}</span>
                  </div>
                ))}
              </div>
            );

          case "divider":
            return (
              <div
                key={idx}
                className="my-3 h-px w-full bg-gradient-to-r from-transparent via-border/80 to-transparent"
              />
            );

          case "paragraph":
          default:
            return <p key={idx}>{formatInlineTokens(block.text)}</p>;
        }
      })}
    </div>
  );
}

// ─── Live Stock Snapshot Card ────────────────────────────────────────────────

function StockSnapshotCard({
  stock,
  onOpenAnalysis,
}: {
  stock: ChatStockSnapshot;
  onOpenAnalysis?: (symbol: string, type: "BUY" | "SELL") => void;
}) {
  const isPositive = stock.change >= 0;

  // Calculate 52w bar position
  let pct52 = 50;
  if (stock.high52 && stock.low52 && stock.high52 > stock.low52) {
    pct52 = Math.min(
      100,
      Math.max(0, ((stock.price - stock.low52) / (stock.high52 - stock.low52)) * 100)
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/80 bg-secondary/40 p-3.5 shadow-sm backdrop-blur-sm transition-all hover:border-primary/40">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-foreground">
              {stock.symbol}
            </span>
            <span className="rounded bg-secondary px-1.5 py-0.2 font-mono text-[9px] text-muted-foreground uppercase">
              NSE
            </span>
            <span className="flex items-center gap-1 font-mono text-[9px] text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              LIVE
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {stock.companyName}
          </p>
        </div>

        <div className="text-right">
          <div className="font-mono text-sm font-bold text-foreground">
            {fmtINR(stock.price)}
          </div>
          <div
            className={cn(
              "flex items-center justify-end gap-1 font-mono text-xs font-semibold",
              isPositive ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {isPositive ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            <span>
              {isPositive ? "+" : ""}
              {stock.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded bg-background/50 p-1.5 text-center">
          <span className="text-[10px] text-muted-foreground">P/E Ratio</span>
          <p className="font-mono font-medium text-foreground">
            {stock.pe ? stock.pe.toFixed(1) : "—"}
          </p>
        </div>
        <div className="rounded bg-background/50 p-1.5 text-center">
          <span className="text-[10px] text-muted-foreground">Market Cap</span>
          <p className="font-mono font-medium text-foreground">
            {stock.marketCap ? `₹${(stock.marketCap / 100).toFixed(0)} Cr` : "—"}
          </p>
        </div>
        <div className="rounded bg-background/50 p-1.5 text-center">
          <span className="text-[10px] text-muted-foreground">52W Low</span>
          <p className="font-mono font-medium text-foreground">
            {stock.low52 ? fmtINR(stock.low52) : "—"}
          </p>
        </div>
        <div className="rounded bg-background/50 p-1.5 text-center">
          <span className="text-[10px] text-muted-foreground">52W High</span>
          <p className="font-mono font-medium text-foreground">
            {stock.high52 ? fmtINR(stock.high52) : "—"}
          </p>
        </div>
      </div>

      {stock.low52 && stock.high52 && (
        <div className="mt-2">
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>52W Low</span>
            <span>Range Position</span>
            <span>52W High</span>
          </div>
          <div className="relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${pct52}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons: AI Buy & Sell Analysis with War Impact */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenAnalysis?.(stock.symbol, "BUY")}
            className="flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-emerald-300 transition-all hover:bg-emerald-500/25 hover:border-emerald-500/60"
            title="Open AI Buy Analysis with War Impact"
          >
            <TrendingUp className="size-3 text-emerald-400" />
            <span>AI Buy Analysis & War Risk</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenAnalysis?.(stock.symbol, "SELL")}
            className="flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-rose-300 transition-all hover:bg-rose-500/25 hover:border-rose-500/60"
            title="Open AI Sell Analysis with War Impact"
          >
            <TrendingDown className="size-3 text-rose-400" />
            <span>AI Sell Analysis & War Risk</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-muted-foreground">
            {stock.source}
          </span>
          <Link
            to="/company/$ticker"
            params={{ ticker: stock.symbol.toLowerCase() }}
            className="flex items-center gap-1 font-mono text-[10px] text-primary transition-colors hover:underline"
          >
            Deep Dive
            <ExternalLink className="size-2.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Institutional Analysis & War Impact Modal ───────────────────────────────

function AnalysisDrawerModal({
  isOpen,
  onClose,
  symbol,
  type,
}: {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  type: "BUY" | "SELL";
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && symbol) {
      loadAnalysis();
    }
  }, [isOpen, symbol, type]);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      if (type === "BUY") {
        const res = await apiClient.generateBuyAnalysis(symbol);
        setData(res);
      } else {
        const res = await apiClient.generateSellAnalysis(symbol);
        setData(res);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load analysis");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const riskMetrics = data?.riskRewardMetrics;
  const warImpact = riskMetrics?.warConflictImpact;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 bg-secondary/30 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-lg border",
                type === "BUY"
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                  : "border-rose-500/40 bg-rose-500/15 text-rose-400"
              )}
            >
              {type === "BUY" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-foreground">{symbol}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono uppercase",
                    type === "BUY" ? "border-emerald-500/40 text-emerald-400" : "border-rose-500/40 text-rose-400"
                  )}
                >
                  AI {type} ANALYSIS
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Grounded in Qdrant Vector Filings & Geopolitical Conflict Impact
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div
          className="flex-1 space-y-4 overflow-y-auto p-5 no-scrollbar"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="size-7 animate-spin text-primary" />
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                Evaluating filings, profit/loss risk metrics, and active war conflicts for {symbol}...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">
              <AlertCircle className="mr-2 inline size-4" />
              {error}
            </div>
          ) : data ? (
            <>
              {/* ⚔️ Active War & Geopolitical Conflict Exposure Card */}
              {warImpact && (
                <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 pb-2">
                    <div className="flex items-center gap-2">
                      <Swords className="size-4 text-amber-400" />
                      <span className="font-mono text-xs font-bold uppercase tracking-wide text-amber-200">
                        War & Geopolitical Conflict Exposure
                      </span>
                    </div>
                    <Badge
                      className={cn(
                        "font-mono text-[10px] font-semibold",
                        warImpact.impactSeverity === "Net Beneficiary"
                          ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                          : warImpact.impactSeverity === "Neutral / Insulated"
                          ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-300"
                          : warImpact.impactSeverity === "Moderate Negative"
                          ? "border-amber-500/40 bg-amber-500/20 text-amber-300"
                          : "border-rose-500/40 bg-rose-500/20 text-rose-300"
                      )}
                    >
                      {warImpact.impactSeverity}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <span className="font-mono text-[9px] uppercase text-muted-foreground">Active Conflict</span>
                      <p className="font-semibold text-foreground">{warImpact.conflictType}</p>
                      <p className="text-[11px] text-muted-foreground">{warImpact.conflictStatus}</p>
                    </div>
                    <div>
                      <span className="font-mono text-[9px] uppercase text-muted-foreground">War Risk Score</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-amber-400">
                          {warImpact.warRiskScorePercent}%
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {warImpact.warRiskScorePercent <= 30
                            ? "Low Conflict Exposure"
                            : warImpact.warRiskScorePercent <= 60
                            ? "Moderate Sensitivity"
                            : "High Vulnerability"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-[9px] uppercase text-muted-foreground">Transmission Channels</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {warImpact.exposureChannels.map((channel: string, cIdx: number) => (
                        <span
                          key={cIdx}
                          className="rounded border border-border/80 bg-background/80 px-2 py-0.5 font-mono text-[10px] text-foreground/80"
                        >
                          {channel}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-[9px] uppercase text-muted-foreground">
                      Operational & Supply Chain Impact
                    </span>
                    <p className="mt-0.5 text-xs leading-relaxed text-foreground/90">{warImpact.directEffect}</p>
                  </div>

                  <div className="rounded border border-border/50 bg-background/60 p-2.5">
                    <span className="font-mono text-[9px] uppercase text-muted-foreground">
                      Strategic Guidance / Hedge
                    </span>
                    <p className="mt-0.5 text-xs italic leading-relaxed text-foreground/90">
                      {warImpact.strategicImplication}
                    </p>
                  </div>
                </div>
              )}

              {/* Quantitative Risk & Profit/Loss Card */}
              {riskMetrics && (
                <div className="space-y-3 rounded-lg border border-border/80 bg-secondary/30 p-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wide text-foreground">
                      Quantitative {type === "BUY" ? "Profit & Loss Risk Ratio" : "Exit & Protection Metrics"}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {riskMetrics.riskLevel}
                    </Badge>
                  </div>

                  {type === "BUY" ? (
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div className="rounded bg-background/60 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground">Target Profit</span>
                        <p className="font-mono text-sm font-bold text-emerald-400">
                          +{riskMetrics.profitPotentialPercent}%
                        </p>
                        <span className="text-[9px] text-muted-foreground">
                          ₹{riskMetrics.targetPrice?.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="rounded bg-background/60 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground">Downside Loss</span>
                        <p className="font-mono text-sm font-bold text-rose-400">
                          {riskMetrics.downsideLossPercent}%
                        </p>
                        <span className="text-[9px] text-muted-foreground">
                          Stop: ₹{riskMetrics.stopLossPrice?.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="rounded bg-background/60 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground">Risk/Reward</span>
                        <p className="font-mono text-sm font-bold text-foreground">
                          {riskMetrics.riskRewardRatio} : 1
                        </p>
                        <span className="text-[9px] text-muted-foreground">
                          {riskMetrics.riskRewardRatio >= 2 ? "Asymmetric" : "Balanced"}
                        </span>
                      </div>
                      <div className="rounded bg-background/60 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground">Risk Score</span>
                        <p className="font-mono text-sm font-bold text-foreground">
                          {riskMetrics.riskScorePercent}%
                        </p>
                        <span className="text-[9px] text-muted-foreground">
                          {riskMetrics.profitProbabilityPercent}% Upside
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div className="rounded bg-background/60 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground">Recommended Action</span>
                        <p className="font-mono text-sm font-bold text-foreground">
                          {riskMetrics.recommendationAction}
                        </p>
                      </div>
                      <div className="rounded bg-background/60 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground">Downside Risk</span>
                        <p className="font-mono text-sm font-bold text-rose-400">
                          {riskMetrics.downsideLossPercent}%
                        </p>
                        <span className="text-[9px] text-muted-foreground">
                          Trigger: ₹{riskMetrics.exitTriggerPrice?.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="rounded bg-background/60 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground">Recovery Target</span>
                        <p className="font-mono text-sm font-bold text-emerald-400">
                          +{riskMetrics.upsideRecoveryPercent}%
                        </p>
                        <span className="text-[9px] text-muted-foreground">
                          ₹{riskMetrics.targetRecoveryPrice?.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="rounded bg-background/60 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground">Deterioration Risk</span>
                        <p className="font-mono text-sm font-bold text-foreground">
                          {riskMetrics.riskScorePercent}%
                        </p>
                      </div>
                    </div>
                  )}

                  <p className="border-t border-border/30 pt-2 text-xs italic leading-relaxed text-muted-foreground">
                    {riskMetrics.rationale || riskMetrics.recommendationSummary}
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/80 bg-secondary/20 px-5 py-3">
          <Button size="sm" variant="ghost" onClick={onClose} className="font-mono text-xs">
            Close
          </Button>

          <Link
            to="/company/$ticker"
            params={{ ticker: symbol.toLowerCase() }}
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            <span>Open Complete Institutional Report</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Evidence Citations Drawer ────────────────────────────────────────────────

function EvidenceCitations({ evidence }: { evidence: ChatEvidenceItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!evidence || evidence.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-border/50 bg-background/60 p-2.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <Database className="size-3.5 text-primary" />
          <span>Verified Vector Filing Evidence ({evidence.length} sources)</span>
        </span>
        <span className="flex items-center gap-1 text-[11px]">
          {expanded ? "Collapse" : "Inspect Audited Chunks"}
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </span>
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-2 border-t border-border/40 pt-2">
          {evidence.map((chunk, cIdx) => (
            <div
              key={chunk.chunkId || cIdx}
              className="rounded border border-border/60 bg-secondary/30 p-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border/30 pb-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="border-primary/40 text-[9px] text-primary">
                    {chunk.symbol}
                  </Badge>
                  <span className="font-medium text-foreground">
                    {chunk.documentType.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ({chunk.reportingPeriod})
                  </span>
                </div>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {chunk.source}
                </span>
              </div>
              <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                "{chunk.text}"
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── News Sentiment Pills ─────────────────────────────────────────────────────

function NewsPills({ news }: { news: ChatNewsItem[] }) {
  if (!news || news.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/40 pt-2">
      <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
        <Newspaper className="size-3" /> News:
      </span>
      {news.map((item, nIdx) => {
        const sentimentColor =
          item.sentiment === "positive"
            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
            : item.sentiment === "negative"
            ? "border-rose-500/30 text-rose-400 bg-rose-500/10"
            : "border-border text-muted-foreground bg-secondary/40";

        return (
          <a
            key={nIdx}
            href={item.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex max-w-[280px] items-center gap-1 truncate rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:border-primary/50",
              sentimentColor
            )}
            title={item.title}
          >
            <span className="truncate">{item.title}</span>
            <ExternalLink className="size-2 shrink-0" />
          </a>
        );
      })}
    </div>
  );
}

// ─── Main Research Page Component ────────────────────────────────────────────

function ResearchPage() {
  const { q, session: searchSessionId } = Route.useSearch();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(
    searchSessionId
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<{
    symbol: string;
    type: "BUY" | "SELL";
  } | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const initialQuerySentRef = useRef(false);

  // Load chat sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // When session changes or on mount, load its messages
  useEffect(() => {
    if (currentSessionId) {
      loadMessagesForSession(currentSessionId);
    }
  }, [currentSessionId]);

  // Handle URL query parameter `?q=...`
  useEffect(() => {
    if (q && !initialQuerySentRef.current) {
      initialQuerySentRef.current = true;
      handleSendMessage(q);
    }
  }, [q]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const loadSessions = async () => {
    try {
      const list = await apiClient.getChatSessions();
      setSessions(list);
      if (!currentSessionId && list.length > 0) {
        // Automatically select the most recent session if available
        setCurrentSessionId(list[0]._id);
      }
    } catch (err) {
      console.warn("Could not fetch sessions from backend:", err);
    }
  };

  const loadMessagesForSession = async (sessionId: string) => {
    setLoadingHistory(true);
    try {
      const msgs = await apiClient.getChatSessionMessages(sessionId);
      setMessages(msgs);
    } catch (err) {
      console.warn("Could not load messages for session:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStartNewSession = () => {
    setCurrentSessionId(undefined);
    setMessages([]);
    setInput("");
    setShowSessionsDrawer(false);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      if (currentSessionId === sessionId) {
        handleStartNewSession();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleCopyMessage = (text: string, msgId: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      _id: `temp-${Date.now()}`,
      sessionId: currentSessionId || "new",
      role: "user",
      content: trimmed,
      referencedSymbols: [],
      stockSnapshots: [],
      evidence: [],
      newsHighlights: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const result = await apiClient.sendChatMessage(trimmed, currentSessionId);
      if (result && result.assistantMessage) {
        // Update current session ID if this was a new thread
        if (!currentSessionId && result.session?._id) {
          setCurrentSessionId(result.session._id);
          setSessions((prev) => [result.session, ...prev]);
        } else if (result.session) {
          // Update last message in existing session list
          setSessions((prev) =>
            prev.map((s) => (s._id === result.session._id ? result.session : s))
          );
        }

        // Replace optimistic turn with server docs
        setMessages((prev) => {
          const filtered = prev.filter((m) => m._id !== tempUserMsg._id);
          return [...filtered, result.userMessage, result.assistantMessage];
        });
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      // Fallback assistant message if network / service fails
      const fallbackMsg: ChatMessage = {
        _id: `fallback-${Date.now()}`,
        sessionId: currentSessionId || "new",
        role: "assistant",
        content: `I couldn't reach the backend AI engine at the moment. Please verify the backend service is running or try querying another Indian equity symbol like **TCS**, **INFY**, or **RELIANCE**.`,
        referencedSymbols: [],
        stockSnapshots: [],
        evidence: [],
        newsHighlights: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return sessions;
    const qLower = sessionSearch.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(qLower) ||
        (s.lastMessage && s.lastMessage.toLowerCase().includes(qLower))
    );
  }, [sessions, sessionSearch]);

  const QUICK_PROMPTS = [
    "Analyze TCS live valuation, margins & cash flow",
    "What are the risks and debt structure of Adani Green?",
    "Compare Tata Motors vs Reliance on P/E and growth",
    "Examine Infosys free cash flow and ROE metrics",
    "Top short-term high growth picks in infrastructure",
  ];

  return (
    <AppShell
      eyebrow="RAG INTELLIGENCE + LIVE QUOTES"
      title="AI Financial Research"
      subtitle="Connected to Qdrant Vector Filing Knowledge Base, Live NSE/BSE Quotes, and Ollama 20B"
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSessionsDrawer(!showSessionsDrawer)}
            className="flex items-center gap-1.5 font-mono text-xs"
          >
            <Clock className="size-3.5" />
            <span>Research History ({sessions.length})</span>
          </Button>
          <Button
            size="sm"
            variant="signal"
            onClick={handleStartNewSession}
            className="flex items-center gap-1.5 font-mono text-xs"
          >
            <Plus className="size-3.5" />
            <span>New Research</span>
          </Button>
        </div>
      }
    >
      <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-12 overflow-x-hidden">
        {/* Left Drawer / Sidebar on Large Screens */}
        <div
          className={cn(
            "min-w-0 lg:col-span-3 lg:block",
            showSessionsDrawer ? "block" : "hidden lg:block"
          )}
        >
          <Panel className="flex h-[75vh] flex-col p-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
                <Layers className="size-3.5 text-primary" />
                <span>SAVED THREADS</span>
                <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] text-muted-foreground">
                  {sessions.length}
                </span>
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={handleStartNewSession}
                title="Create New Thread"
              >
                <Plus className="size-3.5 text-primary" />
              </Button>
            </div>

            {/* Thread Search Box */}
            <div className="relative mt-2">
              <Search className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
              <input
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="Filter saved threads..."
                className="h-8 w-full rounded border border-border/70 bg-background/60 pl-7 pr-2 font-mono text-xs outline-none focus:border-primary"
              />
              {sessionSearch && (
                <button
                  onClick={() => setSessionSearch("")}
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Thread List */}
            <div
              className="mt-2.5 flex-1 space-y-1.5 overflow-y-auto pr-1 no-scrollbar"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {filteredSessions.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {sessionSearch ? "No threads match search" : "No previous threads yet."}
                </div>
              ) : (
                filteredSessions.map((sess) => {
                  const isActive = sess._id === currentSessionId;
                  const cleanPreview = stripMarkdownForPreview(sess.lastMessage || "");

                  return (
                    <div
                      key={sess._id}
                      onClick={() => {
                        setCurrentSessionId(sess._id);
                        setShowSessionsDrawer(false);
                      }}
                      className={cn(
                        "group relative flex cursor-pointer items-start justify-between rounded-md border p-2.5 text-left transition-all",
                        isActive
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-transparent bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-1 top-3 size-1.5 rounded-full bg-emerald-400" />
                      )}
                      <div className="min-w-0 flex-1 pl-1.5 pr-2">
                        <p className="truncate text-xs font-medium text-foreground">
                          {sess.title}
                        </p>
                        {cleanPreview && (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {cleanPreview}
                          </p>
                        )}
                        <span className="font-mono text-[9px] text-muted-foreground/80">
                          {new Date(sess.lastMessageAt || sess.updatedAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSession(sess._id, e)}
                        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-500/20 hover:text-rose-400 group-hover:opacity-100"
                        title="Delete Session"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* System Status Indicators */}
            <div className="mt-auto border-t border-border/50 pt-3">
              <div className="space-y-1.5 font-mono text-[10px] text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Radio className="size-2.5 text-emerald-400" /> Live Quotes:
                  </span>
                  <span className="text-emerald-400">NSE / Yahoo V8</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Database className="size-2.5 text-primary" /> Vector Store:
                  </span>
                  <span className="text-primary">Qdrant Cloud</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Bot className="size-2.5 text-indigo-400" /> LLM Engine:
                  </span>
                  <span className="text-indigo-400">gpt-oss:20b</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* Main Chat Panel */}
        <div className="min-w-0 lg:col-span-9">
          <Panel className="flex h-[75vh] flex-col overflow-hidden p-0 sm:p-0">
            {/* Real-Time Market Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-secondary/20 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  Grounded Financial Copilot
                </span>
                <Badge
                  variant="outline"
                  className="hidden border-primary/30 font-mono text-[9px] text-primary sm:inline-flex"
                >
                  Strict Filing Citations & No-Hallucination Guardrails
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  Active Thread:
                </span>
                <span className="max-w-[200px] truncate font-mono text-[10px] font-semibold text-foreground">
                  {sessions.find((s) => s._id === currentSessionId)?.title ||
                    "New Research Session"}
                </span>
              </div>
            </div>

            {/* Conversation Messages Container */}
            <div
              className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4 sm:p-5 no-scrollbar"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {messages.length === 0 && !loadingHistory ? (
                <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                  <div className="flex size-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_20px_rgba(var(--primary),0.2)]">
                    <Bot className="size-6" />
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold text-foreground">
                    Ask AssetMind Financial Copilot
                  </h3>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Analyze Indian equities, check real-time NSE share prices, inspect
                    verified audited filings from Qdrant, and evaluate risk vs profit metrics.
                  </p>

                  <div className="mt-6 w-full max-w-lg">
                    <p className="text-left font-mono text-[10px] text-muted-foreground uppercase">
                      Recommended Research Prompts:
                    </p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {QUICK_PROMPTS.map((promptText) => (
                        <button
                          key={promptText}
                          onClick={() => handleSendMessage(promptText)}
                          className="flex items-center justify-between rounded-md border border-border/80 bg-secondary/40 px-3 py-2 text-left text-xs text-foreground/90 transition-all hover:border-primary/50 hover:bg-secondary/80"
                        >
                          <span>{promptText}</span>
                          <Compass className="size-3 text-primary opacity-60" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={msg._id || idx}
                    className={
                      msg.role === "user" ? "flex justify-end" : "flex items-start gap-3"
                    }
                  >
                    {msg.role === "assistant" && (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary">
                        <Bot className="size-4" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "rounded-xl px-4 py-3 text-sm leading-relaxed transition-all",
                        msg.role === "user"
                          ? "max-w-[85%] rounded-br-none border border-primary/30 bg-primary/15 text-foreground sm:max-w-[75%]"
                          : "w-full max-w-[95%] rounded-tl-none border border-border/80 bg-secondary/35 shadow-sm sm:max-w-[90%]"
                      )}
                    >
                      {/* Embedded Stock Snapshot Cards if Assistant referenced stocks */}
                      {msg.role === "assistant" &&
                        msg.stockSnapshots &&
                        msg.stockSnapshots.length > 0 && (
                          <div className="mb-3 space-y-2.5">
                            {msg.stockSnapshots.map((stock) => (
                              <StockSnapshotCard
                                key={stock.symbol}
                                stock={stock}
                                onOpenAnalysis={(sym, type) =>
                                  setActiveAnalysis({ symbol: sym, type })
                                }
                              />
                            ))}
                          </div>
                        )}

                      {/* Assistant or User Content with Full Table & Token Rendering */}
                      {msg.role === "assistant" ? (
                        <RenderChatBlocks content={msg.content} />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}

                      {/* Vector Filing Evidence Citations */}
                      {msg.role === "assistant" &&
                        msg.evidence &&
                        msg.evidence.length > 0 && (
                          <EvidenceCitations evidence={msg.evidence} />
                        )}

                      {/* News Sentiment Highlights */}
                      {msg.role === "assistant" &&
                        msg.newsHighlights &&
                        msg.newsHighlights.length > 0 && (
                          <NewsPills news={msg.newsHighlights} />
                        )}

                      {/* Message Footer: Timestamp, Model Badge & Copy Button */}
                      <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-1.5 text-[9px] text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {msg.role === "assistant" && (
                            <span className="font-mono text-primary/70">
                              {msg.modelUsed || "gpt-oss:20b"} • {((msg.confidenceScore || 0.9) * 100).toFixed(0)}% confidence
                            </span>
                          )}
                        </div>

                        {msg.role === "assistant" && (
                          <button
                            onClick={() => handleCopyMessage(msg.content, msg._id)}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            title="Copy response to clipboard"
                          >
                            {copiedId === msg._id ? (
                              <>
                                <CheckCircle2 className="size-2.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-2.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex items-start gap-3 pl-1">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary">
                    <Sparkles className="size-4 animate-spin text-primary" />
                  </div>
                  <div className="rounded-xl border border-border/80 bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="size-2 animate-ping rounded-full bg-primary" />
                      <span className="font-mono">
                        Retrieving real-time quotes, querying Qdrant vector evidence & reasoning with Ollama 20B...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Quick Prompt Chips (when conversation active) */}
            {messages.length > 0 && (
              <div
                className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap border-t border-border/60 bg-secondary/10 px-4 py-2 no-scrollbar"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                <span className="font-mono text-[10px] text-muted-foreground">Prompt Suggestions:</span>
                {QUICK_PROMPTS.map((promptText) => (
                  <button
                    key={promptText}
                    onClick={() => handleSendMessage(promptText)}
                    className="shrink-0 rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {promptText}
                  </button>
                ))}
              </div>
            )}

            {/* Input Form */}
            <form
              className="flex items-center gap-2 border-t border-border/80 bg-background/70 p-3 sm:p-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Indian equities (TCS, INFY, RELIANCE), P/E multiples, filings, or risks..."
                className="panel-soft h-10 flex-1 rounded-md border border-border px-3 text-sm outline-none transition-colors focus:border-primary"
                aria-label="Research Query"
                disabled={isTyping}
              />
              <Button
                type="submit"
                size="sm"
                variant="signal"
                disabled={isTyping || !input.trim()}
                className="gap-1.5 font-mono text-xs"
              >
                <Send className="size-3.5" />
                <span>Send</span>
              </Button>
            </form>
          </Panel>
        </div>
      </div>

      {/* Institutional AI Buy/Sell Analysis & War Impact Modal */}
      <AnalysisDrawerModal
        isOpen={Boolean(activeAnalysis)}
        onClose={() => setActiveAnalysis(null)}
        symbol={activeAnalysis?.symbol || ""}
        type={activeAnalysis?.type || "BUY"}
      />
    </AppShell>
  );
}
