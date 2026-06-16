import { runDrizzleMigrations } from '../src/infra/database/runDrizzleMigrations.js'

runDrizzleMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
