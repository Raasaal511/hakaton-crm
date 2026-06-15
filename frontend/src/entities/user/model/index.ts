import { createStore } from 'effector'
import { useUnit } from 'effector-react'
import { setUser, clearUser, type AuthUser } from 'shared/api/events/auth'

export const $userStore = createStore<AuthUser | null>(null)
  .on(setUser, (_, user) => user)
  .on(clearUser, () => null)

export const useUser = () => useUnit($userStore)

export const selectors = {
  useUser,
}
