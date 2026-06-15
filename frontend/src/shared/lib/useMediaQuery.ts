import { useEffect, useState } from 'react'

/** Единый брейкпоинт «мобильный / планшет в портрете» для layout и навигации. */
export const MOBILE_MAX_WIDTH_PX = 768
export const mediaMaxMobileQuery = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}
