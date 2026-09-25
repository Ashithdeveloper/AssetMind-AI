/**
 * AssetMind AI — Live Price Refresh Scheduler
 *
 * Runs every 60 seconds (configurable) to:
 *   1. Fetch live quotes for all tracked Indian equities via Yahoo Finance V8 API
 *   2. Persist updates to MongoDB StockPrice collection
 *   3. Broadcast via in-memory EventEmitter for WebSocket/SSE push (optional future use)
 *
 * Designed to be started once at server boot alongside the existing ScrapingScheduler.
 */

import { EventEmitter } from 'events';
import { fetchBatchLiveQuotes, persistLiveQuote } from './liveQuote.service';
import { Asset } from '../../models/Asset.model';
import { LiveQuote } from './realtime.types';

// ─── Event Emitter for real-time push (SSE / WebSocket ready) ─────────────────
export const priceEventBus = new EventEmitter();
priceEventBus.setMaxListeners(100);

// ─── Scheduler State ──────────────────────────────────────────────────────────
let refreshTimer: NodeJS.Timeout | null = null;
let isRefreshing = false;

// Default Indian equities always tracked
const DEFAULT_INDIA_SYMBOLS = [
  'TCS', 'INFY', 'WIPRO', 'HCLTECH',
  'ADANIENT', 'ADANIPORTS', 'ADANIGREEN', 'ADANIPOWER',
  'OLAELEC', 'RELIANCE', 'TATAMOTORS',
];

// In-memory latest quotes store
const latestQuotes = new Map<string, LiveQuote>();

/**
 * Get latest in-memory quote (fast, no DB lookup needed)
 */
export function getLatestQuote(symbol: string): LiveQuote | undefined {
  return latestQuotes.get(symbol.trim().toUpperCase());
}

/**
 * Get all latest in-memory quotes
 */
export function getAllLatestQuotes(): Map<string, LiveQuote> {
  return new Map(latestQuotes);
}

/**
 * Run a single price refresh cycle for all tracked symbols
 */
async function runRefreshCycle(): Promise<void> {
  if (isRefreshing) {
    console.log('[LiveRefresh] Already refreshing, skipping this tick.');
    return;
  }

  isRefreshing = true;
  const startMs = Date.now();

  try {
    // Combine default + DB-tracked symbols
    const dbSymbols = await Asset.distinct('symbol');
    const allSymbols = Array.from(
      new Set([...DEFAULT_INDIA_SYMBOLS, ...dbSymbols.map((s: string) => s.toUpperCase())])
    );

    console.log(`[LiveRefresh] 🔄 Refreshing live prices for ${allSymbols.length} symbols...`);

    const quotes = await fetchBatchLiveQuotes(allSymbols);

    let persisted = 0;
    for (const [sym, quote] of quotes.entries()) {
      latestQuotes.set(sym, quote);

      // Persist to MongoDB asynchronously (don't block the cycle)
      persistLiveQuote(quote).catch((e) =>
        console.error(`[LiveRefresh] Persist error ${sym}:`, e.message)
      );

      persisted++;
    }

    // Emit batch update event (for SSE/WebSocket consumers)
    priceEventBus.emit('quotes-updated', Array.from(quotes.values()));

    const elapsed = Date.now() - startMs;
    console.log(`[LiveRefresh] ✅ Refreshed ${persisted}/${allSymbols.length} quotes in ${elapsed}ms`);
  } catch (err: any) {
    console.error('[LiveRefresh] ❌ Refresh cycle error:', err.message);
  } finally {
    isRefreshing = false;
  }
}

/**
 * Start the live price refresh scheduler
 */
export function startLivePriceRefresh(intervalSeconds = 60): void {
  if (refreshTimer) {
    console.log('[LiveRefresh] Scheduler already running.');
    return;
  }

  console.log(`[LiveRefresh] 🚀 Starting live price refresh every ${intervalSeconds}s...`);

  // Immediate first run
  setTimeout(() => {
    runRefreshCycle().catch(console.error);
  }, 3000); // 3s delay after server starts

  // Recurring interval
  refreshTimer = setInterval(() => {
    runRefreshCycle().catch(console.error);
  }, intervalSeconds * 1000);
}

/**
 * Stop the live price refresh scheduler
 */
export function stopLivePriceRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    console.log('[LiveRefresh] Scheduler stopped.');
  }
}
