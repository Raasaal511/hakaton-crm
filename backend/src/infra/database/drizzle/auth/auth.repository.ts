import { injectable, inject } from 'inversify'
import { eq, inArray, sql } from 'drizzle-orm'
import { TYPES } from '../../../../types.js'
import type { DB } from '../client.js'
import { usersSchema } from '../schema.js'
import type { CreateUserData, IAuthRepository } from '../../../../entities/auth/index.js'
import { mergeUserPreferences, type UserPreferences } from '../../../../entities/user/user.preferences.js'

@injectable()
export class AuthRepository implements IAuthRepository {
  constructor(@inject(TYPES.DB) private db: DB) {}

  async getUserByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(usersSchema)
      .where(eq(usersSchema.email, email))
      .limit(1)
    return user
  }

  async getUserByEmailLower(emailLower: string) {
    const [user] = await this.db
      .select()
      .from(usersSchema)
      .where(sql`lower(${usersSchema.email}) = ${emailLower}`)
      .limit(1)
    return user
  }

  async getUserById(id: number) {
    const [row] = await this.db
      .select({
        id: usersSchema.id,
        email: usersSchema.email,
        firstname: usersSchema.firstname,
        lastname: usersSchema.lastname,
        systemRole: usersSchema.systemRole,
        profilePasswordSet: usersSchema.profilePasswordSet,
        preferences: usersSchema.preferences,
      })
      .from(usersSchema)
      .where(eq(usersSchema.id, id))
      .limit(1)
    if (!row) return undefined
    return {
      id: row.id,
      email: row.email,
      firstname: row.firstname,
      lastname: row.lastname,
      systemRole: row.systemRole,
      profilePasswordSet: row.profilePasswordSet,
      preferences: mergeUserPreferences(row.preferences),
    }
  }

  async getUserPreferences(userId: number): Promise<UserPreferences> {
    const [row] = await this.db
      .select({ preferences: usersSchema.preferences })
      .from(usersSchema)
      .where(eq(usersSchema.id, userId))
      .limit(1)
    if (!row) throw new Error('User not found')
    return mergeUserPreferences(row.preferences)
  }

  async getPreferencesForUserIds(userIds: number[]): Promise<Map<number, UserPreferences>> {
    const unique = [...new Set(userIds)]
    if (unique.length === 0) return new Map()
    const rows = await this.db
      .select({ id: usersSchema.id, preferences: usersSchema.preferences })
      .from(usersSchema)
      .where(inArray(usersSchema.id, unique))
    const map = new Map<number, UserPreferences>()
    for (const row of rows) {
      map.set(row.id, mergeUserPreferences(row.preferences))
    }
    return map
  }

  async updateUserPreferences(userId: number, preferences: UserPreferences): Promise<UserPreferences> {
    await this.db
      .update(usersSchema)
      .set({ preferences, updatedAt: new Date() })
      .where(eq(usersSchema.id, userId))
    return this.getUserPreferences(userId)
  }

  async getUserForPasswordChange(id: number) {
    const [row] = await this.db
      .select({
        hashPassword: usersSchema.hashPassword,
        profilePasswordSet: usersSchema.profilePasswordSet,
      })
      .from(usersSchema)
      .where(eq(usersSchema.id, id))
      .limit(1)
    return row
  }

  async updateProfile(id: number, data: { firstname: string; lastname: string }) {
    await this.db
      .update(usersSchema)
      .set({ firstname: data.firstname, lastname: data.lastname })
      .where(eq(usersSchema.id, id))
  }

  async updatePassword(id: number, hashPassword: string, profilePasswordSet: boolean) {
    await this.db
      .update(usersSchema)
      .set({ hashPassword, profilePasswordSet })
      .where(eq(usersSchema.id, id))
  }

  async updateEmail(id: number, email: string) {
    await this.db.update(usersSchema).set({ email }).where(eq(usersSchema.id, id))
  }

  async createUser(dto: CreateUserData) {
    const userData = {
      id: usersSchema.id,
      firstname: usersSchema.firstname,
      lastname: usersSchema.lastname
    }
    const [user] = await this.db.insert(usersSchema).values(dto).returning(userData)
    return user
  }

}
