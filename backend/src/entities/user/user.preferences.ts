export type UserNotificationPreferences = {
  pushEnabled: boolean
  taskAssigned: boolean
  taskCompleted: boolean
  deptAdminTaskCreated: boolean
  deptAdminTaskCompleted: boolean
  deptAdminTaskMoved: boolean
  deptAdminAssigneesChanged: boolean
}

export type UserAppearancePreferences = {
  theme: 'light' | 'dark' | 'system'
  accentId: string
}

export type UserPreferences = {
  notifications: UserNotificationPreferences
  appearance: UserAppearancePreferences
}

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  pushEnabled: true,
  taskAssigned: true,
  taskCompleted: true,
  deptAdminTaskCreated: true,
  deptAdminTaskCompleted: true,
  deptAdminTaskMoved: true,
  deptAdminAssigneesChanged: true,
}

export const DEFAULT_USER_APPEARANCE_PREFERENCES: UserAppearancePreferences = {
  theme: 'system',
  accentId: 'blue',
}

export const VALID_ACCENT_IDS = ['blue', 'violet', 'teal', 'green', 'orange', 'rose', 'slate'] as const
export type AccentId = (typeof VALID_ACCENT_IDS)[number]

export const VALID_THEME_PREFERENCES = ['light', 'dark', 'system'] as const

const NOTIFICATION_KEYS = Object.keys(
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
) as (keyof UserNotificationPreferences)[]

export function mergeUserPreferences(
  raw: Partial<UserPreferences> | Record<string, unknown> | null | undefined,
): UserPreferences {
  const merged: UserPreferences = {
    notifications: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
    appearance: { ...DEFAULT_USER_APPEARANCE_PREFERENCES },
  }
  if (!raw || typeof raw !== 'object') return merged

  const src = raw as Record<string, unknown>
  const notifications =
    src.notifications != null && typeof src.notifications === 'object'
      ? (src.notifications as Record<string, unknown>)
      : null
  if (notifications) {
    for (const key of NOTIFICATION_KEYS) {
      if (typeof notifications[key] === 'boolean') {
        merged.notifications[key] = notifications[key] as boolean
      }
    }
  }

  const appearance =
    src.appearance != null && typeof src.appearance === 'object'
      ? (src.appearance as Record<string, unknown>)
      : null
  if (appearance) {
    if (
      typeof appearance.theme === 'string' &&
      (VALID_THEME_PREFERENCES as readonly string[]).includes(appearance.theme)
    ) {
      merged.appearance.theme = appearance.theme as UserAppearancePreferences['theme']
    }
    if (
      typeof appearance.accentId === 'string' &&
      (VALID_ACCENT_IDS as readonly string[]).includes(appearance.accentId)
    ) {
      merged.appearance.accentId = appearance.accentId
    }
  }

  return merged
}

export function parseUserPreferencesPatch(body: unknown): Partial<UserPreferences> | null {
  if (body == null || typeof body !== 'object') return null
  const src = body as Record<string, unknown>
  const out: Partial<UserPreferences> = {}
  const notifications: Partial<UserNotificationPreferences> = {}
  const appearance: Partial<UserAppearancePreferences> = {}

  const notifSrc =
    src.notifications != null && typeof src.notifications === 'object'
      ? (src.notifications as Record<string, unknown>)
      : src
  for (const key of NOTIFICATION_KEYS) {
    if (typeof notifSrc[key] === 'boolean') {
      notifications[key] = notifSrc[key] as boolean
    }
  }
  if (Object.keys(notifications).length > 0) {
    out.notifications = notifications as UserNotificationPreferences
  }

  const appearSrc =
    src.appearance != null && typeof src.appearance === 'object'
      ? (src.appearance as Record<string, unknown>)
      : src
  if (
    typeof appearSrc.theme === 'string' &&
    (VALID_THEME_PREFERENCES as readonly string[]).includes(appearSrc.theme)
  ) {
    appearance.theme = appearSrc.theme as UserAppearancePreferences['theme']
  }
  if (
    typeof appearSrc.accentId === 'string' &&
    (VALID_ACCENT_IDS as readonly string[]).includes(appearSrc.accentId)
  ) {
    appearance.accentId = appearSrc.accentId
  }
  if (Object.keys(appearance).length > 0) {
    out.appearance = appearance as UserAppearancePreferences
  }

  return Object.keys(out).length > 0 ? out : null
}

export type PushNotificationKind =
  | 'task_assigned'
  | 'task_completed'
  | 'task_created'
  | 'task_moved'
  | 'task_assignees_changed'

export type PushAudience = 'assignee' | 'dept_admin'

export function isPushAllowedForUser(
  prefs: UserPreferences,
  kind: PushNotificationKind,
  audience: PushAudience = 'assignee',
): boolean {
  if (!prefs.notifications.pushEnabled) return false
  switch (kind) {
    case 'task_assigned':
      return prefs.notifications.taskAssigned
    case 'task_completed':
      return audience === 'dept_admin'
        ? prefs.notifications.deptAdminTaskCompleted
        : prefs.notifications.taskCompleted
    case 'task_created':
      return prefs.notifications.deptAdminTaskCreated
    case 'task_moved':
      return prefs.notifications.deptAdminTaskMoved
    case 'task_assignees_changed':
      return prefs.notifications.deptAdminAssigneesChanged
    default:
      return true
  }
}
