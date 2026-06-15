import { inject, injectable } from 'inversify'
import { TYPES } from '../types.js'
import type { IDepartmentRepository } from '../entities/department/index.js'
import type { IPipelinesRepository } from '../entities/pipelines/index.js'
import type { IColumnsRepository } from '../entities/columnts/index.js'
import {
  mergeDepartmentPolicies,
  type DepartmentPolicies,
  type DepartmentNotificationKey,
} from '../entities/department/department.policies.js'
import { mergeDepartmentPermissions } from '../entities/department/department.permissions.js'
import {
  mergePipelinePolicies,
  type PipelinePolicies,
} from '../entities/pipeline/pipeline.policies.js'
import { mergeColumnPolicies, type ColumnPolicies } from '../entities/column/column.policies.js'
import { BadRequestError } from '../infra/libs/errors.js'
import type { OrganizationAccessService } from './organization-access.service.js'

export type MemberCapabilityKey = 'memberCanSeeAllTasks' | 'memberCanCreateTasks'

export type DeptAdminNotificationEvent =
  | 'task_created'
  | 'task_completed'
  | 'task_moved'
  | 'task_assignees_changed'

const NOTIFICATION_EVENT_MAP: Record<DeptAdminNotificationEvent, DepartmentNotificationKey> = {
  task_created: 'deptAdminOnTaskCreated',
  task_completed: 'deptAdminOnTaskCompleted',
  task_moved: 'deptAdminOnTaskMoved',
  task_assignees_changed: 'deptAdminOnAssigneesChanged',
}

@injectable()
export class PolicyResolverService {
  constructor(
    @inject(TYPES.DepartmentRepository) private readonly departmentRepo: IDepartmentRepository,
    @inject(TYPES.PipelinesRepository) private readonly pipelinesRepo: IPipelinesRepository,
    @inject(TYPES.ColumnRepository) private readonly columnRepo: IColumnsRepository,
    @inject(TYPES.OrganizationAccessService) private readonly orgAccessService: OrganizationAccessService,
  ) {}

  async getDepartmentPolicies(departmentId: number): Promise<DepartmentPolicies> {
    const department = await this.departmentRepo.getDepartmentById(departmentId)
    return mergeDepartmentPolicies(department?.policies)
  }

  async getPipelinePolicies(pipelineId: number): Promise<PipelinePolicies> {
    const pipeline = await this.pipelinesRepo.getPipelineById(pipelineId)
    void pipeline
    return mergePipelinePolicies(null)
  }

  async getColumnPolicies(columnId: number): Promise<ColumnPolicies> {
    void columnId
    return mergeColumnPolicies(null)
  }

  async canBypassTaskRules(userId: number, organizationId: number): Promise<boolean> {
    return this.orgAccessService.canManageOrganization(organizationId, userId)
  }

  async resolveMemberCapability(
    departmentId: number,
    pipelineId: number | null | undefined,
    userId: number,
    key: MemberCapabilityKey,
  ): Promise<boolean> {
    const department = await this.departmentRepo.getDepartmentById(departmentId)
    if (!department) return false
    if (await this.orgAccessService.canManageOrganization(department.organizationId, userId)) {
      return true
    }
    const role = await this.departmentRepo.getUserRoleInDepartment(departmentId, userId)
    if (role === 'admin') return true
    if (role !== 'member') return false

    const deptPerms = mergeDepartmentPermissions(department.permissions)
    // Политики воронки убираем: переопределения участникам игнорируются.
    return deptPerms[key]
  }

  async resolveNotificationFlags(
    departmentId: number,
    pipelineId: number | null | undefined,
    event: DeptAdminNotificationEvent,
  ): Promise<{ enabled: boolean }> {
    const deptPolicies = await this.getDepartmentPolicies(departmentId)
    const notificationKey = NOTIFICATION_EVENT_MAP[event]
    // Политики воронки убираем: уведомления админам отдела определяются только политиками раздела.
    void pipelineId
    return { enabled: deptPolicies.notifications[notificationKey] }
  }

  async isCompletedColumn(columnId: number): Promise<boolean> {
    const col = await this.columnRepo.getColumnById(columnId)
    if (!col || col.pipelineId == null) return false
    const pipelineCols = await this.columnRepo.getColumnsByPipelineId(col.pipelineId)
    if (pipelineCols.length === 0) return false
    const lastPos = Math.max(...pipelineCols.map((c) => c.position))
    return col.position === lastPos
  }

  validateTaskRulesForCreateOrUpdate(
    policies: DepartmentPolicies,
    responsibleIds: number[],
    deadLine: Date | string | null | undefined,
  ): void {
    if (policies.taskRules.requireResponsible && responsibleIds.length === 0) {
      throw new BadRequestError('По правилам раздела необходимо назначить исполнителя')
    }
    if (policies.taskRules.requireDeadLine && (deadLine == null || deadLine === '')) {
      throw new BadRequestError('По правилам раздела необходимо указать срок')
    }
  }

  validateColumnEnterRules(
    colPolicies: ColumnPolicies,
    responsibleIds: number[],
    deadLine: Date | string | null | undefined,
  ): void {
    if (colPolicies.requireResponsibleOnEnter && responsibleIds.length === 0) {
      throw new BadRequestError('Для переноса в эту колонку необходимо назначить исполнителя')
    }
    if (colPolicies.requireDeadLineOnEnter && (deadLine == null || deadLine === '')) {
      throw new BadRequestError('Для переноса в эту колонку необходимо указать срок')
    }
  }
}
