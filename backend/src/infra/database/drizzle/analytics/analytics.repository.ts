import { injectable, inject } from 'inversify'
import { and, eq, gte, inArray, isNull, isNotNull, lt, lte, sql, desc } from 'drizzle-orm'
import { TYPES } from '../../../../types.js'
import type { DB } from '../client.js'
import type { IAnalyticsRepository } from '../../../../entities/analytics/index.js'
import type {
  OrganizationAnalyticsByDepartment,
  OrganizationAnalyticsOverview,
  OrganizationAnalyticsTopPerformer,
  OrganizationAnalyticsTrendPoint,
} from '../../../../entities/analytics/index.js'
import {
  departmentSchema,
  pipelinesSchema,
  taskSchema,
  usersSchema,
  usersToOrganizationsSchema,
  usersToDepartmentsSchema,
  columnSchema,
} from '../schema.js'

@injectable()
export class AnalyticsRepository implements IAnalyticsRepository {
  constructor(@inject(TYPES.DB) private db: DB) {}

  async getOverview(
    organizationId: number,
    from: Date | null,
    to: Date,
    departmentId?: number,
  ): Promise<OrganizationAnalyticsOverview> {
    const [membersRow] =
      departmentId == null
        ? await this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(usersToOrganizationsSchema)
            .where(eq(usersToOrganizationsSchema.organizationId, organizationId))
        : await this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(usersToDepartmentsSchema)
            .where(eq(usersToDepartmentsSchema.departmentId, departmentId))

    const departmentsCount =
      departmentId == null
        ? (
            await this.db
              .select({ count: sql<number>`count(*)::int` })
              .from(departmentSchema)
              .where(
                and(
                  eq(departmentSchema.organizationId, organizationId),
                  isNull(departmentSchema.deletedAt),
                ),
              )
          )[0]?.count ?? 0
        : 1

    const pipelinesWhere = and(
      eq(departmentSchema.organizationId, organizationId),
      isNull(pipelinesSchema.deletedAt),
      isNull(departmentSchema.deletedAt),
      ...(departmentId != null ? [eq(pipelinesSchema.departmentId, departmentId)] : []),
    )
    const [pipelinesRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(pipelinesSchema)
      .innerJoin(departmentSchema, eq(pipelinesSchema.departmentId, departmentSchema.id))
      .where(pipelinesWhere)

    const activeBase = this.db.select({ count: sql<number>`count(*)::int` }).from(taskSchema)
    const activeFrom =
      departmentId != null
        ? activeBase.innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
        : activeBase
    const [activeRow] = await activeFrom.where(
      and(
        eq(taskSchema.organizationId, organizationId),
        isNull(taskSchema.deletedAt),
        isNull(taskSchema.completedAt),
        ...(departmentId != null
          ? [eq(columnSchema.departmentId, departmentId), isNull(columnSchema.deletedAt)]
          : []),
      ),
    )

    const completedConditions = [
      eq(taskSchema.organizationId, organizationId),
      isNull(taskSchema.deletedAt),
      isNotNull(taskSchema.completedAt),
      lte(taskSchema.completedAt, to),
    ]
    if (from) {
      completedConditions.push(gte(taskSchema.completedAt, from))
    }
    if (departmentId != null) {
      completedConditions.push(
        eq(columnSchema.departmentId, departmentId),
        isNull(columnSchema.deletedAt),
      )
    }
    const completedBase = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(taskSchema)
    const completedFrom =
      departmentId != null
        ? completedBase.innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
        : completedBase
    const [completedRow] = await completedFrom.where(and(...completedConditions))

    const createdConditions = [
      eq(taskSchema.organizationId, organizationId),
      isNull(taskSchema.deletedAt),
      lte(taskSchema.createdAt, to),
    ]
    if (from) {
      createdConditions.push(gte(taskSchema.createdAt, from))
    }
    if (departmentId != null) {
      createdConditions.push(
        eq(columnSchema.departmentId, departmentId),
        isNull(columnSchema.deletedAt),
      )
    }
    const createdBase = this.db.select({ count: sql<number>`count(*)::int` }).from(taskSchema)
    const createdFrom =
      departmentId != null
        ? createdBase.innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
        : createdBase
    const [createdRow] = await createdFrom.where(and(...createdConditions))

    const now = new Date()
    const overdueBase = this.db.select({ count: sql<number>`count(*)::int` }).from(taskSchema)
    const overdueFrom =
      departmentId != null
        ? overdueBase.innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
        : overdueBase
    const [overdueRow] = await overdueFrom.where(
      and(
        eq(taskSchema.organizationId, organizationId),
        isNull(taskSchema.deletedAt),
        isNull(taskSchema.completedAt),
        isNotNull(taskSchema.deadLine),
        lt(taskSchema.deadLine, now),
        ...(departmentId != null
          ? [eq(columnSchema.departmentId, departmentId), isNull(columnSchema.deletedAt)]
          : []),
      ),
    )

    const cycleConditions = [
      eq(taskSchema.organizationId, organizationId),
      isNull(taskSchema.deletedAt),
      isNotNull(taskSchema.completedAt),
      isNotNull(taskSchema.createdAt),
      lte(taskSchema.completedAt, to),
    ]
    if (from) {
      cycleConditions.push(gte(taskSchema.completedAt, from))
    }
    if (departmentId != null) {
      cycleConditions.push(
        eq(columnSchema.departmentId, departmentId),
        isNull(columnSchema.deletedAt),
      )
    }
    const cycleBase = this.db
      .select({
        avgSeconds: sql<string | null>`avg(extract(epoch from (${taskSchema.completedAt} - ${taskSchema.createdAt})))`,
      })
      .from(taskSchema)
    const cycleFrom =
      departmentId != null
        ? cycleBase.innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
        : cycleBase
    const [cycleRow] = await cycleFrom.where(and(...cycleConditions))

    const avgSeconds = cycleRow?.avgSeconds == null ? null : Number(cycleRow.avgSeconds)
    const avgCycleDays =
      avgSeconds == null || Number.isNaN(avgSeconds)
        ? null
        : Math.round((avgSeconds / 86400) * 10) / 10

    const completedInPeriod = completedRow?.count ?? 0
    const createdInPeriod = createdRow?.count ?? 0
    const completionRate =
      createdInPeriod > 0
        ? Math.round((completedInPeriod / createdInPeriod) * 1000) / 1000
        : 0

    return {
      membersCount: membersRow?.count ?? 0,
      departmentsCount,
      pipelinesCount: pipelinesRow?.count ?? 0,
      activeTasks: activeRow?.count ?? 0,
      createdInPeriod,
      completedInPeriod,
      overdueTasks: overdueRow?.count ?? 0,
      completionRate,
      avgCycleDays,
    }
  }

  async getTrend(
    organizationId: number,
    from: Date,
    to: Date,
    departmentId?: number,
  ): Promise<OrganizationAnalyticsTrendPoint[]> {
    const deptJoin =
      departmentId != null
        ? sql`
        inner join ${columnSchema} on ${taskSchema.columnId} = ${columnSchema.id}
          and ${columnSchema.departmentId} = ${departmentId}
          and ${columnSchema.deletedAt} is null`
        : sql``

    const result = await this.db.execute<{
      day: string
      created: string | number
      completed: string | number
    }>(sql`
      with days as (
        select generate_series(
          date_trunc('day', ${from.toISOString()}::timestamp),
          date_trunc('day', ${to.toISOString()}::timestamp),
          interval '1 day'
        )::date as day
      ),
      created_per_day as (
        select date_trunc('day', ${taskSchema.createdAt})::date as day,
               count(*)::int as c
        from ${taskSchema}
        ${deptJoin}
        where ${taskSchema.organizationId} = ${organizationId}
          and ${taskSchema.deletedAt} is null
          and ${taskSchema.createdAt} >= ${from.toISOString()}
          and ${taskSchema.createdAt} <= ${to.toISOString()}
        group by 1
      ),
      completed_per_day as (
        select date_trunc('day', ${taskSchema.completedAt})::date as day,
               count(*)::int as c
        from ${taskSchema}
        ${deptJoin}
        where ${taskSchema.organizationId} = ${organizationId}
          and ${taskSchema.deletedAt} is null
          and ${taskSchema.completedAt} is not null
          and ${taskSchema.completedAt} >= ${from.toISOString()}
          and ${taskSchema.completedAt} <= ${to.toISOString()}
        group by 1
      )
      select to_char(d.day, 'YYYY-MM-DD') as day,
             coalesce(c.c, 0)::int as created,
             coalesce(co.c, 0)::int as completed
      from days d
      left join created_per_day c on c.day = d.day
      left join completed_per_day co on co.day = d.day
      order by d.day asc
    `)

    const list = (result as unknown as { rows?: unknown[] }).rows ?? (result as unknown as unknown[])
    return (list as { day: string; created: string | number; completed: string | number }[]).map((r) => ({
      date: r.day,
      created: Number(r.created) || 0,
      completed: Number(r.completed) || 0,
    }))
  }

  async getByDepartment(
    organizationId: number,
    from: Date | null,
    to: Date,
    departmentId?: number,
  ): Promise<OrganizationAnalyticsByDepartment[]> {
    const now = new Date()
    const fromIso = from ? from.toISOString() : null
    const toIso = to.toISOString()
    const nowIso = now.toISOString()

    const deptClause =
      departmentId != null ? sql` and d.id = ${departmentId}` : sql``

    const result = await this.db.execute<{
      department_id: number
      name: string
      active: string | number
      completed: string | number
      overdue: string | number
    }>(sql`
      select
        d.id as department_id,
        d.name as name,
        count(*) filter (
          where t.id is not null and t.deleted_at is null and t.completed_at is null
            and (t.dead_line is null or t.dead_line >= ${nowIso})
        )::int as active,
        count(*) filter (
          where t.id is not null and t.deleted_at is null and t.completed_at is not null
            and t.completed_at <= ${toIso}
            and (${fromIso}::timestamp is null or t.completed_at >= ${fromIso}::timestamp)
        )::int as completed,
        count(*) filter (
          where t.id is not null and t.deleted_at is null and t.completed_at is null
            and t.dead_line is not null and t.dead_line < ${nowIso}
        )::int as overdue
      from ${departmentSchema} d
      left join ${columnSchema} c on c.department_id = d.id and c.deleted_at is null
      left join ${taskSchema} t
        on t.column_id = c.id and t.organization_id = ${organizationId}
      where d.organization_id = ${organizationId}
        and d.deleted_at is null
        ${deptClause}
      group by d.id, d.name
      order by d.name asc
    `)

    const list = (result as unknown as { rows?: unknown[] }).rows ?? (result as unknown as unknown[])
    return (list as {
      department_id: number
      name: string
      active: string | number
      completed: string | number
      overdue: string | number
    }[]).map((r) => ({
      departmentId: Number(r.department_id),
      name: r.name,
      active: Number(r.active) || 0,
      completed: Number(r.completed) || 0,
      overdue: Number(r.overdue) || 0,
    }))
  }

  async getTopPerformers(
    organizationId: number,
    from: Date | null,
    to: Date,
    limit: number,
    departmentId?: number,
  ): Promise<OrganizationAnalyticsTopPerformer[]> {
    const completedConditions = [
      eq(taskSchema.organizationId, organizationId),
      isNull(taskSchema.deletedAt),
      isNotNull(taskSchema.completedAt),
      isNotNull(taskSchema.responsibleId),
      lte(taskSchema.completedAt, to),
    ]
    if (from) {
      completedConditions.push(gte(taskSchema.completedAt, from))
    }
    if (departmentId != null) {
      completedConditions.push(
        eq(columnSchema.departmentId, departmentId),
        isNull(columnSchema.deletedAt),
      )
    }

    let completedRows
    if (departmentId != null) {
      completedRows = await this.db
        .select({
          userId: taskSchema.responsibleId,
          firstname: usersSchema.firstname,
          lastname: usersSchema.lastname,
          completed: sql<number>`count(*)::int`,
        })
        .from(taskSchema)
        .innerJoin(usersSchema, eq(taskSchema.responsibleId, usersSchema.id))
        .innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
        .where(and(...completedConditions))
        .groupBy(taskSchema.responsibleId, usersSchema.firstname, usersSchema.lastname)
        .orderBy(desc(sql`count(*)`))
        .limit(limit)
    } else {
      completedRows = await this.db
        .select({
          userId: taskSchema.responsibleId,
          firstname: usersSchema.firstname,
          lastname: usersSchema.lastname,
          completed: sql<number>`count(*)::int`,
        })
        .from(taskSchema)
        .innerJoin(usersSchema, eq(taskSchema.responsibleId, usersSchema.id))
        .where(and(...completedConditions))
        .groupBy(taskSchema.responsibleId, usersSchema.firstname, usersSchema.lastname)
        .orderBy(desc(sql`count(*)`))
        .limit(limit)
    }

    if (completedRows.length === 0) return []

    const userIds = completedRows.map((r) => r.userId).filter((v): v is number => v != null)

    const activeConditions = [
      eq(taskSchema.organizationId, organizationId),
      isNull(taskSchema.deletedAt),
      isNull(taskSchema.completedAt),
      inArray(taskSchema.responsibleId, userIds),
    ]
    if (departmentId != null) {
      activeConditions.push(
        eq(columnSchema.departmentId, departmentId),
        isNull(columnSchema.deletedAt),
      )
    }

    const activeRows =
      userIds.length === 0
        ? []
        : departmentId != null
          ? await this.db
              .select({
                userId: taskSchema.responsibleId,
                active: sql<number>`count(*)::int`,
              })
              .from(taskSchema)
              .innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
              .where(and(...activeConditions))
              .groupBy(taskSchema.responsibleId)
          : await this.db
              .select({
                userId: taskSchema.responsibleId,
                active: sql<number>`count(*)::int`,
              })
              .from(taskSchema)
              .where(and(...activeConditions))
              .groupBy(taskSchema.responsibleId)

    const activeByUser = new Map<number, number>()
    for (const r of activeRows) {
      if (r.userId != null) activeByUser.set(r.userId, Number(r.active) || 0)
    }

    const now = new Date()
    const overduePerformerConditions = [
      eq(taskSchema.organizationId, organizationId),
      isNull(taskSchema.deletedAt),
      isNull(taskSchema.completedAt),
      isNotNull(taskSchema.deadLine),
      lt(taskSchema.deadLine, now),
      inArray(taskSchema.responsibleId, userIds),
    ]
    if (departmentId != null) {
      overduePerformerConditions.push(eq(columnSchema.departmentId, departmentId), isNull(columnSchema.deletedAt))
    }

    const overdueRows =
      userIds.length === 0
        ? []
        : departmentId != null
          ? await this.db
              .select({ userId: taskSchema.responsibleId, overdue: sql<number>`count(*)::int` })
              .from(taskSchema)
              .innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
              .where(and(...overduePerformerConditions))
              .groupBy(taskSchema.responsibleId)
          : await this.db
              .select({ userId: taskSchema.responsibleId, overdue: sql<number>`count(*)::int` })
              .from(taskSchema)
              .where(and(...overduePerformerConditions))
              .groupBy(taskSchema.responsibleId)

    const overdueByUser = new Map<number, number>()
    for (const r of overdueRows) {
      if (r.userId != null) overdueByUser.set(r.userId, Number(r.overdue) || 0)
    }

    return completedRows
      .filter((r) => r.userId != null)
      .map((r) => ({
        userId: r.userId as number,
        firstname: r.firstname,
        lastname: r.lastname,
        completed: Number(r.completed) || 0,
        active: activeByUser.get(r.userId as number) ?? 0,
        overdue: overdueByUser.get(r.userId as number) ?? 0,
      }))
  }
}
