import type { User } from "../../infra/database/drizzle/schema.js"
import type { UserPreferences } from '../user/user.preferences.js'

export type SystemRole = 'user' | 'root'
export type UserSafe = Pick<User, 'id' | 'email' | 'firstname' | 'lastname' | 'systemRole'> & {
  profilePasswordSet: boolean
  preferences: UserPreferences
}
export type JwtPayload = Pick<User, 'id' | 'email'>

export type CreateUserDTO = Pick<User, 'firstname' | 'lastname' | 'email'> & { password: string }
export type LoginUserDTO = Pick<User, 'email'> & { password: string }
export type UpdateProfileDTO = Pick<User, 'firstname' | 'lastname'>
export type ChangePasswordDTO = { currentPassword?: string; newPassword: string }
export type ChangeEmailDTO = { email: string }
export type CreateUserData = Pick<User, 'firstname' | 'lastname' | 'email' | 'hashPassword' | 'profilePasswordSet'>
export type OrganizationRole = 'owner' | 'admin' | 'manager' | 'employee' | 'member' | 'viewer'