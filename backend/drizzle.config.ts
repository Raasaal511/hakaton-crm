import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config() // загружаем .env чтобы DB_* переменные были доступны в drizzle-kit CLI

/**
 * На проде часто задаётся только DATABASE_URL — тогда и приложение, и
 * `npm run db:migrate` должны смотреть на одну и ту же строку подключения.
 */
const dbCredentials = process.env.DATABASE_URL?.trim()
  ? { url: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'postgres',
      ssl: false,
    }

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infra/database/drizzle/schema.ts',
  out: './drizzle',
  dbCredentials,
})