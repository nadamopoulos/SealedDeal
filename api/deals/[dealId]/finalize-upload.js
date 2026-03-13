import { del } from '@vercel/blob';
import { redis } from '../../lib/redis.js';
import { processFile, appendDocsToDeal } from '../../lib/extract.js';

/**
 * Assembles chunked upload: downloads temp blobs, concatenates them,
 * extracts text via Claude, stores in Redis, and cleans up temps.
 *
 * Body JSON:
 *   tempUrls   — ordered array of temporary blob URLs
 *   fileName   — original file name
 *   fileSize   — original file size in bytes
 *   contentType — MIME type
 *   uploadId   — upload session ID (for logging)
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
  const { tempUrls, fileName, fileSize, contentType, uploadId } = req.body || {};

  if (!tempUrls?.length || !fileName) {
    return res.status(400).json({ error: 'tempUrls and fileName are required' });
  }

  try {
    console.log(`finalize-upload: assembling ${tempUrls.length} chunks for "${fileName}" (${fileSize} bytes)`);

    // 1. Download all temp blobs in parallel (private blobs need auth)
    const chunkBuffers = await Promise.all(
      tempUrls.map(async (url, i) => {
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) {
          throw new Error(`Failed to download chunk ${i}: ${resp.status} ${resp.statusText}`);
        }
        const arrayBuf = await resp.arrayBuffer();
        return Buffer.from(arrayBuf);
      })
    );

    // 2. Concatenate into single buffer
    const finalBuffer = Buffer.concat(chunkBuffers);
    console.log(`finalize-upload: assembled ${finalBuffer.length} bytes`);

    // 3. Delete temp blobs (fire-and-forget, don't block extraction)
    del(tempUrls, { token }).catch((err) =>
      console.error('finalize-upload: temp cleanup error:', err)
    );

    // 4. Extract text directly — we already have the buffer, no need to save+re-download
    const { docMeta, truncatedText } = await processFile(
      finalBuffer,
      fileName,
      dealId,
      redis
    );

    // Override size with the original file size
    if (fileSize) {
      docMeta.size = fileSize;
    }

    // 5. Update deal in Redis
    await appendDocsToDeal(dealId, [docMeta], redis);

    console.log(`finalize-upload: "${fileName}" extracted ${truncatedText.length} chars, status=${docMeta.status}`);

    res.json({
      documents: [{
        ...docMeta,
        extractedText: truncatedText,
      }],
    });
  } catch (err) {
    console.error('finalize-upload error:', err);
    res.status(500).json({ error: err.message || 'Finalize upload failed' });
  }
}
