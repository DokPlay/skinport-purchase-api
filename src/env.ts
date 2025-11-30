import dotenv from 'dotenv';

dotenv.config();

// Read an environment variable or fall back to a sensible default.
// Throws when no value is provided and no fallback is defined, making failures explicit on boot.
const required = (value: string | undefined, name: string, fallback?: string): string => {
  if (value && value.trim().length > 0) {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Environment variable ${name} is required`);
};

// Centralised configuration so runtime options are defined in one place.
export const env = {
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  skinportApiUrl: required(process.env.SKINPORT_API_URL, 'SKINPORT_API_URL', 'https://api.skinport.com/v1/items'),
  redisUrl: required(process.env.REDIS_URL, 'REDIS_URL', 'redis://localhost:6379'),
  databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/skinport'),
  cacheTtlSeconds: Number.parseInt(process.env.ITEM_CACHE_TTL ?? '300', 10)
};
