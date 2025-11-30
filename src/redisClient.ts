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

    // Clear the cached client and promise so a subsequent call can retry the
    // connection instead of reusing a rejected promise forever.
    try {
      await client?.quit();
    } catch (quitError) {
      console.error('Failed to close Redis client after connection error:', quitError);
    }

    client = null;
    connectPromise = null;

    throw error;
  }

  return client;
};

export const closeRedisClient = async (): Promise<void> => {
  try {
    await client?.quit();
  } catch (error) {
    console.error('Failed to close Redis client during shutdown:', error);
  } finally {
    client = null;
    connectPromise = null;
  }
};
