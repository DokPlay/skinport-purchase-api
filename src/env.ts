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

// Ensure we only reach trusted hosts over TLS to prevent SSRF to arbitrary internal endpoints.
const strictHttpsUrl = (value: string | undefined, name: string, fallback: string, allowedHost: string): string => {
  const raw = required(value, name, fallback);

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use https`);
  }

  if (parsed.hostname !== allowedHost) {
    throw new Error(`${name} must point to ${allowedHost}`);
  }

  return parsed.toString();
};

const positiveInteger = (value: string | undefined, name: string, fallback: string): number => {
  const parsed = Number.parseInt(required(value, name, fallback), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
};

// Centralised configuration so runtime options are defined in one place.
export const env = {
  port: positiveInteger(process.env.PORT, 'PORT', '3000'),
  skinportApiUrl: strictHttpsUrl(
    process.env.SKINPORT_API_URL,
    'SKINPORT_API_URL',
    'https://api.skinport.com/v1/items',
    'api.skinport.com'
  ),
  redisUrl: required(process.env.REDIS_URL, 'REDIS_URL', 'redis://localhost:6379'),
  databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/skinport'),
  cacheTtlSeconds: positiveInteger(process.env.ITEM_CACHE_TTL, 'ITEM_CACHE_TTL', '300')
};
