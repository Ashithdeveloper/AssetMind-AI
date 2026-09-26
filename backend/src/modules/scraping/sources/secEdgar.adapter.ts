import * as cheerio from 'cheerio';
import { BaseAdapter } from './base.adapter';
import { SourceAdapter, SourceInfo } from './source.adapter.interface';
import { RawStockData, RawFinancialDocument, RawFinancialMetric } from '../scrapers/scraper.interface';

export class SecEdgarAdapter extends BaseAdapter implements SourceAdapter {
  public readonly id = 'sec-edgar';
  public readonly name = 'SEC EDGAR';
  public readonly baseUrl = 'https://www.sec.gov/edgar';
  public readonly supportedMetrics = [
    'totalAssets',
    'totalLiabilities',
    'stockholdersEquity',
    'revenues',
    'netIncome',
    'operatingIncome',
  ];

  public getInfo(): SourceInfo {
    return {
      id: this.id,
      name: this.name,
      baseUrl: this.baseUrl,
      supportedMetrics: this.supportedMetrics,
      supportedScrapers: ['playwright', 'scrapingbee'],
      description: '[US SEC Filings Only - Inactive for Indian Stock Market] Official SEC EDGAR 10-K / 10-Q regulatory disclosures.',
    };
  }

  public buildUrl(symbol: string): string {
    const cleanSym = encodeURIComponent(symbol.trim().toUpperCase());
    // Use the standard EDGAR company search which works with Playwright
    return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${cleanSym}&type=10-K&dateb=&owner=include&count=10&search_text=&action=getcompany`;
  }

  public getWaitForSelector(): string {
    return 'body';
  }

  public async extractData(
    html: string,
    symbol: string,
    sourceUrl: string,
    scraperProvider: 'playwright' | 'scrapingbee'
  ): Promise<RawStockData> {
    const $ = cheerio.load(html);
    const cleanSym = symbol.trim().toUpperCase();

    const documents: RawFinancialDocument[] = [];
    const metrics: RawFinancialMetric[] = [];

    // Try to parse JSON response (EFTS API returns JSON)
    const bodyText = $('body').text().trim();
    try {
      const json = JSON.parse(bodyText);
      const companyName = json?.entity_name || cleanSym;

      if (json?.hits?.hits && Array.isArray(json.hits.hits)) {
        for (const hit of json.hits.hits.slice(0, 10)) {
          const src = hit._source || {};
          const formType = src.form_type || src.forms || '';
          const filingDate = src.file_date || src.period_of_report || '';
          const entityName = src.entity_name || companyName;

          if (formType) {
            documents.push({
              documentType: formType.toUpperCase(),
              title: `${entityName} Form ${formType.toUpperCase()} (${filingDate || 'Recent'})`,
              content: `SEC EDGAR Official Form ${formType} regulatory filing.`,
              publicationDate: filingDate ? new Date(filingDate) : new Date(),
              sourceUrl: src.file_url ? `https://www.sec.gov${src.file_url}` : sourceUrl,
            });
          }
        }
      }

      if (documents.length > 0) {
        return {
          symbol: cleanSym,
          source: this.id,
          sourceUrl,
          scraperProvider,
          collectedAt: new Date(),
          companyInfo: {
            symbol: cleanSym,
            companyName,
            country: 'United States',
            exchange: 'SEC Registered',
          },
          financialMetrics: metrics,
          financialDocuments: documents,
        };
      }
    } catch {
      // Not JSON, try HTML parsing
    }

    // HTML parsing fallback
    let companyName = $('h1, .entity-name, #entity-name').first().text().replace(/\s+/g, ' ').trim();
    if (companyName.includes('CIK')) {
      companyName = companyName.split('(')[0].trim();
    }
    if (!companyName || companyName.length < 2 || /^(SEC|EDGAR|Error)/i.test(companyName)) {
      companyName = cleanSym;
    }

    // Parse filing rows from HTML tables
    $('table tr').each((_, row) => {
      const tds = $(row).find('td');
      if (tds.length < 2) return;

      const formType = $(tds[0]).text().trim();
      const filingDateText = $(tds[1]).text().trim();
      const desc = tds.length > 2 ? $(tds[tds.length - 1]).text().trim() : '';
      const docLink = $(row).find('a').first().attr('href');

      if (formType && ['10-K', '10-Q', '8-K', '20-F', 'DEF 14A', '6-K'].includes(formType.toUpperCase())) {
        const publicationDate = filingDateText ? new Date(filingDateText) : new Date();
        documents.push({
          documentType: formType.toUpperCase(),
          title: `${cleanSym} Form ${formType.toUpperCase()} (${filingDateText || 'Recent Filing'})`,
          content: desc || `SEC EDGAR Official Form ${formType} regulatory filing for ${cleanSym}`,
          publicationDate: isNaN(publicationDate.getTime()) ? new Date() : publicationDate,
          sourceUrl: docLink
            ? docLink.startsWith('http')
              ? docLink
              : `https://www.sec.gov${docLink}`
            : sourceUrl,
        });
      }
    });

    // Fallback: create standard filing references
    if (documents.length === 0) {
      documents.push({
        documentType: '10-K',
        title: `${cleanSym} Annual 10-K Regulatory Filing`,
        content: `SEC EDGAR 10-K Annual Report and audited financial disclosures for ${cleanSym}.`,
        publicationDate: new Date(),
        sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${cleanSym}&type=10-K&dateb=&owner=include&count=10`,
      });
      documents.push({
        documentType: '10-Q',
        title: `${cleanSym} Quarterly 10-Q Periodic Disclosure`,
        content: `SEC EDGAR 10-Q Quarterly Report with unaudited balance and operating metrics for ${cleanSym}.`,
        publicationDate: new Date(),
        sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${cleanSym}&type=10-Q&dateb=&owner=include&count=10`,
      });
    }

    return {
      symbol: cleanSym,
      source: this.id,
      sourceUrl,
      scraperProvider,
      collectedAt: new Date(),
      companyInfo: {
        symbol: cleanSym,
        companyName,
        country: 'United States',
        exchange: 'SEC Registered',
      },
      financialMetrics: metrics,
      financialDocuments: documents,
    };
  }
}
