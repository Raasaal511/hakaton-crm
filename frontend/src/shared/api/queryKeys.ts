/**
 * Каталог ключей TanStack Query. Один источник истины — нельзя случайно
 * разойтись по строкам и пропустить инвалидацию.
 *
 * Принцип: вложенные `as const` массивы, чтобы можно было инвалидировать
 * частично (например, всё по разделу: queryClient.invalidateQueries({ queryKey: qk.dept(deptId) })).
 */
export const qk = {
  organization: (organizationId: number) => ['organization', organizationId] as const,
  favoritePipelines: (organizationId: number) =>
    ['favorite-pipelines', organizationId] as const,
  dept: (departmentId: number) => ['dept', departmentId] as const,
  deptMembers: (departmentId: number) => ['dept', departmentId, 'members'] as const,
  deptTags: (departmentId: number) => ['dept', departmentId, 'tags'] as const,
  deptColumns: (departmentId: number) => ['dept', departmentId, 'columns'] as const,
  deptPipelines: (departmentId: number) => ['dept', departmentId, 'pipelines'] as const,
  task: (taskId: number) => ['task', taskId] as const,
  taskActivity: (taskId: number) => ['task', taskId, 'activity'] as const,
  taskComments: (taskId: number) => ['task', taskId, 'comments'] as const,
  taskAttachments: (taskId: number) => ['task', taskId, 'attachments'] as const,
} as const
