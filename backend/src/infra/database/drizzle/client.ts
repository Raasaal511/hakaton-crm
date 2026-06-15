import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import config from 'config'

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (databaseUrl) {
    return new Pool({ connectionString: databaseUrl })
  }

  const dbConfig = config.get<{
    host: string
    port: number
    user: string
    password: string
    database: string
  }>('db')

  return new Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: false,
  })
}

export const pool = createPool()
export const db = drizzle(pool)
export type DB = typeof db
