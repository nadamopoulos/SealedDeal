// IMPORTANT: handleUpload is exported from @vercel/blob/client (NOT @vercel/blob)
import { handleUpload } from '@vercel/blob/client';

// Do NOT disable bodyParser — Vercel auto-parses JSON and we need req.body

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Fail fast if Blob storage is not configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set — add Vercel Blob storage to the project');
    return res.status(500).json({
      error: 'Blob storage not configured. Add Vercel Blob to the project and set BLOB_READ_WRITE_TOKEN.',
    });
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/msword',
            'text/plain',
            'text/csv',
            'text/markdown',
            'application/octet-stream',
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
          tokenPayload: JSON.stringify({
            dealId: req.query.dealId,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Blob upload finished. Processing happens via a separate call to process-blob.
        console.log('Blob upload completed:', blob.pathname, 'size:', blob.size);
      },
    });

    res.json(jsonResponse);
  } catch (err) {
    console.error('Blob upload error:', err);
    res.status(400).json({ error: err.message || 'Blob upload failed' });
  }
}
