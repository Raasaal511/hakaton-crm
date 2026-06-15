import 'dotenv/config'
import 'reflect-metadata'
import { container } from './container.js'
import { TYPES } from './types.js'
import type { IServer } from './api/server.js'
import { runDrizzleMigrations } from './infra/database/runDrizzleMigrations.js'
import { runPersonalOrgExtraMembersCleanup } from './infra/database/runPersonalOrgExtraMembersCleanup.js'
import { runPersonalOrgDefaultNameMigration } from './infra/database/runPersonalOrgDefaultNameMigration.js'
import { runMainPipelineMigration } from './infra/database/runMainPipelineMigration.js'

const start = async () => {
  await runDrizzleMigrations()
  await runPersonalOrgExtraMembersCleanup()
  await runPersonalOrgDefaultNameMigration()
  await runMainPipelineMigration()
  const server = container.get<IServer>(TYPES.Server)
  await server.start()
}

start()
