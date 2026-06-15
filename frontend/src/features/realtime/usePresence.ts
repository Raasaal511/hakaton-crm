import { useEffect, useState } from 'react'
import { wsClient } from './wsClient'

export type PresenceUser = {
  userId: number
  name: string
  color: string
}

export function usePresence(boardId: string | null) {
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!boardId) return

    wsClient.joinBoard(boardId)

    const offList = wsClient.on('presence_list', (e) => {
      if (e.boardId === boardId) setUsers(e.users as PresenceUser[])
    })
    const offJoined = wsClient.on('presence_joined', (e) => {
      if (e.boardId !== boardId) return
      const user = e.user as PresenceUser
      setUsers((prev) => {
        if (prev.find((u) => u.userId === user.userId)) return prev
        return [...prev, user]
      })
    })
    const offLeft = wsClient.on('presence_left', (e) => {
      if (e.boardId !== boardId) return
      setUsers((prev) => prev.filter((u) => u.userId !== (e.userId as number)))
    })

    return () => {
      wsClient.leaveBoard(boardId)
      offList()
      offJoined()
      offLeft()
    }
  }, [boardId])

  return users
}
