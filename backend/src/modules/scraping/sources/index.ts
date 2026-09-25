import { SourceAdapter, SourceInfo } from './source.adapter.interface';
import { YahooFinanceAdapter } from './yahooFinance.adapter';
import { StockAnalysisAdapter } from './stockAnalysis.adapter';
import { MarketScreenerAdapter } from './marketScreener.adapter';
import { MacrotrendsAdapter } from './macrotrends.adapter';
import { CompaniesMarketCapAdapter } from './companiesMarketCap.adapter';
import { TradingViewAdapter } from './tradingView.adapter';
import { InvestingAdapter } from './investing.adapter';
import { MorningstarAdapter } from './morningstar.adapter';
import { SecEdgarAdapter } from './secEdgar.adapter';
import { StockMarketCapAdapter } from './stockMarketCap.adapter';
import { ScreenerInAdapter } from './screenerIn.adapter';

export const sourceAdapters: Record<string, SourceAdapter> = {
  'yahoo-finance': new YahooFinanceAdapter(),
  'stockanalysis': new StockAnalysisAdapter(),
  'marketscreener': new MarketScreenerAdapter(),
  'macrotrends': new MacrotrendsAdapter(),
  'companiesmarketcap': new CompaniesMarketCapAdapter(),
  'tradingview': new TradingViewAdapter(),
  'investing': new InvestingAdapter(),
  'morningstar': new MorningstarAdapter(),
  'sec-edgar': new SecEdgarAdapter(),
  'stockmarketcap': new StockMarketCapAdapter(),
  'screener-in': new ScreenerInAdapter(),
};

export const getSourceAdapter = (id: string): SourceAdapter | undefined => {
  const normalizedId = id.trim().toLowerCase().replace(/[_\s]/g, '-');
  return sourceAdapters[normalizedId];
};

export const getAllSourceInfos = (): SourceInfo[] => {
  return Object.values(sourceAdapters).map((adapter) => adapter.getInfo());
};
