import { useEffect } from 'react'
import { wsClient } from './wsClient'

export function useWsConnection(orgId: number | undefined, userName: string | undefined) {
  useEffect(() => {
    if (!orgId || !userName) return
    wsClient.connect(orgId, userName)
    return () => {
      wsClient.disconnect()
    }
  }, [orgId, userName])
}
