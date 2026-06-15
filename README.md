# Meridian CRM — Hackathon Demo

Полнофункциональная CRM-платформа с AI-ассистентом. Стек: React 19 + Fastify + PostgreSQL.

---

## Быстрый запуск (Docker — рекомендуется)

```bash
# 1. Запустить все сервисы одной командой
docker compose up --build

# 2. В отдельном терминале заполнить демо-данными (первый раз)
docker compose exec backend node dist/src/index.js # убедиться что запущен
# затем:
DB_HOST=localhost DB_USER=meridian DB_PASSWORD=meridian_secret DB_NAME=meridian \
  npx tsx backend/scripts/seed-demo.ts
```

**Доступ:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- WebSocket: ws://localhost:3000/ws

**Логин:**
- `owner@meridian.demo` / `demo1234` (владелец)
- `manager@meridian.demo` / `demo1234` (менеджер)
- `employee@meridian.demo` / `demo1234` (сотрудник)

---

## Ручная разработка

### 1. База данных

```bash
# Запустить PostgreSQL (пример через Docker)
docker run -d \
  --name meridian_db \
  -e POSTGRES_USER=meridian \
  -e POSTGRES_PASSWORD=meridian_secret \
  -e POSTGRES_DB=meridian \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Backend

```bash
cd backend
npm install

# Применить миграции и запустить сервер
npm run dev
```

### 3. Заполнить демо-данными

```bash
cd backend
DB_HOST=localhost DB_USER=meridian DB_PASSWORD=meridian_secret DB_NAME=meridian \
  npm run db:seed-demo
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend доступен на http://localhost:5173

---

## Переменные окружения Backend

| Переменная | Значение по умолчанию | Описание |
|------------|----------------------|----------|
| `NODE_ENV` | `development` | Среда (загружает `config/{NODE_ENV}.json`) |
| `DATABASE_URL` | — | Полная строка подключения к PostgreSQL (альтернатива отдельным настройкам) |
| `TASK_ATTACHMENTS_DIR` | `./attachments` | Директория для файлов задач |
| `MIGRATIONS_FOLDER` | auto-detect | Путь к папке с миграциями Drizzle |

Настройки БД, JWT, CORS задаются в `backend/config/development.json` (скопировать из `default.example.json`).

---

## Архитектура

```
hackaton-crm/
├── backend/          # Fastify API + Drizzle ORM + PostgreSQL
│   ├── src/
│   │   ├── modules/  # CRM, Catalog модули
│   │   ├── services/ # RBAC, Audit, Auth
│   │   └── realtime/ # WebSocket сервер
│   ├── drizzle/      # SQL миграции
│   └── scripts/      # seed-demo.ts, seed-drizzle-migrations.ts
├── frontend/         # React 19 + TanStack Query + Vite
│   └── src/
│       ├── pages/    # CRM, Catalog, Dashboard, AI страницы
│       ├── features/ # Формы: ContactForm, LeadForm, CompanyForm, ProductForm
│       └── shared/   # UI компоненты, API клиент, AI утилиты
└── docker-compose.yml
```

---

## API Endpoints (основные)

### CRM
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/crm/contacts?orgId=` | Список контактов (поиск, фильтры, пагинация) |
| POST | `/api/crm/contacts?orgId=` | Создать контакт |
| PUT | `/api/crm/contacts/:id?orgId=` | Обновить контакт |
| DELETE | `/api/crm/contacts/:id?orgId=` | Удалить контакт |
| GET | `/api/crm/companies?orgId=` | Список компаний |
| POST | `/api/crm/companies?orgId=` | Создать компанию |
| GET | `/api/crm/leads?orgId=` | Список лидов |
| GET | `/api/crm/leads/stats?orgId=` | Статистика лидов (KPI) |
| POST | `/api/crm/leads?orgId=` | Создать лид |
| PATCH | `/api/crm/leads/:id/move?orgId=` | Переместить лид по воронке |

### Каталог
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/catalog/products?orgId=` | Список товаров |
| POST | `/api/catalog/products?orgId=` | Создать товар |
| GET | `/api/catalog/services?orgId=` | Список услуг |
| GET | `/api/catalog/inventory/summary?orgId=` | Сводка по складу |

### Realtime
| Тип | Путь | Описание |
|-----|------|----------|
| WS | `/ws?orgId=&token=` | WebSocket соединение |
