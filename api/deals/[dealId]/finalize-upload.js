import { put, del } from '@vercel/blob';
import { redis } from '../../lib/redis.js';
import { registerFile, appendDocsToDeal } from '../../lib/extract.js';

/**
 * Assembles chunked upload: downloads temp blobs, concatenates them,
 * stores the final file as a single blob, cleans up temps, and registers
 * the document in Redis.
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

    // 3. Store final blob
    const pathname = `deals/${dealId}/${Date.now()}-${fileName}`;
    const finalBlob = await put(pathname, finalBuffer, {
      token,
      access: 'private',
      contentType: contentType || 'application/octet-stream',
      addRandomSuffix: false,
    });

    console.log(`finalize-upload: stored final blob → ${finalBlob.url}`);

    // 4. Delete temp blobs (fire-and-forget, don't block response)
    del(tempUrls, { token }).catch((err) =>
      console.error('finalize-upload: temp cleanup error:', err)
    );

    // 5. Register document in Redis
    const { docMeta } = registerFile(fileName, fileSize);

    if (redis) {
      await redis.set(`deal:${dealId}:blob:${docMeta.id}`, finalBlob.url);
    }

    await appendDocsToDeal(dealId, [docMeta], redis);

    res.json({
      documents: [{
        ...docMeta,
        extractedText: '',
        blobUrl: finalBlob.url,
      }],
    });
  } catch (err) {
    console.error('finalize-upload error:', err);
    res.status(500).json({ error: err.message || 'Finalize upload failed' });
  }
}
