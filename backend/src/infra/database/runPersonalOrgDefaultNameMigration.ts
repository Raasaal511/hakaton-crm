import { sql } from 'drizzle-orm'
import { db } from './drizzle/client.js'

/**
 * При старте API: личные организации с дефолтным именем «Мои задачи» → «Личное пространство».
 * Идемпотентно. Дублирует backend/scripts/rename-personal-org-default-name.sql — менять синхронно.
 */
const renamePersonalOrgDefaultName = sql.raw(`
UPDATE "organizations"
SET "name" = 'Личное пространство',
    "updated_at" = now()
WHERE "is_personal" = TRUE
  AND "deleted_at" IS NULL
  AND "name" = 'Мои задачи'
`)

export async function runPersonalOrgDefaultNameMigration(): Promise<void> {
  await db.execute(renamePersonalOrgDefaultName)
}
