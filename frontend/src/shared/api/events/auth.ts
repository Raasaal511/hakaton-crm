import { createEvent } from 'effector'
import type { UserPreferences } from '../../types/userPreferences'

export type SystemRole = 'user' | 'root'

export type AuthUser = {
  id: number
  email: string
  firstname: string
  lastname: string
  systemRole: SystemRole
  profilePasswordSet?: boolean
  preferences?: UserPreferences
}

export const setUser = createEvent<AuthUser | null>()
export const clearUser = createEvent()
