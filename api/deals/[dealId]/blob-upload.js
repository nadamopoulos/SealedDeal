// Bypass handleUpload abstraction — generate client tokens directly.
// handleUpload has issues with Vercel serverless request objects and
// callback URLs. Manual token generation is simpler and more reliable.
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set');
    return res.status(500).json({
      error: 'Blob storage not configured. Set BLOB_READ_WRITE_TOKEN.',
    });
  }

  try {
    const { type, payload } = req.body || {};

    console.log('blob-upload: event type:', type, 'pathname:', payload?.pathname, 'multipart:', payload?.multipart);

    // The @vercel/blob/client upload() sends two event types to this endpoint:
    // 1. "blob.generate-client-token" — needs a signed client token to upload
    // 2. "blob.upload-completed"      — notification that upload finished

    if (type === 'blob.generate-client-token') {
      const { pathname, multipart } = payload || {};

      // Default validUntil is only 30 seconds — way too short for large
      // file uploads. Set to 1 hour from now.
      const validUntil = Date.now() + 60 * 60 * 1000;

      const clientToken = await generateClientTokenFromReadWriteToken({
        token: process.env.BLOB_READ_WRITE_TOKEN,
        pathname,
        maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
        validUntil,
        multipart: multipart || false,
      });

      // Return the Blob API URL so the client can upload directly.
      // Vercel auto-sets VERCEL_BLOB_API_URL; fallback to public default.
      const apiUrl = process.env.VERCEL_BLOB_API_URL || 'https://vercel.com/api/blob';

      console.log('blob-upload: generated token for', pathname, 'apiUrl:', apiUrl);
      return res.json({ type, clientToken, apiUrl });
    }

    if (type === 'blob.upload-completed') {
      // Acknowledge immediately — actual processing happens via process-blob
      return res.json({ type, response: 'ok' });
    }

    console.error('blob-upload: unknown event type:', type, 'body:', JSON.stringify(req.body).slice(0, 200));
    return res.status(400).json({ error: `Unknown event type: ${type}` });
  } catch (err) {
    console.error('Blob upload error:', err);
    res.status(500).json({ error: err.message || 'Blob upload failed' });
  }
}
