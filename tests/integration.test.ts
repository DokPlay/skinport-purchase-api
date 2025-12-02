import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import postgres from 'postgres';
import { createClient, RedisClientType } from 'redis';

vi.setConfig({ hookTimeout: 40000 });

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/skinport';

let sql: ReturnType<typeof postgres> | null = null;
let redis: RedisClientType | null = null;

const waitFor = async (fn: () => Promise<boolean>, timeoutMs = 30000, interval = 500) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await fn()) return true;
    } catch (e) {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('timeout waiting for condition');
};

beforeAll(async () => {
  // wait for HTTP server
  await waitFor(async () => {
    try {
      const res = await fetch(`${BASE_URL}/items`, { method: 'GET', headers: { Authorization: 'Bearer demo_token' } });
      return res.ok;
    } catch (e) {
      return false;
    }
  }, 30000);

  // connect to DB and redis
  sql = postgres(DATABASE_URL, { max: 2 });
  redis = createClient({ url: REDIS_URL });
  await redis.connect();
});

afterAll(async () => {
  try {
    await redis?.quit();
  } catch {}
  try {
    await sql?.end({ timeout: 1_000 });
  } catch {}
});

describe('Integration smoke tests', () => {
  it('GET /items returns an array and caches to Redis', async () => {
    const res = await fetch(`${BASE_URL}/items`, { method: 'GET', headers: { Authorization: 'Bearer demo_token' } });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // check redis key exists
    const cached = await redis?.get('items:min-prices');
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached as string);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('POST /purchase performs a transactional purchase and updates DB', async () => {
    // read current balance and product price
      const db = sql!;
      const user = await db`SELECT id, balance FROM users WHERE id = 1`;
      const product = await db`SELECT id, price FROM products WHERE id = 1`;
    expect(user.length).toBeGreaterThan(0);
    expect(product.length).toBeGreaterThan(0);
    const prevBalance = Number(user[0].balance);
    const price = Number(product[0].price);

    const res = await fetch(`${BASE_URL}/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo_token' },
      body: JSON.stringify({ productId: 1 })
    });

    expect(res.ok).toBe(true);
    const payload = await res.json();
    expect(payload).toHaveProperty('userId', 1);
    expect(payload).toHaveProperty('balance');
    const newBalance = Number(payload.balance);
    // balance decreased by approx price (allow small numeric rounding)
    expect(Math.abs(newBalance - (prevBalance - price))).toBeLessThan(0.01);

    // check purchases table has a recent entry
      const purchases = await db`SELECT id FROM purchases WHERE user_id = 1 AND product_id = 1 ORDER BY created_at DESC LIMIT 1`;
    expect(purchases.length).toBeGreaterThan(0);
  });
});
