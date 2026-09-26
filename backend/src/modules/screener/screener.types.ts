export interface ScreenerApiItem {
  id: number;
  name: string;
  url: string;
}

export interface ScreenerSearchResultItem {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  url: string;
  isScraped: boolean;
  marketCap?: number | null | undefined;
  latestPrice?: number | null | undefined;
  changePercent?: number | null | undefined;
  sector?: string | null | undefined;
  pe?: number | null | undefined;
  bseCode?: string | null | undefined;
  nseSymbol?: string | null | undefined;
}

export interface ScreenerSearchResponse {
  query: string;
  total: number;
  source: string;
  results: ScreenerSearchResultItem[];
}
