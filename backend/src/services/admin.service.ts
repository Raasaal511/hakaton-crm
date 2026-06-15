import { injectable, inject } from 'inversify'
import { TYPES } from '../types.js'
import type { IAdminRepository } from '../entities/admin/index.js'
import type { IOrganizationRepository } from '../entities/organization/index.js'

@injectable()
export class AdminService {
  constructor(
    @inject(TYPES.AdminRepository) private adminRepo: IAdminRepository,
    @inject(TYPES.OrganizationRepository) private organizationRepo: IOrganizationRepository
  ) {}

  async getStats() {
    return this.adminRepo.getStats()
  }

  async getAllOrganizations() {
    return this.organizationRepo.getAllOrganizations()
  }
}
