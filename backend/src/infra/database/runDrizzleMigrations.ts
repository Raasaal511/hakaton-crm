import { existsSync } from 'node:fs'
import path from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './drizzle/client.js'

const JOURNAL = path.join('meta', '_journal.json')

function findDrizzleFolder(startDir: string): string | null {
  let dir = path.resolve(startDir)
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'drizzle')
    if (existsSync(path.join(candidate, JOURNAL))) {
      return candidate
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}


function resolveMigrationsFolder(): string {
  const env = process.env.MIGRATIONS_FOLDER?.trim()
  if (env) return path.resolve(env)

  const fromCwd = findDrizzleFolder(process.cwd())
  if (fromCwd) return fromCwd

  const main = process.argv[1]
  if (main) {
    const fromMain = findDrizzleFolder(path.dirname(path.resolve(main)))
    if (fromMain) return fromMain
  }

  return path.resolve(process.cwd(), 'drizzle')
}

export async function runDrizzleMigrations(): Promise<void> {
  const migrationsFolder = resolveMigrationsFolder()
  const dbLabel = process.env.DATABASE_URL?.trim()
    ? 'DATABASE_URL'
    : `config db (${process.env.NODE_ENV ?? 'development'})`

  console.log(`[db] Drizzle migrate → ${migrationsFolder} (${dbLabel})`)

  try {
    await migrate(db, { migrationsFolder })
    console.log('[db] Drizzle migrations: OK')
  } catch (err) {
    console.error('[db] Drizzle migrations failed:', err)
    throw err
  }
}
