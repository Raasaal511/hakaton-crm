import { injectable, inject } from 'inversify'
import { TYPES } from '../../types.js'
import { NotFoundError, BadRequestError } from '../../infra/libs/errors.js'
import { AuditService } from '../../services/audit.service.js'
import { ProjectsRepository } from './projects.repository.js'
import type { CreateProjectDTO, UpdateProjectDTO, ProjectListFilter, AddProjectMemberDTO } from './projects.types.js'
import type { Project } from '../../infra/database/drizzle/schema.js'

@injectable()
export class ProjectsService {
  constructor(
    @inject(TYPES.ProjectsRepository) private repo: ProjectsRepository,
    @inject(TYPES.AuditService) private audit: AuditService,
  ) {}

  async list(orgId: number, filter: ProjectListFilter = {}) {
    const [items, total] = await Promise.all([
      this.repo.findAll(orgId, filter),
      this.repo.count(orgId, filter),
    ])
    return { items, total }
  }

  async getById(orgId: number, id: number): Promise<Project> {
    const project = await this.repo.findById(orgId, id)
    if (!project) throw new NotFoundError('Проект не найден')
    return project
  }

  async create(orgId: number, userId: number, dto: CreateProjectDTO): Promise<Project> {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название проекта обязательно')

    const project = await this.repo.create(orgId, userId, { ...dto, name })

    await this.repo.addMember(project.id, userId, 'owner')

    await this.audit.record({
      organizationId: orgId,
      actorUserId: userId,
      entityType: 'project',
      entityId: project.id,
      action: 'project_created',
      payload: { name: project.name },
    })

    return project
  }

  async update(orgId: number, id: number, userId: number, dto: UpdateProjectDTO): Promise<Project> {
    await this.getById(orgId, id)

    const updated = await this.repo.update(orgId, id, dto)
    if (!updated) throw new NotFoundError('Проект не найден')

    await this.audit.record({
      organizationId: orgId,
      actorUserId: userId,
      entityType: 'project',
      entityId: id,
      action: 'project_updated',
      payload: dto as Record<string, unknown>,
    })

    return updated
  }

  async delete(orgId: number, id: number, userId: number): Promise<void> {
    await this.getById(orgId, id)
    const deleted = await this.repo.softDelete(orgId, id)
    if (!deleted) throw new NotFoundError('Проект не найден')

    await this.audit.record({
      organizationId: orgId,
      actorUserId: userId,
      entityType: 'project',
      entityId: id,
      action: 'project_deleted',
      payload: {},
    })
  }

  async getMembers(orgId: number, projectId: number) {
    await this.getById(orgId, projectId)
    return this.repo.getMembers(projectId)
  }

  async addMember(orgId: number, projectId: number, userId: number, dto: AddProjectMemberDTO) {
    await this.getById(orgId, projectId)
    await this.repo.addMember(projectId, dto.userId, dto.role ?? 'member')
    return this.repo.getMembers(projectId)
  }

  async removeMember(orgId: number, projectId: number, userId: number, targetUserId: number) {
    await this.getById(orgId, projectId)
    const removed = await this.repo.removeMember(projectId, targetUserId)
    if (!removed) throw new NotFoundError('Участник не найден')
  }
}
