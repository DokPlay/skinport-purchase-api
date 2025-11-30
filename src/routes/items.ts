import { FastifyInstance } from 'fastify';
import type { RedisClientType } from 'redis';
import { env } from '../env.js';
import { getRedisClient } from '../redisClient.js';

interface SkinportItem {
  market_hash_name: string;
  min_price: number;
  tradable: boolean;
}

export interface ItemPriceSummary {
  marketHashName: string;
  tradableMinPrice: number | null;
  nonTradableMinPrice: number | null;
}

const ITEMS_CACHE_KEY = 'items:min-prices';
const SKINPORT_FETCH_TIMEOUT_MS = 10_000;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

// Validate and normalise the Skinport response before aggregating it.
const normalizeItems = (payload: unknown): SkinportItem[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  const items: SkinportItem[] = [];

  for (const entry of payload) {
    if (entry === null || typeof entry !== 'object') {
      continue;
    }

    const { market_hash_name, min_price, tradable } = entry as Partial<SkinportItem> & Record<string, unknown>;

    if (typeof market_hash_name !== 'string' || !isFiniteNumber(min_price) || typeof tradable !== 'boolean') {
      continue;
    }

    items.push({
      market_hash_name,
      min_price,
      tradable
    });
  }

  return items;
};

// Build a per-market-hash summary of tradable/non-tradable minimum prices.
const aggregatePrices = (items: SkinportItem[]): ItemPriceSummary[] => {
  const map = new Map<string, ItemPriceSummary>();

  for (const item of items) {
    const existing = map.get(item.market_hash_name) ?? {
      marketHashName: item.market_hash_name,
      tradableMinPrice: null,
      nonTradableMinPrice: null
    };

    if (item.tradable) {
      if (existing.tradableMinPrice === null || item.min_price < existing.tradableMinPrice) {
        existing.tradableMinPrice = item.min_price;
      }
    } else {
      if (existing.nonTradableMinPrice === null || item.min_price < existing.nonTradableMinPrice) {
        existing.nonTradableMinPrice = item.min_price;
      }
    }

    map.set(item.market_hash_name, existing);
  }

  return Array.from(map.values());
};

// Fetch item prices from Skinport and return a normalised summary.
const fetchItemPrices = async (): Promise<ItemPriceSummary[]> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SKINPORT_FETCH_TIMEOUT_MS);

  const url = `${env.skinportApiUrl}?app_id=730&currency=EUR`;
  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Skinport API responded with ${response.status}`);
    }

    const payload = await response.json();
    const items = normalizeItems(payload);

    if (items.length === 0) {
      throw new Error('No valid items returned from Skinport API');
    }

    return aggregatePrices(items);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Skinport API request timed out');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

// Expose an endpoint to read cached item prices, falling back to live API data when needed.
export const registerItemRoutes = async (fastify: FastifyInstance): Promise<void> => {
  let redis: RedisClientType | null = null;

  try {
    redis = await getRedisClient();
  } catch (error) {
    fastify.log.warn({ err: error }, 'Redis unavailable; continuing without cache');
  }

  fastify.get('/items', async (request, reply) => {
    let cachedItems: ItemPriceSummary[] | null = null;

    try {
      const cached = await redis?.get(ITEMS_CACHE_KEY);

      if (cached) {
        cachedItems = JSON.parse(cached) as ItemPriceSummary[];
      }
    } catch (error) {
      fastify.log.warn({ err: error }, 'Failed to read from Redis cache');
    }

    if (cachedItems) {
      return cachedItems;
    }

    try {
      const items = await fetchItemPrices();

      if (redis) {
        try {
          await redis.set(ITEMS_CACHE_KEY, JSON.stringify(items), {
            EX: env.cacheTtlSeconds
          });
        } catch (error) {
          fastify.log.warn({ err: error }, 'Failed to write items to Redis cache');
        }
      }

      return items;
    } catch (error) {
      fastify.log.error(error);
      reply.status(502);
      return { error: 'Unable to fetch item prices' };
    }
  });
};
