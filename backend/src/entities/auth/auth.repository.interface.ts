import type { User } from "../../infra/database/drizzle/schema.js"
import type { CreateUserData, UserSafe } from "./auth.types.js"
import type { UserPreferences } from '../user/user.preferences.js'

export interface IAuthRepository {
  getUserByEmail(email: string): Promise<User | undefined>
  getUserByEmailLower(emailLower: string): Promise<User | undefined>
  getUserById(id: number): Promise<UserSafe | undefined>
  getUserForPasswordChange(
    id: number,
  ): Promise<{ hashPassword: string; profilePasswordSet: boolean } | undefined>
  updateProfile(id: number, data: { firstname: string; lastname: string }): Promise<void>
  updatePassword(id: number, hashPassword: string, profilePasswordSet: boolean): Promise<void>
  updateEmail(id: number, email: string): Promise<void>
  getUserPreferences(userId: number): Promise<UserPreferences>
  getPreferencesForUserIds(userIds: number[]): Promise<Map<number, UserPreferences>>
  updateUserPreferences(userId: number, preferences: UserPreferences): Promise<UserPreferences>
  createUser(dto: CreateUserData): Promise<Pick<User, 'id' | 'firstname' | 'lastname'> | undefined>
}
