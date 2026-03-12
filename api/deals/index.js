import { redis } from '../lib/redis.js';

export default async function handler(req, res) {
  if (!redis) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  // GET — list all deals
  if (req.method === 'GET') {
    try {
      const ids = (await redis.get('deal-ids')) || [];
      if (ids.length === 0) return res.json({ deals: [] });

      // Batch-read all deals
      const keys = ids.map((id) => `deal:${id}`);
      const raw = await redis.mget(...keys);

      const deals = raw
        .filter(Boolean)
        .map((d) => (typeof d === 'string' ? JSON.parse(d) : d));

      res.json({ deals });
    } catch (err) {
      console.error('List deals error:', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // POST — create deal
  if (req.method === 'POST') {
    try {
      const { name, company, industry, dealSize, geography, stage } = req.body;
      if (!name || !company) {
        return res.status(400).json({ error: 'name and company required' });
      }

      const deal = {
        id: crypto.randomUUID(),
        name,
        company,
        industry: industry || '',
        dealSize: dealSize || '',
        geography: geography || '',
        stage: stage || 'screening',
        status: 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documents: [],
        analysis: null,
        scoreHistory: [],
        summaryEdits: null,
      };

      // Store deal + update ID list
      const ids = (await redis.get('deal-ids')) || [];
      ids.unshift(deal.id);

      await Promise.all([
        redis.set(`deal:${deal.id}`, JSON.stringify(deal)),
        redis.set('deal-ids', JSON.stringify(ids)),
      ]);

      res.json({ deal });
    } catch (err) {
      console.error('Create deal error:', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
