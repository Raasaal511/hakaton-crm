import { createEvent, createEffect, createStore } from 'effector'
import { departmentsAPI } from 'shared/api/requests/departments'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { columnsAPI } from 'shared/api/requests/columns'
import {
  setCurrentDepartment,
  setDepartmentMembers,
  setDepartments,
} from 'shared/api/events/department'
import { setColumns, clearColumns } from 'shared/api/events/columns'
import { clearTasks } from 'shared/api/events/tasks'
import { setCurrentOrganization, setMembers } from 'shared/api/events/organization'
import { $currentOrganizationStore, $membersStore } from 'entities/organization/model'
import { $currentDepartmentStore, $departmentsStore } from 'entities/department/model'

type InitParams = {
  departmentId: number
}

type PipelineBoardParams = {
  departmentId: number
  pipelineId: number
}

type DepartmentPageInitResult = {
  department: Awaited<ReturnType<typeof departmentsAPI.getById>>
  members: Awaited<ReturnType<typeof departmentsAPI.getMembers>>
  orgMembers: Awaited<ReturnType<typeof organizationsAPI.getMembers>> | []
  org: Awaited<ReturnType<typeof organizationsAPI.getById>> | null
  orgDepartments: Awaited<ReturnType<typeof departmentsAPI.getAll>>
}

type PipelineBoardInitResult = DepartmentPageInitResult & {
  columns: Awaited<ReturnType<typeof columnsAPI.getByPipeline>>
}

type OverviewResult = {
  department: Awaited<ReturnType<typeof departmentsAPI.getById>>
  members: Awaited<ReturnType<typeof departmentsAPI.getMembers>>
  orgMembers: Awaited<ReturnType<typeof organizationsAPI.getMembers>> | []
  org: Awaited<ReturnType<typeof organizationsAPI.getById>> | null
  orgDepartments: Awaited<ReturnType<typeof departmentsAPI.getAll>>
}

export const departmentPageMounted = createEvent<InitParams>()
export const departmentPageUnmounted = createEvent()
export const departmentOverviewMounted = createEvent<InitParams>()
export const departmentOverviewUnmounted = createEvent()
export const pipelineBoardMounted = createEvent<PipelineBoardParams>()

const $activePipelineBoardId = createStore<number | null>(null)
  .on(pipelineBoardMounted, (_, { pipelineId }) => pipelineId)
  .on(departmentPageUnmounted, () => null)

async function resolveOrgData(
  organizationId: number
): Promise<{
  orgMembers: Awaited<ReturnType<typeof organizationsAPI.getMembers>> | []
  org: Awaited<ReturnType<typeof organizationsAPI.getById>> | null
  orgDepartments: Awaited<ReturnType<typeof departmentsAPI.getAll>>
}> {
  const currentOrg = $currentOrganizationStore.getState()
  const cachedMembers = $membersStore.getState()
  const cachedDepartments = $departmentsStore.getState()
  const hasCached =
    currentOrg?.id === organizationId &&
    cachedMembers.length > 0 &&
    cachedDepartments.length > 0
  if (hasCached && currentOrg) {
    return {
      orgMembers: cachedMembers,
      org: currentOrg,
      orgDepartments: cachedDepartments,
    }
  }
  const [orgMembers, org, orgDepartments] = await Promise.all([
    organizationsAPI.getMembers(organizationId).catch(() => []),
    organizationsAPI.getById(organizationId),
    departmentsAPI.getAll(organizationId).catch(() => []),
  ])
  return { orgMembers, org, orgDepartments }
}

export const initDepartmentOverviewFx = createEffect(
  async ({ departmentId }: InitParams): Promise<OverviewResult> => {
    const department = await departmentsAPI.getById(departmentId)
    if (department == null) {
      return {
        department: null as unknown as OverviewResult['department'],
        members: [],
        orgMembers: [],
        org: null,
        orgDepartments: [],
      }
    }
    const { orgMembers, org, orgDepartments } = await resolveOrgData(department.organizationId)
    const members = await departmentsAPI.getMembers(departmentId).catch(() => [])
    return { department, members, orgMembers, org, orgDepartments }
  }
)

initDepartmentOverviewFx.doneData.watch(({ department, members, orgMembers, org, orgDepartments }) => {
  setCurrentDepartment(department)
  setDepartmentMembers(members)
  setMembers(orgMembers)
  if (org) setCurrentOrganization(org)
  if (orgDepartments) setDepartments(orgDepartments)
})


departmentOverviewMounted.watch((params) => {
  initDepartmentOverviewFx(params)
})

export const $departmentOverviewError = createStore<string | null>(null)
  .on(departmentOverviewMounted, () => null)
  .on(departmentOverviewUnmounted, () => null)
  .on(initDepartmentOverviewFx.failData, (_, err) =>
    (err instanceof Error ? err.message : String(err ?? '')) || 'Не удалось загрузить Раздел'
  )

export const initDepartmentPageFx = createEffect(
  async ({ departmentId }: InitParams): Promise<DepartmentPageInitResult> => {
    const cachedDept = $currentDepartmentStore.getState()
    const department =
      cachedDept?.id === departmentId
        ? cachedDept
        : await departmentsAPI.getById(departmentId)
    if (department == null) {
      return {
        department: null as unknown as DepartmentPageInitResult['department'],
        members: [],
        orgMembers: [],
        org: null,
        orgDepartments: [],
      }
    }
    const { orgMembers, org, orgDepartments } = await resolveOrgData(department.organizationId)
    const members = await departmentsAPI.getMembers(departmentId).catch(() => [])
    return {
      department,
      members,
      orgMembers,
      org,
      orgDepartments,
    }
  },
)

departmentPageMounted.watch(({ departmentId }) => {
  initDepartmentPageFx({ departmentId })
})

export const initPipelineBoardFx = createEffect(
  async ({ departmentId, pipelineId }: PipelineBoardParams): Promise<PipelineBoardInitResult> => {
    const cachedDept = $currentDepartmentStore.getState()
    const department =
      cachedDept?.id === departmentId
        ? cachedDept
        : await departmentsAPI.getById(departmentId)
    if (department == null) {
      return {
        department: null as unknown as PipelineBoardInitResult['department'],
        members: [],
        columns: [],
        orgMembers: [],
        org: null,
        orgDepartments: [],
      }
    }
    const { orgMembers, org, orgDepartments } = await resolveOrgData(department.organizationId)
    const [members, columns] = await Promise.all([
      departmentsAPI.getMembers(departmentId).catch(() => []),
      columnsAPI.getByPipeline(pipelineId).catch(() => []),
    ])
    return {
      department,
      members,
      columns,
      orgMembers,
      org,
      orgDepartments,
    }
  },
)

pipelineBoardMounted.watch((params) => {
  clearColumns()
  clearTasks()
  initPipelineBoardFx(params)
})

initPipelineBoardFx.done.watch(({ params, result }) => {
  if ($activePipelineBoardId.getState() !== params.pipelineId) return
  const { department, members, columns, orgMembers, org, orgDepartments } = result
  setCurrentDepartment(department)
  setDepartmentMembers(members)
  setColumns(columns)
  setMembers(orgMembers)
  if (org) setCurrentOrganization(org)
  if (orgDepartments) setDepartments(orgDepartments)
})

initDepartmentPageFx.doneData.watch(({ department, members, orgMembers, org, orgDepartments }) => {
  setCurrentDepartment(department)
  setDepartmentMembers(members)
  setMembers(orgMembers)
  if (org) setCurrentOrganization(org)
  if (orgDepartments) setDepartments(orgDepartments)
})

departmentPageUnmounted.watch(() => {
  setCurrentDepartment(null)
  setDepartmentMembers([])
  clearColumns()
  clearTasks()
  setMembers([])
})

