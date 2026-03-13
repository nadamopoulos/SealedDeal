import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import XLSX from 'xlsx';

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

function extractXlsx(buffer, filename) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const parts = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rows.length) continue;

      parts.push(`\n=== Sheet: ${sheetName} ===`);

      for (let i = 0; i < Math.min(rows.length, 5000); i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const cells = row.map((cell) => {
          if (cell instanceof Date) return cell.toISOString().split('T')[0];
          if (cell === null || cell === undefined) return '';
          return String(cell);
        });
        if (cells.every((c) => c.trim() === '')) continue;
        parts.push(cells.join('\t'));
      }

      if (rows.length > 5000) {
        parts.push(`... (${rows.length - 5000} more rows truncated)`);
      }
    }

    const text = parts.join('\n');
    if (text.trim().length < 20) {
      return `[Error: Spreadsheet "${filename}" appears empty or contains only formatting]`;
    }
    return text;
  } catch (err) {
    console.error(`XLSX extraction failed for ${filename}:`, err);
    return `[Error extracting spreadsheet ${filename}: ${err.message}]`;
  }
}

// ─── DOCX extraction via mammoth ────────────────────────────

async function extractDocx(buffer, filename) {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    const text = (result.value || '').trim();
    if (text.length < 10) {
      return `[Error: Document "${filename}" appears empty]`;
    }
    return text;
  } catch (err) {
    console.error(`DOCX extraction failed for ${filename}:`, err);
    return `[Error extracting document ${filename}: ${err.message}]`;
  }
}

// ─── PDF extraction via unpdf (fast, local, ESM-native) ─────

async function extractPdf(buffer, filename) {
  try {
    const { extractText: pdfExtract } = await import('unpdf');
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const { text: pages, totalPages } = await pdfExtract(uint8);

    // pages is an array of strings, one per page
    const text = (Array.isArray(pages) ? pages.join('\n\n') : String(pages)).trim();

    console.log(`unpdf for "${filename}": ${text.length} chars, ${totalPages} pages`);

    if (text.length < 50) {
      // Very little text — might be a scanned/image-heavy PDF
      console.log(`"${filename}" has very little text (${text.length} chars), trying Claude OCR fallback...`);
      return extractPdfWithClaude(buffer, filename);
    }

    return text;
  } catch (err) {
    console.error(`unpdf failed for ${filename}:`, err.message);
    // Fall back to Claude API
    console.log(`Falling back to Claude API for "${filename}"...`);
    return extractPdfWithClaude(buffer, filename);
  }
}

/** Claude OCR fallback — only for scanned/image PDFs where pdf-parse finds no text */
const MAX_CLAUDE_FILE_SIZE = 25 * 1024 * 1024;

async function extractPdfWithClaude(buffer, filename) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return `[Cannot extract text from ${filename}: ANTHROPIC_API_KEY not configured]`;
  }

  if (buffer.length > MAX_CLAUDE_FILE_SIZE) {
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
    return `[File "${filename}" is ${sizeMB} MB — too large for OCR extraction. Max: 25 MB.]`;
  }

  try {
    const client = new Anthropic({ apiKey });
    const base64 = Buffer.from(buffer).toString('base64');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 64000,
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
              text: `Extract ALL text content from this PDF "${filename}". Include headings, body text, tables, captions, footnotes, headers, footers, page numbers, chart labels, and any text in images or diagrams. For tables, use tab-separated values. Preserve all numbers, percentages, and currency values exactly. Output ONLY the extracted text, no commentary.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.text || '';
    console.log(`Claude OCR fallback for "${filename}": ${text.length} chars`);
    return text;
  } catch (err) {
    console.error(`Claude OCR fallback failed for ${filename}:`, err.message);
    return `[Error extracting ${filename}: ${err.message}]`;
  }
}

// ─── Main extraction entry point ────────────────────────────

/**
 * Extract text from a file buffer.
 * - TXT/CSV/MD: direct read
 * - XLSX/XLS: SheetJS library (local, fast, reliable)
 * - DOCX: mammoth library (local)
 * - PDF: Claude document API (handles scanned/image PDFs)
 */
export async function extractText(buffer, filename) {
  const ext = path.extname(filename || '').toLowerCase();

  // Plain text — direct read
  if (ext === '.txt' || ext === '.csv' || ext === '.md') {
    return Buffer.from(buffer).toString('utf-8');
  }

  // Spreadsheets — SheetJS (Claude API doesn't support XLSX)
  if (ext === '.xlsx' || ext === '.xls') {
    return extractXlsx(buffer, filename);
  }

  // Word docs — mammoth
  if (ext === '.docx') {
    return extractDocx(buffer, filename);
  }

  // PDFs — pdf-parse (fast, local) with Claude OCR fallback for scanned docs
  if (ext === '.pdf') {
    return extractPdf(buffer, filename);
  }

  return `[Error: Unsupported file type: ${ext}]`;
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
    status: /^\[(Error|Cannot|File ")/.test(extractedText) ? 'error' : 'extracted',
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
