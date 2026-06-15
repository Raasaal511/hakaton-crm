import { useCallback, useRef, useEffect } from 'react'

/**
 * Returns a debounced version of the callback.
 * The callback is invoked after `delay` ms of no invocations.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastArgsRef = useRef<Parameters<T> | undefined>(undefined)

  callbackRef.current = callback

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback(
    ((...args: Parameters<T>) => {
      lastArgsRef.current = args
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        callbackRef.current(...(lastArgsRef.current ?? []))
      }, delay)
    }) as T,
    [delay]
  )
}
