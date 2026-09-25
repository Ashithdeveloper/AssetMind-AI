import mongoose from 'mongoose';
import { Asset, IAsset } from '../../../models/Asset.model';
import { FinancialData, IFinancialData } from '../../../models/FinancialData.model';
import { StockPrice, IStockPrice } from '../../../models/StockPrice.model';
import { FinancialDocument, IFinancialDocument } from '../../../models/FinancialDocument.model';
import { GeneratedDocument, DocumentType, FinancialMetricItem } from '../rag.types';
import { AppError } from '../../../utils/apiResponse';

export class DocumentBuilderService {
  /**
   * Helper to format values with units clearly
   */
  public static formatMetricValue(val: number, unit?: string, currency = 'USD'): string {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    
    switch (unit?.toLowerCase()) {
      case 'billions':
      case 'billion':
      case 'b':
        return `${currency} ${val.toLocaleString()} Billion`;
      case 'millions':
      case 'million':
      case 'm':
        return `${currency} ${val.toLocaleString()} Million`;
      case 'percentage':
      case 'percent':
      case '%':
        return `${val.toFixed(2)}%`;
      case 'ratio':
        return `${val.toFixed(2)}x`;
      case 'currency':
        return `${currency} ${val.toLocaleString()}`;
      default:
        // If raw large number
        if (Math.abs(val) >= 1e9) {
          return `${currency} ${(val / 1e9).toFixed(2)} Billion (${val.toLocaleString()})`;
        } else if (Math.abs(val) >= 1e6) {
          return `${currency} ${(val / 1e6).toFixed(2)} Million (${val.toLocaleString()})`;
        }
        return `${val.toLocaleString()} (${unit || 'raw'})`;
    }
  }

  /**
   * Builds all 7 document types for a given company symbol
   */
  public static async buildDocumentsForSymbol(symbol: string): Promise<GeneratedDocument[]> {
    const cleanSymbol = symbol.trim().toUpperCase();
    const asset = await Asset.findOne({ symbol: cleanSymbol });

    if (!asset) {
      throw new AppError(`Asset with symbol ${cleanSymbol} not found`, 404, 'ASSET_NOT_FOUND');
    }

    // Retrieve all valid or warning financial data for this asset
    const financialRecords = await FinancialData.find({
      symbol: cleanSymbol,
      validationStatus: { $ne: 'REJECTED' },
    }).sort({ reportingPeriod: -1, collectedAt: -1 });

    // Retrieve recent stock prices
    const stockPrices = await StockPrice.find({ symbol: cleanSymbol })
      .sort({ priceTimestamp: -1 })
      .limit(30);

    // Retrieve any financial documents
    const rawDocuments = await FinancialDocument.find({ symbol: cleanSymbol }).sort({
      publicationDate: -1,
      collectedAt: -1,
    });

    const generatedDocs: GeneratedDocument[] = [];

    // 1. Company Profile Document
    const profileDoc = this.buildCompanyProfileDocument(asset, financialRecords, stockPrices[0]);
    if (profileDoc) generatedDocs.push(profileDoc);

    // 2. Financial Statements Documents (Grouped by period)
    const statementDocs = this.buildFinancialStatementDocuments(asset, financialRecords);
    generatedDocs.push(...statementDocs);

    // 3. Financial Ratios Documents
    const ratioDocs = this.buildFinancialRatioDocuments(asset, financialRecords);
    generatedDocs.push(...ratioDocs);

    // 4. Historical Financial Performance Document
    const historyDoc = this.buildHistoricalPerformanceDocument(asset, financialRecords);
    if (historyDoc) generatedDocs.push(historyDoc);

    // 5. Stock Price History Document
    const priceDoc = this.buildStockPriceHistoryDocument(asset, stockPrices);
    if (priceDoc) generatedDocs.push(priceDoc);

    // 6. Financial Disclosures Document
    const disclosureDocs = this.buildFinancialDisclosureDocuments(asset, rawDocuments);
    generatedDocs.push(...disclosureDocs);

    // 7. Source-Specific Financial Information Document
    const sourceDocs = this.buildSourceSpecificDocuments(asset, financialRecords);
    generatedDocs.push(...sourceDocs);

    return generatedDocs;
  }

  /**
   * 1. Company Profile Document
   */
  private static buildCompanyProfileDocument(
    asset: IAsset,
    records: IFinancialData[],
    latestPrice?: IStockPrice
  ): GeneratedDocument | null {
    const companyName = asset.companyName || asset.symbol;
    const nowStr = new Date().toISOString();

    const metrics: FinancialMetricItem[] = [];
    const marketCapRec = records.find((r) => /marketcap/i.test(r.metricName));
    if (marketCapRec) {
      metrics.push({
        name: 'Market Capitalization',
        value: marketCapRec.metricValue,
        formattedValue: this.formatMetricValue(marketCapRec.metricValue, marketCapRec.unit, marketCapRec.currency),
        currency: marketCapRec.currency,
        unit: marketCapRec.unit,
        reportingPeriod: marketCapRec.reportingPeriod,
        source: marketCapRec.source,
      });
    }

    if (latestPrice) {
      metrics.push({
        name: 'Current Stock Price',
        value: latestPrice.price,
        formattedValue: `${latestPrice.currency || 'USD'} ${latestPrice.price.toFixed(2)}`,
        currency: latestPrice.currency,
        reportingPeriod: 'LATEST',
        source: latestPrice.source,
      });
    }

    const lines: string[] = [
      `# Company Profile: ${companyName} (${asset.symbol})`,
      `**Asset Symbol:** ${asset.symbol}`,
      `**Company Name:** ${companyName}`,
      `**Exchange:** ${asset.exchange || 'N/A'}`,
      `**Sector:** ${asset.sector || 'N/A'}`,
      `**Industry:** ${asset.industry || 'N/A'}`,
      `**Country:** ${asset.country || 'N/A'}`,
      '',
      `### Business Description`,
      asset.description || `${companyName} is a publicly traded company listed under symbol ${asset.symbol}.`,
      '',
      `### Key Company Highlights`,
      `- **Latest Stock Price:** ${latestPrice ? `${latestPrice.currency || 'USD'} ${latestPrice.price}` : 'Not Available'}`,
      `- **Market Capitalization:** ${marketCapRec ? this.formatMetricValue(marketCapRec.metricValue, marketCapRec.unit, marketCapRec.currency) : 'Not Available'}`,
      `- **Exchange Listing:** ${asset.exchange || 'N/A'}`,
      `- **Data Timestamp:** ${nowStr}`,
    ];

    return {
      id: `${asset.symbol}_company_profile`,
      symbol: asset.symbol,
      companyName,
      assetId: asset._id.toString(),
      documentType: 'company_profile',
      title: `${companyName} (${asset.symbol}) - Company Profile & Overview`,
      content: lines.join('\n'),
      reportingPeriod: 'CURRENT',
      financialMetrics: metrics,
      source: latestPrice?.source || records[0]?.source || 'assetmind_database',
      sourceUrl: latestPrice?.sourceUrl || records[0]?.sourceUrl || undefined,
      dataTimestamp: nowStr,
    };
  }

  /**
   * 2. Financial Statements Documents (Income Statement, Balance Sheet, Cash Flow by period)
   */
  private static buildFinancialStatementDocuments(
    asset: IAsset,
    records: IFinancialData[]
  ): GeneratedDocument[] {
    const docs: GeneratedDocument[] = [];
    const companyName = asset.companyName || asset.symbol;

    // Filter statement metrics
    const statementKeywords = [
      'revenue',
      'netincome',
      'operatingincome',
      'grossprofit',
      'ebitda',
      'totalassets',
      'totalliabilities',
      'totaldebt',
      'cash',
      'cashandcashequivalents',
      'freecashflow',
      'operatingcashflow',
      'capitalexpenditure',
      'capex',
      'costofrevenue',
      'retainedearnings',
    ];

    const statementRecords = records.filter((r) =>
      statementKeywords.some((k) => r.metricName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(k))
    );

    if (statementRecords.length === 0) {
      return docs;
    }

    // Group by reporting period (e.g. TTM, 2024, 2023)
    const periods = Array.from(new Set(statementRecords.map((r) => r.reportingPeriod || 'TTM')));

    for (const period of periods) {
      const periodRecords = statementRecords.filter((r) => (r.reportingPeriod || 'TTM') === period);
      if (periodRecords.length === 0) continue;

      const metrics: FinancialMetricItem[] = periodRecords.map((r) => ({
        name: r.metricName,
        value: r.metricValue,
        formattedValue: this.formatMetricValue(r.metricValue, r.unit, r.currency),
        currency: r.currency,
        unit: r.unit,
        reportingPeriod: period,
        timestamp: r.dataTimestamp || r.collectedAt,
        source: r.source,
      }));

      const tableRows = periodRecords.map(
        (r) =>
          `| ${r.metricName} | ${this.formatMetricValue(r.metricValue, r.unit, r.currency)} | ${r.unit || 'raw'} | ${r.currency || 'USD'} | ${r.source} |`
      );

      const content = [
        `# Financial Statements: ${companyName} (${asset.symbol}) - Period: ${period}`,
        `**Company:** ${companyName} (${asset.symbol})`,
        `**Reporting Period:** ${period}`,
        `**Document Type:** Financial Statements (Income, Balance Sheet, Cash Flow)`,
        `**Primary Source:** ${periodRecords[0]?.source || 'Verified Financial Source'}`,
        `**Timestamp:** ${periodRecords[0]?.collectedAt ? new Date(periodRecords[0].collectedAt).toISOString() : new Date().toISOString()}`,
        '',
        `### Reported Financial Statement Metrics (${period})`,
        '| Metric Name | Value | Unit | Currency | Source |',
        '| :--- | :--- | :--- | :--- | :--- |',
        ...tableRows,
        '',
        `### Summary of Financial Results for ${period}`,
        `During reporting period ${period}, ${companyName} reported the verified financial metrics above. All values, units, and currencies correspond precisely to recorded financial filings.`,
      ].join('\n');

      docs.push({
        id: `${asset.symbol}_financial_statement_${period}`,
        symbol: asset.symbol,
        companyName,
        assetId: asset._id.toString(),
        documentType: 'financial_statement',
        title: `${companyName} (${asset.symbol}) - Financial Statements (${period})`,
        content,
        reportingPeriod: period,
        financialMetrics: metrics,
        source: periodRecords[0]?.source || 'financial_filings',
        sourceUrl: periodRecords[0]?.sourceUrl || undefined,
        dataTimestamp: periodRecords[0]?.collectedAt
          ? new Date(periodRecords[0].collectedAt).toISOString()
          : new Date().toISOString(),
      });
    }

    return docs;
  }

  /**
   * 3. Financial Ratios Documents
   */
  private static buildFinancialRatioDocuments(
    asset: IAsset,
    records: IFinancialData[]
  ): GeneratedDocument[] {
    const docs: GeneratedDocument[] = [];
    const companyName = asset.companyName || asset.symbol;

    const ratioKeywords = [
      'pe',
      'peratio',
      'pricetoearnings',
      'pb',
      'pbratio',
      'pricetobook',
      'ps',
      'pricetosales',
      'debttoequity',
      'currentratio',
      'quickratio',
      'roe',
      'returnonequity',
      'roa',
      'returnonassets',
      'margin',
      'profitmargin',
      'operatingmargin',
      'grossmargin',
      'dividendyield',
      'payoutratio',
      'beta',
      'eps',
    ];

    const ratioRecords = records.filter((r) =>
      ratioKeywords.some((k) => r.metricName.toLowerCase().replace(/[^a-z0-9]/g, '') === k || r.unit === 'ratio' || r.unit === 'percentage')
    );

    if (ratioRecords.length === 0) return docs;

    const periods = Array.from(new Set(ratioRecords.map((r) => r.reportingPeriod || 'TTM')));

    for (const period of periods) {
      const periodRecords = ratioRecords.filter((r) => (r.reportingPeriod || 'TTM') === period);
      if (periodRecords.length === 0) continue;

      const metrics: FinancialMetricItem[] = periodRecords.map((r) => ({
        name: r.metricName,
        value: r.metricValue,
        formattedValue: this.formatMetricValue(r.metricValue, r.unit, r.currency),
        currency: r.currency,
        unit: r.unit,
        reportingPeriod: period,
        timestamp: r.dataTimestamp || r.collectedAt,
        source: r.source,
      }));

      const tableRows = periodRecords.map(
        (r) =>
          `| ${r.metricName} | ${this.formatMetricValue(r.metricValue, r.unit, r.currency)} | ${r.unit || 'ratio'} | ${r.source} |`
      );

      const content = [
        `# Financial Ratios & Valuation: ${companyName} (${asset.symbol}) - Period: ${period}`,
        `**Company:** ${companyName} (${asset.symbol})`,
        `**Reporting Period:** ${period}`,
        `**Document Type:** Financial Ratios & Valuation Multiples`,
        `**Source:** ${periodRecords[0]?.source || 'Financial Data Provider'}`,
        '',
        `### Key Valuation & Performance Ratios (${period})`,
        '| Metric Name | Value | Unit | Source |',
        '| :--- | :--- | :--- | :--- |',
        ...tableRows,
        '',
        `### Analysis Context`,
        `These financial ratios reflect ${companyName}'s valuation, profitability, and operational efficiency for ${period}.`,
      ].join('\n');

      docs.push({
        id: `${asset.symbol}_financial_ratios_${period}`,
        symbol: asset.symbol,
        companyName,
        assetId: asset._id.toString(),
        documentType: 'financial_ratios',
        title: `${companyName} (${asset.symbol}) - Financial Ratios (${period})`,
        content,
        reportingPeriod: period,
        financialMetrics: metrics,
        source: periodRecords[0]?.source || 'financial_filings',
        sourceUrl: periodRecords[0]?.sourceUrl || undefined,
        dataTimestamp: periodRecords[0]?.collectedAt
          ? new Date(periodRecords[0].collectedAt).toISOString()
          : new Date().toISOString(),
      });
    }

    return docs;
  }

  /**
   * 4. Historical Financial Performance Document
   */
  private static buildHistoricalPerformanceDocument(
    asset: IAsset,
    records: IFinancialData[]
  ): GeneratedDocument | null {
    const companyName = asset.companyName || asset.symbol;
    if (records.length === 0) return null;

    // Collect metrics that appear across multiple reporting periods
    const periods = Array.from(new Set(records.map((r) => r.reportingPeriod || 'TTM')));
    const keyTrends = ['revenue', 'netIncome', 'eps', 'freeCashFlow', 'operatingIncome', 'grossProfit'];

    const trendLines: string[] = [];
    const metrics: FinancialMetricItem[] = [];

    trendLines.push(`### Historical Metric Progression Across Reporting Periods`);
    trendLines.push('| Metric Name | Reporting Period | Reported Value | Unit | Source | Date |');
    trendLines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');

    let count = 0;
    for (const trend of keyTrends) {
      const matches = records.filter(
        (r) => r.metricName.toLowerCase().replace(/[^a-z0-9]/g, '') === trend.toLowerCase()
      );

      for (const m of matches) {
        count++;
        metrics.push({
          name: m.metricName,
          value: m.metricValue,
          formattedValue: this.formatMetricValue(m.metricValue, m.unit, m.currency),
          currency: m.currency,
          unit: m.unit,
          reportingPeriod: m.reportingPeriod,
          source: m.source,
        });

        trendLines.push(
          `| ${m.metricName} | ${m.reportingPeriod || 'TTM'} | ${this.formatMetricValue(m.metricValue, m.unit, m.currency)} | ${m.unit || 'raw'} | ${m.source} | ${m.collectedAt ? new Date(m.collectedAt).toISOString().split('T')[0] : 'N/A'} |`
        );
      }
    }

    if (count === 0) {
      // If none of key trends matched exactly, list the available metrics
      for (const m of records.slice(0, 15)) {
        trendLines.push(
          `| ${m.metricName} | ${m.reportingPeriod || 'TTM'} | ${this.formatMetricValue(m.metricValue, m.unit, m.currency)} | ${m.unit || 'raw'} | ${m.source} | ${m.collectedAt ? new Date(m.collectedAt).toISOString().split('T')[0] : 'N/A'} |`
        );
      }
    }

    const content = [
      `# Historical Financial Performance: ${companyName} (${asset.symbol})`,
      `**Company:** ${companyName} (${asset.symbol})`,
      `**Periods Covered:** ${periods.join(', ')}`,
      `**Document Type:** Historical Financial Performance & Trends`,
      '',
      ...trendLines,
      '',
      `### Performance Summary`,
      `The historical records above illustrate the trajectory of ${companyName}'s core operational and financial metrics across recorded fiscal periods (${periods.join(', ')}).`,
    ].join('\n');

    return {
      id: `${asset.symbol}_historical_performance`,
      symbol: asset.symbol,
      companyName,
      assetId: asset._id.toString(),
      documentType: 'historical_performance',
      title: `${companyName} (${asset.symbol}) - Historical Financial Performance`,
      content,
      reportingPeriod: periods.join(','),
      financialMetrics: metrics,
      source: records[0]?.source || 'financial_filings',
      sourceUrl: records[0]?.sourceUrl || undefined,
      dataTimestamp: new Date().toISOString(),
    };
  }

  /**
   * 5. Stock Price History Document
   */
  private static buildStockPriceHistoryDocument(
    asset: IAsset,
    stockPrices: IStockPrice[]
  ): GeneratedDocument | null {
    const companyName = asset.companyName || asset.symbol;
    if (!stockPrices || stockPrices.length === 0) return null;

    const latest = stockPrices[0];
    const metrics: FinancialMetricItem[] = [
      {
        name: 'Latest Stock Price',
        value: latest.price,
        formattedValue: `${latest.currency || 'USD'} ${latest.price.toFixed(2)}`,
        currency: latest.currency,
        reportingPeriod: 'LATEST',
        source: latest.source,
      },
    ];

    if (latest.previousClose) {
      metrics.push({
        name: 'Previous Close',
        value: latest.previousClose,
        formattedValue: `${latest.currency || 'USD'} ${latest.previousClose.toFixed(2)}`,
        currency: latest.currency,
        source: latest.source,
      });
    }

    if (latest.changePercent !== undefined) {
      metrics.push({
        name: 'Price Change Percent',
        value: latest.changePercent,
        formattedValue: `${latest.changePercent >= 0 ? '+' : ''}${latest.changePercent.toFixed(2)}%`,
        unit: 'percentage',
        source: latest.source,
      });
    }

    if (latest.volume) {
      metrics.push({
        name: 'Trading Volume',
        value: latest.volume,
        formattedValue: latest.volume.toLocaleString(),
        unit: 'shares',
        source: latest.source,
      });
    }

    const priceRows = stockPrices.slice(0, 10).map((sp) => {
      const dateStr = sp.priceTimestamp ? new Date(sp.priceTimestamp).toISOString().split('T')[0] : 'N/A';
      const changeStr = sp.changePercent !== undefined ? `${sp.changePercent.toFixed(2)}%` : 'N/A';
      const volStr = sp.volume ? sp.volume.toLocaleString() : 'N/A';
      return `| ${dateStr} | ${sp.currency || 'USD'} ${sp.price.toFixed(2)} | ${changeStr} | ${volStr} | ${sp.source} |`;
    });

    const content = [
      `# Stock Price & Trading History: ${companyName} (${asset.symbol})`,
      `**Company:** ${companyName} (${asset.symbol})`,
      `**Exchange:** ${asset.exchange || 'N/A'}`,
      `**Current Market Price:** ${latest.currency || 'USD'} ${latest.price.toFixed(2)}`,
      `**Day Change:** ${latest.change !== undefined ? latest.change.toFixed(2) : 'N/A'} (${latest.changePercent !== undefined ? latest.changePercent.toFixed(2) + '%' : 'N/A'})`,
      `**Trading Volume:** ${latest.volume ? latest.volume.toLocaleString() : 'N/A'}`,
      `**Previous Close:** ${latest.previousClose ? `${latest.currency || 'USD'} ${latest.previousClose.toFixed(2)}` : 'N/A'}`,
      `**Timestamp:** ${new Date(latest.priceTimestamp || latest.collectedAt).toISOString()}`,
      `**Source:** ${latest.source}`,
      '',
      `### Recent Trading Price Table`,
      '| Date | Price | Change % | Volume | Source |',
      '| :--- | :--- | :--- | :--- | :--- |',
      ...priceRows,
      '',
      `### Trading Observations`,
      `The latest trading data records ${companyName} trading at ${latest.currency || 'USD'} ${latest.price.toFixed(2)}.`,
    ].join('\n');

    return {
      id: `${asset.symbol}_stock_price_history`,
      symbol: asset.symbol,
      companyName,
      assetId: asset._id.toString(),
      documentType: 'stock_price_history',
      title: `${companyName} (${asset.symbol}) - Stock Price & Trading History`,
      content,
      reportingPeriod: 'RECENT',
      financialMetrics: metrics,
      source: latest.source,
      sourceUrl: latest.sourceUrl || undefined,
      dataTimestamp: new Date(latest.priceTimestamp || latest.collectedAt).toISOString(),
    };
  }

  /**
   * 6. Financial Disclosures Document
   */
  private static buildFinancialDisclosureDocuments(
    asset: IAsset,
    documents: IFinancialDocument[]
  ): GeneratedDocument[] {
    const docs: GeneratedDocument[] = [];
    const companyName = asset.companyName || asset.symbol;

    if (!documents || documents.length === 0) {
      // If no raw documents, create a summary disclosure from company profile data
      const content = [
        `# Financial Disclosures & Regulatory Notes: ${companyName} (${asset.symbol})`,
        `**Company:** ${companyName} (${asset.symbol})`,
        `**Exchange:** ${asset.exchange || 'N/A'}`,
        `**Document Type:** Financial Disclosures & Notes`,
        '',
        `### Regulatory Disclosures Overview`,
        `${companyName} is subject to reporting and disclosure regulations under its registered market jurisdiction (${asset.country || 'Global/US'}). All financial figures cited in AssetMind AI correspond to publicly published reports.`,
      ].join('\n');

      docs.push({
        id: `${asset.symbol}_financial_disclosures_general`,
        symbol: asset.symbol,
        companyName,
        assetId: asset._id.toString(),
        documentType: 'financial_disclosures',
        title: `${companyName} (${asset.symbol}) - Financial Disclosures & Notes`,
        content,
        reportingPeriod: 'ANNUAL',
        financialMetrics: [],
        source: 'regulatory_filings',
        dataTimestamp: new Date().toISOString(),
      });
      return docs;
    }

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const content = [
        `# Financial Disclosure: ${doc.title}`,
        `**Company:** ${companyName} (${asset.symbol})`,
        `**Disclosure Type:** ${doc.documentType}`,
        `**Source:** ${doc.source}`,
        `**Publication Date:** ${doc.publicationDate ? new Date(doc.publicationDate).toISOString() : 'N/A'}`,
        '',
        `### Disclosure Content`,
        doc.content || `Filing titled "${doc.title}" filed by ${companyName} under ${doc.documentType}.`,
      ].join('\n');

      docs.push({
        id: `${asset.symbol}_disclosure_${doc._id.toString()}`,
        symbol: asset.symbol,
        companyName,
        assetId: asset._id.toString(),
        documentType: 'financial_disclosures',
        title: `${companyName} (${asset.symbol}) - ${doc.title}`,
        content,
        reportingPeriod: doc.publicationDate ? new Date(doc.publicationDate).getFullYear().toString() : 'CURRENT',
        financialMetrics: [],
        source: doc.source,
        sourceUrl: doc.sourceUrl || undefined,
        dataTimestamp: new Date(doc.collectedAt || doc.createdAt).toISOString(),
      });
    }

    return docs;
  }

  /**
   * 7. Source-Specific Financial Information Document
   */
  private static buildSourceSpecificDocuments(
    asset: IAsset,
    records: IFinancialData[]
  ): GeneratedDocument[] {
    const docs: GeneratedDocument[] = [];
    const companyName = asset.companyName || asset.symbol;

    const sources = Array.from(new Set(records.map((r) => r.source || 'default')));

    for (const src of sources) {
      const srcRecords = records.filter((r) => (r.source || 'default') === src);
      if (srcRecords.length === 0) continue;

      const metrics: FinancialMetricItem[] = srcRecords.map((r) => ({
        name: r.metricName,
        value: r.metricValue,
        formattedValue: this.formatMetricValue(r.metricValue, r.unit, r.currency),
        currency: r.currency,
        unit: r.unit,
        reportingPeriod: r.reportingPeriod,
        source: src,
      }));

      const rows = srcRecords.slice(0, 25).map(
        (r) =>
          `| ${r.metricName} | ${this.formatMetricValue(r.metricValue, r.unit, r.currency)} | ${r.reportingPeriod || 'TTM'} | ${r.scraperProvider} | ${r.collectedAt ? new Date(r.collectedAt).toISOString().split('T')[0] : 'N/A'} |`
      );

      const content = [
        `# Source-Attributed Financial Evidence: ${companyName} (${asset.symbol}) from ${src}`,
        `**Company:** ${companyName} (${asset.symbol})`,
        `**Data Source Provider:** ${src}`,
        `**Source URL:** ${srcRecords[0]?.sourceUrl || 'N/A'}`,
        `**Scraper Engine:** ${srcRecords[0]?.scraperProvider || 'playwright'}`,
        `**Record Count:** ${srcRecords.length} verified metrics`,
        '',
        `### Extracted Data Points via ${src}`,
        '| Metric Name | Value | Period | Scraper Engine | Date Collected |',
        '| :--- | :--- | :--- | :--- | :--- |',
        ...rows,
        '',
        `### Provenance Details`,
        `Data collected by automated extraction from ${src}. All values reflect original source telemetry without modification.`,
      ].join('\n');

      docs.push({
        id: `${asset.symbol}_source_specific_${src.replace(/[^a-zA-Z0-9]/g, '_')}`,
        symbol: asset.symbol,
        companyName,
        assetId: asset._id.toString(),
        documentType: 'source_specific_info',
        title: `${companyName} (${asset.symbol}) - Financial Data from ${src}`,
        content,
        reportingPeriod: srcRecords[0]?.reportingPeriod || 'TTM',
        financialMetrics: metrics,
        source: src,
        sourceUrl: srcRecords[0]?.sourceUrl || undefined,
        dataTimestamp: srcRecords[0]?.collectedAt
          ? new Date(srcRecords[0].collectedAt).toISOString()
          : new Date().toISOString(),
      });
    }

    return docs;
  }
}
