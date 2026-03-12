import { redis } from '../../lib/redis.js';

export default async function handler(req, res) {
  if (!redis) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  const { dealId } = req.query;

  // GET — single deal (documents have extractedText: null)
  if (req.method === 'GET') {
    try {
      const raw = await redis.get(`deal:${dealId}`);
      if (!raw) return res.status(404).json({ error: 'Deal not found' });

      const deal = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // Strip extractedText from documents to keep response small
      if (deal.documents) {
        deal.documents = deal.documents.map((d) => ({
          ...d,
          extractedText: null,
        }));
      }

      res.json({ deal });
    } catch (err) {
      console.error('Get deal error:', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // PUT — update deal
  if (req.method === 'PUT') {
    try {
      const raw = await redis.get(`deal:${dealId}`);
      if (!raw) return res.status(404).json({ error: 'Deal not found' });

      const existing = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const updates = req.body;

      const merged = {
        ...existing,
        ...updates,
        id: dealId, // never change ID
        updatedAt: new Date().toISOString(),
      };

      await redis.set(`deal:${dealId}`, JSON.stringify(merged));

      // Strip extractedText for response
      if (merged.documents) {
        merged.documents = merged.documents.map((d) => ({
          ...d,
          extractedText: null,
        }));
      }

      res.json({ deal: merged });
    } catch (err) {
      console.error('Update deal error:', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // DELETE — remove deal + doc texts
  if (req.method === 'DELETE') {
    try {
      const raw = await redis.get(`deal:${dealId}`);
      if (raw) {
        const deal = typeof raw === 'string' ? JSON.parse(raw) : raw;
        // Delete doc text keys
        const docKeys = (deal.documents || []).map(
          (d) => `deal:${dealId}:doc:${d.id}`
        );
        if (docKeys.length > 0) {
          await redis.del(...docKeys);
        }
      }

      // Remove deal key + update ID list
      const ids = (await redis.get('deal-ids')) || [];
      const filtered = ids.filter((id) => id !== dealId);

      await Promise.all([
        redis.del(`deal:${dealId}`),
        redis.set('deal-ids', JSON.stringify(filtered)),
      ]);

      res.json({ ok: true });
    } catch (err) {
      console.error('Delete deal error:', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
