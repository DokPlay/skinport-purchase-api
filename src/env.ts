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

const booleanFlag = (value: string | undefined, name: string, fallback: string): boolean => {
  const normalized = required(value, name, fallback).trim().toLowerCase();

  if (normalized === 'true' || normalized === '1') {
    return true;
  }

  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  throw new Error(`${name} must be a boolean-like value (true/false)`);
};

const parseApiKeyMappings = (
  value: string | undefined,
  name: string,
  fallback?: string
): Record<string, number> => {
  const raw = required(value, name, fallback);
  const mappings = raw
    .split(',')
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0);

  if (mappings.length === 0) {
    throw new Error(`${name} must contain at least one token:userId mapping`);
  }

  const result: Record<string, number> = {};

  for (const mapping of mappings) {
    const [token, idString] = mapping.split(':').map((value) => value?.trim());

    if (!token || !idString) {
      throw new Error(`${name} entries must be in the form token:userId`);
    }

    const id = Number.parseInt(idString, 10);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error(`${name} userId must be a positive integer`);
    }

    result[token] = id;
  }

  return result;
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
  skinportUserAgent: required(
    process.env.SKINPORT_USER_AGENT,
    'SKINPORT_USER_AGENT',
    // Use a browser-like default user agent to avoid Cloudflare bot challenges when
    // calling the public Skinport endpoint from server-side environments.
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  ),
  redisUrl: required(process.env.REDIS_URL, 'REDIS_URL', 'redis://localhost:6379'),
  databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/skinport'),
  cacheTtlSeconds: positiveInteger(process.env.ITEM_CACHE_TTL, 'ITEM_CACHE_TTL', '300'),
  // Provide a sensible default token for local development so the server
  // can boot without extra configuration while still validating input.
  userApiKeys: parseApiKeyMappings(process.env.USER_API_KEYS, 'USER_API_KEYS', 'demo_token:1'),
  useSkinportFallback: booleanFlag(process.env.USE_SKINPORT_FALLBACK, 'USE_SKINPORT_FALLBACK', 'true')
};
