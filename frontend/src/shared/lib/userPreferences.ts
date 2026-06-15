import type {
  UserAppearancePreferences,
  UserNotificationPreferences,
  UserPreferences,
} from '../types/userPreferences'
import {
  DEFAULT_USER_APPEARANCE_PREFERENCES,
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
} from '../types/userPreferences'
import { applyAccent, setAccentIdInStorage, type AccentId } from './accent'
import {
  applyTheme,
  resolveTheme,
  setThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from './theme'

export function mergeUserPreferences(raw?: Partial<UserPreferences> | null): UserPreferences {
  const notifications = { ...DEFAULT_USER_NOTIFICATION_PREFERENCES }
  const appearance = { ...DEFAULT_USER_APPEARANCE_PREFERENCES }
  if (!raw) return { notifications, appearance }
  if (raw.notifications) {
    for (const key of Object.keys(DEFAULT_USER_NOTIFICATION_PREFERENCES) as Array<
      keyof UserNotificationPreferences
    >) {
      if (typeof raw.notifications[key] === 'boolean') {
        notifications[key] = raw.notifications[key]
      }
    }
  }
  if (raw.appearance) {
    if (raw.appearance.theme === 'light' || raw.appearance.theme === 'dark' || raw.appearance.theme === 'system') {
      appearance.theme = raw.appearance.theme
    }
    if (typeof raw.appearance.accentId === 'string' && raw.appearance.accentId.length > 0) {
      appearance.accentId = raw.appearance.accentId
    }
  }
  return { notifications, appearance }
}

export function applyAppearancePreferences(appearance: UserAppearancePreferences): ResolvedTheme {
  setThemePreference(appearance.theme as ThemePreference)
  const resolved = resolveTheme(appearance.theme as ThemePreference)
  applyTheme(resolved)
  setAccentIdInStorage(appearance.accentId as AccentId)
  applyAccent(appearance.accentId, resolved)
  return resolved
}

export function applyUserPreferences(preferences: UserPreferences): ResolvedTheme {
  return applyAppearancePreferences(preferences.appearance)
}
