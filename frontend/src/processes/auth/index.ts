import { createEvent, createEffect, sample } from 'effector'
import { authAPI } from 'shared/api/requests/auth'
import { setUser } from 'shared/api/events/auth'
import { applyUserPreferences } from 'shared/lib/userPreferences'

export const authCheckRequested = createEvent()

const authCheckFx = createEffect(async () => {
  const token = localStorage.getItem('token')
  if (!token) return null
  return authAPI.getMe()
})

sample({
  clock: authCheckRequested,
  target: authCheckFx,
})

sample({
  clock: authCheckFx.doneData,
  filter: (user): user is NonNullable<typeof user> => user !== null,
  target: setUser,
})

authCheckFx.doneData.watch((user) => {
  if (user?.preferences) {
    applyUserPreferences(user.preferences)
  }
})
