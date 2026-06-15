import { injectable, inject } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../types.js'
import { AuthService } from '../services/auth.service.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import type {
  CreateUserDTO,
  LoginUserDTO,
  UpdateProfileDTO,
  ChangePasswordDTO,
  ChangeEmailDTO,
} from '../entities/auth/index.js'

@injectable()
export class AuthController {
  constructor(
    @inject(TYPES.AuthService) private _authService: AuthService,
  ) {}

  getMe: FastifyPluginAsync = async (fastify) => {
    fastify.get('/auth/me', { preHandler: [authMiddleware] }, async (req, reply) => {
      const user = await this._authService.getMe(req.user!.id)
      return reply.send(user)
    })
  }

  login: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Body: LoginUserDTO }>('/auth/login', {}, async (req, reply) => {
      const dto = req.body
      const token = await this._authService.login(dto)
      return reply.send({ token })
    })
  }

  register: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Body: CreateUserDTO }>('/auth/register', {}, async (req, reply) => {
      const dto = req.body
      const user = await this._authService.register(dto)
      return reply.send({ user })
    })
  }

  updateProfile: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{ Body: UpdateProfileDTO }>(
      '/auth/profile',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const user = await this._authService.updateProfile(req.user!.id, req.body)
        return reply.send(user)
      },
    )
  }

  changePassword: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{ Body: ChangePasswordDTO }>(
      '/auth/password',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        await this._authService.changePassword(req.user!.id, req.body)
        return reply.send({ ok: true })
      },
    )
  }

  getPreferences: FastifyPluginAsync = async (fastify) => {
    fastify.get('/auth/me/preferences', { preHandler: [authMiddleware] }, async (req, reply) => {
      const preferences = await this._authService.getPreferences(req.user!.id)
      return reply.send({ preferences })
    })
  }

  updatePreferences: FastifyPluginAsync = async (fastify) => {
    fastify.patch('/auth/me/preferences', { preHandler: [authMiddleware] }, async (req, reply) => {
      const preferences = await this._authService.updatePreferences(req.user!.id, req.body)
      return reply.send({ preferences })
    })
  }

  changeEmail: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{ Body: ChangeEmailDTO }>(
      '/auth/email',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const { user, token } = await this._authService.changeEmail(req.user!.id, req.body)
        return reply.send({ user, token })
      },
    )
  }
}
