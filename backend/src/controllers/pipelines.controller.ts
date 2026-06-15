import { inject, injectable } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../types.js'
import { PipelinesService } from '../services/pipelines.service.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { validateParamId } from '../middlewares/validationMiddleware.js'
import { BadRequestError } from '../infra/libs/errors.js'
import type { CreatePipelineDTO, UpdatePipelineDTO } from '../entities/pipelines/index.js'

@injectable()
export class PipelinesController {
  constructor(@inject(TYPES.PipelinesService) private readonly pipelinesService: PipelinesService) {}

  getPipelinesByDepartmentId: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { departmentId: string } }>(
      '/departments/:departmentId/pipelines',
      {
        preHandler: [
          authMiddleware,
          validateParamId('departmentId', 'id Раздела'),
        ],
      },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const pipelines = await this.pipelinesService.getPipelinesByDepartmentId(departmentId, req.user!.id)
        return reply.send(pipelines)
      },
    )
  }

  createPipeline: FastifyPluginAsync = async (fastify) => {
    fastify.post<{
      Params: { departmentId: string }
      Body: CreatePipelineDTO
    }>(
      '/departments/:departmentId/pipelines',
      {
        preHandler: [
          authMiddleware,
          validateParamId('departmentId', 'id Раздела'),
        ],
      },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const pipeline = await this.pipelinesService.createPipeline(departmentId, req.user!.id, {
          name: req.body.name,
          departmentId,
        })
        return reply.status(201).send(pipeline)
      },
    )
  }

  /**
   * Возвращает каталог готовых шаблонов воронок (IT-проект, баг-трекер и т.п.).
   * Защищён аутентификацией, чтобы не светить пресеты неавторизованным.
   */
  getPipelineTemplates: FastifyPluginAsync = async (fastify) => {
    fastify.get(
      '/pipeline-templates',
      { preHandler: [authMiddleware] },
      async (_req, reply) => {
        const templates = this.pipelinesService.getTemplates()
        return reply.send(templates)
      },
    )
  }

  /**
   * Создание воронки по шаблону: тело — `{ templateKey, name? }`. Если `name`
   * не передан, используется имя шаблона.
   */
  createPipelineFromTemplate: FastifyPluginAsync = async (fastify) => {
    fastify.post<{
      Params: { departmentId: string }
      Body: { templateKey?: string; name?: string }
    }>(
      '/departments/:departmentId/pipelines/from-template',
      {
        preHandler: [
          authMiddleware,
          validateParamId('departmentId', 'id Раздела'),
        ],
      },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const body = (req.body ?? {}) as { templateKey?: string; name?: string }
        if (typeof body.templateKey !== 'string' || body.templateKey.trim() === '') {
          throw new BadRequestError('templateKey обязателен')
        }
        const pipeline = await this.pipelinesService.createPipelineFromTemplate(
          departmentId,
          req.user!.id,
          {
            templateKey: body.templateKey.trim(),
            name: typeof body.name === 'string' ? body.name : undefined,
          },
        )
        return reply.status(201).send(pipeline)
      },
    )
  }

  /** Персональные избранные воронки пользователя во всех доступных ему организациях. */
  listAllFavoritePipelines: FastifyPluginAsync = async (fastify) => {
    fastify.get('/favorite-pipelines', { preHandler: [authMiddleware] }, async (req, reply) => {
      const items = await this.pipelinesService.listAllFavoritePipelines(req.user!.id)
      return reply.send(items)
    })
  }

  /** Персональные избранные воронки пользователя в организации. */
  listFavoritePipelines: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { organizationId: string } }>(
      '/organizations/:organizationId/favorite-pipelines',
      {
        preHandler: [
          authMiddleware,
          validateParamId('organizationId', 'id организации'),
        ],
      },
      async (req, reply) => {
        const organizationId = Number(req.params.organizationId)
        const items = await this.pipelinesService.listFavoritePipelines(organizationId, req.user!.id)
        return reply.send(items)
      },
    )
  }

  addFavoritePipeline: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Params: { id: string } }>(
      '/pipelines/:id/favorite',
      {
        preHandler: [authMiddleware, validateParamId('id', 'id воронки')],
      },
      async (req, reply) => {
        const id = Number(req.params.id)
        const item = await this.pipelinesService.addFavoritePipeline(id, req.user!.id)
        return reply.status(201).send(item)
      },
    )
  }

  removeFavoritePipeline: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Params: { id: string } }>(
      '/pipelines/:id/favorite',
      {
        preHandler: [authMiddleware, validateParamId('id', 'id воронки')],
      },
      async (req, reply) => {
        const id = Number(req.params.id)
        await this.pipelinesService.removeFavoritePipeline(id, req.user!.id)
        return reply.status(204).send()
      },
    )
  }

  updatePipeline: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{
      Params: { id: string }
      Body: UpdatePipelineDTO
    }>(
      '/pipelines/:id',
      {
        preHandler: [
          authMiddleware,
          validateParamId('id', 'id воронки'),
        ],
      },
      async (req, reply) => {
        const id = Number(req.params.id)
        const pipeline = await this.pipelinesService.updatePipeline(id, req.user!.id, req.body)
        return reply.send(pipeline)
      },
    )
  }

  getPipelinePolicies: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { id: string } }>(
      '/pipelines/:id/policies',
      {
        preHandler: [authMiddleware, validateParamId('id', 'id воронки')],
      },
      async (req, reply) => {
        const id = Number(req.params.id)
        const policies = await this.pipelinesService.getPipelinePolicies(id, req.user!.id)
        return reply.send({ policies })
      },
    )
  }

  updatePipelinePolicies: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
      '/pipelines/:id/policies',
      {
        preHandler: [authMiddleware, validateParamId('id', 'id воронки')],
      },
      async (req, reply) => {
        const id = Number(req.params.id)
        const policies = await this.pipelinesService.updatePipelinePolicies(id, req.user!.id, req.body)
        return reply.send({ policies })
      },
    )
  }

  updatePipelineColumnsPolicies: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{
      Params: { id: string }
      Body: { columns?: Array<{ columnId: number; policies: Record<string, unknown> }> }
    }>(
      '/pipelines/:id/columns/policies',
      {
        preHandler: [authMiddleware, validateParamId('id', 'id воронки')],
      },
      async (req, reply) => {
        const id = Number(req.params.id)
        const columns = req.body?.columns
        if (!Array.isArray(columns) || columns.length === 0) {
          throw new BadRequestError('Укажите массив columns')
        }
        const items = columns.map((c) => ({
          columnId: Number(c.columnId),
          policies: c.policies as import('../entities/column/column.policies.js').ColumnPolicies,
        }))
        const result = await this.pipelinesService.updatePipelineColumnsPolicies(
          id,
          req.user!.id,
          items,
        )
        return reply.send({ columns: result })
      },
    )
  }

  deletePipeline: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Params: { id: string } }>(
      '/pipelines/:id',
      {
        preHandler: [
          authMiddleware,
          validateParamId('id', 'id воронки'),
        ],
      },
      async (req, reply) => {
        const id = Number(req.params.id)
        await this.pipelinesService.softDeletePipeline(id, req.user!.id)
        return reply.status(204).send()
      },
    )
  }
}

