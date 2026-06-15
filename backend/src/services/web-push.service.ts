import { injectable, inject } from 'inversify'
import webpush from 'web-push'
import { TYPES } from '../types.js'
import { WebPushSubscriptionsRepository } from '../infra/database/drizzle/web-push/web-push-subscriptions.repository.js'
import type { IDepartmentRepository } from '../entities/department/index.js'
import type { IOrganizationRepository } from '../entities/organization/index.js'
import type { PolicyResolverService, DeptAdminNotificationEvent } from './policy-resolver.service.js'
import type { IColumnsRepository } from '../entities/columnts/index.js'
import type { IAuthRepository } from '../entities/auth/index.js'
import {
  isPushAllowedForUser,
  type PushAudience,
  type PushNotificationKind,
} from '../entities/user/user.preferences.js'

export type TaskPushRef = {
  id: number
  name: string
  responsibleId: number | null
  responsibleIds?: number[]
  columnId?: number | null
  departmentId?: number | null
  departmentName?: string | null
  pipelineName?: string | null
  columnName?: string | null
}

type OutgoingPayload = {
  type: PushNotificationKind
  audience?: PushAudience
  taskId: number
  title: string
  body: string
  url: string
  tag: string
}

@injectable()
export class WebPushService {
  private readonly enabled: boolean

  private readonly publicKey: string | undefined

  constructor(
    @inject(TYPES.WebPushSubscriptionsRepository)
    private readonly repo: WebPushSubscriptionsRepository,
    @inject(TYPES.DepartmentRepository)
    private readonly departmentRepo: IDepartmentRepository,
    @inject(TYPES.OrganizationRepository)
    private readonly organizationRepo: IOrganizationRepository,
    @inject(TYPES.PolicyResolverService)
    private readonly policyResolver: PolicyResolverService,
    @inject(TYPES.ColumnRepository)
    private readonly columnRepo: IColumnsRepository,
    @inject(TYPES.AuthRepository) private readonly authRepo: IAuthRepository,
  ) {
    const pub = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim()
    const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim()
    const subject = process.env.WEB_PUSH_SUBJECT?.trim() ?? 'mailto:noreply@localhost'
    this.publicKey = pub && pub.length > 0 ? pub : undefined
    this.enabled = Boolean(pub && priv && pub.length > 0 && priv.length > 0)
    if (this.enabled) {
      webpush.setVapidDetails(subject, pub!, priv!)
    }
  }

  getPublicKey(): string | null {
    return this.publicKey ?? null
  }

  async saveSubscription(
    userId: number,
    raw: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<void> {
    await this.repo.upsertForUser(userId, {
      endpoint: raw.endpoint,
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth,
    })
  }

  async unsubscribeUserEndpoint(userId: number, endpoint: string): Promise<void> {
    await this.repo.deleteByUserAndEndpoint(userId, endpoint)
  }

  notifyTaskCreated(task: TaskPushRef, actorUserId: number): void {
    void this.runNotifyTaskCreated(task, actorUserId)
  }

  notifyTaskCompleted(task: TaskPushRef, actorUserId: number): void {
    void this.runNotifyTaskCompleted(task, actorUserId)
  }

  /** Уведомление только вновь добавленным исполнителям (уже без актора). */
  notifyTaskAssigned(task: TaskPushRef, newAssigneeUserIds: number[], actorUserId: number): void {
    void this.runNotifyTaskAssigned(task, newAssigneeUserIds, actorUserId)
  }

  notifyDepartmentAdminsTaskMoved(task: TaskPushRef, actorUserId: number): void {
    void this.runNotifyDepartmentAdmins(task, actorUserId, [], {
      type: 'task_moved',
      title: 'Задача перенесена',
      tagSuffix: 'moved-dept',
      fullPlace: true,
    })
  }

  private async runNotifyTaskCreated(task: TaskPushRef, actorUserId: number): Promise<void> {
    if (!this.enabled) return
    await this.runNotifyDepartmentAdmins(task, actorUserId, this.responsibleIds(task), {
      type: 'task_created',
      title: 'Новая задача в отделе',
      tagSuffix: 'created-dept',
    })
  }

  private async runNotifyTaskCompleted(task: TaskPushRef, actorUserId: number): Promise<void> {
    if (!this.enabled) return
    const assigneeIds = this.responsibleIds(task).filter((id) => id !== actorUserId)
    if (assigneeIds.length > 0) {
      void this.sendToUserIds(assigneeIds, {
        type: 'task_completed',
        audience: 'assignee',
        taskId: task.id,
        title: 'Задача завершена',
        body: this.formatPushBody(task, 'assignee'),
        url: `/tasks/${task.id}`,
        tag: `task-${task.id}-completed`,
      })
    }
    await this.runNotifyDepartmentAdmins(task, actorUserId, this.responsibleIds(task), {
      type: 'task_completed',
      title: 'Задача завершена в отделе',
      tagSuffix: 'completed-dept',
    })
  }

  private async runNotifyTaskAssigned(
    task: TaskPushRef,
    newAssigneeUserIds: number[],
    actorUserId: number,
  ): Promise<void> {
    if (!this.enabled) return
    const assigneeIds = [...new Set(newAssigneeUserIds)].filter((id) => id !== actorUserId)
    if (assigneeIds.length > 0) {
      void this.sendToUserIds(assigneeIds, {
        type: 'task_assigned',
        audience: 'assignee',
        taskId: task.id,
        title: 'Вас назначили исполнителем задачи',
        body: this.formatPushBody(task, 'assignee'),
        url: `/tasks/${task.id}`,
        tag: `task-${task.id}-assigned`,
      })
    }
    await this.runNotifyDepartmentAdmins(task, actorUserId, assigneeIds, {
      type: 'task_assignees_changed',
      title: 'Изменены исполнители задачи',
      tagSuffix: 'assignees-dept',
    })
  }

  private async runNotifyDepartmentAdmins(
    task: TaskPushRef,
    actorUserId: number,
    excludeUserIds: number[],
    meta: {
      type: OutgoingPayload['type']
      title: string
      tagSuffix: string
      /** Для переноса: отдел · воронка · колонка (в title нет «в отделе»). */
      fullPlace?: boolean
    },
  ): Promise<void> {
    if (!this.enabled) return
    if (task.departmentId == null) return
    const event = this.mapPayloadTypeToNotificationEvent(meta.type)
    if (event) {
      const pipelineId = await this.resolvePipelineIdForTask(task)
      const flags = await this.policyResolver.resolveNotificationFlags(
        task.departmentId,
        pipelineId,
        event,
      )
      if (!flags.enabled) return
    }
    const adminIds = await this.departmentAdminRecipients(task.departmentId, actorUserId, excludeUserIds)
    if (adminIds.length === 0) return
    void this.sendToUserIds(adminIds, {
      type: meta.type,
      audience: 'dept_admin',
      taskId: task.id,
      title: meta.title,
      body: this.formatPushBody(task, meta.fullPlace ? 'full_place' : 'dept_admin'),
      url: `/tasks/${task.id}`,
      tag: `task-${task.id}-${meta.tagSuffix}`,
    })
  }

  private mapPayloadTypeToNotificationEvent(
    type: OutgoingPayload['type'],
  ): DeptAdminNotificationEvent | null {
    switch (type) {
      case 'task_created':
        return 'task_created'
      case 'task_completed':
        return 'task_completed'
      case 'task_moved':
        return 'task_moved'
      case 'task_assignees_changed':
        return 'task_assignees_changed'
      default:
        return null
    }
  }

  private async resolvePipelineIdForTask(task: TaskPushRef): Promise<number | null> {
    if (task.columnId == null) return null
    const col = await this.columnRepo.getColumnById(task.columnId)
    return col?.pipelineId ?? null
  }

  private async departmentAdminRecipients(
    departmentId: number | null | undefined,
    actorUserId: number,
    excludeUserIds: number[] = [],
  ): Promise<number[]> {
    if (departmentId == null) return []
    const dept = await this.departmentRepo.getDepartmentById(departmentId)
    if (!dept) return []
    const org = await this.organizationRepo.getOrganizationById(dept.organizationId)
    if (org?.isPersonal) return []
    const admins = await this.departmentRepo.getDepartmentAdminUserIds(departmentId)
    const exclude = new Set([actorUserId, ...excludeUserIds])
    return admins.filter((id) => !exclude.has(id))
  }

  private responsibleIds(task: TaskPushRef): number[] {
    if (task.responsibleIds != null && task.responsibleIds.length > 0) {
      return [...new Set(task.responsibleIds)]
    }
    if (task.responsibleId != null) return [task.responsibleId]
    return []
  }

  private shortName(name: string): string {
    return name.length > 120 ? `${name.slice(0, 117)}…` : name
  }

  /** assignee — отдел · воронка; dept_admin — только воронка; full_place — отдел · воронка · колонка. */
  private formatPushBody(
    task: TaskPushRef,
    context: 'assignee' | 'dept_admin' | 'full_place',
  ): string {
    const name = this.shortName(task.name)
    const place = this.formatPlaceLine(task, context)
    return place ? `${name}\n${place}` : name
  }

  private formatPlaceLine(
    task: TaskPushRef,
    context: 'assignee' | 'dept_admin' | 'full_place',
  ): string | null {
    const dept = task.departmentName?.trim() ?? ''
    const pipeline = task.pipelineName?.trim() ?? ''
    const column = task.columnName?.trim() ?? ''

    let parts: string[]
    if (context === 'dept_admin') {
      parts = pipeline ? [pipeline] : dept ? [dept] : []
    } else if (context === 'full_place') {
      parts = [dept, pipeline, column].filter(Boolean)
    } else {
      parts = [dept, pipeline].filter(Boolean)
    }

    if (parts.length === 0) return null
    return this.truncateContext(parts.join(' · '))
  }

  private truncateContext(text: string, max = 80): string {
    return text.length > max ? `${text.slice(0, 77)}…` : text
  }

  private async sendToUserIds(userIds: number[], payload: OutgoingPayload): Promise<void> {
    if (userIds.length === 0) return
    const prefsMap = await this.authRepo.getPreferencesForUserIds(userIds)
    const audience = payload.audience ?? 'assignee'
    const allowedIds = userIds.filter((id) => {
      const prefs = prefsMap.get(id)
      if (!prefs) return true
      return isPushAllowedForUser(prefs, payload.type, audience)
    })
    if (allowedIds.length === 0) return
    const subs = await this.repo.findKeysByUserIds(allowedIds)
    const body = JSON.stringify(payload)
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: {
                p256dh: s.p256dh,
                auth: s.auth,
              },
            },
            body,
          )
        } catch (err: unknown) {
          const code =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? (err as { statusCode?: number }).statusCode
              : undefined
          if (code === 404 || code === 410) {
            await this.repo.deleteByEndpoint(s.endpoint)
          }
        }
      }),
    )
  }
}
