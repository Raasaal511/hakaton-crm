import { createEvent, createEffect, createStore, sample } from 'effector'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { departmentsAPI } from 'shared/api/requests/departments'
import { setCurrentOrganization, setMembers } from 'shared/api/events/organization'
import { setDepartments } from 'shared/api/events/department'
import type { DepartmentMember } from 'shared/types/departments'

type InitParams = {
  organizationId: number
}

export const organizationPageMounted = createEvent<InitParams>()
export const organizationPageUnmounted = createEvent()

const initOrganizationPageFx = createEffect(
  async ({ organizationId }: InitParams) => {
    const [org, members, deps] = await Promise.all([
      organizationsAPI.getById(organizationId),
      organizationsAPI.getMembers(organizationId).catch(() => []),
      departmentsAPI.getAll(organizationId).catch(() => []),
    ])
    return { org, members, deps }
  },
)

const loadDepartmentMembersFx = createEffect(
  async ({ organizationId, depsCount }: { organizationId: number; depsCount: number }) => {
    if (depsCount === 0) return {}
    const raw = await departmentsAPI.getMembersByOrganization(organizationId).catch(() => ({}))
    const map: Record<number, DepartmentMember[]> = {}
    for (const [key, members] of Object.entries(raw)) {
      map[Number(key)] = members
    }
    return map
  },
)

organizationPageMounted.watch((params) => {
  initOrganizationPageFx(params)
})

initOrganizationPageFx.doneData.watch(({ org, members, deps }) => {
  setCurrentOrganization(org)
  setMembers(members)
  setDepartments(deps)
})

sample({
  clock: initOrganizationPageFx.doneData,
  fn: ({ org, deps }) => ({ organizationId: org.id, depsCount: deps.length }),
  target: loadDepartmentMembersFx,
})

export const $departmentMembersMap = createStore<Record<number, DepartmentMember[]>>({})
  .on(loadDepartmentMembersFx.doneData, (_, map) => map)
  .reset(organizationPageMounted)
  .reset(organizationPageUnmounted)

organizationPageUnmounted.watch(() => {})

export const $organizationPageError = createStore<string | null>(null)
  .on(organizationPageMounted, () => null)
  .on(organizationPageUnmounted, () => null)
  .on(initOrganizationPageFx.failData, (_, error) =>
    (error instanceof Error ? error.message : String(error ?? '')) || 'Не удалось загрузить организацию'
  )
