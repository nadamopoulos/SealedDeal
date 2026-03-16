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

      let deal;
      try {
        deal = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (parseErr) {
        console.error(`Corrupt deal JSON for ${dealId}, attempting recovery...`);
        // If deal JSON is corrupt, return a minimal deal so the UI doesn't break
        return res.json({
          deal: {
            id: dealId,
            name: 'Unknown (data corrupted)',
            company: '',
            industry: '',
            dealSize: '',
            geography: '',
            stage: 'screening',
            documents: [],
            analysis: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _corrupt: true,
          },
        });
      }

      // Strip extractedText from documents to keep response small
      if (deal.documents) {
        deal.documents = deal.documents.map((d) => ({
          ...d,
          extractedText: null,
        }));
      }

      // Load analysis from separate key if not embedded in deal
      if (!deal.analysis) {
        try {
          const analysisRaw = await redis.get(`deal:${dealId}:analysis`);
          if (analysisRaw) {
            deal.analysis = typeof analysisRaw === 'string' ? JSON.parse(analysisRaw) : analysisRaw;
          }
        } catch (analysisErr) {
          console.error(`Failed to load analysis for ${dealId}:`, analysisErr);
          // Continue without analysis
        }
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

      // If updates include analysis, store separately
      if (updates.analysis) {
        await redis.set(`deal:${dealId}:analysis`, JSON.stringify(updates.analysis));
        delete updates.analysis;
      }

      const merged = {
        ...existing,
        ...updates,
        id: dealId, // never change ID
        updatedAt: new Date().toISOString(),
      };

      // Remove embedded analysis before saving deal (keep it in separate key)
      const { analysis: embeddedAnalysis, ...dealWithoutAnalysis } = merged;
      if (embeddedAnalysis) {
        await redis.set(`deal:${dealId}:analysis`, JSON.stringify(embeddedAnalysis));
      }

      await redis.set(`deal:${dealId}`, JSON.stringify(dealWithoutAnalysis));

      // Strip extractedText for response
      if (merged.documents) {
        merged.documents = merged.documents.map((d) => ({
          ...d,
          extractedText: null,
        }));
      }

      // Re-attach analysis for response
      merged.analysis = embeddedAnalysis || null;
      try {
        const analysisRaw = await redis.get(`deal:${dealId}:analysis`);
        if (analysisRaw) {
          merged.analysis = typeof analysisRaw === 'string' ? JSON.parse(analysisRaw) : analysisRaw;
        }
      } catch {}

      res.json({ deal: merged });
    } catch (err) {
      console.error('Update deal error:', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // DELETE — remove deal + doc texts + analysis
  if (req.method === 'DELETE') {
    try {
      let docKeys = [];
      try {
        const raw = await redis.get(`deal:${dealId}`);
        if (raw) {
          const deal = typeof raw === 'string' ? JSON.parse(raw) : raw;
          docKeys = (deal.documents || []).map(
            (d) => `deal:${dealId}:doc:${d.id}`
          );
        }
      } catch {
        // If deal JSON is corrupt, still proceed with deletion
      }

      // Remove deal key, analysis key, doc text keys, and update ID list
      const ids = (await redis.get('deal-ids')) || [];
      const filtered = ids.filter((id) => id !== dealId);

      const keysToDelete = [`deal:${dealId}`, `deal:${dealId}:analysis`, ...docKeys];

      await Promise.all([
        redis.del(...keysToDelete),
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
