# Skinport Purchase API (Русская версия)

[English version](./README.md)

Простой сервер на Fastify (TypeScript) с двумя эндпоинтами:

- **GET `/items`** — получает предметы Skinport, возвращает минимальные цены для трейдабельных и нетрейдабельных предметов и кеширует ответ в Redis.
- **POST `/purchase`** — оформляет покупку товара из локальной базы, записывает её и возвращает обновлённый баланс пользователя.

## Требования

- Node.js 18+
- PostgreSQL
- Redis

## Быстрый запуск

1. Установите зависимости:

   CMD

   ```bash
   npm install
   ```

2. Скопируйте `.env.example` в `.env` и при необходимости поправьте значения (подходит для локального демо):

   ```bash
   PORT=3000
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/skinport
   REDIS_URL=redis://localhost:6379
   SKINPORT_API_URL=https://api.skinport.com/v1/items
   ITEM_CACHE_TTL=300
   # Демонстрационные токены, сопоставление токен → userId
   USER_API_KEYS=demo_token:1,collector_token:2
   ```

   > **Аутентификация:** `USER_API_KEYS` — это простое демо-сопоставление Bearer-токенов с userId. Укажите любые пары `токен:userId` для локального теста.
   >
   > **Безопасность:** `SKINPORT_API_URL` должен быть `https://api.skinport.com/v1/items`; другие хосты отклоняются, чтобы не отправлять запросы на непроверенные адреса.

3. Запустите PostgreSQL и Redis:

   CMD

   ```bash
   docker compose up -d
   ```

4. Накатите схему и демо-данные (операции идемпотентны):

   CMD

   ```bash
   docker compose exec -T postgres psql -U postgres -d skinport < schema.sql
   ```

   **Windows (PowerShell):**

   ```powershell
   Get-Content .\schema.sql | docker compose exec -T postgres psql -U postgres -d skinport
   ```

5. Запустите API в режиме разработки:

   CMD

   ```bash
   npm run dev
   ```

   Документация: http://localhost:3000/docs

6. Продакшен-сборка (не запускайте одновременно с dev):

   CMD

   ```bash
   npm run build
   npm start
   ```

## Как обращаться к Skinport API

Для `/v1/items` нужно обязательно отправлять `Accept-Encoding: br`, иначе будет ответ `406 not_acceptable`. Пример запроса на Node:

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

> **Совет:** Старые сборки cURL (особенно на Windows) не умеют Brotli. Используйте Node 18+ или cURL с поддержкой Brotli и ключом `--compressed` + заголовком `-H "Accept-Encoding: br"`.

## Небольшое демо через curl

Используя дефолтный `.env` и сиды, вызовите эндпоинты с демо-ключом (`demo_token` → пользователь `1`). Для `/items` добавьте Brotli.

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
