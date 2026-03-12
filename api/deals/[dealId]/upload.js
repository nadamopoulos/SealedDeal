import Busboy from 'busboy';
import { redis } from '../../lib/redis.js';
import { processFile, appendDocsToDeal } from '../../lib/extract.js';

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

  const { dealId } = req.query;

  try {
    const files = await parseMultipart(req);
    const results = [];

    for (const file of files) {
      const { docMeta, truncatedText } = await processFile(
        file.buffer,
        file.filename,
        dealId,
        redis
      );

      results.push({
        ...docMeta,
        extractedText: truncatedText,
      });
    }

    // Update deal in Redis with new document metadata
    const docMetas = results.map(({ extractedText, ...meta }) => meta);
    await appendDocsToDeal(dealId, docMetas, redis);

    res.json({ documents: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload processing failed' });
  }
}
