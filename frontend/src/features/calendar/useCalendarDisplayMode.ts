import { useCallback, useEffect, useState } from 'react'
import type { CalendarDisplayMode } from './types'

export function useCalendarDisplayMode(storageKey: string): [
  CalendarDisplayMode,
  (mode: CalendarDisplayMode) => void,
] {
  const [mode, setModeState] = useState<CalendarDisplayMode>('month')

  useEffect(() => {
    if (!storageKey) return
    try {
      const v = localStorage.getItem(storageKey)
      if (v === 'week' || v === 'month' || v === 'day') setModeState(v)
    } catch {
      /* ignore */
    }
  }, [storageKey])

  const setMode = useCallback(
    (next: CalendarDisplayMode) => {
      setModeState(next)
      if (!storageKey) return
      try {
        localStorage.setItem(storageKey, next)
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  )

  return [mode, setMode]
}
