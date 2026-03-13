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

// ─── MIME type mapping ──────────────────────────────────────

const EXT_TO_MIME = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.md': 'text/plain',
};

// ─── Claude-based extraction ────────────────────────────────

/**
 * Extract text from any file by sending it to Claude as a document.
 * Claude handles PDFs, XLSX, DOCX, and other document formats natively.
 */
/** Max file size to send to Claude (25 MB — base64 expands ~33%, nearing API limits) */
const MAX_CLAUDE_FILE_SIZE = 25 * 1024 * 1024;

async function extractWithClaude(buffer, filename) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return `[Cannot extract text from ${filename}: ANTHROPIC_API_KEY not configured]`;
  }

  if (buffer.length > MAX_CLAUDE_FILE_SIZE) {
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
    console.warn(`Skipping Claude extraction for "${filename}" (${sizeMB} MB exceeds 25 MB limit)`);
    return `[File "${filename}" is ${sizeMB} MB — too large for text extraction. Max supported: 25 MB.]`;
  }

  const ext = path.extname(filename || '').toLowerCase();
  const mediaType = EXT_TO_MIME[ext] || 'application/octet-stream';

  try {
    const client = new Anthropic({ apiKey });
    const base64 = Buffer.from(buffer).toString('base64');

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
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract ALL text content from this document "${filename}". Include every piece of text — headings, body text, tables, captions, footnotes, headers, footers, page numbers, chart labels, and any text in images or diagrams.

For tables and spreadsheets, format them as tab-separated values with clear column headers. Include ALL sheets if this is a spreadsheet.
For financial data, preserve all numbers, percentages, and currency values exactly as shown.
For charts/graphs, describe the data shown including axis labels and values.

Output ONLY the extracted text, no commentary or explanation. Preserve the document's logical structure using headings and line breaks.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.text || '';
    console.log(`Claude extraction for "${filename}": ${text.length} chars`);
    return text;
  } catch (err) {
    console.error(`Claude extraction failed for ${filename}:`, err.message);
    return `[Error extracting ${filename} with Claude: ${err.message}]`;
  }
}

// ─── Main extraction entry point ────────────────────────────

/**
 * Extract text from a file buffer.
 * - Plain text files (TXT, CSV, MD): direct read (no API call needed)
 * - Everything else (PDF, XLSX, XLS, DOCX, etc.): sent to Claude
 */
export async function extractText(buffer, filename) {
  const ext = path.extname(filename || '').toLowerCase();

  // Plain text files — no need for an API call
  if (ext === '.txt' || ext === '.csv' || ext === '.md') {
    return Buffer.from(buffer).toString('utf-8');
  }

  // All other files — send to Claude for extraction
  return extractWithClaude(buffer, filename);
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
