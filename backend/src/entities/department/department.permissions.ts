/** Права раздела; настраивает только владелец организации. */
export type DepartmentPermissions = {
  /** Админ отдела: добавлять и удалять участников раздела */
  deptAdminCanManageMembers: boolean
  /** Админ отдела: создавать, переименовывать и удалять воронки */
  deptAdminCanManagePipelines: boolean
  /** Админ отдела: колонки на доске (кроме системной основной воронки — как сейчас) */
  deptAdminCanManageColumns: boolean
  /** Админ отдела: теги раздела */
  deptAdminCanManageTags: boolean
  /** Админ отдела: переименовывать раздел */
  deptAdminCanRenameDepartment: boolean
  /** Участник (member): видит все задачи раздела, не только свои */
  memberCanSeeAllTasks: boolean
  /** Участник (member): может создавать задачи */
  memberCanCreateTasks: boolean
}

export const DEFAULT_DEPARTMENT_PERMISSIONS: DepartmentPermissions = {
  deptAdminCanManageMembers: true,
  deptAdminCanManagePipelines: true,
  deptAdminCanManageColumns: true,
  deptAdminCanManageTags: true,
  deptAdminCanRenameDepartment: true,
  memberCanSeeAllTasks: false,
  memberCanCreateTasks: true,
}

export type DepartmentPermissionKey = keyof DepartmentPermissions

const PERMISSION_KEYS = Object.keys(DEFAULT_DEPARTMENT_PERMISSIONS) as DepartmentPermissionKey[]

export function mergeDepartmentPermissions(
  raw: Partial<DepartmentPermissions> | null | undefined,
): DepartmentPermissions {
  const merged = { ...DEFAULT_DEPARTMENT_PERMISSIONS }
  if (!raw || typeof raw !== 'object') return merged
  for (const key of PERMISSION_KEYS) {
    if (typeof raw[key] === 'boolean') {
      merged[key] = raw[key]
    }
  }
  return merged
}

export function parseDepartmentPermissionsPayload(
  body: unknown,
): Partial<DepartmentPermissions> | null {
  if (body == null || typeof body !== 'object') return null
  const src = body as Record<string, unknown>
  const nested =
    src.permissions != null && typeof src.permissions === 'object'
      ? (src.permissions as Record<string, unknown>)
      : src
  const out: Partial<DepartmentPermissions> = {}
  for (const key of PERMISSION_KEYS) {
    if (typeof nested[key] === 'boolean') {
      out[key] = nested[key]
    }
  }
  return Object.keys(out).length > 0 ? out : null
}
