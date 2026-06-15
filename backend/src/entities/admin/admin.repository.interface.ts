import type { AdminStats } from './admin.types.js'

export interface IAdminRepository {
  getStats(): Promise<AdminStats>
}
