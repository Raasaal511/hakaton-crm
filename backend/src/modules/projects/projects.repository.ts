import { injectable, inject } from 'inversify'
import { eq, and, ilike, isNull, desc, sql } from 'drizzle-orm'
import { TYPES } from '../../types.js'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { projectsSchema, projectMembersSchema, usersSchema } from '../../infra/database/drizzle/schema.js'
import type { Project, ProjectMember } from '../../infra/database/drizzle/schema.js'
import type { CreateProjectDTO, UpdateProjectDTO, ProjectListFilter } from './projects.types.js'

@injectable()
export class ProjectsRepository {
  constructor(@inject(TYPES.DB) private db: NodePgDatabase<Record<string, never>>) {}

  async findAll(orgId: number, filter: ProjectListFilter = {}): Promise<Project[]> {
    let query = this.db
      .select()
      .from(projectsSchema)
      .where(
        and(
          eq(projectsSchema.organizationId, orgId),
          isNull(projectsSchema.deletedAt),
          filter.status ? eq(projectsSchema.status, filter.status) : undefined,
          filter.priority ? eq(projectsSchema.priority, filter.priority) : undefined,
          filter.q ? ilike(projectsSchema.name, `%${filter.q}%`) : undefined,
        ),
      )
      .orderBy(desc(projectsSchema.createdAt))
      .$dynamic()

    if (filter.limit) query = query.limit(filter.limit) as typeof query
    if (filter.offset) query = query.offset(filter.offset) as typeof query

    return query
  }

  async count(orgId: number, filter: ProjectListFilter = {}): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectsSchema)
      .where(
        and(
          eq(projectsSchema.organizationId, orgId),
          isNull(projectsSchema.deletedAt),
          filter.status ? eq(projectsSchema.status, filter.status) : undefined,
          filter.priority ? eq(projectsSchema.priority, filter.priority) : undefined,
          filter.q ? ilike(projectsSchema.name, `%${filter.q}%`) : undefined,
        ),
      )
    return result[0]?.count ?? 0
  }

  async findById(orgId: number, id: number): Promise<Project | undefined> {
    const rows = await this.db
      .select()
      .from(projectsSchema)
      .where(
        and(
          eq(projectsSchema.id, id),
          eq(projectsSchema.organizationId, orgId),
          isNull(projectsSchema.deletedAt),
        ),
      )
      .limit(1)
    return rows[0]
  }

  async create(orgId: number, ownerUserId: number, dto: CreateProjectDTO): Promise<Project> {
    const rows = await this.db
      .insert(projectsSchema)
      .values({
        organizationId: orgId,
        ownerUserId,
        name: dto.name,
        description: dto.description,
        status: dto.status ?? 'planning',
        priority: dto.priority ?? 'medium',
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        budget: dto.budget ?? 0,
        currency: dto.currency ?? 'RUB',
        color: dto.color ?? '#6366f1',
      })
      .returning()
    return rows[0]!
  }

  async update(orgId: number, id: number, dto: UpdateProjectDTO): Promise<Project | undefined> {
    const rows = await this.db
      .update(projectsSchema)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.progress !== undefined && { progress: dto.progress }),
        ...(dto.budget !== undefined && { budget: dto.budget }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
      })
      .where(and(eq(projectsSchema.id, id), eq(projectsSchema.organizationId, orgId), isNull(projectsSchema.deletedAt)))
      .returning()
    return rows[0]
  }

  async softDelete(orgId: number, id: number): Promise<boolean> {
    const rows = await this.db
      .update(projectsSchema)
      .set({ deletedAt: new Date() })
      .where(and(eq(projectsSchema.id, id), eq(projectsSchema.organizationId, orgId), isNull(projectsSchema.deletedAt)))
      .returning({ id: projectsSchema.id })
    return rows.length > 0
  }

  async getMembers(projectId: number): Promise<(ProjectMember & { firstname: string; lastname: string | null; email: string })[]> {
    const rows = await this.db
      .select({
        projectId: projectMembersSchema.projectId,
        userId: projectMembersSchema.userId,
        role: projectMembersSchema.role,
        joinedAt: projectMembersSchema.joinedAt,
        firstname: usersSchema.firstname,
        lastname: usersSchema.lastname,
        email: usersSchema.email,
      })
      .from(projectMembersSchema)
      .innerJoin(usersSchema, eq(projectMembersSchema.userId, usersSchema.id))
      .where(eq(projectMembersSchema.projectId, projectId))
    return rows
  }

  async addMember(projectId: number, userId: number, role = 'member'): Promise<void> {
    await this.db
      .insert(projectMembersSchema)
      .values({ projectId, userId, role })
      .onConflictDoUpdate({
        target: [projectMembersSchema.projectId, projectMembersSchema.userId],
        set: { role },
      })
  }

  async removeMember(projectId: number, userId: number): Promise<boolean> {
    const rows = await this.db
      .delete(projectMembersSchema)
      .where(and(eq(projectMembersSchema.projectId, projectId), eq(projectMembersSchema.userId, userId)))
      .returning({ projectId: projectMembersSchema.projectId })
    return rows.length > 0
  }
}
