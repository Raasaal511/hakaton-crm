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
  // CRM
  crmSegments: (orgId: number) => ['crm', orgId, 'segments'] as const,
  crmContacts: (orgId: number, filter?: object) => ['crm', orgId, 'contacts', filter] as const,
  crmContact: (orgId: number, id: number) => ['crm', orgId, 'contacts', id] as const,
  crmCompanies: (orgId: number, filter?: object) => ['crm', orgId, 'companies', filter] as const,
  crmCompany: (orgId: number, id: number) => ['crm', orgId, 'companies', id] as const,
  crmLeads: (orgId: number, filter?: object) => ['crm', orgId, 'leads', filter] as const,
  crmLead: (orgId: number, id: number) => ['crm', orgId, 'leads', id] as const,
  crmLeadSources: (orgId: number) => ['crm', orgId, 'lead-sources'] as const,
  crmKanban: (orgId: number) => ['crm', orgId, 'kanban'] as const,
  crmLeadStats: (orgId: number) => ['crm', orgId, 'lead-stats'] as const,
  crmDeals: (orgId: number, filter?: object) => ['crm', orgId, 'deals', filter] as const,
  crmDealStages: (orgId: number) => ['crm', orgId, 'deal-stages'] as const,
  crmDealStats: (orgId: number) => ['crm', orgId, 'deal-stats'] as const,
  crmReports: (orgId: number, period?: string) => ['crm', orgId, 'reports', period] as const,
  crmDocuments: (orgId: number, type: string, id: number) => ['crm', orgId, 'documents', type, id] as const,
  crmCommunications: (orgId: number, type: string, id: number) => ['crm', orgId, 'communications', type, id] as const,
  crmAutomationRules: (orgId: number) => ['crm', orgId, 'automation-rules'] as const,
  crmActivity: (orgId: number, type: string, id: number) => ['crm', orgId, 'activity', type, id] as const,
  // Finance / Sales
  financeQuotes: (orgId: number) => ['finance', orgId, 'quotes'] as const,
  financeInvoices: (orgId: number) => ['finance', orgId, 'invoices'] as const,
  // Activity feed
  crmRecentActivity: (orgId: number) => ['crm', orgId, 'activity', 'recent'] as const,
  // Catalog
  catalogCategories: (orgId: number) => ['catalog', orgId, 'categories'] as const,
  catalogProducts: (orgId: number, filter?: object) => ['catalog', orgId, 'products', filter] as const,
  catalogProduct: (orgId: number, id: number) => ['catalog', orgId, 'products', id] as const,
  catalogServices: (orgId: number, filter?: object) => ['catalog', orgId, 'services', filter] as const,
  catalogService: (orgId: number, id: number) => ['catalog', orgId, 'services', id] as const,
  catalogWarehouses: (orgId: number) => ['catalog', orgId, 'warehouses'] as const,
  catalogStockMovements: (orgId: number, productId?: number) => ['catalog', orgId, 'stock-movements', productId] as const,
  catalogInventorySummary: (orgId: number) => ['catalog', orgId, 'inventory-summary'] as const,
  // Projects
  projects: (orgId: number, filter?: object) => ['projects', orgId, filter] as const,
  project: (orgId: number, id: number) => ['projects', orgId, id] as const,
  projectMembers: (id: number) => ['projects', id, 'members'] as const,
} as const
