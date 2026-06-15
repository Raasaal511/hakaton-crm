import type { FastifyRequest, FastifyReply } from 'fastify'
import type { IAuthRepository } from '../entities/auth/index.js'
import { ForbiddenError } from '../infra/libs/errors.js'

/**
 * PreHandler: проверяет, что пользователь имеет системную роль root.
 * Выполняется после authMiddleware.
 */
export function requireRoot(authRepository: IAuthRepository) {
  return async (req: FastifyRequest & { user?: { id: number } }, _reply: FastifyReply) => {
    const userId = req.user!.id
    const user = await authRepository.getUserById(userId)
    if (!user || user.systemRole !== 'root') {
      throw new ForbiddenError('Только root может выполнить это действие')
    }
  }
}
