import type { FastifyRequest, FastifyReply } from 'fastify'
import { validatePositiveId } from '../infra/libs/validation.js'
import type { OrganizationAccessService } from '../services/organization-access.service.js'

type OrgAccessMode = 'read' | 'manage' | 'owner'

/**
 * PreHandler: проверяет, что param положительный id.
 * Выбрасывает BadRequestError до вызова контроллера.
 */
export function validateParamId(paramName: string, fieldName: string) {
  return async (req: FastifyRequest<{ Params: Record<string, string> }>, _reply: FastifyReply) => {
    const value = req.params[paramName]
    const id = Number(value)
    validatePositiveId(id, fieldName)
  }
}

/**
 * PreHandler: проверяет доступ к организации (read/manage/owner).
 * Выполняется до контроллера при ошибке запрос не доходит до handler.
 */
export function requireOrgAccess(orgAccessService: OrganizationAccessService,
  paramName: string, mode: OrgAccessMode) {


  return async (
    req: FastifyRequest<{ Params: Record<string, string> }> & { user?: { id: number } },
    _reply: FastifyReply
  ) => {
    const organizationId = Number(req.params[paramName])
    const userId = req.user!.id

    await orgAccessService.ensureOrganizationExists(organizationId)

    switch (mode) {
      case 'read':
        await orgAccessService.ensureUserInOrganization(organizationId, userId)
        break
      case 'manage':
        await orgAccessService.ensureCanManageOrganization(organizationId, userId)
        break
      case 'owner':
        await orgAccessService.ensureIsOwner(organizationId, userId)
        break
    }
  }
}
