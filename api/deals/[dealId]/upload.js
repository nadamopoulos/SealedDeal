import Busboy from 'busboy';
import path from 'path';

function categorizeDocument(filename) {
  const name = filename.toLowerCase();
  if (/financ|p&l|income|balance|cash.?flow|revenue|ebitda|budget|audit|tax|valuation|model/i.test(name))
    return 'financial';
  if (/legal|contract|agreement|compliance|regulat|license|patent|litigation|ip\b|trademark/i.test(name))
    return 'legal';
  if (/operat|process|supply|logistics|inventory|manufacturing|quality|kpi|sop|franchise.?agreement/i.test(name))
    return 'operational';
  if (/market|industry|compet|landscape|benchmark|customer|segment|tam|sam|research|trend/i.test(name))
    return 'market';
  if (/manage|team|org|executive|board|leadership|cv|resume|bio|compensation|hiring/i.test(name))
    return 'management';
  return 'other';
}

/**
 * Parse multipart form data into in-memory file buffers.
 * Works with both Vercel (pre-buffered body) and local Express (stream).
 */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const files = [];
    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: 50 * 1024 * 1024 },
    });

    busboy.on('file', (fieldname, stream, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        files.push({
          fieldname,
          filename,
          mimeType,
          buffer: Buffer.concat(chunks),
        });
      });
    });

    busboy.on('finish', () => resolve(files));
    busboy.on('error', (err) => reject(err));

    // Vercel pre-buffers the body — if req.body is a Buffer, write it directly.
    // Otherwise (local Express), pipe the stream.
    if (req.body && Buffer.isBuffer(req.body)) {
      busboy.end(req.body);
    } else if (req.body && typeof req.body === 'string') {
      busboy.end(Buffer.from(req.body));
    } else {
      req.pipe(busboy);
    }
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const files = await parseMultipart(req);
    const results = [];

    for (const file of files) {
      let extractedText = '';
      const ext = path.extname(file.filename || '').toLowerCase();

      try {
        if (ext === '.pdf') {
          const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
          const uint8 = new Uint8Array(file.buffer);
          const doc = await getDocument({ data: uint8 }).promise;
          const textParts = [];
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item) => item.str).join(' ');
            textParts.push(`[Page ${i}] ${pageText}`);
          }
          extractedText = textParts.join('\n\n');
          doc.destroy();
        } else if (ext === '.docx') {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          extractedText = result.value;
        } else if (ext === '.txt' || ext === '.csv' || ext === '.md') {
          extractedText = file.buffer.toString('utf-8');
        } else if (ext === '.xlsx' || ext === '.xls') {
          extractedText = `[Spreadsheet file: ${file.filename} - Please note: spreadsheet data extraction is limited. For best results, export key sheets as CSV.]`;
        } else {
          extractedText = `[Unsupported file type: ${ext}. Supported: PDF, DOCX, TXT, CSV, MD]`;
        }
      } catch (parseErr) {
        extractedText = `[Error extracting text from ${file.filename}: ${parseErr.message}]`;
      }

      results.push({
        id: crypto.randomUUID(),
        name: file.filename,
        type: ext.replace('.', ''),
        size: file.buffer.length,
        extractedText: extractedText.slice(0, 200000),
        status: extractedText.startsWith('[Error') ? 'error' : 'extracted',
        category: categorizeDocument(file.filename || ''),
      });
    }

    res.json({ documents: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload processing failed' });
  }
}
