import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Banknote,
  DollarSign,
  Activity,
  Sparkles,
  Eye,
  FileText,
  Building2,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InstitutionalReportViewerProps {
  markdown: string;
  sections?: Record<string, string>;
  companyName: string;
  symbol: string;
  type?: "BUY" | "SELL";
  generatedAt?: string;
}

export type ContentBlock =
  | { type: "table"; headers: string[]; rows: string[][] }
  | {
      type: "callout";
      variant: "takeaway" | "warning" | "info" | "recommendation";
      label: string;
      text: string;
    }
  | { type: "bullet_list"; items: Array<{ label?: string; text: string }> }
  | { type: "subheading"; title: string }
  | { type: "divider" }
  | { type: "paragraph"; text: string };

interface ParsedSection {
  id: string;
  title: string;
  rawText: string;
  blocks: ContentBlock[];
}

// ─── Inline Text Formatter (Bolds, Italics, Evidence Citations) ───────────────

function RenderFormattedInline({ text }: { text: string }) {
  if (!text) return null;

  const tokens: React.ReactNode[] = [];
  const pattern = /(\[Evidence\s+\d+\]|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("[Evidence") && token.endsWith("]")) {
      const label = token.slice(1, -1);
      tokens.push(
        <span
          key={`ev-${match.index}`}
          className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400 font-semibold mx-1 align-baseline shadow-xs"
        >
          <FileText className="size-2.5 text-emerald-400/80" />
          {label}
        </span>,
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      tokens.push(
        <strong key={`b-${match.index}`} className="font-semibold text-slate-100">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      tokens.push(
        <em key={`i-${match.index}`} className="italic text-slate-300">
          {token.slice(1, -1)}
        </em>,
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return <>{tokens}</>;
}

// ─── Institutional Financial Table Component ──────────────────────────────────

function InstitutionalTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border/80 bg-slate-950/70 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border/80 bg-slate-900/90 text-[11px] font-mono uppercase tracking-wider text-slate-400">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    "px-3.5 py-2.5 font-semibold select-none",
                    i === 0 ? "text-left" : i === headers.length - 1 ? "text-right" : "text-left",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-xs">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="transition-colors hover:bg-slate-900/50">
                {row.map((cell, cIdx) => {
                  const isFirst = cIdx === 0;
                  const isLast = cIdx === headers.length - 1;
                  const isNumOrMoney =
                    /^[₹$€£]?[+-]?[\d,.]+%?x?/.test(cell) ||
                    cell.includes("bn") ||
                    cell.includes("trn") ||
                    cell.includes("Cr");

                  return (
                    <td
                      key={cIdx}
                      className={cn(
                        "px-3.5 py-2.5",
                        isFirst ? "font-medium text-slate-200" : "",
                        isLast ? "text-right" : "",
                        isNumOrMoney ? "font-mono text-slate-100 font-medium" : "text-slate-300",
                      )}
                    >
                      <RenderFormattedInline text={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Executive Callout Block ──────────────────────────────────────────────────

function ExecutiveCallout({
  variant,
  label,
  text,
}: {
  variant: "takeaway" | "warning" | "info" | "recommendation";
  label: string;
  text: string;
}) {
  const config = {
    takeaway: {
      border: "border-emerald-500/30 bg-emerald-500/5",
      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      icon: <Sparkles className="size-4 text-emerald-400 shrink-0" />,
    },
    warning: {
      border: "border-amber-500/30 bg-amber-500/5",
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      icon: <AlertTriangle className="size-4 text-amber-400 shrink-0" />,
    },
    recommendation: {
      border: "border-blue-500/30 bg-blue-500/5",
      badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      icon: <CheckCircle2 className="size-4 text-blue-400 shrink-0" />,
    },
    info: {
      border: "border-slate-700/60 bg-slate-900/60",
      badge: "bg-slate-800 text-slate-300 border-slate-700",
      icon: <Info className="size-4 text-slate-400 shrink-0" />,
    },
  }[variant];

  return (
    <div className={cn("my-3 rounded-lg border p-3.5 shadow-sm transition-all", config.border)}>
      <div className="flex items-center gap-2 mb-1.5">
        {config.icon}
        <span
          className={cn(
            "rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase",
            config.badge,
          )}
        >
          {label}
        </span>
      </div>
      <p className="text-xs sm:text-sm leading-relaxed text-slate-200">
        <RenderFormattedInline text={text} />
      </p>
    </div>
  );
}

// ─── Markdown Section Parser ──────────────────────────────────────────────────

function parseSectionBlocks(lines: string[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i] ?? "";
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

    // 2. Subheading: ### or ####
    if (line.startsWith("### ") || line.startsWith("#### ")) {
      const title = line.replace(/^#{3,4}\s+/, "").trim();
      blocks.push({ type: "subheading", title });
      i++;
      continue;
    }

    // 3. Table detection: starts and ends with |
    if (line.startsWith("|") && line.endsWith("|")) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        Boolean(lines[i]?.trim().startsWith("|")) &&
        Boolean(lines[i]?.trim().endsWith("|"))
      ) {
        tableLines.push((lines[i] ?? "").trim());
        i++;
      }

      if (tableLines.length >= 2) {
        // First line contains headers
        const headerRow = tableLines[0] ?? "";
        const headers = headerRow
          .split("|")
          .slice(1, -1)
          .map((h) => h.trim());

        const rows: string[][] = [];
        for (let r = 1; r < tableLines.length; r++) {
          const rowLine = tableLines[r] ?? "";
          // Check if it's the markdown separator row (|---|---|)
          if (rowLine.replace(/[|\s-:]/g, "").length === 0) {
            continue;
          }
          const cells = rowLine
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());
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

    // 4. Bullet lists: lines starting with - , * , • , or 1.
    if (
      line.startsWith("- ") ||
      line.startsWith("* ") ||
      line.startsWith("• ") ||
      /^\d+\.\s+/.test(line)
    ) {
      const listItems: Array<{ label?: string; text: string }> = [];
      while (
        i < lines.length &&
        ((lines[i] ?? "").trim().startsWith("- ") ||
          (lines[i] ?? "").trim().startsWith("* ") ||
          (lines[i] ?? "").trim().startsWith("• ") ||
          /^\d+\.\s+/.test((lines[i] ?? "").trim()))
      ) {
        const itemLine = (lines[i] ?? "").trim();
        const content = itemLine.replace(/^([-*•]|\d+\.)\s+/, "").trim();
        // Check for **Label:** or Label:
        const boldMatch = content.match(/^\*\*([^*]+)\*\*:\s*(.*)$/);
        if (boldMatch && boldMatch[1] && boldMatch[2] !== undefined) {
          listItems.push({ label: boldMatch[1].trim(), text: boldMatch[2].trim() });
        } else {
          const colonIdx = content.indexOf(":");
          if (colonIdx > 0 && colonIdx < 45 && !content.slice(0, colonIdx).includes("http")) {
            listItems.push({
              label: content.substring(0, colonIdx).replace(/\*\*/g, "").trim(),
              text: content.substring(colonIdx + 1).trim(),
            });
          } else {
            listItems.push({ text: content });
          }
        }
        i++;
      }
      blocks.push({ type: "bullet_list", items: listItems });
      continue;
    }

    // 5. Callouts (e.g. **Key Take-away:** or **Conclusion:**)
    const calloutMatch = line.match(
      /^\*\*(Key\s*Take-?away|Takeaway|Bottom\s*Line|Conclusion|Recommendation|Warning|Risk\s*Factor|Assessment|Verdict|Note)\*\*:\s*(.*)$/i,
    );
    if (calloutMatch && calloutMatch[1] && calloutMatch[2] !== undefined) {
      const rawLabel = calloutMatch[1].trim();
      const text = calloutMatch[2].trim();
      let variant: "takeaway" | "warning" | "info" | "recommendation" = "takeaway";
      const lower = rawLabel.toLowerCase();
      if (lower.includes("warning") || lower.includes("risk")) variant = "warning";
      else if (lower.includes("recommendation") || lower.includes("action"))
        variant = "recommendation";
      else if (lower.includes("note")) variant = "info";

      blocks.push({
        type: "callout",
        variant,
        label: rawLabel.replace(/-/g, " ").toUpperCase(),
        text,
      });
      i++;
      continue;
    }

    // 6. Regular narrative paragraph
    blocks.push({ type: "paragraph", text: line });
    i++;
  }

  return blocks;
}

// ─── Main Institutional Report Viewer ─────────────────────────────────────────

export function InstitutionalReportViewer({
  markdown,
  sections,
  companyName,
  symbol,
  type = "BUY",
  generatedAt,
}: InstitutionalReportViewerProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string>("all");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Parse markdown into clean, structured analytical sections
  const parsedSections = React.useMemo(() => {
    const result: ParsedSection[] = [];
    const lines = markdown.split("\n");

    let currentTitle = "Executive Overview";
    let currentLines: string[] = [];

    const flush = () => {
      if (currentLines.length === 0) return;
      const rawText = currentLines.join("\n").trim();
      const blocks = parseSectionBlocks(currentLines);

      if (blocks.length > 0) {
        const id = currentTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        result.push({
          id: id || `section-${result.length}`,
          title: currentTitle,
          rawText,
          blocks,
        });
      }

      currentLines = [];
    };

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip top-level document hero title (# Capital Preservation Exit Analysis: ...)
      if (
        trimmed.startsWith("# ") &&
        (trimmed.includes("Analysis") || trimmed.includes("Memo") || trimmed.includes("Report"))
      ) {
        continue;
      }

      if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
        flush();
        currentTitle = trimmed.replace(/^[#\s0-9.]+/g, "").trim();
      } else {
        currentLines.push(line);
      }
    }

    flush();
    return result;
  }, [markdown]);

  // Icon mapping for memo and exit analysis sections
  const getSectionIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("performance") || t.includes("summary"))
      return <Activity className="size-4 text-emerald-400" />;
    if (t.includes("deteriorat") || t.includes("decline") || t.includes("weakness"))
      return <AlertTriangle className="size-4 text-amber-400" />;
    if (t.includes("overview") || t.includes("company"))
      return <Building2 className="size-4 text-primary" />;
    if (t.includes("strength")) return <ShieldCheck className="size-4 text-emerald-400" />;
    if (t.includes("cash flow") || t.includes("fcf"))
      return <Banknote className="size-4 text-primary" />;
    if (t.includes("valuation") || t.includes("multiple"))
      return <DollarSign className="size-4 text-primary" />;
    if (t.includes("roe") || t.includes("margin") || t.includes("profitability"))
      return <Activity className="size-4 text-emerald-400" />;
    if (t.includes("debt") || t.includes("leverage"))
      return <Layers className="size-4 text-amber-400" />;
    if (t.includes("risk") || t.includes("exit"))
      return <ShieldAlert className="size-4 text-rose-400" />;
    if (t.includes("profit") || t.includes("loss") || t.includes("investor"))
      return <Banknote className="size-4 text-emerald-400" />;
    if (t.includes("growth") || t.includes("opportunit"))
      return <TrendingUp className="size-4 text-primary" />;
    if (t.includes("monitor") || t.includes("watch"))
      return <Eye className="size-4 text-blue-400" />;
    if (t.includes("source") || t.includes("evidence") || t.includes("reference"))
      return <FileText className="size-4 text-muted-foreground" />;
    return <Sparkles className="size-4 text-primary" />;
  };

  const toggleExpand = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const displayedSections =
    selectedSectionId === "all"
      ? parsedSections
      : parsedSections.filter((s) => s.id === selectedSectionId);

  return (
    <div className="space-y-4">
      {/* Memo Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {type === "BUY" ? (
              <Sparkles className="size-5" />
            ) : (
              <ShieldAlert className="size-5 text-amber-500" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              {type === "BUY"
                ? "Institutional Buy-Side Memo"
                : "Capital Preservation Exit Analysis"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {companyName} ({symbol}) · Evaluated on verified filings and Indian market data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="rounded bg-secondary/80 px-2 py-0.5">
            {parsedSections.length} Analytical Sections
          </span>
          {generatedAt && (
            <span>
              {new Date(generatedAt).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Quick Section Filter Bar */}
      {parsedSections.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
          <button
            onClick={() => setSelectedSectionId("all")}
            className={cn(
              "rounded-full px-3 py-1 font-mono text-xs font-medium transition-colors",
              selectedSectionId === "all"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            All Sections
          </button>
          {parsedSections.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setSelectedSectionId(s.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-medium transition-colors",
                selectedSectionId === s.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <span>{idx + 1}.</span>
              <span>{s.title.replace(/^[0-9.\s]+/, "")}</span>
            </button>
          ))}
        </div>
      )}

      {/* Rendered Section Cards */}
      <div className="space-y-4">
        {displayedSections.map((section, idx) => {
          const isCollapsed = expandedSections[section.id] === true;

          // Compute section summary tag
          const tableBlock = section.blocks.find((b) => b.type === "table") as
            { type: "table"; headers: string[]; rows: string[][] } | undefined;
          const bulletBlock = section.blocks.find((b) => b.type === "bullet_list") as
            { type: "bullet_list"; items: Array<{ label?: string; text: string }> } | undefined;

          const summaryTag = tableBlock
            ? `${tableBlock.rows.length} Metrics Audited`
            : bulletBlock
              ? `${bulletBlock.items.length} Key Data Points`
              : "Analytical Deep-Dive";

          return (
            <div
              key={section.id}
              id={`section-${section.id}`}
              className="rounded-lg border border-border bg-card transition-all hover:border-primary/30"
            >
              {/* Section Header */}
              <div
                onClick={() => toggleExpand(section.id)}
                className="flex cursor-pointer items-center justify-between border-b border-border/60 bg-secondary/20 px-4 py-3 select-none"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded bg-secondary text-foreground text-xs font-mono font-medium">
                    {idx + 1}
                  </span>
                  {getSectionIcon(section.title)}
                  <h4 className="font-semibold text-sm text-foreground">
                    {section.title.replace(/^[0-9.\s]+/, "")}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{summaryTag}</span>
                  {isCollapsed ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Section Body */}
              {!isCollapsed && (
                <div className="p-4 space-y-3">
                  {section.blocks.map((block, bIdx) => {
                    switch (block.type) {
                      case "table":
                        return (
                          <InstitutionalTable
                            key={bIdx}
                            headers={block.headers}
                            rows={block.rows}
                          />
                        );

                      case "callout":
                        return (
                          <ExecutiveCallout
                            key={bIdx}
                            variant={block.variant}
                            label={block.label}
                            text={block.text}
                          />
                        );

                      case "subheading":
                        return (
                          <h5
                            key={bIdx}
                            className="font-semibold text-xs text-foreground uppercase tracking-wider mt-4 mb-1"
                          >
                            {block.title}
                          </h5>
                        );

                      case "divider":
                        return <div key={bIdx} className="my-3 border-t border-border/50" />;

                      case "bullet_list":
                        return (
                          <div key={bIdx} className="my-2 space-y-2">
                            {block.items.map((b, itemIdx) => (
                              <div
                                key={itemIdx}
                                className="flex items-start gap-2.5 rounded-md border border-border/50 bg-secondary/15 p-2.5 text-xs transition-colors hover:bg-secondary/30"
                              >
                                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                                <div className="flex-1 leading-relaxed">
                                  {b.label ? (
                                    <>
                                      <span className="font-mono font-semibold uppercase tracking-wide text-foreground">
                                        {b.label}:
                                      </span>{" "}
                                      <span className="text-foreground/90 font-mono">
                                        <RenderFormattedInline text={b.text} />
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-foreground/90">
                                      <RenderFormattedInline text={b.text} />
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );

                      case "paragraph":
                      default:
                        return (
                          <p key={bIdx} className="text-sm leading-relaxed text-foreground/90">
                            <RenderFormattedInline text={block.text} />
                          </p>
                        );
                    }
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
