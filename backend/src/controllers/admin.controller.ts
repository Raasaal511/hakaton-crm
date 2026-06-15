import { inject, injectable } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../types.js'
import { AdminService } from '../services/admin.service.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { requireRoot } from '../middlewares/requireRootMiddleware.js'
import type { IAuthRepository } from '../entities/auth/index.js'

@injectable()
export class AdminController {
  constructor(
    @inject(TYPES.AdminService) private adminService: AdminService,
    @inject(TYPES.AuthRepository) private authRepository: IAuthRepository
  ) {}

  getStats: FastifyPluginAsync = async (fastify) => {
    fastify.get(
      '/admin/stats',
      {
        preHandler: [authMiddleware, requireRoot(this.authRepository)],
      },
      async (_req, reply) => {
        const stats = await this.adminService.getStats()
        return reply.send(stats)
      }
    )
  }

  getAllOrganizations: FastifyPluginAsync = async (fastify) => {
    fastify.get(
      '/admin/organizations',
      {
        preHandler: [authMiddleware, requireRoot(this.authRepository)],
      },
      async (_req, reply) => {
        const organizations = await this.adminService.getAllOrganizations()
        return reply.send(organizations)
      }
    )
  }
}
