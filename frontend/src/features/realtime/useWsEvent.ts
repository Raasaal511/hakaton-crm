import { useEffect } from 'react'
import { wsClient } from './wsClient'

export function useWsEvent(type: string, handler: (event: Record<string, unknown> & { type: string }) => void) {
  useEffect(() => {
    const off = wsClient.on(type, handler)
    return () => { off() }
  }, [type, handler])
}
