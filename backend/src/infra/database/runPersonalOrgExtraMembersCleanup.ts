import { sql } from 'drizzle-orm'
import { db } from './drizzle/client.js'

/** Снять «чужих» участников с разделов личных организаций (см. organizations.owner_user_id). */
const deleteExtraDeptMemberships = sql.raw(`
DELETE FROM "users_to_departments" utd
WHERE EXISTS (
  SELECT 1
  FROM "departments" d
  INNER JOIN "organizations" o ON o.id = d.organization_id
  WHERE utd.department_id = d.id
    AND d.deleted_at IS NULL
    AND o.is_personal = TRUE
    AND o.deleted_at IS NULL
    AND o.owner_user_id IS NOT NULL
    AND utd.user_id <> o.owner_user_id
)
`)

/** Удалить членство в личной организации у всех, кроме владельца. Идемпотентно. */
const deleteExtraOrgMemberships = sql.raw(`
DELETE FROM "users_to_organizations" uto
USING "organizations" o
WHERE uto.organization_id = o.id
  AND o.is_personal = TRUE
  AND o.deleted_at IS NULL
  AND o.owner_user_id IS NOT NULL
  AND uto.user_id <> o.owner_user_id
`)

/**
 * Выполняется при старте API: не требует ручного psql на проде.
 * Дублирует drizzle/0014_cleanup_personal_org_extra_members.sql — менять синхронно.
 */
export async function runPersonalOrgExtraMembersCleanup(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(deleteExtraDeptMemberships)
    await tx.execute(deleteExtraOrgMemberships)
  })
}
