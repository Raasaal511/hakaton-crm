/**
 * Скрипт для назначения пользователя root по email.
 * Использование: npx tsx scripts/set-root.ts <email>
 */
import 'dotenv/config'
import { db } from '../src/infra/database/drizzle/client.js'
import { usersSchema } from '../src/infra/database/drizzle/schema.js'
import { eq } from 'drizzle-orm'

const email = process.argv[2]
if (!email) {
  console.error('Использование: npx tsx scripts/set-root.ts <email>')
  process.exit(1)
}

async function main() {
  const [result] = await db
    .update(usersSchema)
    .set({ systemRole: 'root' })
    .where(eq(usersSchema.email, email))
    .returning({ id: usersSchema.id, email: usersSchema.email, systemRole: usersSchema.systemRole })

  if (result) {
    console.log(`Пользователь ${result.email} (id: ${result.id}) назначен root`)
  } else {
    console.error(`Пользователь с email ${email} не найден`)
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
