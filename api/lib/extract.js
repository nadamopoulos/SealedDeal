import path from 'path';

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

/**
 * Extract text from a file buffer based on its extension.
 * Returns the extracted text string.
 */
export async function extractText(buffer, filename) {
  const ext = path.extname(filename || '').toLowerCase();
  let extractedText = '';

  try {
    if (ext === '.pdf') {
      // Use pdf-parse v2 (PDFParse class) — properly installed dependency
      const { PDFParse } = await import('pdf-parse');
      const uint8 = new Uint8Array(buffer);
      const parser = new PDFParse({ data: uint8 });
      const result = await parser.getText();
      extractedText = result.text || '';
      await parser.destroy();
    } else if (ext === '.docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      extractedText = result.value;
    } else if (ext === '.txt' || ext === '.csv' || ext === '.md') {
      extractedText = Buffer.from(buffer).toString('utf-8');
    } else if (ext === '.xlsx' || ext === '.xls') {
      extractedText = `[Spreadsheet file: ${filename} - Please note: spreadsheet data extraction is limited. For best results, export key sheets as CSV.]`;
    } else {
      extractedText = `[Unsupported file type: ${ext}. Supported: PDF, DOCX, TXT, CSV, MD]`;
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
