import { useCallback, useEffect, useState } from 'react'
import { applyAccent, getAccentIdFromStorage } from './accent'
import {
  applyTheme,
  getThemePreference,
  resolveTheme,
  setThemePreference,
  subscribeSystemTheme,
  type ResolvedTheme,
  type ThemePreference,
  THEME_STORAGE_KEY,
} from './theme'

export function useTheme(): {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (next: ThemePreference) => void
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getThemePreference())
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(getThemePreference()))

  const syncResolved = useCallback((pref: ThemePreference) => {
    const next = resolveTheme(pref)
    setResolved(next)
    applyTheme(next)
    applyAccent(getAccentIdFromStorage(), next)
  }, [])

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next)
      setThemePreference(next)
      syncResolved(next)
    },
    [syncResolved],
  )

  useEffect(() => {
    syncResolved(preference)
  }, [preference, syncResolved])

  useEffect(() => {
    return subscribeSystemTheme(() => {
      if (getThemePreference() === 'system') {
        syncResolved('system')
      }
    })
  }, [syncResolved])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY || e.newValue == null) return
      const pref = e.newValue as ThemePreference
      setPreferenceState(pref)
      syncResolved(pref)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [syncResolved])

  return { preference, resolved, setPreference }
}
