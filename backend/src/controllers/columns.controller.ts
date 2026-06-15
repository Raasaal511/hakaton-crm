import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { ColumnService } from "../services/column.service";
import { FastifyPluginAsync } from "fastify";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validateParamId } from "../middlewares/validationMiddleware";
import { BadRequestError } from "../infra/libs/errors";
import { CreateColumnDTO } from "../entities/columnts";

@injectable()
export class ColumnsController {
    constructor(@inject(TYPES.ColumnService) private columnService: ColumnService) { }

    getColumnsByPipeline: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { pipelineId: string } }>(
            '/pipelines/:pipelineId/columns',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('pipelineId', 'id воронки'),
                ],
            },
            async (req, reply) => {
                const pipelineId = Number(req.params.pipelineId)
                const columns = await this.columnService.getColumnsByPipelineId(
                    pipelineId,
                    req.user!.id,
                )
                return reply.send(columns)
            },
        )
    }

    getColumns: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { departmentId: string } }>(
            '/departments/:departmentId/columns',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('departmentId', 'id Раздела'),
                ],
            },
            async (req, reply) => {
                const departmentId = Number(req.params.departmentId)
                const columns = await this.columnService.getColumnsByDepartmentId(
                    departmentId,
                    req.user!.id
                )
                return reply.send(columns)
            }
        )
    }

    createColumn: FastifyPluginAsync = async (fastify) => {
        fastify.post<{
            Params: { departmentId: string }
            Body: CreateColumnDTO
        }>(
            '/departments/:departmentId/columns',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('departmentId', 'id Раздела'),
                ],
            },
            async (req, reply) => {
                const departmentId = Number(req.params.departmentId)
                const dto: CreateColumnDTO = {
                    name: req.body.name,
                    position: req.body.position,
                    departmentId,
                    color: req.body.color ?? null,
                    pipelineId: req.body.pipelineId,
                }
                const column = await this.columnService.createColumn(dto, req.user!.id)
                return reply.status(201).send(column)
            }
        )
    }

    updateColumn: FastifyPluginAsync = async (fastify) => {
        fastify.patch<{
            Params: { departmentId: string; id: string }
            Body: { name?: string; position?: number; color?: string | null }
        }>(
            '/departments/:departmentId/columns/:id',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('departmentId', 'id Раздела'),
                    validateParamId('id', 'id колонки'),
                ],
            },
            async (req, reply) => {
                const departmentId = Number(req.params.departmentId)
                const columnId = Number(req.params.id)
                const column = await this.columnService.updateColumn(
                    req.body,
                    columnId,
                    departmentId,
                    req.user!.id
                )
                return reply.send(column)
            }
        )
    }

    deleteColumn: FastifyPluginAsync = async (fastify) => {
        fastify.delete<{ Params: { departmentId: string; id: string } }>(
            '/departments/:departmentId/columns/:id',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('departmentId', 'id Раздела'),
                    validateParamId('id', 'id колонки'),
                ],
            },
            async (req, reply) => {
                const departmentId = Number(req.params.departmentId)
                const columnId = Number(req.params.id)
                await this.columnService.softDeleteColumn(
                    columnId,
                    departmentId,
                    req.user!.id
                )
                return reply.status(204).send()
            }
        )
    }

    getColumnPolicies: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { departmentId: string; columnId: string } }>(
            '/departments/:departmentId/columns/:columnId/policies',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('departmentId', 'id Раздела'),
                    validateParamId('columnId', 'id колонки'),
                ],
            },
            async (req, reply) => {
                const departmentId = Number(req.params.departmentId)
                const columnId = Number(req.params.columnId)
                const policies = await this.columnService.getColumnPolicies(
                    departmentId,
                    columnId,
                    req.user!.id,
                )
                return reply.send({ policies })
            },
        )
    }

    updateColumnPolicies: FastifyPluginAsync = async (fastify) => {
        fastify.patch<{ Params: { departmentId: string; columnId: string }; Body: Record<string, unknown> }>(
            '/departments/:departmentId/columns/:columnId/policies',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('departmentId', 'id Раздела'),
                    validateParamId('columnId', 'id колонки'),
                ],
            },
            async (req, reply) => {
                const departmentId = Number(req.params.departmentId)
                const columnId = Number(req.params.columnId)
                const policies = await this.columnService.updateColumnPolicies(
                    departmentId,
                    columnId,
                    req.user!.id,
                    req.body,
                )
                return reply.send({ policies })
            },
        )
    }

    reorderColumns: FastifyPluginAsync = async (fastify) => {
        fastify.patch<{
            Params: { departmentId: string }
            Body: { columnIds: number[] }
        }>(
            '/departments/:departmentId/columns/reorder',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('departmentId', 'id Раздела'),
                ],
            },
            async (req, reply) => {
                const departmentId = Number(req.params.departmentId)
                const columnIds = req.body.columnIds
                if (!Array.isArray(columnIds)) throw new BadRequestError('columnIds должен быть массивом')
                await this.columnService.reorderColumns(
                    departmentId,
                    columnIds,
                    req.user!.id
                )
                return reply.status(204).send()
            }
        )
    }
}