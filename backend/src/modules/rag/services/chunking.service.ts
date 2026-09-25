import crypto from 'crypto';
import { GeneratedDocument, DocumentChunk, ChunkMetadata } from '../rag.types';

export interface ChunkingOptions {
  chunkSize?: number; // target max characters per chunk (default 800)
  chunkOverlap?: number; // character overlap between sequential chunks (default 150)
  preserveTableIntegrity?: boolean;
}

export class ChunkingService {
  private static defaultOptions: Required<ChunkingOptions> = {
    chunkSize: 800,
    chunkOverlap: 150,
    preserveTableIntegrity: true,
  };

  /**
   * Split multiple generated documents into structured, metadata-rich chunks
   */
  public static chunkDocuments(
    documents: GeneratedDocument[],
    options?: ChunkingOptions
  ): DocumentChunk[] {
    const opts = { ...this.defaultOptions, ...options };
    const allChunks: DocumentChunk[] = [];

    for (const doc of documents) {
      const docChunks = this.chunkSingleDocument(doc, opts);
      allChunks.push(...docChunks);
    }

    return allChunks;
  }

  /**
   * Split a single document into meaningful chunks respecting tables and headings
   */
  public static chunkSingleDocument(
    doc: GeneratedDocument,
    options?: ChunkingOptions
  ): DocumentChunk[] {
    const opts = { ...this.defaultOptions, ...options };
    const rawContent = doc.content;

    // Split document content into logical sections (headings, markdown tables, paragraphs)
    const sections = this.splitIntoLogicalSections(rawContent);
    const chunks: DocumentChunk[] = [];

    let currentChunkText = '';
    let sectionBuffer: string[] = [];
    let chunkIndex = 0;

    const flushChunk = () => {
      if (sectionBuffer.length === 0 && !currentChunkText.trim()) return;

      const bodyText = (currentChunkText + '\n' + sectionBuffer.join('\n\n')).trim();
      if (!bodyText) return;

      chunkIndex++;
      const uniqueChunkId = `${doc.symbol.toLowerCase()}_${doc.documentType}_${doc.reportingPeriod.toLowerCase().replace(/[^a-z0-9]/g, '_')}_chunk_${chunkIndex}_${crypto.createHash('md5').update(bodyText).digest('hex').substring(0, 8)}`;

      // Context prefix ensures dense vector models and keyword searches always associate metrics with symbol & company
      const contextualizedContent = [
        `[Asset: ${doc.symbol} | Company: ${doc.companyName} | Type: ${doc.documentType} | Period: ${doc.reportingPeriod} | Source: ${doc.source}]`,
        bodyText,
      ].join('\n\n');

      // Extract metric names present in this chunk for fast keyword filtering
      const metricNames = doc.financialMetrics
        .filter((m) => bodyText.toLowerCase().includes(m.name.toLowerCase()))
        .map((m) => m.name);

      const metadata: ChunkMetadata = {
        domain: 'stocks',
        assetId: doc.assetId,
        symbol: doc.symbol,
        companyName: doc.companyName,
        documentType: doc.documentType,
        reportingPeriod: doc.reportingPeriod,
        source: doc.source,
        sourceUrl: doc.sourceUrl,
        dataTimestamp: doc.dataTimestamp,
        chunkId: uniqueChunkId,
        metricNames: metricNames.length > 0 ? metricNames : undefined,
      };

      chunks.push({
        chunkId: uniqueChunkId,
        documentId: doc.id,
        content: contextualizedContent,
        metadata,
        tokenCount: Math.ceil(contextualizedContent.length / 4),
      });

      // Prepare overlap for next chunk if overlap is configured
      if (opts.chunkOverlap > 0 && bodyText.length > opts.chunkOverlap) {
        currentChunkText = bodyText.slice(-opts.chunkOverlap);
      } else {
        currentChunkText = '';
      }
      sectionBuffer = [];
    };

    for (const section of sections) {
      // If adding this section exceeds chunkSize and we already have content, flush first
      const estimatedLength = currentChunkText.length + sectionBuffer.join('\n\n').length + section.length;

      if (estimatedLength > opts.chunkSize && (sectionBuffer.length > 0 || currentChunkText.length > 0)) {
        flushChunk();
      }

      // If the section itself is an exceptionally large table, split rows while preserving table header
      if (section.includes('|') && section.length > opts.chunkSize && opts.preserveTableIntegrity) {
        const tableChunks = this.splitLargeTable(section, opts.chunkSize);
        for (const tblSub of tableChunks) {
          sectionBuffer.push(tblSub);
          flushChunk();
        }
      } else {
        sectionBuffer.push(section);
      }
    }

    // Flush any remaining buffered sections
    flushChunk();

    return chunks;
  }

  /**
   * Split markdown text into logical coherent sections
   */
  private static splitIntoLogicalSections(text: string): string[] {
    const lines = text.split('\n');
    const sections: string[] = [];
    let currentBlock: string[] = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isHeader = line.startsWith('#') || line.startsWith('###');
      const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');

      if (isHeader) {
        if (currentBlock.length > 0) {
          sections.push(currentBlock.join('\n').trim());
          currentBlock = [];
        }
        currentBlock.push(line);
        inTable = false;
      } else if (isTableRow) {
        if (!inTable && currentBlock.length > 0) {
          // If we were in normal text and now entered a table, flush previous block
          sections.push(currentBlock.join('\n').trim());
          currentBlock = [];
        }
        inTable = true;
        currentBlock.push(line);
      } else {
        if (inTable) {
          // Exited table
          sections.push(currentBlock.join('\n').trim());
          currentBlock = [];
          inTable = false;
        }

        if (line.trim() === '') {
          if (currentBlock.length > 0) {
            sections.push(currentBlock.join('\n').trim());
            currentBlock = [];
          }
        } else {
          currentBlock.push(line);
        }
      }
    }

    if (currentBlock.length > 0) {
      sections.push(currentBlock.join('\n').trim());
    }

    return sections.filter((s) => s.length > 0);
  }

  /**
   * Preserves table headers when splitting tables across chunk boundaries
   */
  private static splitLargeTable(tableText: string, maxChunkSize: number): string[] {
    const lines = tableText.split('\n');
    if (lines.length <= 3) return [tableText];

    const headerLines: string[] = [];
    const rowLines: string[] = [];

    // First two lines are usually header and divider: | Col | Col | and |---|---|
    for (const line of lines) {
      if (headerLines.length < 2 && line.includes('|')) {
        headerLines.push(line);
      } else if (line.includes('|')) {
        rowLines.push(line);
      }
    }

    const subTables: string[] = [];
    let currentRowGroup: string[] = [];

    for (const row of rowLines) {
      currentRowGroup.push(row);
      const combined = [...headerLines, ...currentRowGroup].join('\n');
      if (combined.length >= maxChunkSize) {
        subTables.push(combined);
        currentRowGroup = [];
      }
    }

    if (currentRowGroup.length > 0) {
      subTables.push([...headerLines, ...currentRowGroup].join('\n'));
    }

    return subTables.length > 0 ? subTables : [tableText];
  }
}
