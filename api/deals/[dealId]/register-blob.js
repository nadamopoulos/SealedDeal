import { redis } from '../../lib/redis.js';
import { registerFile, appendDocsToDeal } from '../../lib/extract.js';

/**
 * Lightweight endpoint: registers a blob-uploaded file in Redis
 * WITHOUT text extraction. Returns immediately with doc metadata.
 * Extraction happens later via process-blob.
 */
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
    const { docMeta } = registerFile(fileName, fileSize);

    // Store blob URL so process-blob can find it later
    if (redis) {
      await redis.set(`deal:${dealId}:blob:${docMeta.id}`, blobUrl);
    }

    // Append doc metadata to deal (status: "pending")
    await appendDocsToDeal(dealId, [docMeta], redis);

    res.json({
      documents: [{
        ...docMeta,
        extractedText: '',
        blobUrl,
      }],
    });
  } catch (err) {
    console.error('Register blob error:', err);
    res.status(500).json({ error: err.message || 'Failed to register upload' });
  }
}
