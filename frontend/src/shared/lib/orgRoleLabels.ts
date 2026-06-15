import type { OrganizationRole } from '../types/organization'

export const ORG_ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
  viewer: 'Наблюдатель',
}
