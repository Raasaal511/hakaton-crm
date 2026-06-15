import { createStore, sample, combine } from 'effector'
import { useUnit } from 'effector-react'
import {
  setOrganizations,
  addOrganization,
  delOrganization,
  setCurrentOrganization,
  editOrganization,
  setMembers,
  addMember,
  updateMember,
  removeMember,
} from 'shared/api/events/organization'
import { pickCurrentOrganization } from 'shared/lib/resolveHomePath'
import { persistLastVisitedOrganizationId } from 'shared/lib/lastVisitedOrganization'
import { $userStore } from 'entities/user/model'
import type { Organization, OrganizationMember } from 'shared/types/organization'

export const $organizationsStore = createStore<Organization[]>([])
  .on(setOrganizations, (_, orgs) => orgs)
  .on(addOrganization, (orgs, org) => [org, ...orgs])
  .on(delOrganization, (orgs, id) => orgs.filter((o) => o.id !== id))
  .on(editOrganization, (orgs, org) =>
    orgs.map((o) => (o.id === org.id ? { ...o, ...org } : o)),
  )

export const $currentOrganizationStore = createStore<Organization | null>(null)
  .on(setCurrentOrganization, (_, org) => org)
  .on(editOrganization, (_, org) => org)

export const $membersStore = createStore<OrganizationMember[]>([])
  .on(setMembers, (_, members) => members)
  .on(addMember, (members, member) => [member, ...members])
  .on(updateMember, (members, member) =>
    members.map((m) => (m.id === member.id ? member : m))
  )
  .on(removeMember, (members, id) => members.filter((m) => m.id !== id))

export const useOrganizations = () => useUnit($organizationsStore)
export const useCurrentOrganization = () => useUnit($currentOrganizationStore)
export const useOrganizationMembers = () => useUnit($membersStore)

export const selectors = {
  useOrganizations,
  useCurrentOrganization,
  useOrganizationMembers,
}

setCurrentOrganization.watch((org) => {
  if (org?.id != null) persistLastVisitedOrganizationId(org.id)
})

sample({
  clock: setOrganizations,
  source: combine({
    previous: $currentOrganizationStore,
    user: $userStore,
  }),
  filter: ({ user }) => user != null,
  fn: ({ previous, user }, organizations) =>
    pickCurrentOrganization(organizations, previous, user!.id),
  target: setCurrentOrganization,
})
