import { inject, injectable } from "inversify";
import { TYPES } from "../types.js";
import { OrganizationService } from "../services/organization.service.js";
import { OrganizationAccessService } from "../services/organization-access.service.js";
import { type FastifyPluginAsync } from 'fastify'
import { AddUserToOrganizationDTO, CreateOrganizationDTO, type OrganizationRole, UpdateOrganizationDTO } from "../entities/organization/organization.types.js";
import { BadRequestError } from "../infra/libs/errors.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validateParamId, requireOrgAccess } from "../middlewares/validationMiddleware.js";

@injectable()
export class OrganizationController {
    constructor(
        @inject(TYPES.OrganizationService) private organizationService: OrganizationService,
        @inject(TYPES.OrganizationAccessService) private orgAccessService: OrganizationAccessService
    ) { }

    addUserToOrganization: FastifyPluginAsync = async (fastify) => {
        fastify.post<{
            Params: { organizationId: string }
            Body: AddUserToOrganizationDTO
        }>('/organizations/:organizationId/members', {
            preHandler: [
                authMiddleware,
                validateParamId('organizationId', 'id организации'),
                requireOrgAccess(this.orgAccessService, 'organizationId', 'manage'),
            ],
        },
            async (req, reply) => {
                const organizationId = Number(req.params.organizationId)
                const member = await this.organizationService.addUserToOrganization(organizationId, req.body)
                return reply.status(201).send(member)
            }
        )
    }

    getOrganizationMembers: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { organizationId: string } }>(
            '/organizations/:organizationId/members',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('organizationId', 'id организации'),
                    requireOrgAccess(this.orgAccessService, 'organizationId', 'read'),
                ],
            },
            async (req, reply) => {
                const organizationId = Number(req.params.organizationId)
                const members = await this.organizationService.getOrganizationMembers(organizationId, req.user!.id)
                return reply.send(members)
            }
        )
    }

    getOrganizationMembersWithDepartments: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { organizationId: string } }>(
            '/organizations/:organizationId/members/with-departments',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('organizationId', 'id организации'),
                    requireOrgAccess(this.orgAccessService, 'organizationId', 'manage'),
                ],
            },
            async (req, reply) => {
                const organizationId = Number(req.params.organizationId)
                const members = await this.organizationService.getOrganizationMembersWithDepartments(organizationId, req.user!.id)
                return reply.send(members)
            }
        )
    }

    updateMemberRole: FastifyPluginAsync = async (fastify) => {
        fastify.patch<{
            Params: { organizationId: string; userId: string }
            Body: { role: string }
        }>('/organizations/:organizationId/members/:userId/role', {
            preHandler: [
                authMiddleware,
                validateParamId('organizationId', 'id организации'),
                validateParamId('userId', 'id пользователя'),
                requireOrgAccess(this.orgAccessService, 'organizationId', 'owner'),
            ],
        },
            async (req, reply) => {
                const organizationId = Number(req.params.organizationId)
                const userId = Number(req.params.userId)
                const role = req.body?.role
                const member = await this.organizationService.updateMemberRole(organizationId, userId, role as OrganizationRole, req.user!.id)
                return reply.send(member)
            }
        )
    }

    removeUserFromOrganization: FastifyPluginAsync = async (fastify) => {
        fastify.delete<{
            Params: { organizationId: string; userId: string }
        }>('/organizations/:organizationId/members/:userId', {
            preHandler: [
                authMiddleware,
                validateParamId('organizationId', 'id организации'),
                validateParamId('userId', 'id пользователя'),
                requireOrgAccess(this.orgAccessService, 'organizationId', 'manage'),
            ],
        },
            async (req, reply) => {
                const organizationId = Number(req.params.organizationId)
                const userId = Number(req.params.userId)
                await this.organizationService.removeUserFromOrganization(organizationId, userId)
                return reply.status(204).send()
            }
        )
    }

    removeUsersFromOrganization: FastifyPluginAsync = async (fastify) => {
        fastify.delete<{
            Params: { organizationId: string }
            Body: { userIds: number[] }
        }>('/organizations/:organizationId/members', {
            preHandler: [
                authMiddleware,
                validateParamId('organizationId', 'id организации'),
                requireOrgAccess(this.orgAccessService, 'organizationId', 'manage'),
            ],
        },
            async (req, reply) => {
                const organizationId = Number(req.params.organizationId)
                const userIdsToRemove = req.body?.userIds ?? []
                await this.organizationService.removeUsersFromOrganization(organizationId, userIdsToRemove)
                return reply.status(204).send()
            }
        )
    }

    getOrganizationById: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { id: string } }>('/organizations/:id', {
            preHandler: [
                authMiddleware,
                validateParamId('id', 'id'),
                requireOrgAccess(this.orgAccessService, 'id', 'read'),
            ],
        },
            async (req, reply) => {
                const id = Number(req.params.id)
                const organization = await this.organizationService.getOrganizationById(id)
                return reply.send(organization)
            })
    }

    getUserOrganization: FastifyPluginAsync = async (fastify) => {
        fastify.get('/organizations', { preHandler: authMiddleware },
            async (req, reply) => {
                const userId = req.user!.id
                const organizations = await this.organizationService.getUserOrganizations(userId)
                return reply.send(organizations)
            })
    }

    createOrganization: FastifyPluginAsync = async (fastify) => {
        fastify.post<{ Body: CreateOrganizationDTO }>('/organizations', { preHandler: authMiddleware },
            async (req, reply) => {
                const userId = req.user!.id
                const dto = req.body
                const organization = await this.organizationService.createOrganization(dto, userId)
                return reply.send(organization)
            })
    }

    updateOrganization: FastifyPluginAsync = async (fastify) => {
        fastify.patch<{
            Params: { id: string }
            Body: UpdateOrganizationDTO
        }>('/organizations/:id', {
            preHandler: [
                authMiddleware,
                validateParamId('id', 'id организации'),
                requireOrgAccess(this.orgAccessService, 'id', 'manage'),
            ],
        },
            async (req, reply) => {
                const id = Number(req.params.id)
                const updated = await this.organizationService.updateOrganization(id, req.user!.id, req.body)
                return reply.send(updated)
            })
    }

    deleteOrganization: FastifyPluginAsync = async (fastify) => {
        fastify.delete<{ Params: { id: string } }>('/organizations/:id', {
            preHandler: [
                authMiddleware,
                validateParamId('id', 'id организации'),
                requireOrgAccess(this.orgAccessService, 'id', 'owner'),
            ],
        },
            async (req, reply) => {
                const organizationId = Number(req.params.id)
                await this.organizationService.softDeleteOrganization(organizationId)
                return reply.status(204).send()
            }
        )
    }

}