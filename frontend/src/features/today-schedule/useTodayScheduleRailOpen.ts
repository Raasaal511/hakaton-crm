import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'rasl_schedule_open'

function readStored(): boolean | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return null
}

export function useTodayScheduleRailOpen(defaultOpen: boolean) {
  const [open, setOpenState] = useState(() => readStored() ?? defaultOpen)

  useEffect(() => {
    const stored = readStored()
    if (stored != null) setOpenState(stored)
    else setOpenState(defaultOpen)
  }, [defaultOpen])

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const toggle = useCallback(() => {
    setOpen(!open)
  }, [open, setOpen])

  return { open, setOpen, toggle }
}
