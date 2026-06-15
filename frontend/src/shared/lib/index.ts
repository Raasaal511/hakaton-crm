export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export { useCanManage, useCanManageDepartment, canViewOrganizationFullAnalytics } from './useCanManage'
export { mergeDepartmentPermissions, resolveDepartmentCapabilities } from './departmentPermissions'
export type { DepartmentCapabilities } from './departmentPermissions'
export { useDeleteWithConfirm } from './useDeleteWithConfirm'
export { useDebouncedCallback } from './useDebouncedCallback'
export { htmlDescriptionToPlainText, isHtmlDescriptionEmpty } from './htmlToPlainText'
export { usePersistentToggle } from './usePersistentToggle'
export { useMediaQuery, MOBILE_MAX_WIDTH_PX, mediaMaxMobileQuery } from './useMediaQuery'
export { useBottomSheetDrag } from './useBottomSheetDrag'
export { ORG_ROLE_LABELS } from './orgRoleLabels'
export { isStandalonePwa } from './isStandalonePwa'
export { hasAuthToken } from './hasAuthToken'
export {
  THEME_STORAGE_KEY,
  THEME_COLOR_LIGHT,
  THEME_COLOR_DARK,
  getSystemTheme,
  resolveTheme,
  getThemePreference,
  setThemePreference,
  applyTheme,
  initThemeFromStorage,
  subscribeSystemTheme,
  updateThemeColorMeta,
} from './theme'
export type { ThemePreference, ResolvedTheme } from './theme'
export { useTheme } from './useTheme'
export {
  ACCENT_PALETTE,
  ACCENT_STORAGE_KEY,
  applyAccent,
  applyAccentTokens,
  getAccentIdFromStorage,
  getAccentPaletteItem,
  initAccentFromStorage,
  setAccentIdInStorage,
} from './accent'
export type { AccentId, AccentPaletteItem, AccentTokens } from './accent'
export { mergeUserPreferences, applyUserPreferences, applyAppearancePreferences } from './userPreferences'
export { useChartTheme } from './useChartTheme'
export type { ChartTheme } from './useChartTheme'
