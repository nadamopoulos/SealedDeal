// Server-side chunked multipart upload to Vercel Blob.
// Each request from the client stays under Vercel's 4.5 MB body limit.
// The server uses @vercel/blob's server-side API (no CORS issues).
import {
  createMultipartUpload,
  uploadPart,
  completeMultipartUpload,
} from '@vercel/blob';

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not set' });
  }

  try {
    const { action } = req.body;

    // ── 1. Initiate multipart upload ──────────────────────────
    if (action === 'create') {
      const { pathname, contentType } = req.body;
      const result = await createMultipartUpload(pathname, {
        token,
        access: 'private',
        contentType: contentType || 'application/octet-stream',
      });
      return res.json({
        uploadId: result.uploadId,
        key: result.key,
      });
    }

    // ── 2. Upload a single part (base64-encoded chunk) ────────
    if (action === 'upload-part') {
      const { uploadId, key, pathname, partNumber, chunkBase64 } = req.body;
      const buffer = Buffer.from(chunkBase64, 'base64');

      const part = await uploadPart(pathname, buffer, {
        token,
        access: 'private',
        uploadId,
        key,
        partNumber,
      });

      return res.json({ partNumber: part.partNumber, etag: part.etag });
    }

    // ── 3. Complete multipart upload ──────────────────────────
    if (action === 'complete') {
      const { uploadId, key, pathname, parts } = req.body;
      const blob = await completeMultipartUpload(pathname, parts, {
        token,
        access: 'private',
        uploadId,
        key,
      });
      return res.json({ url: blob.url, pathname: blob.pathname });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('blob-multipart error:', err);
    res.status(500).json({ error: err.message || 'Multipart upload failed' });
  }
}
