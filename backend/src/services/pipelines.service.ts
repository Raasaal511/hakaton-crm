import { inject, injectable } from 'inversify'
import { TYPES } from '../types.js'
import type { IPipelinesRepository, CreatePipelineDTO, UpdatePipelineDTO } from '../entities/pipelines/index.js'
import type { IColumnsRepository } from '../entities/columnts/index.js'
import type { IUserFavoritePipelinesRepository } from '../entities/favorite-pipelines/favorite-pipelines.repository.interface.js'
import type { Pipeline } from '../infra/database/drizzle/schema.js'
import { DepartmentService } from './department.service.js'
import { OrganizationAccessService } from './organization-access.service.js'
import type { DepartmentAccessService } from './department-access.service.js'
import { BadRequestError, ForbiddenError, NotFoundError } from '../infra/libs/errors.js'
import { validateNonEmptyString } from '../infra/libs/validation.js'
import {
  PIPELINE_TEMPLATES,
  getPipelineTemplateByKey,
  type PipelineTemplate,
} from '../infra/libs/pipelineTemplates.js'
import { mergePipelinePolicies, type PipelinePolicies } from '../entities/pipeline/pipeline.policies.js'
import type { ColumnPolicies } from '../entities/column/column.policies.js'

@injectable()
export class PipelinesService {
  constructor(
    @inject(TYPES.PipelinesRepository) private readonly pipelinesRepo: IPipelinesRepository,
    @inject(TYPES.ColumnRepository) private readonly columnRepo: IColumnsRepository,
    @inject(TYPES.UserFavoritePipelinesRepository)
    private readonly favoritePipelinesRepo: IUserFavoritePipelinesRepository,
    @inject(TYPES.DepartmentService) private readonly departmentService: DepartmentService,
    @inject(TYPES.OrganizationAccessService) private readonly orgAccessService: OrganizationAccessService,
    @inject(TYPES.DepartmentAccessService) private readonly departmentAccessService: DepartmentAccessService,
  ) {}

  private async ensurePipelineExists(id: number): Promise<Pipeline> {
    const pipeline = await this.pipelinesRepo.getPipelineById(id)
    if (!pipeline) {
      throw new NotFoundError('Такой воронки не существует')
    }
    return pipeline
  }

  private mapPipelineForApi(pipeline: Pipeline): Pipeline & { policies: PipelinePolicies } {
    return {
      ...pipeline,
      policies: mergePipelinePolicies(null),
    }
  }

  async getPipelineById(id: number, currentUserId: number): Promise<Pipeline & { policies: PipelinePolicies }> {
    const pipeline = await this.ensurePipelineExists(id)
    const department = await this.departmentService.getDepartmentById(pipeline.departmentId, currentUserId)
    await this.orgAccessService.ensureUserInOrganization(department.organizationId, currentUserId)
    return this.mapPipelineForApi(pipeline)
  }

  async getPipelinesByDepartmentId(
    departmentId: number,
    currentUserId: number,
  ): Promise<(Pipeline & { policies: PipelinePolicies })[]> {
    const department = await this.departmentService.getDepartmentById(departmentId, currentUserId)
    await this.orgAccessService.ensureUserInOrganization(department.organizationId, currentUserId)
    const list = await this.pipelinesRepo.getPipelinesByDepartmentId(departmentId)
    return list.map((p) => this.mapPipelineForApi(p))
  }

  async getPipelinePolicies(pipelineId: number, currentUserId: number): Promise<PipelinePolicies> {
    const pipeline = await this.ensurePipelineExists(pipelineId)
    const department = await this.departmentService.getDepartmentById(pipeline.departmentId, currentUserId)
    await this.orgAccessService.ensureIsOwner(
      department.organizationId,
      currentUserId,
      'просматривать политики воронки',
    )
    return mergePipelinePolicies(null)
  }

  async updatePipelinePolicies(
    pipelineId: number,
    currentUserId: number,
    _body: unknown,
  ): Promise<PipelinePolicies> {
    const pipeline = await this.ensurePipelineExists(pipelineId)
    const department = await this.departmentService.getDepartmentById(pipeline.departmentId, currentUserId)
    await this.orgAccessService.ensureIsOwner(
      department.organizationId,
      currentUserId,
      'менять политики воронки',
    )
    throw new BadRequestError('Политики воронки больше не настраиваются')
  }

  async updatePipelineColumnsPolicies(
    pipelineId: number,
    currentUserId: number,
    _items: Array<{ columnId: number; policies: Partial<ColumnPolicies> }>,
  ): Promise<Array<{ columnId: number; policies: ColumnPolicies }>> {
    const pipeline = await this.ensurePipelineExists(pipelineId)
    const department = await this.departmentService.getDepartmentById(pipeline.departmentId, currentUserId)
    await this.orgAccessService.ensureIsOwner(
      department.organizationId,
      currentUserId,
      'менять политики колонок воронки',
    )
    void pipelineId
    throw new BadRequestError('Политики колонок воронки больше не настраиваются')
  }

  async createPipeline(departmentId: number, currentUserId: number, dto: CreatePipelineDTO): Promise<Pipeline> {
    const department = await this.departmentService.getDepartmentById(departmentId, currentUserId)
    await this.departmentAccessService.ensureDepartmentPermission(
      departmentId,
      currentUserId,
      'deptAdminCanManagePipelines',
    )

    validateNonEmptyString(dto.name, 'Название воронки')
    const trimmedName = dto.name!.trim()
    if (!trimmedName) {
      throw new BadRequestError('Название воронки обязательно')
    }

    const pipeline = await this.pipelinesRepo.createPipeline({
      name: trimmedName,
      departmentId,
    })

    await this.columnRepo.createColumn({
      name: 'Задачи',
      position: 0,
      departmentId,
      pipelineId: pipeline.id,
      color: null,
    })

    return pipeline
  }

  /**
   * Список доступных шаблонов воронок. Это статический каталог — никаких прав
   * проверять не нужно, но эндпоинт всё равно защищён аутентификацией на уровне
   * контроллера, чтобы не светить пресеты неавторизованным.
   */
  getTemplates(): readonly PipelineTemplate[] {
    return PIPELINE_TEMPLATES
  }

  /**
   * Создаёт пользовательскую воронку по выбранному шаблону: имя, набор колонок
   * и их цвета берутся из пресета. `isMainTemplate` всегда `false` — шаблоны
   * порождают обычные пользовательские воронки, не системные.
   */
  async createPipelineFromTemplate(
    departmentId: number,
    currentUserId: number,
    input: { templateKey: string; name?: string },
  ): Promise<Pipeline> {
    await this.departmentService.getDepartmentById(departmentId, currentUserId)
    await this.departmentAccessService.ensureDepartmentPermission(
      departmentId,
      currentUserId,
      'deptAdminCanManagePipelines',
    )

    const template = getPipelineTemplateByKey(input.templateKey)
    if (!template) {
      throw new BadRequestError('Неизвестный шаблон воронки')
    }
    if (template.columns.length === 0) {
      throw new BadRequestError('Шаблон не содержит колонок')
    }

    const requestedName = typeof input.name === 'string' ? input.name.trim() : ''
    const pipelineName = requestedName.length > 0 ? requestedName : template.name

    const pipeline = await this.pipelinesRepo.createPipeline({
      name: pipelineName,
      departmentId,
    })

    for (let i = 0; i < template.columns.length; i++) {
      const col = template.columns[i]!
      await this.columnRepo.createColumn({
        name: col.name,
        position: i,
        departmentId,
        pipelineId: pipeline.id,
        color: col.color ?? null,
      })
    }

    return pipeline
  }

  async updatePipeline(id: number, currentUserId: number, dto: UpdatePipelineDTO): Promise<Pipeline> {
    const pipeline = await this.ensurePipelineExists(id)
    await this.departmentService.getDepartmentById(pipeline.departmentId, currentUserId)
    await this.departmentAccessService.ensureDepartmentPermission(
      pipeline.departmentId,
      currentUserId,
      'deptAdminCanManagePipelines',
    )

    if (typeof dto.name !== 'string') {
      return pipeline
    }

    const payload: UpdatePipelineDTO & { id: number } = { id }

    const trimmedName = dto.name.trim()
    if (!trimmedName) {
      throw new BadRequestError('Название воронки не может быть пустым')
    }
    if (pipeline.isMainTemplate && trimmedName !== pipeline.name) {
      throw new ForbiddenError('Системную воронку «Основная воронка» нельзя переименовать')
    }
    payload.name = trimmedName

    return this.pipelinesRepo.updatePipeline(payload)
  }

  async softDeletePipeline(id: number, currentUserId: number): Promise<void> {
    const pipeline = await this.ensurePipelineExists(id)
    await this.departmentService.getDepartmentById(pipeline.departmentId, currentUserId)
    await this.departmentAccessService.ensureDepartmentPermission(
      pipeline.departmentId,
      currentUserId,
      'deptAdminCanManagePipelines',
    )
    if (pipeline.isMainTemplate) {
      throw new ForbiddenError('Системную воронку «Основная воронка» нельзя удалить')
    }
    await this.pipelinesRepo.softDeletePipeline(id)
  }

  /** Избранные воронки текущего пользователя в рамках одной организации. */
  async listFavoritePipelines(organizationId: number, userId: number) {
    await this.orgAccessService.ensureUserInOrganization(organizationId, userId)
    return this.favoritePipelinesRepo.listForOrganization(userId, organizationId)
  }

  /**
   * Все избранные воронки пользователя во всех пространствах, где он ещё участник
   * `users_to_organizations`.
   */
  async listAllFavoritePipelines(userId: number) {
    return this.favoritePipelinesRepo.listAllForUser(userId)
  }

  /** Добавить воронку в избранное (доступен любой участник организации раздела). */
  async addFavoritePipeline(pipelineId: number, userId: number) {
    const pipeline = await this.ensurePipelineExists(pipelineId)
    const department = await this.departmentService.getDepartmentById(pipeline.departmentId, userId)
    await this.orgAccessService.ensureUserInOrganization(department.organizationId, userId)
    await this.favoritePipelinesRepo.add(userId, pipelineId)
    return {
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      departmentId: department.id,
      departmentName: department.name,
    }
  }

  async removeFavoritePipeline(pipelineId: number, userId: number): Promise<void> {
    const pipeline = await this.ensurePipelineExists(pipelineId)
    const department = await this.departmentService.getDepartmentById(pipeline.departmentId, userId)
    await this.orgAccessService.ensureUserInOrganization(department.organizationId, userId)
    await this.favoritePipelinesRepo.remove(userId, pipelineId)
  }
}

