import { inject, injectable } from 'inversify'
import { TYPES } from '../types.js'
import { DepartmentService } from '../services/department.service.js'
import { OrganizationAccessService } from '../services/organization-access.service.js'
import type { FastifyPluginAsync } from 'fastify'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { validateParamId, requireOrgAccess } from '../middlewares/validationMiddleware.js'
import { AddUserToDepartmentDTO, CreateDepartmentDTO } from '../entities/department/index.js'
import { AppError } from '../infra/libs/errors.js'

@injectable()
export class DepartmentController {
  constructor(
    @inject(TYPES.DepartmentService) private departmentService: DepartmentService,
    @inject(TYPES.OrganizationAccessService) private orgAccessService: OrganizationAccessService
  ) { }

  getDepartmentsByOrganizationId: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { organizationId: string } }>(
      '/organizations/:organizationId/departments',
      {
        preHandler: [
          authMiddleware,
          validateParamId('organizationId', 'id организации'),
          requireOrgAccess(this.orgAccessService, 'organizationId', 'read'),
        ],
      },
      async (req, reply) => {
        const organizationId = Number(req.params.organizationId)
        const departments = await this.departmentService.getDepartmentsByOrganizationId(
          organizationId,
          req.user!.id
        )
        return reply.send(departments)
      }
    )
  }

  /** Все участники разделов организации, доступных текущему пользователю (один ответ). */
  getDepartmentsMembersByOrganization: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { organizationId: string } }>(
      '/organizations/:organizationId/departments/members',
      {
        preHandler: [
          authMiddleware,
          validateParamId('organizationId', 'id организации'),
          requireOrgAccess(this.orgAccessService, 'organizationId', 'read'),
        ],
      },
      async (req, reply) => {
        const organizationId = Number(req.params.organizationId)
        const map = await this.departmentService.getDepartmentsMembersForOrganization(organizationId, req.user!.id)
        return reply.send(map)
      }
    )
  }

  getDepartmentMembers: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { departmentId: string } }>(
      '/departments/:departmentId/members',
      { preHandler: [authMiddleware, validateParamId('departmentId', 'id Раздела')] },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const members = await this.departmentService.getDepartmentMembers(departmentId, req.user!.id)
        return reply.send(members)
      }
    )
  }

  getDepartmentById: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { id: string } }>(
      '/departments/:id',
      { preHandler: [authMiddleware, validateParamId('id', 'id Раздела')] },
      async (req, reply) => {
        const departmentId = Number(req.params.id)
        const department = await this.departmentService.getDepartmentById(
          departmentId,
          req.user!.id
        )
        return reply.send(department)
      }
    )
  }

  createDepartment: FastifyPluginAsync = async (fastify) => {
    fastify.post<{
      Params: { organizationId: string }
      Body: CreateDepartmentDTO
    }>(
      '/organizations/:organizationId/departments',
      {
        preHandler: [
          authMiddleware,
          validateParamId('organizationId', 'id организации'),
          requireOrgAccess(this.orgAccessService, 'organizationId', 'manage'),
        ],
      },
      async (req, reply) => {
        const organizationId = Number(req.params.organizationId)
        const department = await this.departmentService.createDepartment(
          organizationId,
          req.user!.id,
          { name: req.body.name, organizationId }
        )
        return reply.status(201).send(department)
      }
    )
  }

  updateDepartment: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{
      Params: { id: string }
      Body: { name: string }
    }>(
      '/departments/:id',
      { preHandler: [authMiddleware, validateParamId('id', 'id Раздела')] },
      async (req, reply) => {
        const departmentId = Number(req.params.id)
        const department = await this.departmentService.updateDepartment(
          departmentId,
          req.user!.id,
          req.body
        )
        return reply.send(department)
      }
    )
  }

  deleteDepartment: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Params: { id: string } }>(
      '/departments/:id',
      { preHandler: [authMiddleware, validateParamId('id', 'id Раздела')] },
      async (req, reply) => {
        const departmentId = Number(req.params.id)
        await this.departmentService.softDeleteDepartment(departmentId, req.user!.id)
        return reply.status(204).send()
      }
    )
  }

  reorderDepartments: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{
      Params: { organizationId: string }
      Body: { departmentIds: number[] }
    }>(
      '/organizations/:organizationId/departments/reorder',
      {
        preHandler: [
          authMiddleware,
          validateParamId('organizationId', 'id организации'),
          requireOrgAccess(this.orgAccessService, 'organizationId', 'manage'),
        ],
      },
      async (req, reply) => {
        const organizationId = Number(req.params.organizationId)
        const departmentIds = req.body?.departmentIds
        if (!Array.isArray(departmentIds)) {
          throw new AppError('departmentIds должен быть массивом', 400)
        }
        await this.departmentService.reorderDepartments(
          organizationId,
          departmentIds,
          req.user!.id
        )
        return reply.status(204).send()
      }
    )
  }

  addUserToDepartment: FastifyPluginAsync = async (fastify) => {
    fastify.post<{
      Params: { departmentId: string }
      Body: AddUserToDepartmentDTO
    }>(
      '/departments/:departmentId/members',
      { preHandler: [authMiddleware, validateParamId('departmentId', 'id Раздела')] },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const member = await this.departmentService.addUserToDepartment(
          departmentId,
          req.user!.id,
          req.body
        )
        return reply.status(201).send(member)
      }
    )
  }

  removeUserFromDepartment: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Params: { departmentId: string; userId: string } }>(
      '/departments/:departmentId/members/:userId',
      {
        preHandler: [
          authMiddleware,
          validateParamId('departmentId', 'id Раздела'),
          validateParamId('userId', 'id пользователя'),
        ],
      },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const userId = Number(req.params.userId)
        await this.departmentService.removeUserFromDepartment(
          departmentId,
          req.user!.id,
          userId
        )
        return reply.status(204).send()
      }
    )
  }

  getDepartmentPermissions: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { id: string } }>(
      '/departments/:id/permissions',
      { preHandler: [authMiddleware, validateParamId('id', 'id Раздела')] },
      async (req, reply) => {
        const departmentId = Number(req.params.id)
        const permissions = await this.departmentService.getDepartmentPermissions(
          departmentId,
          req.user!.id,
        )
        return reply.send({ permissions })
      },
    )
  }

  updateDepartmentPermissions: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
      '/departments/:id/permissions',
      { preHandler: [authMiddleware, validateParamId('id', 'id Раздела')] },
      async (req, reply) => {
        const departmentId = Number(req.params.id)
        const permissions = await this.departmentService.updateDepartmentPermissions(
          departmentId,
          req.user!.id,
          req.body,
        )
        return reply.send({ permissions })
      },
    )
  }

  getDepartmentPolicies: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { id: string } }>(
      '/departments/:id/policies',
      { preHandler: [authMiddleware, validateParamId('id', 'id Раздела')] },
      async (req, reply) => {
        const departmentId = Number(req.params.id)
        const policies = await this.departmentService.getDepartmentPolicies(departmentId, req.user!.id)
        return reply.send({ policies })
      },
    )
  }

  updateDepartmentPolicies: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
      '/departments/:id/policies',
      { preHandler: [authMiddleware, validateParamId('id', 'id Раздела')] },
      async (req, reply) => {
        const departmentId = Number(req.params.id)
        const policies = await this.departmentService.updateDepartmentPolicies(
          departmentId,
          req.user!.id,
          req.body,
        )
        return reply.send({ policies })
      },
    )
  }

  updateDepartmentMemberRole: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{
      Params: { departmentId: string; userId: string }
      Body: { role: 'member' | 'admin' }
    }>(
      '/departments/:departmentId/members/:userId/role',
      {
        preHandler: [
          authMiddleware,
          validateParamId('departmentId', 'id Раздела'),
          validateParamId('userId', 'id пользователя'),
        ],
      },
      async (req, reply) => {
        const departmentId = Number(req.params.departmentId)
        const userId = Number(req.params.userId)
        const { role } = req.body
        if (role !== 'member' && role !== 'admin') {
          return reply.status(400).send({ error: 'Роль должна быть member или admin' })
        }
        await this.departmentService.setDepartmentMemberRole(
          departmentId,
          req.user!.id,
          userId,
          role
        )
        return reply.status(204).send()
      }
    )
  }
}
