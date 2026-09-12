# Facturo — сервер

HTTP API Facturo: выставление и приём электронных счетов `e-Factura` для малого
и среднего бизнеса Молдовы.

NestJS 12, Prisma 7, PostgreSQL. Интеграции с налоговой и банком спрятаны за
интерфейсами, поэтому весь продукт разрабатывается и тестируется без реквизитов.

## Начать

```bash
cp .env.example .env
npm install
docker compose up -d db
npx prisma migrate deploy
npm run start:dev
```

API поднимается на `http://localhost:3001/api`, документация — на
`/api/docs`, здоровье — на `/api/health` (реальный `SELECT 1`, а не «процесс
жив»).

Для Supabase `DATABASE_URL` — runtime-подключение (transaction pooler, порт 6543),
`DIRECT_URL` — подключение миграций (session pooler, порт 5432). Если `DIRECT_URL`
не задан, Prisma CLI использует `DATABASE_URL`. Пароль нужно URL-кодировать;
для TLS используйте `sslmode=verify-full` и доверенный CA bundle. Реальные
реквизиты хранятся только в локальном `.env`.

Для Google задайте `GOOGLE_CLIENT_ID`, совпадающий с клиентским
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Используется Google Identity Services и проверка
ID token, поэтому client secret не нужен. `POST /api/auth/google` возвращает
сессию; `companyId: null` означает, что пользователь должен создать компанию
через `POST /api/companies`. Список и переключение: `GET /api/companies` и
`POST /api/companies/:id/switch`.

Существующие e2e-тесты очищают таблицы: запускайте их только с отдельной
тестовой базой, не с общей Supabase-базой проекта.

## Проверка перед коммитом

```bash
npm run verify
```

lint → typecheck → тесты → сборка. Это же выполняет CI.

## Контракт с клиентом

```bash
npm run openapi:export
```

Пишет `openapi.json`. Клиент (`facturo`) генерирует из него весь свой слой
данных. Типы бэкенда в клиент напрямую не тянутся.

## Документы

- **`CLAUDE.md`** — стек, архитектура, правила кода, чеклист безопасности,
  грабли. Обязательны и для человека, и для ИИ-ассистента.
- **`PLAN.md`** — идея, границы MVP, фазы и риски.
- **`.claude/`** — агенты, скиллы, хуки и права для Claude Code.
