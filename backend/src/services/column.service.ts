import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { CreateColumnDTO, IColumnsRepository, UpdateColumnDTO } from "../entities/columnts";
import type { IPipelinesRepository } from '../entities/pipelines/index.js'
import type { Column } from '../infra/database/drizzle/schema.js'
import { DepartmentService } from "./department.service";
import { BadRequestError, ForbiddenError, NotFoundError } from "../infra/libs/errors";
import { DepartmentAccessService } from "./department-access.service.js";
import { PipelinesService } from './pipelines.service.js'
import { mergeColumnPolicies, type ColumnPolicies } from '../entities/column/column.policies.js'
import type { OrganizationAccessService } from './organization-access.service.js'

const MAIN_PIPELINE_COLUMNS_LOCKED = 'Колонки системной воронки «Основная воронка» нельзя изменять'

@injectable()
export class ColumnService {
    constructor(
        @inject(TYPES.ColumnRepository) private columnRepository: IColumnsRepository,
        @inject(TYPES.PipelinesRepository) private pipelinesRepo: IPipelinesRepository,
        @inject(TYPES.DepartmentService) private departmentService: DepartmentService,
        @inject(TYPES.DepartmentAccessService) private departmentAccessService: DepartmentAccessService,
        @inject(TYPES.PipelinesService) private pipelinesService: PipelinesService,
        @inject(TYPES.OrganizationAccessService) private orgAccessService: OrganizationAccessService,
    ) { }

    private mapColumnForApi(column: Column): Column & { policies: ColumnPolicies } {
        return {
            ...column,
            policies: mergeColumnPolicies(null),
        }
    }

    private async ensureColumnExist(columnId: number): Promise<Column> {
        const column = await this.columnRepository.getColumnById(columnId)
        if (!column) throw new NotFoundError('Такой колонки не существует')
        return column
    }

    async getColumnsByDepartmentId(departmentId: number, currentUserId: number): Promise<Column[]> {
        await this.departmentService.getDepartmentById(departmentId, currentUserId)
        return this.columnRepository.getColumnsByDepartmentId(departmentId)
    }

    async getColumnsByPipelineId(pipelineId: number, currentUserId: number): Promise<(Column & { policies: ColumnPolicies })[]> {
        const pipeline = await this.pipelinesService.getPipelineById(pipelineId, currentUserId)
        const columns = await this.columnRepository.getColumnsByPipelineId(pipeline.id)
        return columns.map((c) => this.mapColumnForApi(c))
    }

    async getColumnPolicies(
        departmentId: number,
        columnId: number,
        currentUserId: number,
    ): Promise<ColumnPolicies> {
        const column = await this.ensureColumnExist(columnId)
        if (column.departmentId !== departmentId) {
            throw new BadRequestError('Колонка не принадлежит разделу')
        }
        const department = await this.departmentService.getDepartmentById(departmentId, currentUserId)
        await this.orgAccessService.ensureIsOwner(
            department.organizationId,
            currentUserId,
            'просматривать политики колонки',
        )
        return mergeColumnPolicies(null)
    }

    async updateColumnPolicies(
        departmentId: number,
        columnId: number,
        currentUserId: number,
        _body: unknown,
    ): Promise<ColumnPolicies> {
        const column = await this.ensureColumnExist(columnId)
        if (column.departmentId !== departmentId) {
            throw new BadRequestError('Колонка не принадлежит разделу')
        }
        const department = await this.departmentService.getDepartmentById(departmentId, currentUserId)
        await this.orgAccessService.ensureIsOwner(
            department.organizationId,
            currentUserId,
            'менять политики колонки',
        )
        throw new BadRequestError('Политики колонки больше не настраиваются')
    }

    private async assertPipelineColumnsEditable(pipelineId: number): Promise<void> {
        const pipeline = await this.pipelinesRepo.getPipelineById(pipelineId)
        if (!pipeline) {
            throw new NotFoundError('Такой воронки не существует')
        }
        if (pipeline.isMainTemplate) {
            throw new ForbiddenError(MAIN_PIPELINE_COLUMNS_LOCKED)
        }
    }

    async createColumn({ name, position, departmentId, color, pipelineId }: CreateColumnDTO, currentUserId: number): Promise<Column> {
        const trimmedName = name?.trim()
        if (!trimmedName) throw new BadRequestError('Название колонки обязательно')

        const safeColor = color?.trim() || null

        const department = await this.departmentService.getDepartmentById(departmentId, currentUserId)
        await this.departmentAccessService.ensureDepartmentPermission(
            departmentId,
            currentUserId,
            'deptAdminCanManageColumns',
        )


        let targetPipelineId: number
        if (pipelineId != null) {
            const pipeline = await this.pipelinesService.getPipelineById(pipelineId, currentUserId)
            if (pipeline.departmentId !== departmentId) {
                throw new BadRequestError('Воронка не принадлежит этому Разделу')
            }
            targetPipelineId = pipeline.id
        } else {
            const pipelines = await this.pipelinesService.getPipelinesByDepartmentId(departmentId, currentUserId)
            const defaultPipeline = pipelines[0]
            if (!defaultPipeline) {
                throw new BadRequestError('Для Раздела не найдена ни одна воронка')
            }
            targetPipelineId = defaultPipeline.id
        }

        await this.assertPipelineColumnsEditable(targetPipelineId)

        return this.columnRepository.createColumn({
            name: trimmedName,
            position,
            departmentId,
            color: safeColor,
            pipelineId: targetPipelineId,
        })
    }

    async updateColumn({ name, color }: UpdateColumnDTO, columnId: number, departmentId: number, currentUserId: number): Promise<Column> {
        const column = await this.ensureColumnExist(columnId)
        if (column.departmentId !== departmentId) throw new NotFoundError('Колонка не принадлежит этому Разделу')
        const department = await this.departmentService.getDepartmentById(departmentId, currentUserId)
        await this.departmentAccessService.ensureDepartmentPermission(
            departmentId,
            currentUserId,
            'deptAdminCanManageColumns',
        )

        if (column.pipelineId != null) {
            const pipeline = await this.pipelinesRepo.getPipelineById(column.pipelineId)
            if (!pipeline) throw new NotFoundError('Такой воронки не существует')
            if (pipeline.isMainTemplate) {
                const wantsNameChange =
                    typeof name === 'string' &&
                    name.trim().length > 0 &&
                    name.trim() !== column.name
                if (wantsNameChange) {
                    throw new ForbiddenError(MAIN_PIPELINE_COLUMNS_LOCKED)
                }
            }
        }

        const updatePayload: UpdateColumnDTO & { id: number } = { id: columnId }

        if (typeof name === 'string') {
            const trimmedName = name.trim()
            if (trimmedName) {
                updatePayload.name = trimmedName
            }
        }

        if (color !== undefined) {
            const trimmedColor = color?.trim()
            updatePayload.color = trimmedColor || null
        }

        return this.columnRepository.updateColumn(updatePayload)
    }

    async softDeleteColumn(columnId: number, departmentId: number, currentUserId: number): Promise<void> {
        const column = await this.ensureColumnExist(columnId)
        if (column.departmentId !== departmentId) throw new NotFoundError('Колонка не принадлежит этому Разделу')
        const department = await this.departmentService.getDepartmentById(departmentId, currentUserId)
        await this.departmentAccessService.ensureDepartmentPermission(
            departmentId,
            currentUserId,
            'deptAdminCanManageColumns',
        )

        if (column.pipelineId != null) {
            await this.assertPipelineColumnsEditable(column.pipelineId)
        }

        return this.columnRepository.softDeleteColumn(columnId)
    }

    async reorderColumns(departmentId: number, columnIds: number[], currentUserId: number): Promise<void> {
        const department = await this.departmentService.getDepartmentById(departmentId, currentUserId)
        await this.departmentAccessService.ensureDepartmentPermission(
            departmentId,
            currentUserId,
            'deptAdminCanManageColumns',
        )

        for (const id of columnIds) {
            const col = await this.columnRepository.getColumnById(id)
            if (col && col.departmentId === departmentId && col.pipelineId != null) {
                await this.assertPipelineColumnsEditable(col.pipelineId)
            }
        }

        return this.columnRepository.reorderColumns(departmentId, columnIds)
    }

}