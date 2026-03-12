import { handleUpload } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse body manually since bodyParser is disabled
  let body;
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Validate the upload — allow common document types
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
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
          tokenPayload: JSON.stringify({
            dealId: req.query.dealId,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // The blob is uploaded. We'll process it via a separate endpoint call.
        console.log('Blob upload completed:', blob.pathname, 'size:', blob.size);
      },
    });

    res.json(jsonResponse);
  } catch (err) {
    console.error('Blob upload error:', err);
    res.status(400).json({ error: err.message || 'Blob upload failed' });
  }
}
