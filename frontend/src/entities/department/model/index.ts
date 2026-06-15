import { createStore } from 'effector'
import { useUnit } from 'effector-react'
import {
  setDepartments,
  addDepartment,
  editDepartment,
  delDepartment,
  reorderDepartments,
  setCurrentDepartment,
  setDepartmentMembers,
  addDepartmentMember,
  updateDepartmentMemberRole,
  removeDepartmentMember,
} from 'shared/api/events/department'
import type { Department, DepartmentMember } from 'shared/types/departments'

export const $departmentsStore = createStore<Department[]>([])
  .on(setDepartments, (_, deps) => deps)
  .on(addDepartment, (deps, dep) => [...deps, dep])
  .on(editDepartment, (deps, dep) =>
    deps.map((d) => (d.id === dep.id ? { ...d, ...dep } : d)),
  )
  .on(delDepartment, (deps, id) => deps.filter((d) => d.id !== id))
  .on(reorderDepartments, (deps, orderedIds) => {
    const positionById = new Map<number, number>()
    orderedIds.forEach((id, idx) => positionById.set(id, idx))
    return [...deps]
      .map((d) =>
        positionById.has(d.id) ? { ...d, position: positionById.get(d.id)! } : d,
      )
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id)
  })

export const $currentDepartmentStore = createStore<Department | null>(null)
  .on(setCurrentDepartment, (_, dep) => dep)

export const $departmentMembersStore = createStore<DepartmentMember[]>([])
  .on(setDepartmentMembers, (_, members) => members)
  .on(addDepartmentMember, (members, member) => [member, ...members])
  .on(updateDepartmentMemberRole, (members, { id, role }) =>
    members.map((m) => (m.id === id ? { ...m, role } : m))
  )
  .on(removeDepartmentMember, (members, id) => members.filter((m) => m.id !== id))

export const useDepartments = () => useUnit($departmentsStore)
export const useCurrentDepartment = () => useUnit($currentDepartmentStore)
export const useDepartmentMembers = () => useUnit($departmentMembersStore)

export const selectors = {
  useDepartments,
  useCurrentDepartment,
  useDepartmentMembers,
}
