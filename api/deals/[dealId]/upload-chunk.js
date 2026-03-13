import Busboy from 'busboy';
import { put } from '@vercel/blob';

export const config = {
  api: { bodyParser: false },
};

/**
 * Receives a single binary chunk via multipart/form-data and stores it
 * as a temporary blob in Vercel Blob storage.
 *
 * FormData fields:
 *   chunk     — binary file data (≤ 4 MB)
 *   chunkIndex — "0", "1", "2", ...
 *   uploadId  — unique upload session identifier
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not set' });
  }

  const { dealId } = req.query;

  try {
    const { chunkBuffer, chunkIndex, uploadId } = await parseChunkForm(req);

    const pathname = `tmp/${dealId}/${uploadId}/${chunkIndex}`;
    const blob = await put(pathname, chunkBuffer, {
      token,
      access: 'private',
      addRandomSuffix: false,
    });

    console.log(`upload-chunk: stored chunk ${chunkIndex} (${chunkBuffer.length} bytes) → ${blob.url}`);

    res.json({ tempUrl: blob.url, chunkIndex: Number(chunkIndex) });
  } catch (err) {
    console.error('upload-chunk error:', err);
    res.status(500).json({ error: err.message || 'Chunk upload failed' });
  }
}

/**
 * Parse multipart/form-data to extract chunk binary + metadata fields.
 */
function parseChunkForm(req) {
  return new Promise((resolve, reject) => {
    let chunkBuffer = null;
    let chunkIndex = '0';
    let uploadId = '';

    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: 5 * 1024 * 1024 },
    });

    busboy.on('file', (_fieldname, stream) => {
      const chunks = [];
      stream.on('data', (d) => chunks.push(d));
      stream.on('end', () => {
        chunkBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('field', (name, val) => {
      if (name === 'chunkIndex') chunkIndex = val;
      if (name === 'uploadId') uploadId = val;
    });

    busboy.on('finish', () => {
      if (!chunkBuffer) return reject(new Error('No chunk data received'));
      if (!uploadId) return reject(new Error('uploadId is required'));
      resolve({ chunkBuffer, chunkIndex, uploadId });
    });

    busboy.on('error', reject);

    // Vercel pre-buffers the body; local Express streams it
    if (req.body && Buffer.isBuffer(req.body)) {
      busboy.end(req.body);
    } else if (req.body && typeof req.body === 'string') {
      busboy.end(Buffer.from(req.body));
    } else {
      req.pipe(busboy);
    }
  });
}
