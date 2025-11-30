import { createClient, RedisClientType } from 'redis';
import { env } from './env.js';

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;

// Lazily create and share a Redis client across the process, waiting for the
// connection attempt to complete before handing it to callers so cache operations
// do not fail with a "client is closed" error.
export const getRedisClient = async (): Promise<RedisClientType> => {
  if (!client) {
    client = createClient({ url: env.redisUrl });

    client.on('error', (error) => {
      console.error('Redis client error:', error);
    });

    connectPromise = client.connect();
  }

  try {
    if (connectPromise) {
      await connectPromise;
    }
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }

  return client;
};
