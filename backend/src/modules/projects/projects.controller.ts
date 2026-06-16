import { injectable, inject } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../../types.js'
import { ProjectsService } from './projects.service.js'
import { authMiddleware } from '../../middlewares/authMiddleware.js'
import { BadRequestError } from '../../infra/libs/errors.js'
import type { CreateProjectDTO, UpdateProjectDTO, ProjectListFilter, AddProjectMemberDTO } from './projects.types.js'

@injectable()
export class ProjectsController {
  constructor(
    @inject(TYPES.ProjectsService) private service: ProjectsService,
  ) {}

  listProjects: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: ProjectListFilter & { orgId: string } }>(
      '/projects',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        const result = await this.service.list(orgId, {
          q: req.query.q,
          status: req.query.status,
          priority: req.query.priority,
          limit: req.query.limit ? Number(req.query.limit) : undefined,
          offset: req.query.offset ? Number(req.query.offset) : undefined,
        })
        return reply.send(result)
      },
    )
  }

  createProject: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: CreateProjectDTO }>(
      '/projects',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        const project = await this.service.create(orgId, req.user!.id, req.body)
        return reply.status(201).send(project)
      },
    )
  }

  getProjectById: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { id: string }; Querystring: { orgId: string } }>(
      '/projects/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        const project = await this.service.getById(orgId, id)
        return reply.send(project)
      },
    )
  }

  updateProject: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{ Params: { id: string }; Querystring: { orgId: string }; Body: UpdateProjectDTO }>(
      '/projects/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        const project = await this.service.update(orgId, id, req.user!.id, req.body)
        return reply.send(project)
      },
    )
  }

  deleteProject: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Params: { id: string }; Querystring: { orgId: string } }>(
      '/projects/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.service.delete(orgId, id, req.user!.id)
        return reply.status(204).send()
      },
    )
  }

  getProjectMembers: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { id: string }; Querystring: { orgId: string } }>(
      '/projects/:id/members',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        const members = await this.service.getMembers(orgId, id)
        return reply.send(members)
      },
    )
  }

  addProjectMember: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Params: { id: string }; Querystring: { orgId: string }; Body: AddProjectMemberDTO }>(
      '/projects/:id/members',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!req.body.userId) throw new BadRequestError('userId обязателен')
        const members = await this.service.addMember(orgId, id, req.user!.id, req.body)
        return reply.status(201).send(members)
      },
    )
  }

  removeProjectMember: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Params: { id: string; userId: string }; Querystring: { orgId: string } }>(
      '/projects/:id/members/:userId',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        const targetUserId = Number(req.params.userId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.service.removeMember(orgId, id, req.user!.id, targetUserId)
        return reply.status(204).send()
      },
    )
  }
}
