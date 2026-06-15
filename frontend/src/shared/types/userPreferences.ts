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

export type AccentId = 'blue' | 'violet' | 'teal' | 'green' | 'orange' | 'rose' | 'slate'
