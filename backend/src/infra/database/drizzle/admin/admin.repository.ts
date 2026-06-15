import { injectable, inject } from 'inversify'
import { and, eq, sql, isNull } from 'drizzle-orm'
import { TYPES } from '../../../../types.js'
import type { DB } from '../client.js'
import type { IAdminRepository } from '../../../../entities/admin/index.js'
import {
  organizationsSchema,
  usersSchema,
  taskSchema,
  departmentSchema,
} from '../schema.js'

@injectable()
export class AdminRepository implements IAdminRepository {
  constructor(@inject(TYPES.DB) private db: DB) {}

  async getStats() {
    const [orgCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationsSchema)
      .where(
        and(
          isNull(organizationsSchema.deletedAt),
          eq(organizationsSchema.isPersonal, false)
        )
      )

    const [userCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersSchema)

    const [taskCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(taskSchema)
      .where(isNull(taskSchema.deletedAt))

    const [deptCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(departmentSchema)
      .where(isNull(departmentSchema.deletedAt))

    return {
      organizations: orgCount?.count ?? 0,
      users: userCount?.count ?? 0,
      tasks: taskCount?.count ?? 0,
      departments: deptCount?.count ?? 0,
    }
  }
}
