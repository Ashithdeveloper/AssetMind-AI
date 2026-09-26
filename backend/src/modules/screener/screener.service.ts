import axios from 'axios';
import { Asset } from '../../models/Asset.model';
import { FinancialMetrics } from '../../models/FinancialMetrics.model';
import { StockPrice } from '../../models/StockPrice.model';
import { ScreenerExtractionService } from '../scraping/services/screenerExtraction.service';
import { fetchLiveQuote } from '../realtime/liveQuote.service';
import { ScreenerApiItem, ScreenerSearchResponse, ScreenerSearchResultItem } from './screener.types';
import { AppError } from '../../utils/apiResponse';

export class ScreenerService {
  private static readonly SCREENER_SEARCH_URL = 'https://www.screener.in/api/company/search/';

  /**
   * Search Screener.in live by company name or stock symbol,
   * cross-referencing with local MongoDB to indicate whether it has been scraped.
   */
  public static async searchScreener(query: string): Promise<ScreenerSearchResponse> {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return {
        query: '',
        total: 0,
        source: 'Screener.in Live API',
        results: [],
      };
    }

    let items: ScreenerApiItem[] = [];

    try {
      const response = await axios.get<ScreenerApiItem[]>(this.SCREENER_SEARCH_URL, {
        params: { q: cleanQuery },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      if (Array.isArray(response.data)) {
        items = response.data;
      }
    } catch (err: any) {
      console.warn(`[ScreenerService] Screener.in live search failed for "${cleanQuery}":`, err.message);
    }

    // Process and enrich each search item
    const results: ScreenerSearchResultItem[] = await Promise.all(
      items.map(async (item) => {
        // Extract symbol/slug from url: /company/SUZLON/consolidated/ or /company/SUZLON/
        const match = item.url.match(/\/company\/([^/]+)/i);
        const slug = match ? match[1].toUpperCase() : item.name.toUpperCase();
        const cleanSymbol = slug.replace(/\.NS$|\.BO$/i, '');

        // Check if exists in MongoDB
        const asset = await Asset.findOne({
          $or: [
            { symbol: cleanSymbol },
            { nseSymbol: cleanSymbol },
            { bseCode: cleanSymbol },
          ],
        }).lean();

        if (asset) {
          // In database: enrich with metrics and price
          const latestPriceDoc = await StockPrice.findOne({ assetId: asset._id })
            .sort({ priceTimestamp: -1 })
            .lean();

          const fm = await FinancialMetrics.findOne({ symbol: cleanSymbol }).lean();

          return {
            id: item.id,
            name: asset.companyName || item.name,
            symbol: asset.symbol,
            slug,
            url: item.url,
            isScraped: true,
            marketCap: asset.marketCapitalization || null,
            latestPrice: latestPriceDoc?.price ?? asset.currentPrice ?? null,
            changePercent: latestPriceDoc?.changePercent ?? null,
            sector: asset.sector || null,
            pe: fm?.valuation?.peRatio?.value ?? null,
            bseCode: asset.bseCode || null,
            nseSymbol: asset.nseSymbol || asset.symbol,
          };
        }

        // Not yet scraped into database
        return {
          id: item.id,
          name: item.name,
          symbol: cleanSymbol,
          slug,
          url: item.url,
          isScraped: false,
          marketCap: null,
          latestPrice: null,
          changePercent: null,
          sector: null,
          pe: null,
          bseCode: null,
          nseSymbol: cleanSymbol,
        };
      })
    );

    return {
      query: cleanQuery,
      total: results.length,
      source: 'Screener.in Live API',
      results,
    };
  }

  /**
   * Scrape a company on-demand from Screener.in using its slug or symbol,
   * persist statements & metrics to DB, and return formatted analysis overview.
   */
  public static async scrapeAndGetCompany(slugOrSymbol: string, force = false) {
    const cleanSym = slugOrSymbol.trim().toUpperCase().replace(/\.NS$|\.BO$/i, '');
    if (!cleanSym) {
      throw new AppError('Company symbol or slug is required', 400, 'INVALID_INPUT');
    }

    // Perform live scrape
    const scrapedData = await ScreenerExtractionService.scrapeCompany(cleanSym, { force });

    // Retrieve saved Asset document
    const asset = await Asset.findOne({ symbol: cleanSym }).lean();
    if (!asset) {
      throw new AppError(`Failed to save or find scraped asset for ${cleanSym}`, 500, 'SCRAPE_SAVE_FAILED');
    }

    // Try fetching live quote for fresh market info
    let liveQuote: any = null;
    try {
      liveQuote = await fetchLiveQuote(cleanSym);
    } catch {
      // Non-blocking
    }

    const metrics = await FinancialMetrics.findOne({ symbol: cleanSym }).lean();

    return {
      message: `Successfully scraped ${asset.companyName} from Screener.in`,
      company: {
        id: asset._id.toString(),
        companyName: asset.companyName,
        symbol: asset.symbol,
        nseSymbol: asset.nseSymbol || asset.symbol,
        bseCode: asset.bseCode,
        exchange: asset.exchange || 'NSE',
        country: 'India',
        sector: asset.sector || 'General',
        industry: asset.industry || 'General',
        website: asset.website,
        description: asset.description,
        marketCap: asset.marketCapitalization ?? (liveQuote?.marketCap ? Math.round(liveQuote.marketCap / 1e7) : scrapedData.marketCapCr),
        latestPrice: liveQuote?.price ?? scrapedData.currentPrice ?? asset.currentPrice ?? null,
        changePercent: liveQuote?.changePercent ?? null,
        pe: metrics?.valuation?.peRatio?.value ?? scrapedData.metrics?.peRatio ?? null,
        roe: metrics?.roe?.value ?? scrapedData.metrics?.roe ?? null,
        roce: scrapedData.metrics?.roce ?? null,
        bookValue: scrapedData.metrics?.bookValue ?? null,
        dividendYield: scrapedData.metrics?.dividendYield ?? null,
        source: 'Screener.in (Audited Financials)',
        scrapedAt: new Date().toISOString(),
      },
    };
  }
}
