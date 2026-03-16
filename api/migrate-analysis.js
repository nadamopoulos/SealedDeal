/**
 * One-time migration: extract embedded analysis from deal JSON
 * into a separate Redis key `deal:{id}:analysis`.
 *
 * This fixes deals where the combined deal+analysis JSON exceeded
 * Redis value size limits, causing corrupt JSON.
 *
 * GET /api/migrate-analysis
 */
import { redis } from './lib/redis.js';

export default async function handler(req, res) {
  if (!redis) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  try {
    const ids = (await redis.get('deal-ids')) || [];
    const results = [];

    for (const id of ids) {
      const raw = await redis.get(`deal:${id}`);
      if (!raw) {
        results.push({ id, status: 'not_found' });
        continue;
      }

      let deal;
      try {
        deal = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (parseErr) {
        results.push({ id, status: 'corrupt_json', error: parseErr.message });
        continue;
      }

      if (deal.analysis) {
        const analysis = deal.analysis;
        delete deal.analysis;

        await Promise.all([
          redis.set(`deal:${id}`, JSON.stringify(deal)),
          redis.set(`deal:${id}:analysis`, JSON.stringify(analysis)),
        ]);

        results.push({
          id,
          status: 'migrated',
          dealSize: JSON.stringify(deal).length,
          analysisSize: JSON.stringify(analysis).length,
        });
      } else {
        // Check if already has separate analysis
        const hasAnalysis = await redis.get(`deal:${id}:analysis`);
        results.push({
          id,
          status: hasAnalysis ? 'already_separated' : 'no_analysis',
          dealSize: typeof raw === 'string' ? raw.length : JSON.stringify(raw).length,
        });
      }
    }

    res.json({ migrated: results });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ error: err.message });
  }
}
