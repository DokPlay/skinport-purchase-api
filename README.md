# Skinport Purchase API

Simple Fastify server in TypeScript that exposes two endpoints:

1. **GET `/items`** — Fetches Skinport items, returns the minimal tradable and non-tradable prices for each item, and caches the response in Redis.
2. **POST `/purchase`** — Processes a purchase of a product from the local database, records the purchase, and returns the updated user balance.

## Requirements

- Node.js 18+
- PostgreSQL
- Redis

## Getting started

Install dependencies:

```bash
npm install
```

Create an `.env` file (optional, defaults are provided, see `.env.example`):

```
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/skinport
REDIS_URL=redis://localhost:6379
SKINPORT_API_URL=https://api.skinport.com/v1/items
ITEM_CACHE_TTL=300
# Demo tokens mapped to user IDs for purchase authentication
USER_API_KEYS=demo_token:1,collector_token:2
```

> **Security note:** `SKINPORT_API_URL` must be an `https://` URL pointing to `api.skinport.com`; other hosts are rejected to avoid
> accidentally proxying requests to untrusted destinations.

You can also start local dependencies with Docker Compose (PostgreSQL + Redis):

```bash
docker compose up -d
```
Use the default credentials from `.env.example`, then apply the schema and seed demo data (the inserts are idempotent thanks to unique constraints on usernames and product names):

```bash
psql "${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/skinport}" -f schema.sql
```

Run the server in development mode:

```bash
npm run dev
```

View interactive API documentation:

```bash
open http://localhost:3000/docs
```

Build and start:

```bash
npm run build
npm start
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
