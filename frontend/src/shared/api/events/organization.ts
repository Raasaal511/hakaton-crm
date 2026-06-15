import { createEvent } from 'effector'
import type { Organization, OrganizationMember } from 'shared/types/organization'

export const setOrganizations = createEvent<Organization[]>()
export const addOrganization = createEvent<Organization>()
export const delOrganization = createEvent<number>()

export const setCurrentOrganization = createEvent<Organization | null>()
export const editOrganization = createEvent<Organization>()
export const setMembers = createEvent<OrganizationMember[]>()
export const addMember = createEvent<OrganizationMember>()
export const updateMember = createEvent<OrganizationMember>()
export const removeMember = createEvent<number>()
