import { Redis } from '@upstash/redis';

// Support both Vercel KV env vars and direct Upstash vars
const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.warn(
    'Redis not configured — set KV_REST_API_URL + KV_REST_API_TOKEN ' +
    '(or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)'
  );
}

export const redis = url && token ? new Redis({ url, token }) : null;
