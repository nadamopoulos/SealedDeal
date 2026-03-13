import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Categorize a document based on its filename.
 */
export function categorizeDocument(filename) {
  const name = filename.toLowerCase();
  if (/financ|p&l|income|balance|cash.?flow|revenue|ebitda|budget|audit|tax|valuation|model|projection/i.test(name))
    return 'financial';
  if (/legal|contract|agreement|compliance|regulat|license|patent|litigation|ip\b|trademark/i.test(name))
    return 'legal';
  if (/operat|process|supply|logistics|inventory|manufacturing|quality|kpi|sop|franchise.?agreement|capex/i.test(name))
    return 'operational';
  if (/market|industry|compet|landscape|benchmark|customer|segment|tam|sam|research|trend/i.test(name))
    return 'market';
  if (/manage|team|org|executive|board|leadership|cv|resume|bio|compensation|hiring/i.test(name))
    return 'management';
  return 'other';
}

// ─── XLSX extraction via SheetJS ────────────────────────────

/**
 * Extract all sheet data from an Excel file as readable text.
 * Converts each sheet to CSV-like text with headers.
 */
function extractXlsx(buffer, filename) {
  try {
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const parts = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // Convert to array of arrays
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rows.length) continue;

      parts.push(`\n=== Sheet: ${sheetName} ===`);

      // Format as tab-separated text with headers
      for (let i = 0; i < Math.min(rows.length, 5000); i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        // Convert each cell to string, handling dates and numbers
        const cells = row.map((cell) => {
          if (cell instanceof Date) return cell.toISOString().split('T')[0];
          if (cell === null || cell === undefined) return '';
          return String(cell);
        });
        // Skip rows that are entirely empty
        if (cells.every((c) => c.trim() === '')) continue;
        parts.push(cells.join('\t'));
      }

      if (rows.length > 5000) {
        parts.push(`... (${rows.length - 5000} more rows truncated)`);
      }
    }

    const text = parts.join('\n');
    if (text.trim().length < 20) {
      return `[Spreadsheet "${filename}" appears empty or contains only formatting]`;
    }
    return text;
  } catch (err) {
    console.error(`XLSX extraction failed for ${filename}:`, err);
    return `[Error extracting spreadsheet ${filename}: ${err.message}]`;
  }
}

// ─── PDF extraction: pdf-parse first, Claude fallback ───────

/**
 * Try extracting text from a PDF using pdf-parse.
 * Returns the text, or null if extraction fails/produces empty results.
 */
async function extractPdfLocal(buffer) {
  try {
    const { PDFParse } = await import('pdf-parse');
    const uint8 = new Uint8Array(buffer);
    const parser = new PDFParse({ data: uint8 });
    const result = await parser.getText();
    await parser.destroy();
    const text = (result.text || '').trim();
    // If we got less than 100 chars, treat as failed (probably scanned/image PDF)
    return text.length >= 100 ? text : null;
  } catch (err) {
    console.error('pdf-parse extraction failed:', err.message);
    return null;
  }
}

/**
 * Extract text from a PDF using Claude's vision/document understanding.
 * Sends the PDF as a base64 document to Claude and asks it to extract all text.
 * Works on scanned PDFs, image-heavy PDFs, and complex layouts.
 */
async function extractPdfWithClaude(buffer, filename) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return `[Cannot extract text from ${filename}: ANTHROPIC_API_KEY not configured]`;
  }

  try {
    const client = new Anthropic({ apiKey });
    const base64 = Buffer.from(buffer).toString('base64');

    // Claude supports PDF as a document type
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract ALL text content from this document. Include every piece of text you can see — headings, body text, tables, captions, footnotes, headers, footers, page numbers, chart labels, and any text in images or diagrams.

For tables, format them as tab-separated values with clear column headers.
For financial data, preserve all numbers, percentages, and currency values exactly as shown.
For charts/graphs, describe the data shown including axis labels and values.

Output ONLY the extracted text, no commentary or explanation. Preserve the document's logical structure using headings and line breaks.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.text || '';
    console.log(`Claude PDF extraction for "${filename}": ${text.length} chars`);
    return text;
  } catch (err) {
    console.error(`Claude PDF extraction failed for ${filename}:`, err.message);
    return `[Error extracting PDF with Claude: ${err.message}]`;
  }
}

// ─── Main extraction entry point ────────────────────────────

/**
 * Extract text from a file buffer based on its extension.
 * - PDF: tries pdf-parse first, falls back to Claude API
 * - XLSX/XLS: uses SheetJS xlsx library
 * - DOCX: uses mammoth
 * - TXT/CSV/MD: direct read
 */
export async function extractText(buffer, filename) {
  const ext = path.extname(filename || '').toLowerCase();
  let extractedText = '';

  try {
    if (ext === '.pdf') {
      // Try fast local extraction first
      const localText = await extractPdfLocal(buffer);
      if (localText) {
        extractedText = localText;
        console.log(`PDF "${filename}": pdf-parse extracted ${localText.length} chars`);
      } else {
        // Fallback to Claude for scanned/image PDFs
        console.log(`PDF "${filename}": pdf-parse failed or empty, using Claude`);
        extractedText = await extractPdfWithClaude(buffer, filename);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      extractedText = extractXlsx(buffer, filename);
    } else if (ext === '.docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      extractedText = result.value;
    } else if (ext === '.txt' || ext === '.csv' || ext === '.md') {
      extractedText = Buffer.from(buffer).toString('utf-8');
    } else {
      extractedText = `[Unsupported file type: ${ext}. Supported: PDF, DOCX, XLSX, XLS, TXT, CSV, MD]`;
    }
  } catch (parseErr) {
    console.error(`Text extraction failed for ${filename}:`, parseErr);
    extractedText = `[Error extracting text from ${filename}: ${parseErr.message}]`;
  }

  return extractedText;
}

/**
 * Process a file buffer: extract text, generate metadata, store in Redis.
 * Returns { docMeta, truncatedText }.
 */
export async function processFile(buffer, filename, dealId, redis) {
  const ext = path.extname(filename || '').toLowerCase();
  const extractedText = await extractText(buffer, filename);
  const docId = crypto.randomUUID();
  const truncatedText = extractedText.slice(0, 200000);

  const docMeta = {
    id: docId,
    name: filename,
    type: ext.replace('.', ''),
    size: buffer.byteLength || buffer.length,
    uploadedAt: new Date().toISOString(),
    status: extractedText.startsWith('[Error') ? 'error' : 'extracted',
    category: categorizeDocument(filename || ''),
  };

  // Persist extracted text to Redis (separate key per doc)
  if (redis) {
    try {
      await redis.set(`deal:${dealId}:doc:${docId}`, truncatedText);
    } catch (redisErr) {
      console.error('Redis doc text write error:', redisErr);
    }
  }

  return { docMeta, truncatedText };
}

/**
 * Register a file without extraction — just store metadata in Redis.
 * Returns { docMeta }.
 */
export function registerFile(filename, fileSize) {
  const ext = path.extname(filename || '').toLowerCase();
  const docId = crypto.randomUUID();

  const docMeta = {
    id: docId,
    name: filename,
    type: ext.replace('.', ''),
    size: fileSize || 0,
    uploadedAt: new Date().toISOString(),
    status: 'pending',
    category: categorizeDocument(filename || ''),
  };

  return { docMeta };
}

/**
 * After processing files, update the deal in Redis with new document metadata.
 */
export async function appendDocsToDeal(dealId, docMetas, redis) {
  if (!redis) return;
  try {
    const raw = await redis.get(`deal:${dealId}`);
    if (raw) {
      const deal = typeof raw === 'string' ? JSON.parse(raw) : raw;
      deal.documents = [...(deal.documents || []), ...docMetas];
      deal.updatedAt = new Date().toISOString();
      await redis.set(`deal:${dealId}`, JSON.stringify(deal));
    }
  } catch (redisErr) {
    console.error('Redis deal update error:', redisErr);
  }
}
