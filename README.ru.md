# Skinport Purchase API (Русская версия)

[English version](./README.md)

Компактный сервис на Fastify и strict TypeScript с двумя ключевыми эндпоинтами:

- **GET `/items`** — получает предметы Skinport с дефолтными `app_id`/`currency`, возвращает минимальные цены для трейдабельных и нетрейдабельных вариантов и кеширует результат в Redis.
- **POST `/purchase`** — проводит транзакционную покупку из локальной базы, фиксирует её и возвращает обновлённый баланс пользователя.

## Требования

- Node.js 20+
- PostgreSQL
- Redis

## Быстрый запуск

1. Установите зависимости.

   CMD

   ```bash
   npm install
   ```

2. Скопируйте `.env.example` в `.env` (значения подходят для локального демо) и при необходимости измените:

   ```bash
   PORT=3000
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/skinport
   REDIS_URL=redis://localhost:6379
   SKINPORT_API_URL=https://api.skinport.com/v1/items
   SKINPORT_USER_AGENT=skinport-purchase-api/1.0 (+https://github.com/user/skinport-purchase-api)
   USE_SKINPORT_FALLBACK=true
   ITEM_CACHE_TTL=300
   USER_API_KEYS=
   ```

> **Безопасность:** `SKINPORT_API_URL` должен указывать на `https://api.skinport.com/v1/items`; другие хосты отклоняются, чтобы не проксировать запросы на непроверённые адреса.

> **Оффлайн:** если `USE_SKINPORT_FALLBACK` стоит в `true` (по умолчанию), при ошибке запроса к Skinport API вернутся встроенные демонстрационные цены — удобно для CI и сетей с блокировками.

3. Запустите PostgreSQL и Redis.

   CMD

   ```bash
   docker compose up -d
   ```

4. Накатите схему и демо-данные (идемпотентно благодаря уникальным ограничениям на пользователей и товары).

   CMD

   ```bash
   docker compose exec -T postgres psql -U postgres -d skinport < schema.sql
   ```

   **Windows (PowerShell):**

   ```powershell
   Get-Content .\schema.sql | docker compose exec -T postgres psql -U postgres -d skinport
   ```

5. Запустите API в режиме разработки.

   CMD

   ```bash
   npm run dev
   ```

   Документация: http://localhost:3000/docs

6. Соберите и запустите продакшен (не запускайте одновременно с dev).

   CMD

   ```bash
   npm run build
   npm start
   ```

## Как обращаться к Skinport API

Для `/v1/items` обязательно отправляйте `Accept-Encoding: br`, иначе будет ответ `406 not_acceptable`. Пример запроса на Node:

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

> **Совет:** Старые сборки cURL (особенно на Windows) могут не поддерживать Brotli. Используйте Node 20+ или cURL с поддержкой Brotli (`--compressed` + `-H "Accept-Encoding: br"`).

## Эндпоинты

### `GET /items`
Возвращает минимальные цены для трейдабельных и нетрейдабельных предметов Skinport. Ответ кешируется в Redis на `ITEM_CACHE_TTL` секунд.

### `POST /purchase`
Заголовок:

- `Authorization: Bearer <token>` — токены перечислены в `USER_API_KEYS` и сопоставляются с пользователями.

Тело запроса:

```json
{ "productId": 2 }
```

Эндпоинт проводит транзакцию покупки, списывает стоимость с баланса пользователя, сохраняет запись и возвращает обновлённый баланс.
