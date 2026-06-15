-- Переименование личных организаций с дефолтного «Мои задачи» на «Личное пространство».
-- При старте API тот же SQL выполняется в runPersonalOrgDefaultNameMigration.ts (src/index.ts).
-- Этот файл — для ручного psql при необходимости:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/rename-personal-org-default-name.sql
-- Идемпотентно: повторный запуск не трогает уже переименованные строки.

-- ========== PREVIEW ==========

SELECT id, name, owner_user_id, created_at
FROM organizations
WHERE is_personal = TRUE
  AND deleted_at IS NULL
  AND name = 'Мои задачи';

-- ========== UPDATE (раскомментируйте после проверки PREVIEW) ==========

BEGIN;

UPDATE organizations
SET name = 'Личное пространство',
    updated_at = now()
WHERE is_personal = TRUE
  AND deleted_at IS NULL
  AND name = 'Мои задачи';

-- затронутые строки:
SELECT id, name, owner_user_id
FROM organizations
WHERE is_personal = TRUE
  AND deleted_at IS NULL
  AND name = 'Личное пространство';

COMMIT;
