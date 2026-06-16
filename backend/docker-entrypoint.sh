#!/bin/sh
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Meridian CRM — Backend startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Wait for PostgreSQL ────────────────────────────────────────────────────────
echo "⏳  Waiting for PostgreSQL..."
until node -e "
  const { Pool } = require('pg');
  new Pool({ connectionString: process.env.DATABASE_URL })
    .query('SELECT 1')
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 1
done
echo "✅  PostgreSQL is ready"

# ── Run migrations ────────────────────────────────────────────────────────────
echo "📦  Running database migrations..."
node node_modules/.bin/tsx scripts/migrate.ts && echo "✅  Migrations complete" || { echo "❌  Migrations failed"; exit 1; }

# ── Seed demo data (only on first run or when forced) ─────────────────────────
if [ "$SEED_ON_START" = "true" ]; then
  echo "🌱  Seeding demo data..."
  node node_modules/.bin/tsx scripts/seed-demo.ts && echo "✅  Seed complete" || echo "⚠️  Seed skipped (data may already exist)"
fi

echo "🚀  Starting server..."
exec node dist/index.js
