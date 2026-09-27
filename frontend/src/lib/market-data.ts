import { useEffect, useState, useMemo, useCallback } from "react";

export type Company = {
  ticker: string;
  name: string;
  exchange: string;
  country: string;
  countryCode: string;
  sector: string;
  price: number; // INR per share
  change: number;
  marketCap: string;
  capValue: number; // ₹ lakh crore * 10? Use ₹ thousand crore
  trend: number[];
  pe: number;
  revenue: string;
  margin: number;
  debtEquity: number;
  dividend: number;
  risk: "Low" | "Medium" | "High";
  summary: string;
};

const base = (c: Omit<Company, "pe" | "revenue" | "margin" | "debtEquity" | "dividend" | "risk" | "summary">, extra: Pick<Company, "pe" | "revenue" | "margin" | "debtEquity" | "dividend" | "risk" | "summary">): Company => ({ ...c, ...extra });

// capValue is in ₹ thousand crore (₹1 thousand crore = ₹10,000 crore = ₹100 billion)
export const companies: [Company, ...Company[]] = [
  // 1. IT / Technology Companies
  base({ ticker: "TCS", name: "Tata Consultancy Services Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Technology", price: 2084.0, change: 0.86, marketCap: "₹7.57L Cr", capValue: 757, trend: [2040, 2055, 2060, 2072, 2084] }, { pe: 14.1, revenue: "₹2.4L Cr", margin: 19.3, debtEquity: 0.09, dividend: 3.07, risk: "Low", summary: "India's premier IT services & consulting enterprise with robust client retention and fortress balance sheet." }),
  base({ ticker: "INFY", name: "Infosys Limited", exchange: "NSE", country: "India", countryCode: "IN", sector: "Technology", price: 1524.6, change: 1.76, marketCap: "₹6.32L Cr", capValue: 632, trend: [1460, 1485, 1492, 1510, 1524] }, { pe: 24.3, revenue: "₹1.6L Cr", margin: 21.0, debtEquity: 0.05, dividend: 2.4, risk: "Low", summary: "Global digital services and consulting leader with steady deal momentum and shareholder payouts." }),
  base({ ticker: "WIPRO", name: "Wipro Limited", exchange: "NSE", country: "India", countryCode: "IN", sector: "Technology", price: 542.8, change: 1.15, marketCap: "₹2.84L Cr", capValue: 284, trend: [520, 528, 535, 538, 542] }, { pe: 22.4, revenue: "₹89K Cr", margin: 14.8, debtEquity: 0.18, dividend: 0.8, risk: "Low", summary: "Global IT consultancy driving enterprise transformation, cloud modernization, and AI implementations." }),
  base({ ticker: "HCLTECH", name: "HCL Technologies Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Technology", price: 1782.4, change: 0.94, marketCap: "₹4.83L Cr", capValue: 483, trend: [1730, 1745, 1760, 1775, 1782] }, { pe: 26.1, revenue: "₹1.1L Cr", margin: 18.2, debtEquity: 0.12, dividend: 2.8, risk: "Low", summary: "Leading technology firm with strength in engineering R&D, digital foundation, and enterprise software." }),
  base({ ticker: "TECHM", name: "Tech Mahindra Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Technology", price: 1548.0, change: 0.32, marketCap: "₹1.50L Cr", capValue: 150, trend: [1510, 1520, 1530, 1540, 1548] }, { pe: 38.2, revenue: "₹52K Cr", margin: 10.5, debtEquity: 0.14, dividend: 1.6, risk: "Low", summary: "Telecom-focused IT services company specializing in 5G, cloud, and digital transformation." }),

  // 2. Adani Group Companies
  base({ ticker: "ADANIENT", name: "Adani Enterprises Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Energy & Infrastructure", price: 2915.0, change: 2.45, marketCap: "₹3.32L Cr", capValue: 332, trend: [2780, 2810, 2850, 2890, 2915] }, { pe: 88.5, revenue: "₹96K Cr", margin: 4.2, debtEquity: 1.15, dividend: 0.05, risk: "Medium", summary: "Flagship incubator of the Adani Group spanning airport operations, mining, data centers, and road logistics." }),
  base({ ticker: "ADANIPORTS", name: "Adani Ports & SEZ Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Energy & Infrastructure", price: 1385.2, change: 1.82, marketCap: "₹2.99L Cr", capValue: 299, trend: [1320, 1340, 1362, 1375, 1385] }, { pe: 32.4, revenue: "₹27K Cr", margin: 28.5, debtEquity: 0.94, dividend: 0.45, risk: "Medium", summary: "India's largest commercial port operator with end-to-end integrated logistics and nationwide marine presence." }),
  base({ ticker: "ADANIGREEN", name: "Adani Green Energy Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Energy & Infrastructure", price: 1740.0, change: 3.12, marketCap: "₹2.75L Cr", capValue: 275, trend: [1640, 1680, 1705, 1720, 1740] }, { pe: 142.0, revenue: "₹10K Cr", margin: 12.4, debtEquity: 3.8, dividend: 0.0, risk: "High", summary: "Renewable energy leader building massive utility-scale solar and wind capacities across western India." }),
  base({ ticker: "ADANIPOWER", name: "Adani Power Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Energy & Infrastructure", price: 628.5, change: -0.45, marketCap: "₹2.42L Cr", capValue: 242, trend: [610, 622, 635, 630, 628] }, { pe: 11.2, revenue: "₹51K Cr", margin: 22.8, debtEquity: 0.72, dividend: 0.0, risk: "Medium", summary: "Largest private thermal and solar power producer in India with operating plants across six states." }),

  // 3. OLA Electric
  base({ ticker: "OLAELEC", name: "Ola Electric Mobility Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Electric Vehicles", price: 38.5, change: 4.25, marketCap: "₹17K Cr", capValue: 17, trend: [35.2, 36.1, 37.0, 37.8, 38.5] }, { pe: -15.4, revenue: "₹5.3K Cr", margin: -18.2, debtEquity: 0.42, dividend: 0.0, risk: "High", summary: "Pioneer in Indian electric two-wheelers and gigafactory cell manufacturing, driving mass EV adoption." }),

  // 4. Conglomerate & Energy
  base({ ticker: "RELIANCE", name: "Reliance Industries Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Energy & Conglomerate", price: 2890.4, change: 1.24, marketCap: "₹19.5L Cr", capValue: 1950, trend: [2810, 2835, 2850, 2872, 2890] }, { pe: 28.4, revenue: "₹9.2L Cr", margin: 8.6, debtEquity: 0.44, dividend: 0.4, risk: "Medium", summary: "India's largest market-cap conglomerate spanning green energy, retail, telecom (Jio), and refining." }),

  // 5. Automotive
  base({ ticker: "TATAMOTORS", name: "Tata Motors Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Automotive", price: 964.8, change: 2.38, marketCap: "₹3.55L Cr", capValue: 355, trend: [910, 925, 940, 955, 964] }, { pe: 9.6, revenue: "₹4.4L Cr", margin: 6.9, debtEquity: 0.92, dividend: 0.3, risk: "Medium", summary: "Domestic market leader in electric passenger vehicles and commercial transport with JLR luxury brand." }),
  base({ ticker: "MARUTI", name: "Maruti Suzuki India Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Automotive", price: 12065.0, change: 0.63, marketCap: "₹3.80L Cr", capValue: 380, trend: [11800, 11900, 11950, 12000, 12065] }, { pe: 28.5, revenue: "₹1.4L Cr", margin: 12.4, debtEquity: 0.01, dividend: 0.9, risk: "Low", summary: "India's largest passenger car maker with dominant market share in entry and mid-segment vehicles." }),
  base({ ticker: "M&M", name: "Mahindra & Mahindra Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Automotive", price: 3035.0, change: 1.75, marketCap: "₹3.77L Cr", capValue: 377, trend: [2920, 2960, 2985, 3010, 3035] }, { pe: 32.4, revenue: "₹1.5L Cr", margin: 11.8, debtEquity: 0.35, dividend: 0.6, risk: "Medium", summary: "India's leading farm & utility vehicle manufacturer with a strong SUV and EV pipeline." }),

  // 6. Financial Services
  base({ ticker: "HDFCBANK", name: "HDFC Bank Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Financial Services", price: 1642.75, change: 0.54, marketCap: "₹12.5L Cr", capValue: 1250, trend: [1605, 1618, 1625, 1636, 1642] }, { pe: 18.6, revenue: "₹3.1L Cr", margin: 24.8, debtEquity: 1.5, dividend: 1.1, risk: "Low", summary: "India's premier private banking institution with nationwide retail and corporate banking network." }),
  base({ ticker: "ICICIBANK", name: "ICICI Bank Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Financial Services", price: 1326.8, change: -0.58, marketCap: "₹8.50L Cr", capValue: 850, trend: [1310, 1315, 1320, 1325, 1326] }, { pe: 18.2, revenue: "₹1.6L Cr", margin: 22.0, debtEquity: 1.3, dividend: 1.0, risk: "Low", summary: "India's second largest private bank with strong retail and corporate lending franchise." }),
  base({ ticker: "SBIN", name: "State Bank of India", exchange: "NSE", country: "India", countryCode: "IN", sector: "Financial Services", price: 983.0, change: 0.46, marketCap: "₹7.20L Cr", capValue: 720, trend: [960, 968, 975, 980, 983] }, { pe: 10.8, revenue: "₹4.2L Cr", margin: 18.5, debtEquity: 2.1, dividend: 1.5, risk: "Low", summary: "India's largest public sector bank with unmatched nationwide branch network and digital banking platform." }),
  base({ ticker: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Financial Services", price: 404.0, change: -0.25, marketCap: "₹4.02L Cr", capValue: 402, trend: [398, 400, 402, 403, 404] }, { pe: 21.5, revenue: "₹65K Cr", margin: 20.0, debtEquity: 1.2, dividend: 0.3, risk: "Low", summary: "Premium private sector bank known for conservative lending and wealth management services." }),
  base({ ticker: "BAJFINANCE", name: "Bajaj Finance Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Financial Services", price: 996.9, change: 1.52, marketCap: "₹6.15L Cr", capValue: 615, trend: [970, 978, 985, 992, 996] }, { pe: 35.0, revenue: "₹58K Cr", margin: 22.6, debtEquity: 3.5, dividend: 0.5, risk: "Medium", summary: "India's largest non-banking financial company with consumer lending, SME finance, and digital payments." }),

  // 7. Consumer Goods
  base({ ticker: "ITC", name: "ITC Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Consumer Goods", price: 269.0, change: 0.37, marketCap: "₹3.36L Cr", capValue: 336, trend: [264, 265, 267, 268, 269] }, { pe: 22.8, revenue: "₹70K Cr", margin: 26.5, debtEquity: 0.01, dividend: 3.8, risk: "Low", summary: "Diversified conglomerate spanning FMCG, hotels, paperboards, agri-business, and IT with zero debt." }),
  base({ ticker: "HINDUNILVR", name: "Hindustan Unilever Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Consumer Goods", price: 1942.9, change: 0.49, marketCap: "₹4.56L Cr", capValue: 456, trend: [1910, 1920, 1930, 1938, 1942] }, { pe: 52.4, revenue: "₹60K Cr", margin: 17.2, debtEquity: 0.02, dividend: 1.8, risk: "Low", summary: "India's largest FMCG company with brands spanning personal care, home care, and foods." }),
  base({ ticker: "TITAN", name: "Titan Company Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Consumer Goods", price: 4884.0, change: 1.07, marketCap: "₹2.90L Cr", capValue: 290, trend: [4780, 4810, 4840, 4860, 4884] }, { pe: 82.0, revenue: "₹51K Cr", margin: 8.5, debtEquity: 0.92, dividend: 0.3, risk: "Medium", summary: "India's leading jewelry, watches, and eyewear brand with Tanishq as flagship retail chain." }),
  base({ ticker: "NESTLEIND", name: "Nestle India Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Consumer Goods", price: 1362.6, change: 0.86, marketCap: "₹1.31L Cr", capValue: 131, trend: [1340, 1345, 1350, 1358, 1362] }, { pe: 64.0, revenue: "₹19K Cr", margin: 16.5, debtEquity: 0.02, dividend: 1.4, risk: "Low", summary: "India's leading packaged food company with iconic brands like Maggi, Nescafe, and KitKat." }),
  base({ ticker: "ZOMATO", name: "Zomato Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Technology & Consumer", price: 335.0, change: -0.15, marketCap: "₹2.30L Cr", capValue: 230, trend: [328, 330, 332, 334, 335] }, { pe: 210.0, revenue: "₹12.1K Cr", margin: 2.9, debtEquity: 0.02, dividend: 0.0, risk: "High", summary: "India's leading food delivery and quick commerce (Blinkit) platform with growing profitability." }),

  // 8. Healthcare
  base({ ticker: "SUNPHARMA", name: "Sun Pharmaceutical Industries Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Healthcare", price: 1852.2, change: 0.12, marketCap: "₹4.44L Cr", capValue: 444, trend: [1830, 1838, 1845, 1850, 1852] }, { pe: 36.5, revenue: "₹48K Cr", margin: 18.2, debtEquity: 0.15, dividend: 0.5, risk: "Low", summary: "India's largest pharma company by market cap with global specialty and generic drug portfolio." }),
  base({ ticker: "CIPLA", name: "Cipla Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Healthcare", price: 1399.7, change: 0.05, marketCap: "₹1.13L Cr", capValue: 113, trend: [1380, 1385, 1390, 1395, 1399] }, { pe: 28.0, revenue: "₹26K Cr", margin: 14.5, debtEquity: 0.08, dividend: 0.8, risk: "Low", summary: "Leading Indian pharma company known for respiratory, anti-retroviral, and generic medications." }),

  // 9. Telecom
  base({ ticker: "BHARTIARTL", name: "Bharti Airtel Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Telecommunications", price: 1785.4, change: -0.58, marketCap: "₹9.20L Cr", capValue: 920, trend: [1770, 1775, 1780, 1783, 1785] }, { pe: 65.0, revenue: "₹1.5L Cr", margin: 5.0, debtEquity: 2.3, dividend: 0.3, risk: "Medium", summary: "India's largest private telecom operator with 5G rollout, enterprise services, and Africa operations." }),

  // 10. Industrials & Infra
  base({ ticker: "LT", name: "Larsen & Toubro Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Industrials", price: 3876.2, change: 0.46, marketCap: "₹5.31L Cr", capValue: 531, trend: [3820, 3840, 3855, 3870, 3876] }, { pe: 34.0, revenue: "₹2.0L Cr", margin: 8.5, debtEquity: 1.2, dividend: 1.0, risk: "Medium", summary: "India's largest engineering & construction conglomerate spanning infrastructure, defence, and IT." }),

  // 11. Tata Group Consumer
  base({ ticker: "TATACONSUM", name: "Tata Consumer Products Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Consumer Goods", price: 983.2, change: -0.31, marketCap: "₹1.10L Cr", capValue: 110, trend: [978, 980, 981, 982, 983] }, { pe: 85.0, revenue: "₹15.2K Cr", margin: 8.5, debtEquity: 0.14, dividend: 0.8, risk: "Medium", summary: "India's largest branded tea & beverages company. Iconic brands: Tata Tea, Tetley, Tata Salt." }),
  base({ ticker: "TRENT", name: "Trent Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Consumer Goods", price: 2669.3, change: -1.14, marketCap: "₹2.40L Cr", capValue: 240, trend: [2700, 2690, 2680, 2675, 2669] }, { pe: 160.0, revenue: "₹12.5K Cr", margin: 11.8, debtEquity: 0.11, dividend: 0.2, risk: "Medium", summary: "Fast-growing fashion retailer operating Westside and Zudio, flagship of Tata Group's retail ambitions." }),
  base({ ticker: "TATASTEEL", name: "Tata Steel Ltd", exchange: "NSE", country: "India", countryCode: "IN", sector: "Basic Materials", price: 187.97, change: -0.03, marketCap: "₹1.90L Cr", capValue: 190, trend: [186, 187, 188, 188, 187] }, { pe: 45.0, revenue: "₹2.3L Cr", margin: 4.2, debtEquity: 0.94, dividend: 1.8, risk: "High", summary: "India's largest steelmaker with integrated operations spanning mining, manufacturing, and global distribution." }),
];

export type WatchlistStockMeta = {
  ticker: string;
  name?: string;
  exchange?: string;
  price?: number;
  change?: number;
  sector?: string;
  marketCap?: string;
  pe?: number;
};

const KEY = "assetmind-watchlist";
const META_KEY = "assetmind-watchlist-meta";

export const normalizeTicker = (ticker: string): string => {
  if (!ticker) return "";
  return ticker.trim().toUpperCase().replace(/\.(NS|BO)$/i, "");
};

export const getWatchlistMetaMap = (): Record<string, WatchlistStockMeta> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback to empty
  }
  return {};
};

export const saveWatchlistMeta = (meta: WatchlistStockMeta) => {
  if (typeof window === "undefined" || !meta.ticker) return;
  try {
    const key = normalizeTicker(meta.ticker);
    const existing = getWatchlistMetaMap();
    existing[key] = {
      ...existing[key],
      ...meta,
      ticker: key,
    };
    localStorage.setItem(META_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error("Failed to save watchlist metadata", e);
  }
};

export const getSavedWatchlist = (): string[] => {
  if (typeof window === "undefined") return ["RELIANCE", "TCS", "ZOMATO"];
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => normalizeTicker(String(s))).filter(Boolean);
      }
    }
  } catch (e) {
    console.error("Failed to load watchlist from localStorage", e);
  }
  return ["RELIANCE", "TCS", "ZOMATO"];
};

export const findCompany = (ticker: string): Company => {
  const norm = normalizeTicker(ticker);
  const found = companies.find((c) => normalizeTicker(c.ticker) === norm);
  if (found) return found;

  const metaMap = getWatchlistMetaMap();
  const cached = metaMap[norm];
  const p = cached?.price ?? 1000;

  return {
    ticker: norm,
    name: cached?.name || norm,
    exchange: cached?.exchange || "NSE",
    country: "India",
    countryCode: "IN",
    sector: cached?.sector || "Indian Equity",
    price: p,
    change: cached?.change ?? 0.0,
    marketCap: cached?.marketCap || "₹10,000 Cr",
    capValue: 100,
    trend: [p * 0.98, p * 0.99, p * 0.97, p * 1.01, p],
    pe: cached?.pe || 20,
    revenue: "₹5,000 Cr",
    margin: 15,
    debtEquity: 0.5,
    dividend: 1.0,
    risk: "Medium" as const,
    summary: `Indian corporate enterprise ${norm} with automated financial intelligence and live market analytics.`,
  };
};

export function useWatchlist() {
  const [list, setList] = useState<string[]>(getSavedWatchlist);

  // Derive O(1) lookup Set reactively from list state
  const set = useMemo(() => new Set(list.map(normalizeTicker)), [list]);

  useEffect(() => {
    // Re-sync from localStorage when mounted on client
    setList(getSavedWatchlist());

    const handleSync = () => {
      setList(getSavedWatchlist());
    };

    window.addEventListener("storage", handleSync);
    window.addEventListener("assetmind-watchlist-updated", handleSync);
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("assetmind-watchlist-updated", handleSync);
    };
  }, []);

  const has = useCallback(
    (ticker: string) => {
      if (!ticker) return false;
      return set.has(normalizeTicker(ticker));
    },
    [set]
  );

  const add = useCallback((ticker: string, meta?: Partial<WatchlistStockMeta>) => {
    const norm = normalizeTicker(ticker);
    if (!norm) return;

    const currentList = getSavedWatchlist();
    if (currentList.some((item) => normalizeTicker(item) === norm)) return;

    const next = [...currentList, norm];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      if (meta) {
        saveWatchlistMeta({ ticker: norm, ...meta });
      }
      window.dispatchEvent(new CustomEvent("assetmind-watchlist-updated", { detail: next }));
    } catch (err) {
      console.error("Failed to save watchlist to localStorage:", err);
    }
    setList(next);
  }, []);

  const remove = useCallback((ticker: string) => {
    const norm = normalizeTicker(ticker);
    if (!norm) return;

    const currentList = getSavedWatchlist();
    const next = currentList.filter((item) => normalizeTicker(item) !== norm);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("assetmind-watchlist-updated", { detail: next }));
    } catch (err) {
      console.error("Failed to remove from watchlist:", err);
    }
    setList(next);
  }, []);

  const toggle = useCallback((ticker: string, meta?: Partial<WatchlistStockMeta>) => {
    const norm = normalizeTicker(ticker);
    if (!norm) return;

    const currentList = getSavedWatchlist();
    const exists = currentList.some((item) => normalizeTicker(item) === norm);
    let next: string[];
    if (exists) {
      next = currentList.filter((item) => normalizeTicker(item) !== norm);
    } else {
      next = [...currentList, norm];
      if (meta) {
        saveWatchlistMeta({ ticker: norm, ...meta });
      }
    }

    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("assetmind-watchlist-updated", { detail: next }));
    } catch (err) {
      console.error("Failed to toggle watchlist in localStorage:", err);
    }
    setList(next);
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([]));
      window.dispatchEvent(new CustomEvent("assetmind-watchlist-updated", { detail: [] }));
    } catch (err) {
      console.error("Failed to clear watchlist:", err);
    }
    setList([]);
  }, []);

  return { list, toggle, has, add, remove, clear };
}


export const fmtChange = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

export type MutualFund = {
  code: string; name: string; category: "Equity" | "Debt" | "Hybrid" | "Index";
  amc: string; nav: number; change: number; aum: string; expense: number;
  returns1y: number; returns3y: number; returns5y: number; risk: "Low" | "Medium" | "High";
  minSip: number; rating: number; summary: string;
};

export const mutualFunds: MutualFund[] = [
  { code: "PARAG-FLEXI", name: "Parag Parikh Flexi Cap Fund", category: "Equity", amc: "PPFAS Mutual Fund", nav: 82.45, change: 0.62, aum: "₹81,200 Cr", expense: 0.63, returns1y: 18.4, returns3y: 16.2, returns5y: 21.8, risk: "Medium", minSip: 1000, rating: 5, summary: "Flexi-cap fund investing across Indian and select global equities with a value-oriented approach." },
  { code: "AXIS-BLUE", name: "Axis Bluechip Fund", category: "Equity", amc: "Axis MF", nav: 58.12, change: 0.31, aum: "₹33,400 Cr", expense: 0.66, returns1y: 12.1, returns3y: 10.8, returns5y: 14.2, risk: "Medium", minSip: 500, rating: 4, summary: "Large-cap fund focused on established blue-chip companies with steady earnings." },
  { code: "HDFC-NIFTY50", name: "HDFC Index Fund Nifty 50", category: "Index", amc: "HDFC MF", nav: 198.34, change: 0.48, aum: "₹7,900 Cr", expense: 0.2, returns1y: 14.6, returns3y: 12.4, returns5y: 15.1, risk: "Medium", minSip: 100, rating: 4, summary: "Low-cost index fund tracking the NIFTY 50, mirroring India's 50 largest companies." },
  { code: "MIRAE-LARGECAP", name: "Mirae Asset Large Cap Fund", category: "Equity", amc: "Mirae Asset MF", nav: 112.67, change: 0.55, aum: "₹39,800 Cr", expense: 0.54, returns1y: 15.2, returns3y: 13.1, returns5y: 16.4, risk: "Medium", minSip: 500, rating: 5, summary: "Consistent large-cap performer with a quality-growth stock selection style." },
  { code: "SBI-SMALLCAP", name: "SBI Small Cap Fund", category: "Equity", amc: "SBI MF", nav: 176.9, change: 1.12, aum: "₹34,600 Cr", expense: 0.64, returns1y: 26.8, returns3y: 24.3, returns5y: 29.5, risk: "High", minSip: 500, rating: 5, summary: "High-growth small-cap fund with strong long-term returns and higher volatility." },
  { code: "ICICI-CORPBOND", name: "ICICI Prudential Corporate Bond", category: "Debt", amc: "ICICI Prudential MF", nav: 28.44, change: 0.08, aum: "₹26,100 Cr", expense: 0.35, returns1y: 7.4, returns3y: 6.1, returns5y: 6.8, risk: "Low", minSip: 100, rating: 4, summary: "High-quality corporate bond fund for stable, predictable income." },
  { code: "HDFC-HYBRID", name: "HDFC Hybrid Equity Fund", category: "Hybrid", amc: "HDFC MF", nav: 94.21, change: 0.27, aum: "₹22,300 Cr", expense: 1.18, returns1y: 13.9, returns3y: 11.6, returns5y: 13.8, risk: "Medium", minSip: 100, rating: 4, summary: "Balanced mix of equity and debt for moderate growth with cushioning." },
  { code: "QUANT-SMALL", name: "Quant Small Cap Fund", category: "Equity", amc: "Quant MF", nav: 268.15, change: 1.84, aum: "₹26,700 Cr", expense: 0.64, returns1y: 31.2, returns3y: 28.6, returns5y: 34.1, risk: "High", minSip: 1000, rating: 5, summary: "Aggressive small-cap strategy using quant-driven momentum models." },
];

export type InsurancePlan = {
  id: string; name: string; insurer: string; type: "Term Life" | "Health" | "ULIP" | "Motor";
  premium: number; premiumUnit: "yr" | "mo"; cover: string; claimRatio: number;
  tenure: string; rating: number; summary: string;
};

export const insurancePlans: InsurancePlan[] = [
  { id: "HDFC-TERM", name: "HDFC Life Click 2 Protect", insurer: "HDFC Life", type: "Term Life", premium: 9800, premiumUnit: "yr", cover: "₹1 Cr", claimRatio: 99.2, tenure: "Up to age 85", rating: 5, summary: "Pure term plan with high cover at low cost; optional riders for critical illness." },
  { id: "LIC-JEEVAN", name: "LIC Jeevan Umang", insurer: "LIC of India", type: "Term Life", premium: 32400, premiumUnit: "yr", cover: "₹25 L + bonuses", claimRatio: 98.6, tenure: "Whole life", rating: 4, summary: "Whole-life plan combining protection with guaranteed survival benefits." },
  { id: "STAR-HEALTH", name: "Star Health Family Optima", insurer: "Star Health", type: "Health", premium: 14500, premiumUnit: "yr", cover: "₹10 L family floater", claimRatio: 96.4, tenure: "Annual renewal", rating: 4, summary: "Family floater health cover with wide hospital network and no-claim bonus." },
  { id: "NIVA-ASPIRE", name: "Niva Bupa Aspire", insurer: "Niva Bupa", type: "Health", premium: 11200, premiumUnit: "yr", cover: "₹15 L", claimRatio: 95.8, tenure: "Annual renewal", rating: 4, summary: "Modern health plan with OPD benefits and maternity cover options." },
  { id: "ICICI-ULIP", name: "ICICI Pru Signature (ULIP)", insurer: "ICICI Prudential Life", type: "ULIP", premium: 60000, premiumUnit: "yr", cover: "₹6 L + fund value", claimRatio: 98.9, tenure: "10–30 years", rating: 3, summary: "Market-linked plan combining life cover with equity/debt fund investment." },
  { id: "TATA-AIG-MOTOR", name: "Tata AIG Comprehensive Motor", insurer: "Tata AIG", type: "Motor", premium: 8600, premiumUnit: "yr", cover: "IDV up to ₹12 L", claimRatio: 94.2, tenure: "Annual", rating: 4, summary: "Comprehensive car insurance with zero-depreciation and roadside assistance add-ons." },
];

export type RealAsset = {
  id: string; name: string; kind: "Gold" | "Silver" | "Real Estate" | "REIT";
  unit: string; price: number; change: number; yieldPct: number | null;
  liquidity: "High" | "Medium" | "Low"; summary: string;
};

export const realAssets: RealAsset[] = [
  { id: "GOLD-24K", name: "Gold (24K, 10g)", kind: "Gold", unit: "per 10 g", price: 78450, change: 0.84, yieldPct: null, liquidity: "High", summary: "India's traditional store of value; hedge against inflation and currency risk." },
  { id: "GOLD-SGB", name: "Sovereign Gold Bond", kind: "Gold", unit: "per gram", price: 7845, change: 0.84, yieldPct: 2.5, liquidity: "Medium", summary: "Government-issued gold bond paying 2.5% annual interest plus gold price appreciation." },
  { id: "SILVER", name: "Silver (1 kg)", kind: "Silver", unit: "per kg", price: 94200, change: 1.36, yieldPct: null, liquidity: "High", summary: "Industrial and precious metal with higher volatility than gold." },
  { id: "MUMBAI-RE", name: "Residential — Mumbai (avg)", kind: "Real Estate", unit: "per sq ft", price: 19850, change: 0.12, yieldPct: 2.8, liquidity: "Low", summary: "Premium metro residential market with steady appreciation and rental demand." },
  { id: "BLR-RE", name: "Residential — Bengaluru (avg)", kind: "Real Estate", unit: "per sq ft", price: 9420, change: 0.31, yieldPct: 3.4, liquidity: "Low", summary: "IT-corridor driven demand; among the best rental yields in metro India." },
  { id: "EMBASSY-REIT", name: "Embassy Office Parks REIT", kind: "REIT", unit: "per unit", price: 388.6, change: 0.54, yieldPct: 6.1, liquidity: "High", summary: "Listed REIT owning Grade-A office parks; quarterly distributions." },
  { id: "MINDSPACE-REIT", name: "Mindspace Business Parks REIT", kind: "REIT", unit: "per unit", price: 362.4, change: -0.22, yieldPct: 5.8, liquidity: "High", summary: "Diversified office REIT across Mumbai, Pune, Hyderabad and Chennai." },
];
export const fmtINR = (n: number, decimals = 2) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
