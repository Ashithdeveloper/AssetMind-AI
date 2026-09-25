import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { AppShell, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { companies, fmtINR } from "@/lib/market-data";

export const Route = createFileRoute("/research")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "AI Financial Research Assistant — AssetMind AI" },
      { name: "description", content: "Ask questions grounded in Qdrant financial filings and analyzed by Ollama Cloud 20B." },
    ],
  }),
  component: ResearchPage,
});

type Msg = { role: "user" | "ai"; text: string; sources?: string[] };

function localAnswer(q: string): string {
  const c = companies.find(
    (x) => q.toLowerCase().includes(x.name.toLowerCase().split(" ")[0]!) || q.toUpperCase().includes(x.ticker)
  );
  if (c)
    return `${c.name} (${c.ticker}): ${c.summary} It trades at ${fmtINR(c.price)} with a P/E of ${c.pe}, net margin of ${c.margin}% and a ${c.risk.toLowerCase()} risk profile.`;
  if (/p\/?e|ratio/i.test(q))
    return "The price-to-earnings (P/E) ratio compares share price to earnings per share. A higher P/E often means investors expect faster growth; a lower one can signal value or lower expectations.";
  if (/dividend/i.test(q)) {
    const top = [...companies].sort((a, b) => b.dividend - a.dividend).slice(0, 3);
    return `Highest dividend yields in the workspace: ${top.map((t) => `${t.name} (${t.dividend}%)`).join(", ")}.`;
  }
  return "I can explain financial terms, search Qdrant vector evidence, or summarize any Indian company — try asking about TCS, Adani Enterprises, or Ola Electric.";
}

function ResearchPage() {
  const { q } = Route.useSearch();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "ai",
      text: "Hello — I'm your AssetMind AI financial analyst. Ask me about Indian equities (TCS, Infosys, Adani, Ola Electric), financial filings, ratios, or market risks.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const sent = useRef(false);

  const send = async (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);

    // Identify if question references an Indian company ticker
    const matchedTicker = ["TCS", "INFY", "WIPRO", "HCLTECH", "ADANIENT", "ADANIPORTS", "ADANIGREEN", "ADANIPOWER", "OLAELEC", "RELIANCE", "TATAMOTORS"].find(
      (sym) => text.toUpperCase().includes(sym) || text.toLowerCase().includes(sym.toLowerCase())
    );

    try {
      // Call backend RAG query endpoint
      const response = await apiClient.queryRag(text, matchedTicker || "");
      if (response && response.answer) {
        setMsgs((m) => [
          ...m,
          {
            role: "ai",
            text: response.answer,
            sources: response.sources?.map((s: any) => s.documentType || s.source),
          },
        ]);
      } else {
        setMsgs((m) => [...m, { role: "ai", text: localAnswer(text) }]);
      }
    } catch {
      // Fallback
      setMsgs((m) => [...m, { role: "ai", text: localAnswer(text) }]);
    } finally {
      setTyping(false);
    }
  };

  useEffect(() => {
    if (q && !sent.current) {
      sent.current = true;
      send(q);
    }
  }, [q]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  return (
    <AppShell
      eyebrow="RAG INTELLIGENCE"
      title="AI Financial Research"
      subtitle="Connected to Qdrant Vector Knowledge Base & Ollama Cloud gpt-oss 20B"
    >
      <Panel className="flex h-[70vh] flex-col p-0 sm:p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-3"}>
              {m.role === "ai" && <Bot className="mt-1 size-4 shrink-0 text-primary" />}
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-lg bg-primary/20 px-3.5 py-2.5 text-sm"
                    : "max-w-[85%] rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm leading-relaxed"
                }
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">
                      Vector Evidence:
                    </span>
                    {m.sources.map((src, sIdx) => (
                      <span
                        key={sIdx}
                        className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex items-center gap-2 pl-7 font-mono text-xs text-muted-foreground">
              <Sparkles className="size-3 animate-spin text-primary" />
              Retrieving evidence and reasoning with gpt-oss:20b-cloud…
            </div>
          )}
          <div ref={end} />
        </div>

        {/* Quick prompt chips */}
        <div className="flex flex-wrap gap-1.5 border-t border-border px-4 pt-3">
          {[
            "Analyze TCS margins and cash flow",
            "What are the risks of Adani Green?",
            "What is Ola Electric's growth strategy?",
            "Compare Tata Motors vs Reliance",
          ].map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border transition-colors hover:bg-secondary hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form className="flex gap-2 p-4" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Indian equities, financial metrics, risks, or valuations…"
            className="panel-soft h-10 flex-1 rounded-md border border-border px-3 text-sm outline-none focus:border-primary"
            aria-label="Research Query"
          />
          <Button type="submit" size="sm" variant="signal" disabled={typing}>
            <Send className="mr-1.5 size-4" /> Ask RAG
          </Button>
        </form>
      </Panel>
    </AppShell>
  );
}
