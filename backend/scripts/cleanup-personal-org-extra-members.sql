-- Ручной превью / DBA (psql). В проде очистка выполняется без доступа к консоли БД:
--   • при деплое: npm run db:migrate → миграция drizzle/0014_cleanup_personal_org_extra_members.sql
--   • при каждом старте API: runPersonalOrgExtraMembersCleanup() в src/index.ts
-- Оба варианта идемпотентны (повторный запуск безопасен).
-- Синхронизируйте SQL с backend/src/infra/database/runPersonalOrgExtraMembersCleanup.ts при правках.

-- ========== PREVIEW (только чтение) ==========

SELECT
  o.id AS organization_id,
  o.name,
  o.owner_user_id,
  u.id AS user_id,
  u.email,
  uto.role
FROM users_to_organizations uto
JOIN organizations o ON o.id = uto.organization_id
JOIN users u ON u.id = uto.user_id
WHERE o.is_personal = TRUE
  AND o.deleted_at IS NULL
  AND o.owner_user_id IS NOT NULL
  AND uto.user_id <> o.owner_user_id;

SELECT
  utd.user_id,
  u.email,
  d.id AS department_id,
  d.name AS department_name,
  o.id AS organization_id
FROM users_to_departments utd
JOIN departments d ON d.id = utd.department_id AND d.deleted_at IS NULL
JOIN organizations o ON o.id = d.organization_id
JOIN users u ON u.id = utd.user_id
WHERE o.is_personal = TRUE
  AND o.deleted_at IS NULL
  AND o.owner_user_id IS NOT NULL
  AND utd.user_id <> o.owner_user_id;

-- ========== Ручное выполнение (если миграция/старт API недоступны) ==========
--
-- BEGIN;
-- DELETE FROM "users_to_departments" utd
-- WHERE EXISTS (
--   SELECT 1 FROM "departments" d
--   INNER JOIN "organizations" o ON o.id = d.organization_id
--   WHERE utd.department_id = d.id AND d.deleted_at IS NULL
--     AND o.is_personal = TRUE AND o.deleted_at IS NULL
--     AND o.owner_user_id IS NOT NULL AND utd.user_id <> o.owner_user_id
-- );
-- DELETE FROM "users_to_organizations" uto
-- USING "organizations" o
-- WHERE uto.organization_id = o.id AND o.is_personal = TRUE AND o.deleted_at IS NULL
--   AND o.owner_user_id IS NOT NULL AND uto.user_id <> o.owner_user_id;
-- COMMIT;

-- Личные организации с owner_user_id IS NULL скрипт не трогает.
