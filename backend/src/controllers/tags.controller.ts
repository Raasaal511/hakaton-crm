import { inject, injectable } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../types.js'
import { TagsService } from '../services/tags.service.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { validateParamId } from '../middlewares/validationMiddleware.js'
import { BadRequestError } from '../infra/libs/errors.js'

@injectable()
export class TagsController {
  constructor(@inject(TYPES.TagsService) private tagsService: TagsService) { }

  getTagsByDepartment: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { departmentId: string } }>(
      '/departments/:departmentId/tags',
      {
        preHandler: [
          authMiddleware,
          validateParamId('departmentId', 'id Раздела'),
        ],
      },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const tags = await this.tagsService.getByDepartment(departmentId, req.user!.id)
        return reply.send(tags)
      },
    )
  }

  searchTagsByDepartment: FastifyPluginAsync = async (fastify) => {
    fastify.get<{
      Params: { departmentId: string }
      Querystring: { query?: string }
    }>(
      '/departments/:departmentId/tags/search',
      {
        preHandler: [
          authMiddleware,
          validateParamId('departmentId', 'id Раздела'),
        ],
      },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const query = req.query.query ?? ''
        const tags = await this.tagsService.searchByDepartment(departmentId, req.user!.id, query)
        return reply.send(tags)
      },
    )
  }

  getTaskTags: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { taskId: string } }>(
      '/tasks/:taskId/tags',
      {
        preHandler: [
          authMiddleware,
          validateParamId('taskId', 'id задачи'),
        ],
      },
      async (req, reply) => {
        const taskId = Number(req.params.taskId)
        const tags = await this.tagsService.getTagsForTask(taskId, req.user!.id)
        return reply.send(tags)
      },
    )
  }

  setTaskTags: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{
      Params: { taskId: string }
      Body: { tagIds: number[] }
    }>(
      '/tasks/:taskId/tags',
      {
        preHandler: [
          authMiddleware,
          validateParamId('taskId', 'id задачи'),
        ],
      },
      async (req, reply) => {
        const taskId = Number(req.params.taskId)
        const { tagIds } = req.body
        if (!Array.isArray(tagIds)) {
          throw new BadRequestError('tagIds должен быть массивом')
        }

        await this.tagsService.setTagsForTask(taskId, req.user!.id, tagIds)
        return reply.status(204).send()
      },
    )
  }

  createTagByDepartment: FastifyPluginAsync = async (fastify) => {
    fastify.post<{
      Params: { departmentId: string }
      Body: { name: string }
    }>(
      '/departments/:departmentId/tags',
      {
        preHandler: [
          authMiddleware,
          validateParamId('departmentId', 'id Раздела'),
        ],
      },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const tag = await this.tagsService.createTagByDepartment(departmentId, req.user!.id, {
          name: req.body.name,
        })
        return reply.status(201).send(tag)
      },
    )
  }

  updateTagByDepartment: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{
      Params: { departmentId: string; id: string }
      Body: { name: string }
    }>(
      '/departments/:departmentId/tags/:id',
      {
        preHandler: [
          authMiddleware,
          validateParamId('departmentId', 'id Раздела'),
          validateParamId('id', 'id тега'),
        ],
      },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const tagId = Number(req.params.id)
        const tag = await this.tagsService.updateTagByDepartment(departmentId, req.user!.id, tagId, {
          name: req.body.name,
        })
        return reply.send(tag)
      },
    )
  }

  deleteTagByDepartment: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{
      Params: { departmentId: string; id: string }
    }>(
      '/departments/:departmentId/tags/:id',
      {
        preHandler: [
          authMiddleware,
          validateParamId('departmentId', 'id Раздела'),
          validateParamId('id', 'id тега'),
        ],
      },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const tagId = Number(req.params.id)
        await this.tagsService.deleteTagByDepartment(departmentId, req.user!.id, tagId)
        return reply.status(204).send()
      },
    )
  }

  createTag: FastifyPluginAsync = async (fastify) => {
    fastify.post<{
      Params: { organizationId: string }
      Body: { name: string }
    }>(
      '/organizations/:organizationId/tags',
      {
        preHandler: [
          authMiddleware,
          validateParamId('organizationId', 'id организации'),
        ],
      },
      async (req, reply) => {
        const organizationId = Number(req.params.organizationId)
        const tag = await this.tagsService.createTag(organizationId, req.user!.id, {
          name: req.body.name,
        })
        return reply.status(201).send(tag)
      },
    )
  }

  updateTag: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{
      Params: { organizationId: string; id: string }
      Body: { name: string }
    }>(
      '/organizations/:organizationId/tags/:id',
      {
        preHandler: [
          authMiddleware,
          validateParamId('organizationId', 'id организации'),
          validateParamId('id', 'id тега'),
        ],
      },
      async (req, reply) => {
        const organizationId = Number(req.params.organizationId)
        const tagId = Number(req.params.id)
        const tag = await this.tagsService.updateTag(organizationId, req.user!.id, tagId, {
          name: req.body.name,
        })
        return reply.send(tag)
      },
    )
  }

  deleteTag: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{
      Params: { organizationId: string; id: string }
    }>(
      '/organizations/:organizationId/tags/:id',
      {
        preHandler: [
          authMiddleware,
          validateParamId('organizationId', 'id организации'),
          validateParamId('id', 'id тега'),
        ],
      },
      async (req, reply) => {
        const organizationId = Number(req.params.organizationId)
        const tagId = Number(req.params.id)
        await this.tagsService.deleteTag(organizationId, req.user!.id, tagId)
        return reply.status(204).send()
      },
    )
  }
}