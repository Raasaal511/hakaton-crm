import { useCallback, useEffect, useState } from 'react'
import { userModel } from 'entities/user'
import { authAPI } from 'shared/api/requests/auth'
import { setUser } from 'shared/api/events/auth'
import { applyUserPreferences, mergeUserPreferences } from 'shared/lib/userPreferences'
import type { UserPreferences } from 'shared/types/userPreferences'

export function useUserPreferences() {
  const currentUser = userModel.selectors.useUser()
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    mergeUserPreferences(currentUser?.preferences),
  )
  const [loading, setLoading] = useState(!currentUser?.preferences)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPreferences(mergeUserPreferences(currentUser?.preferences))
  }, [currentUser?.id, currentUser?.preferences])

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    void (async () => {
      try {
        setLoading(true)
        const prefs = await authAPI.getPreferences()
        if (cancelled) return
        setPreferences(prefs)
        applyUserPreferences(prefs)
        if (currentUser) {
          setUser({ ...currentUser, preferences: prefs })
        }
      } catch {
        if (!cancelled) setError('Не удалось загрузить настройки')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  const persist = useCallback(
    async (patch: Partial<UserPreferences>) => {
      const prev = preferences
      const optimistic = mergeUserPreferences({
        notifications: patch.notifications
          ? { ...prev.notifications, ...patch.notifications }
          : prev.notifications,
        appearance: patch.appearance
          ? { ...prev.appearance, ...patch.appearance }
          : prev.appearance,
      })
      setPreferences(optimistic)
      if (patch.appearance) {
        applyUserPreferences(optimistic)
      }
      setSaving(true)
      setError(null)
      try {
        const saved = await authAPI.updatePreferences(patch)
        setPreferences(saved)
        if (patch.appearance) {
          applyUserPreferences(saved)
        }
        if (currentUser) {
          setUser({ ...currentUser, preferences: saved })
        }
      } catch (e: unknown) {
        setPreferences(prev)
        if (patch.appearance) {
          applyUserPreferences(prev)
        }
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (e instanceof Error ? e.message : 'Не удалось сохранить')
        setError(msg)
      } finally {
        setSaving(false)
      }
    },
    [preferences, currentUser],
  )

  return { preferences, loading, saving, error, persist }
}
