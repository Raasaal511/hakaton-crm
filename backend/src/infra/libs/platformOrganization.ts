export const PLATFORM_ORGANIZATION_ID = Number(process.env.PLATFORM_ORGANIZATION_ID || 4)

export function isPlatformOrganization(organizationId: number): boolean {
  return !Number.isNaN(PLATFORM_ORGANIZATION_ID) && organizationId === PLATFORM_ORGANIZATION_ID
}
