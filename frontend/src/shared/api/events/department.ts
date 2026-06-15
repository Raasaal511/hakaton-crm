import { createEvent } from 'effector'
import type { Department, DepartmentMember, DepartmentRole } from 'shared/types/departments'

export const setDepartments = createEvent<Department[]>()
export const addDepartment = createEvent<Department>()
export const editDepartment = createEvent<Department>()
export const delDepartment = createEvent<number>()
export const reorderDepartments = createEvent<number[]>()

export const setCurrentDepartment = createEvent<Department | null>()
export const setDepartmentMembers = createEvent<DepartmentMember[]>()
export const addDepartmentMember = createEvent<DepartmentMember>()
export const updateDepartmentMemberRole = createEvent<{ id: number; role: DepartmentRole }>()
export const removeDepartmentMember = createEvent<number>()
