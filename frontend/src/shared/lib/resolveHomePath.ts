import type { Organization } from 'shared/types/organization'
import { readLastVisitedOrganizationId } from './lastVisitedOrganization'

/**
 * Какую организацию считать «текущей» после загрузки списка.
 * Сохраняет выбор, если он ещё в списке; иначе — last visited из localStorage,
 * затем те же правила, что для домашнего редиректа.
 */
export function pickCurrentOrganization(
  organizations: Organization[],
  previous: Organization | null,
  userId: number,
): Organization | null {
  if (organizations.length === 0) return null

  if (previous != null) {
    const match = organizations.find((o) => o.id === previous.id)
    if (match) return match
  }

  const lastId = readLastVisitedOrganizationId()
  if (lastId != null) {
    const match = organizations.find((o) => o.id === lastId)
    if (match) return match
  }

  const personal = organizations.find((o) => o.isPersonal && o.ownerUserId === userId)
  if (personal) return personal

  const team = organizations.find((o) => !o.isPersonal)
  if (team) return team

  return organizations[0] ?? null
}

/**
 * Цель для «домашнего» редиректа: последняя орг. из localStorage (если ещё в списке),
 * иначе личное пространство владельца, иначе первая командная, иначе первая из списка.
 */
export function resolveHomePath(organizations: Organization[], userId: number): string | null {
  if (organizations.length === 0) return null

  const lastId = readLastVisitedOrganizationId()
  if (lastId != null && organizations.some((o) => o.id === lastId)) {
    return `/organizations/${lastId}`
  }

  const personal = organizations.find((o) => o.isPersonal && o.ownerUserId === userId)
  if (personal) return `/organizations/${personal.id}`

  const team = organizations.find((o) => !o.isPersonal)
  if (team) return `/organizations/${team.id}`

  return `/organizations/${organizations[0].id}`
}
