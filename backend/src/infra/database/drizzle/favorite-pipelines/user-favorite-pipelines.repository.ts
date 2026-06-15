import { injectable, inject } from 'inversify'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { TYPES } from '../../../../types.js'
import type { DB } from '../client.js'
import {
  departmentSchema,
  organizationsSchema,
  pipelinesSchema,
  userFavoritePipelinesSchema,
  usersToOrganizationsSchema,
} from '../schema.js'
import type {
  FavoritePipelineListItem,
  FavoritePipelineListItemWithOrg,
  IUserFavoritePipelinesRepository,
} from '../../../../entities/favorite-pipelines/favorite-pipelines.repository.interface.js'

@injectable()
export class UserFavoritePipelinesRepository implements IUserFavoritePipelinesRepository {
  constructor(@inject(TYPES.DB) private readonly db: DB) {}

  async listForOrganization(
    userId: number,
    organizationId: number,
  ): Promise<FavoritePipelineListItem[]> {
    const rows = await this.db
      .select({
        pipelineId: pipelinesSchema.id,
        pipelineName: pipelinesSchema.name,
        departmentId: departmentSchema.id,
        departmentName: departmentSchema.name,
      })
      .from(userFavoritePipelinesSchema)
      .innerJoin(pipelinesSchema, eq(userFavoritePipelinesSchema.pipelineId, pipelinesSchema.id))
      .innerJoin(departmentSchema, eq(pipelinesSchema.departmentId, departmentSchema.id))
      .where(
        and(
          eq(userFavoritePipelinesSchema.userId, userId),
          eq(departmentSchema.organizationId, organizationId),
          isNull(pipelinesSchema.deletedAt),
          isNull(departmentSchema.deletedAt),
        ),
      )
      .orderBy(desc(userFavoritePipelinesSchema.createdAt))

    return rows
  }

  async listAllForUser(userId: number): Promise<FavoritePipelineListItemWithOrg[]> {
    const rows = await this.db
      .select({
        pipelineId: pipelinesSchema.id,
        pipelineName: pipelinesSchema.name,
        departmentId: departmentSchema.id,
        departmentName: departmentSchema.name,
        organizationId: organizationsSchema.id,
        organizationName: organizationsSchema.name,
      })
      .from(userFavoritePipelinesSchema)
      .innerJoin(pipelinesSchema, eq(userFavoritePipelinesSchema.pipelineId, pipelinesSchema.id))
      .innerJoin(departmentSchema, eq(pipelinesSchema.departmentId, departmentSchema.id))
      .innerJoin(organizationsSchema, eq(departmentSchema.organizationId, organizationsSchema.id))
      .innerJoin(
        usersToOrganizationsSchema,
        and(
          eq(usersToOrganizationsSchema.userId, userId),
          eq(usersToOrganizationsSchema.organizationId, organizationsSchema.id),
        ),
      )
      .where(
        and(
          eq(userFavoritePipelinesSchema.userId, userId),
          isNull(pipelinesSchema.deletedAt),
          isNull(departmentSchema.deletedAt),
          isNull(organizationsSchema.deletedAt),
        ),
      )
      .orderBy(desc(userFavoritePipelinesSchema.createdAt))

    return rows
  }

  async add(userId: number, pipelineId: number): Promise<void> {
    await this.db
      .insert(userFavoritePipelinesSchema)
      .values({ userId, pipelineId })
      .onConflictDoNothing()
  }

  async remove(userId: number, pipelineId: number): Promise<void> {
    await this.db
      .delete(userFavoritePipelinesSchema)
      .where(
        and(
          eq(userFavoritePipelinesSchema.userId, userId),
          eq(userFavoritePipelinesSchema.pipelineId, pipelineId),
        ),
      )
  }
}
