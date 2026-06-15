import { axiosAPI } from '../axios'
import type { LoginDTO, RegisterDTO, RegisterResponseUser } from '../../types/auth'
import type { UserPreferences } from '../../types/userPreferences'
import { mergeUserPreferences } from '../../lib/userPreferences'
import type { AuthUser } from '../events/auth'

function normalizeAuthUser(data: AuthUser): AuthUser {
  return {
    ...data,
    systemRole: data.systemRole ?? 'user',
    profilePasswordSet: data.profilePasswordSet ?? true,
    preferences: mergeUserPreferences(data.preferences),
  }
}

export const authAPI = {
  getMe: async (): Promise<AuthUser | null> => {
    try {
      const { data } = await axiosAPI.get<AuthUser>('/auth/me')
      return normalizeAuthUser(data)
    } catch {
      return null
    }
  },
  getPreferences: async (): Promise<UserPreferences> => {
    const { data } = await axiosAPI.get<{ preferences: UserPreferences }>('/auth/me/preferences')
    return mergeUserPreferences(data.preferences)
  },
  updatePreferences: async (patch: Partial<UserPreferences>): Promise<UserPreferences> => {
    const { data } = await axiosAPI.patch<{ preferences: UserPreferences }>('/auth/me/preferences', patch)
    return mergeUserPreferences(data.preferences)
  },
  updateProfile: async (payload: { firstname: string; lastname: string }) => {
    const { data } = await axiosAPI.patch<AuthUser>('/auth/profile', payload)
    return normalizeAuthUser(data)
  },
  changePassword: async (payload: { currentPassword?: string; newPassword: string }) => {
    await axiosAPI.patch('/auth/password', payload)
  },
  changeEmail: async (payload: { email: string }) => {
    const { data } = await axiosAPI.patch<{ user: AuthUser; token: string }>('/auth/email', payload)
    return {
      user: normalizeAuthUser(data.user),
      token: data.token,
    }
  },
  login: async (userLogin: LoginDTO) => {
    const { data } = await axiosAPI.post<{ token: string }>('/auth/login', userLogin)
    return data.token
  },
  register: async (userRegister: RegisterDTO) => {
    const { data } = await axiosAPI.post<{ user: RegisterResponseUser }>('/auth/register', userRegister)
    return data.user
  },
}