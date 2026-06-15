import { inject, injectable } from 'inversify'
import { TYPES } from '../types.js'
import { CreateTagDTO, ITagsRepository, UpdateTagDTO } from '../entities/tags/index.js'
import { BadRequestError, NotFoundError } from '../infra/libs/errors.js'
import { Tag } from '../infra/database/drizzle/schema.js'
import { OrganizationAccessService } from './organization-access.service.js'
import { DepartmentAccessService } from './department-access.service.js'
import { DepartmentService } from './department.service.js'
import { TasksService } from './tasks.service.js'
import { TaskActivityService } from './task-activity.service.js'

@injectable()
export class TagsService {
  constructor(
    @inject(TYPES.TagsRepository) private tagsRepo: ITagsRepository,
    @inject(TYPES.OrganizationAccessService) private orgAccess: OrganizationAccessService,
    @inject(TYPES.DepartmentAccessService) private departmentAccess: DepartmentAccessService,
    @inject(TYPES.DepartmentService) private departmentService: DepartmentService,
    @inject(TYPES.TasksService) private tasksService: TasksService,
    @inject(TYPES.TaskActivityService) private taskActivity: TaskActivityService,
  ) { }

  private async ensureTagExist(tagId: number): Promise<Tag> {
    const tag = await this.tagsRepo.getTagById(tagId)
    if (!tag) throw new NotFoundError('Такого тега не существует')
    return tag
  }

  async getByDepartment(departmentId: number, currentUserId: number): Promise<Tag[]> {
    await this.departmentService.getDepartmentById(departmentId, currentUserId)
    return this.tagsRepo.getTagsByDepartmentId(departmentId)
  }

  async searchByDepartment(departmentId: number, currentUserId: number, query: string): Promise<Tag[]> {
    await this.departmentService.getDepartmentById(departmentId, currentUserId)
    const trimmed = query.trim()
    if (!trimmed) return []
    return this.tagsRepo.searchTagsByDepartment(departmentId, trimmed)
  }

  async getTagsForTask(taskId: number, currentUserId: number): Promise<Tag[]> {
    await this.tasksService.getTaskById(taskId, currentUserId, { includeAttachments: false })
    return this.tagsRepo.getTagsByTaskId(taskId)
  }

  async setTagsForTask(taskId: number, currentUserId: number, tagIds: number[]): Promise<void> {
    const task = await this.tasksService.assertCanEditTaskContent(taskId, currentUserId)
    const taskWithDept = task as typeof task & { departmentId?: number }
    const taskDepartmentId = taskWithDept.departmentId

    const uniqueTagIds = Array.from(new Set(tagIds))
    if (uniqueTagIds.length > 0) {
      for (const tagId of uniqueTagIds) {
        const tag = await this.ensureTagExist(tagId)
        if (tag.organizationId !== task.organizationId) {
          throw new BadRequestError('Тег принадлежит другой организации')
        }
        if (tag.departmentId != null && taskDepartmentId != null && tag.departmentId !== taskDepartmentId) {
          throw new BadRequestError('Тег принадлежит другому Разделу')
        }
      }
    }

    const tagSignature = (tags: Tag[]) =>
      [...tags].sort((a, b) => a.id - b.id).map((t) => t.id)
        .join(',')

    const beforeTags = await this.tagsRepo.getTagsByTaskId(taskId)
    await this.tagsRepo.setTagsForTask(taskId, uniqueTagIds)
    const afterTags = await this.tagsRepo.getTagsByTaskId(taskId)
    if (tagSignature(beforeTags) !== tagSignature(afterTags)) {
      await this.taskActivity.append(taskId, currentUserId, 'tags', {
        before: beforeTags.map((t) => ({ id: t.id, name: t.name })),
        after: afterTags.map((t) => ({ id: t.id, name: t.name })),
      }).catch(() => undefined)
    }

    // Пропагация тегов на дочерние задачи рассылки (если это родительская задача)
    const childrenIds = await this.tasksService.getBroadcastChildrenIds(taskId).catch(() => [])
    for (const childId of childrenIds) {
      await this.tagsRepo.setTagsForTask(childId, uniqueTagIds).catch(() => undefined)
    }
  }

  async createTag(organizationId: number, currentUserId: number, dto: { name: string; departmentId?: number }) {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Введите корректные данные')

    await this.orgAccess.ensureCanManageOrganization(organizationId, currentUserId)
    const payload: CreateTagDTO = { name, organizationId, departmentId: dto.departmentId }
    return this.tagsRepo.createTag(payload)
  }

  async createTagByDepartment(departmentId: number, currentUserId: number, dto: { name: string }) {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Введите корректные данные')

    const department = await this.departmentService.getDepartmentById(departmentId, currentUserId)
    await this.departmentAccess.ensureDepartmentPermission(
      departmentId,
      currentUserId,
      'deptAdminCanManageTags',
    )
    const payload: CreateTagDTO = { name, organizationId: department.organizationId, departmentId }
    return this.tagsRepo.createTag(payload)
  }

  async updateTagByDepartment(departmentId: number, currentUserId: number, tagId: number, dto: UpdateTagDTO): Promise<Tag> {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название тега обязательно')

    await this.departmentService.getDepartmentById(departmentId, currentUserId)
    const existing = await this.ensureTagExist(tagId)
    if (existing.departmentId !== departmentId) throw new NotFoundError('Такого тега не существует')

    await this.departmentAccess.ensureDepartmentPermission(
      departmentId,
      currentUserId,
      'deptAdminCanManageTags',
    )
    return this.tagsRepo.updateTag(tagId, { name })
  }

  async deleteTagByDepartment(departmentId: number, currentUserId: number, tagId: number): Promise<void> {
    await this.departmentService.getDepartmentById(departmentId, currentUserId)
    const existing = await this.ensureTagExist(tagId)
    if (existing.departmentId !== departmentId) throw new NotFoundError('Такого тега не существует')

    await this.departmentAccess.ensureDepartmentPermission(
      departmentId,
      currentUserId,
      'deptAdminCanManageTags',
    )
    await this.tagsRepo.deleteTag(tagId)
  }

  async updateTag(organizationId: number, currentUserId: number, tagId: number, dto: UpdateTagDTO): Promise<Tag> {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название тега обязательно')

    const existing = await this.ensureTagExist(tagId)
    if (existing.organizationId !== organizationId) throw new NotFoundError('Такого тега не существует')

    await this.orgAccess.ensureCanManageOrganization(organizationId, currentUserId)
    return this.tagsRepo.updateTag(tagId, { name })
  }

  async deleteTag(organizationId: number, currentUserId: number, tagId: number): Promise<void> {
    const existing = await this.ensureTagExist(tagId)
    if (existing.organizationId !== organizationId) throw new NotFoundError('Такого тега не существует')

    await this.orgAccess.ensureCanManageOrganization(organizationId, currentUserId)
    await this.tagsRepo.deleteTag(tagId)
  }
}