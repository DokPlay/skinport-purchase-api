# Skinport Purchase API (Русская версия)

[English version](./README.md)

Компактный сервис на Fastify и strict TypeScript с двумя ключевыми эндпоинтами:

- **GET `/items`** — получает предметы Skinport с дефолтными `app_id`/`currency`, возвращает минимальные цены для трейдабельных и нетрейдабельных вариантов и кеширует результат в Redis.
- **POST `/purchase`** — проводит транзакционную покупку из локальной базы, фиксирует её и возвращает обновлённый баланс пользователя.

## Требования

- Node.js 20+
- PostgreSQL
- Redis
### Важно про Skinport API
Публичный эндпоинт `/v1/items` в 2025 году защищён Cloudflare Bot Management + JS-челленджем.  
Даже с полным набором браузерных заголовков запросы с серверной стороны получают 403 + HTML-страницу "Just a moment…".  
Поэтому реализован надёжный fallback на актуальные sample-данные — сервис всегда возвращает 200 и корректный JSON.  
При необходимости в продакшене можно подключить FlareSolverr / headless-браузер или перейти на их будущий платный API.

## Быстрый запуск (PowerShell)

1. Установите зависимости:

   ```powershell
   npm install
   ```

2. Подготовьте переменные окружения (значения подходят для локального демо):

   ```powershell
   Copy-Item .env.example .env
   @'
   PORT=3000
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/skinport
   REDIS_URL=redis://localhost:6379
   SKINPORT_API_URL=https://api.skinport.com/v1/items
   SKINPORT_USER_AGENT=skinport-purchase-api/1.0 (+https://github.com/user/skinport-purchase-api)
   USE_SKINPORT_FALLBACK=true
   ITEM_CACHE_TTL=300
   USER_API_KEYS=demo_token:1
   '@ | Set-Content .env
   ```

> **Безопасность:** `SKINPORT_API_URL` должен указывать на `https://api.skinport.com/v1/items`; другие хосты отклоняются, чтобы не проксировать запросы на непроверённые адреса.

> **Оффлайн:** если `USE_SKINPORT_FALLBACK` стоит в `true` (по умолчанию), при ошибке запроса к Skinport API вернутся встроенные демонстрационные цены — удобно для CI и сетей с блокировками.

3. Запустите PostgreSQL и Redis:

   ```powershell
   docker compose up -d
   ```

4. Накатите схему и демо-данные (идемпотентно благодаря уникальным ограничениям на пользователей и товары):

   ```powershell
   Get-Content .\schema.sql | docker compose exec -T postgres psql -U postgres -d skinport
   ```

5. Запустите API в режиме разработки:

   ```powershell
   npm run dev
   ```

   Документация: http://localhost:3000/docs

6. Соберите и запустите продакшен (не запускайте одновременно с dev):

   ```powershell
    npm run build
    npm start
    ```

## Скрипты настройки окружения для разработки

Добавлены вспомогательные скрипты для автоматизации поднятия зависимостей и применения схемы БД.

- PowerShell: `scripts/setup-dev.ps1`

  Пример использования (PowerShell):

  ```powershell
  # Устанавливает зависимости, запускает контейнеры, применяет схему и запускает dev-сервер
  .\scripts\setup-dev.ps1
  ```

- Кроссплатформенный Node-скрипт: `scripts/setup-dev.js`

  Пример использования (любая оболочка с Node.js):

  ```bash
  node ./scripts/setup-dev.js
  ```

  Node-скрипт делает те же шаги, но работает на Windows, macOS и Linux — использует локальные `docker` и `npm` и стартует dev-сервер в фоновом режиме.


## Тестирование

Запуск юнит-тестов (Redis, Skinport и база подменяются моками, отдельные сервисы не нужны):

```bash
npm test
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

**Готовый пример под PowerShell (используем именно `curl.exe`, чтобы не попасть на алиас `curl` → `Invoke-WebRequest`):**

```powershell
curl.exe --compressed `
  -H "Accept-Encoding: br" `
  -H "Authorization: Bearer demo_token" `
  "http://localhost:3000/items"
```

### `POST /purchase`
Заголовок:

- `Authorization: Bearer <token>` — токены перечислены в `USER_API_KEYS` и сопоставляются с пользователями.

Тело запроса:

```json
{ "productId": 2 }
```

Эндпоинт проводит транзакцию покупки, списывает стоимость с баланса пользователя, сохраняет запись и возвращает обновлённый баланс.

**Готовые примеры под PowerShell:**

- Через `curl.exe` (JSON-тело в одинарных кавычках):

  ```powershell
  curl.exe -X POST `
    -H "Authorization: Bearer demo_token" `
    -H "Content-Type: application/json" `
    -d '{"productId":1}' `
    "http://localhost:3000/purchase"
  ```

- Через `Invoke-RestMethod`, если хочется «по-пауэршелльному» без cURL:

  ```powershell
  Invoke-RestMethod -Method Post -Uri "http://localhost:3000/purchase" `
    -Headers @{ Authorization = "Bearer demo_token" } `
    -ContentType "application/json" `
    -Body '{"productId":1}'
  ```

## POST-запросы в Postman

Настройка примера для `POST /purchase`:

1. Создайте запрос с методом **POST** и URL `http://localhost:3000/purchase`.
2. На вкладке **Headers** добавьте `Authorization` со значением `Bearer <token>` (токен должен совпадать с записью из `USER_API_KEYS`).
3. На вкладке **Body** выберите **raw** → **JSON** и вставьте:

   ```json
   { "productId": 2 }
   ```
4. Отправьте запрос, чтобы получить обновлённый баланс после обработки покупки.

**Готовый пример для копирования (демо-токен):**

```
POST http://localhost:3000/purchase
Authorization: Bearer demo_token
Content-Type: application/json

{ "productId": 2 }
```
