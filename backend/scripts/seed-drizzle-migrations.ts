/**
 * One-time script: если в БД уже применены все миграции (таблицы есть),
 * но таблица drizzle.__drizzle_migrations пустая или потеряна — эта запись
 * помечает последнюю миграцию как применённую, чтобы `npm run db:migrate` не
 * перезапускал старые миграции.
 *
 * Запуск: npm run db:seed-migrations
 */
import 'dotenv/config'
import pg from 'pg'

const HASH_0011 = 'd1e8054d2da73ab16b684dc10294f86f31ec5e75ede2927e91a2374d453e82c4'
const CREATED_AT_0011 = 1773425077740

function createClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (databaseUrl) {
    return new pg.Client({ connectionString: databaseUrl })
  }

  return new pg.Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'postgres',
    ssl: false,
  })
}

async function main() {
  const client = createClient()

  await client.connect()

  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle')
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `)
    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [HASH_0011, CREATED_AT_0011]
    )
    console.log('OK: запись о последней миграции (0011_brainy_wildside) добавлена в drizzle.__drizzle_migrations')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
