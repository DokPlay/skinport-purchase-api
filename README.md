# Skinport Purchase API

[Русская версия](./README.ru.md)

Simple Fastify server in TypeScript exposing two endpoints:

- **GET `/items`** — Fetches Skinport items, returns the minimal tradable and non-tradable prices for each item, and caches the response in Redis.
- **POST `/purchase`** — Processes a purchase of a product from the local database, records the purchase, and returns the updated user balance.

## Requirements

- Node.js 18+
- PostgreSQL
- Redis

## Quick start

1. Install dependencies:

   CMD

   ```bash
   npm install
   ```

2. Configure the environment by copying `.env.example` to `.env` (defaults work for local demos):

   ```bash
   PORT=3000
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/skinport
   REDIS_URL=redis://localhost:6379
   SKINPORT_API_URL=https://api.skinport.com/v1/items
   ITEM_CACHE_TTL=300
   # Demo tokens mapped to user IDs for purchase authentication
   USER_API_KEYS=demo_token:1,collector_token:2
   ```

   > **Auth note:** The Bearer token mapping in `USER_API_KEYS` is a simple demo mechanism to authenticate purchases; populate the variable with any `token:userId` pairs you like for local testing.
   >
   > **Security note:** `SKINPORT_API_URL` must be an `https://` URL pointing to `api.skinport.com`; other hosts are rejected to avoid accidentally proxying requests to untrusted destinations.

3. Start dependencies (PostgreSQL + Redis):

   CMD

   ```bash
   docker compose up -d
   ```

4. Apply the schema and seed demo data (inserts are idempotent thanks to unique constraints on usernames and product names):

   CMD

   ```bash
   docker compose exec -T postgres psql -U postgres -d skinport < schema.sql
   ```

   **Windows (PowerShell):**

   ```powershell
   Get-Content .\schema.sql | docker compose exec -T postgres psql -U postgres -d skinport
   ```

5. Run the API (development mode):

   CMD

   ```bash
   npm run dev
   ```

   Interactive API docs: http://localhost:3000/docs

6. Production build (do not run dev and prod servers simultaneously):

   CMD

   ```bash
   npm run build
   npm start
   ```

## Skinport API usage

Skinport requires Brotli compression for the `/v1/items` endpoint. Always send `Accept-Encoding: br` or the API will reply with `406 not_acceptable`. A minimal fetch example:

```ts
const url = new URL('https://api.skinport.com/v1/items');
url.searchParams.set('app_id', '730');
url.searchParams.set('currency', 'EUR');

const response = await fetch(url, {
  method: 'GET',
  headers: {
    'Accept-Encoding': 'br',
    Accept: 'application/json'
  }
});

if (!response.ok) {
  throw new Error(`Skinport API responded with ${response.status}`);
}

const data = await response.json();
```

> **Tip:** Older cURL builds (notably on Windows) may not support Brotli. Use Node 18+ (which supports Brotli by default) or a cURL build with `--compressed` + `-H "Accept-Encoding: br"` on platforms that support it.

## Quick demo with curl

With the default `.env` and seeded data, try the endpoints using the demo API key (`demo_token` maps to user `1`). Be sure to include Brotli compression when hitting `/items`.

CMD

```bash
curl --compressed -H "Accept-Encoding: br" -H "Authorization: Bearer demo_token" http://localhost:3000/items
```

CMD

```bash
curl -X POST \
  -H "Authorization: Bearer demo_token" \
  -H "Content-Type: application/json" \
  -d '{"productId":1}' \
  http://localhost:3000/purchase
```

## Endpoints

### `GET /items`
Returns an array with minimal prices for tradable and non-tradable variants of each Skinport item. Responses are cached in Redis for `ITEM_CACHE_TTL` seconds.

### `POST /purchase`
Headers:

- `Authorization: Bearer <token>` — tokens are configured in `USER_API_KEYS` and mapped to user IDs.

Body:

```json
{ "productId": 2 }
```

Performs a transactional purchase on behalf of the authenticated user, deducts the product price from the user balance, records the purchase, and responds with the updated balance.
