import formidable from 'formidable';
import fs from 'fs';
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      multiples: true,
      maxFileSize: 50 * 1024 * 1024,
      uploadDir: '/tmp',
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    const uploadedFiles = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];
    const results = [];

    for (const file of uploadedFiles) {
      let extractedText = '';
      const ext = path.extname(file.originalFilename || '').toLowerCase();

      try {
        if (ext === '.pdf') {
          const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
          const dataBuffer = fs.readFileSync(file.filepath);
          const uint8 = new Uint8Array(dataBuffer);
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
          const dataBuffer = fs.readFileSync(file.filepath);
          const result = await mammoth.extractRawText({ buffer: dataBuffer });
          extractedText = result.value;
        } else if (ext === '.txt' || ext === '.csv' || ext === '.md') {
          extractedText = fs.readFileSync(file.filepath, 'utf-8');
        } else if (ext === '.xlsx' || ext === '.xls') {
          extractedText = `[Spreadsheet file: ${file.originalFilename} - Please note: spreadsheet data extraction is limited. For best results, export key sheets as CSV.]`;
        } else {
          extractedText = `[Unsupported file type: ${ext}. Supported: PDF, DOCX, TXT, CSV, MD]`;
        }
      } catch (parseErr) {
        extractedText = `[Error extracting text from ${file.originalFilename}: ${parseErr.message}]`;
      }

      // Clean up temp file
      try { fs.unlinkSync(file.filepath); } catch {}

      results.push({
        id: crypto.randomUUID(),
        name: file.originalFilename,
        type: ext.replace('.', ''),
        size: file.size,
        extractedText: extractedText.slice(0, 200000),
        status: extractedText.startsWith('[Error') ? 'error' : 'extracted',
        category: categorizeDocument(file.originalFilename || ''),
      });
    }

    res.json({ documents: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
}
