import { del } from '@vercel/blob';
import { redis } from '../../lib/redis.js';
import { processFile, appendDocsToDeal } from '../../lib/extract.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { dealId } = req.query;
  const { blobUrl, fileName, fileSize } = req.body;

  if (!blobUrl || !fileName) {
    return res.status(400).json({ error: 'blobUrl and fileName are required' });
  }

  try {
    // Download file from Vercel Blob
    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
      throw new Error(`Failed to download blob: ${blobResponse.status}`);
    }

    const arrayBuffer = await blobResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text and persist to Redis
    const { docMeta, truncatedText } = await processFile(
      buffer,
      fileName,
      dealId,
      redis
    );

    // Override size with the original file size if provided
    if (fileSize) {
      docMeta.size = fileSize;
    }

    // Update deal in Redis
    await appendDocsToDeal(dealId, [docMeta], redis);

    // Delete the blob — we've extracted the text, no need to keep it
    try {
      await del(blobUrl);
    } catch (delErr) {
      console.warn('Failed to delete blob (non-critical):', delErr.message);
    }

    res.json({
      documents: [{
        ...docMeta,
        extractedText: truncatedText,
      }],
    });
  } catch (err) {
    console.error('Process blob error:', err);
    res.status(500).json({ error: err.message || 'Failed to process uploaded file' });
  }
}
