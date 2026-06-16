import { sql } from "drizzle-orm";
import { pgTable, text, integer, serial, varchar, index, primaryKey, pgEnum, boolean, jsonb } from "drizzle-orm/pg-core";
import { appTimestamp } from './appTimestamp.js'
import type { DepartmentPermissions } from '../../../entities/department/department.permissions.js'
import type { DepartmentPolicies } from '../../../entities/department/department.policies.js'
import type { UserPreferences } from '../../../entities/user/user.preferences.js'

export const organizationRoleEnum = pgEnum('organization_role', ['owner', 'admin', 'manager', 'employee', 'member', 'viewer'])
export const systemRoleEnum = pgEnum('system_role', ['user', 'root'])
export const departmentRoleEnum = pgEnum('department_role', ['member', 'admin'])

export const usersSchema = pgTable('users', {
    id: serial('id').primaryKey(),
    firstname: varchar('firstname', { length: 25 }).notNull(),
    lastname: varchar('lastname', { length: 25 }).notNull(),
    email: varchar('email', { length: 150 }).notNull().default(''),
    hashPassword: varchar('hash_password', { length: 255 }).notNull(),
    profilePasswordSet: boolean('profile_password_set').notNull().default(true),
    systemRole: systemRoleEnum('system_role').notNull().default('user'),
    preferences: jsonb('preferences').notNull().default({}).$type<Partial<UserPreferences>>(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date())
})

export type User = typeof usersSchema.$inferSelect

export const organizationsSchema = pgTable('organizations', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 25 }).notNull(),
    isPersonal: boolean('is_personal').notNull().default(false),
    ownerUserId: integer('owner_user_id').references(() => usersSchema.id, { onDelete: 'cascade' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at')
})

export type Organization = typeof organizationsSchema.$inferSelect

export const departmentSchema = pgTable('departments', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    position: integer('position').notNull().default(0),
    permissions: jsonb('permissions').notNull().default({}).$type<Partial<DepartmentPermissions>>(),
    policies: jsonb('policies').notNull().default({}).$type<Partial<DepartmentPolicies>>(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at')
}, (table) => ({
    organizationPositionIdx: index('department_organization_position_idx').on(table.organizationId, table.position),
}))

export type Department = typeof departmentSchema.$inferSelect

export const pipelinesSchema = pgTable('pipelines', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    departmentId: integer('department_id').references(() => departmentSchema.id, { onDelete: 'cascade' }).notNull(),
    /** Системная «Основная воронка»: фиксированные колонки, без правок пользователя */
    isMainTemplate: boolean('is_main_template').notNull().default(false),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at'),
}, (table) => ({
    departmentIdx: index('pipelines_department_idx').on(table.departmentId),
}))

export type Pipeline = typeof pipelinesSchema.$inferSelect

/** Избранные воронки пользователя (персональный быстрый доступ). */
export const userFavoritePipelinesSchema = pgTable(
  'user_favorite_pipelines',
  {
    userId: integer('user_id')
      .references(() => usersSchema.id, { onDelete: 'cascade' })
      .notNull(),
    pipelineId: integer('pipeline_id')
      .references(() => pipelinesSchema.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.pipelineId] }),
    userIdx: index('user_favorite_pipelines_user_id_idx').on(table.userId),
  }),
)

export type UserFavoritePipeline = typeof userFavoritePipelinesSchema.$inferSelect

export const columnSchema = pgTable('columns', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    position: integer('position').notNull(),
    departmentId: integer('department_id').references(() => departmentSchema.id, { onDelete: "cascade" }).notNull(),
    pipelineId: integer('pipeline_id').references(() => pipelinesSchema.id, { onDelete: 'cascade' }),
    color: varchar('color', { length: 7 }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at')
}, (table) => ({
    departmentPositionIdx: index('department_position_idx').on(table.departmentId, table.position),
    pipelinePositionIdx: index('pipeline_position_idx').on(table.pipelineId, table.position),
}))

export type Column = typeof columnSchema.$inferSelect

export const taskSchema = pgTable('tasks', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    columnId: integer('column_id').references(() => columnSchema.id, { onDelete: 'cascade' }),
    responsibleId: integer('responsible_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    creatorId: integer('creator_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    startDate: appTimestamp('start_date'),
    deadLine: appTimestamp('dead_line'),
    position: integer('position').notNull(),
    organizationId: integer('organization_id').notNull().references(() => organizationsSchema.id, { onDelete: 'cascade' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at'),
    /** Когда задача впервые попала в завершающую колонку воронки; сбрасывается при возврате в работу */
    completedAt: appTimestamp('completed_at'),
    /** Ссылка на родительскую задачу-рассылку; если задан — это дочерняя копия участника */
    broadcastParentId: integer('broadcast_parent_id'),
}, (table) => ({
    columnPositionIdx: index('column_position_idx').on(table.columnId, table.position),
}))

export type Task = typeof taskSchema.$inferSelect

export const taskActivitySchema = pgTable(
    'task_activity',
    {
        id: serial('id').primaryKey(),
        taskId: integer('task_id')
            .references(() => taskSchema.id, { onDelete: 'cascade' })
            .notNull(),
        actorUserId: integer('actor_user_id').references(() => usersSchema.id, {
            onDelete: 'set null',
        }),
        kind: varchar('kind', { length: 64 }).notNull(),
        payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
        createdAt: appTimestamp('created_at').default(sql`now()`).notNull(),
    },
    (table) => ({
        taskCreatedIdx: index('task_activity_task_created_idx').on(table.taskId, table.createdAt),
    }),
)

export type TaskActivityRow = typeof taskActivitySchema.$inferSelect

export const taskAttachmentSchema = pgTable(
    'task_attachments',
    {
        id: serial('id').primaryKey(),
        taskId: integer('task_id')
            .references(() => taskSchema.id, { onDelete: 'cascade' })
            .notNull(),
        organizationId: integer('organization_id')
            .references(() => organizationsSchema.id, { onDelete: 'cascade' })
            .notNull(),
        fileName: varchar('file_name', { length: 512 }).notNull(),
        mimeType: varchar('mime_type', { length: 255 }),
        sizeBytes: integer('size_bytes').notNull(),
        storedFileName: varchar('stored_file_name', { length: 64 }).notNull().unique(),
        uploadedByUserId: integer('uploaded_by_user_id').references(() => usersSchema.id, {
            onDelete: 'set null',
        }),
        createdAt: appTimestamp('created_at').default(sql`now()`),
    },
    (table) => ({
        taskIdx: index('task_attachments_task_idx').on(table.taskId),
    }),
)

export type TaskAttachment = typeof taskAttachmentSchema.$inferSelect

export const taskCommentSchema = pgTable(
    'task_comments',
    {
        id: serial('id').primaryKey(),
        taskId: integer('task_id')
            .references(() => taskSchema.id, { onDelete: 'cascade' })
            .notNull(),
        authorId: integer('author_id').references(() => usersSchema.id, {
            onDelete: 'set null',
        }),
        body: text('body').notNull(),
        createdAt: appTimestamp('created_at').default(sql`now()`),
        updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
        deletedAt: appTimestamp('deleted_at'),
    },
    (table) => ({
        taskIdx: index('task_comments_task_idx').on(table.taskId),
    }),
)

export type TaskComment = typeof taskCommentSchema.$inferSelect

export const tagsSchema = pgTable('tags', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: "cascade" }).notNull(),
    departmentId: integer('department_id').references(() => departmentSchema.id, { onDelete: 'cascade' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at')
})

export type Tag = typeof tagsSchema.$inferSelect

export const taskTagsSchema = pgTable('task_tags', {
    taskId: integer('task_id').references(() => taskSchema.id, { onDelete: 'cascade' }).notNull(),
    tagId: integer('tag_id').references(() => tagsSchema.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.taskId, table.tagId] })
}))

export const taskResponsiblesSchema = pgTable('task_responsibles', {
    taskId: integer('task_id').references(() => taskSchema.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => usersSchema.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.taskId, table.userId] }),
    userIdx: index('task_responsibles_user_idx').on(table.userId),
}))

export const usersToOrganizationsSchema = pgTable('users_to_organizations', {
    userId: integer('user_id').references(() => usersSchema.id, { onDelete: 'cascade' }).notNull(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    role: organizationRoleEnum('role').notNull().default('member'),
}, (table) => ({
    pk: primaryKey({ columns: [table.userId, table.organizationId] })
}))

export const usersToDepartmentsSchema = pgTable('users_to_departments', {
    userId: integer('user_id').references(() => usersSchema.id, { onDelete: 'cascade' }).notNull(),
    departmentId: integer('department_id').references(() => departmentSchema.id, { onDelete: 'cascade' }).notNull(),
    role: departmentRoleEnum('role').notNull().default('member'),
}, (table) => ({
    pk: primaryKey({ columns: [table.userId, table.departmentId] })
}))

/** Подписки Web Push (VAPID), одна строка на endpoint устройства/браузера. */
export const webPushSubscriptionsSchema = pgTable(
    'web_push_subscriptions',
    {
        id: serial('id').primaryKey(),
        userId: integer('user_id')
            .references(() => usersSchema.id, { onDelete: 'cascade' })
            .notNull(),
        endpoint: text('endpoint').notNull().unique(),
        p256dh: text('p256dh').notNull(),
        auth: text('auth').notNull(),
        createdAt: appTimestamp('created_at').default(sql`now()`),
        updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    },
    (table) => ({
        userIdx: index('web_push_subscriptions_user_id_idx').on(table.userId),
    }),
)

export type WebPushSubscriptionRow = typeof webPushSubscriptionsSchema.$inferSelect

// ---------------------------------------------------------------------------
// RBAC Extension
// ---------------------------------------------------------------------------

export const orgRoleV2Enum = pgEnum('org_role_v2', ['owner', 'admin', 'manager', 'employee', 'viewer'])

export const rbacPermissionsSchema = pgTable('rbac_permissions', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => usersSchema.id, { onDelete: 'cascade' }).notNull(),
    role: orgRoleV2Enum('role').notNull().default('employee'),
    resourceType: varchar('resource_type', { length: 50 }),
    resourceId: integer('resource_id'),
    grantedBy: integer('granted_by').references(() => usersSchema.id, { onDelete: 'set null' }),
    expiresAt: appTimestamp('expires_at'),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    userOrgIdx: index('rbac_user_org_idx').on(table.userId, table.organizationId),
}))

export const rbacGroupsSchema = pgTable('rbac_groups', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    departmentId: integer('department_id').references(() => departmentSchema.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description'),
    parentGroupId: integer('parent_group_id'),
    permissions: jsonb('permissions').notNull().default({}).$type<Record<string, boolean>>(),
    dataRestrictions: jsonb('data_restrictions').notNull().default({}).$type<Record<string, unknown>>(),
    createdByUserId: integer('created_by_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
}, (table) => ({
    orgIdx: index('rbac_groups_org_idx').on(table.organizationId),
}))

export type RbacGroup = typeof rbacGroupsSchema.$inferSelect

export const rbacGroupMembersSchema = pgTable('rbac_group_members', {
    groupId: integer('group_id').references(() => rbacGroupsSchema.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => usersSchema.id, { onDelete: 'cascade' }).notNull(),
    expiresAt: appTimestamp('expires_at'),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    pk: primaryKey({ columns: [table.groupId, table.userId] }),
    userIdx: index('rbac_group_members_user_idx').on(table.userId),
}))

export const auditLogsSchema = pgTable('audit_logs', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }),
    actorUserId: integer('actor_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: integer('entity_id'),
    action: varchar('action', { length: 80 }).notNull(),
    ipAddress: varchar('ip_address', { length: 80 }),
    userAgent: text('user_agent'),
    payload: jsonb('payload').notNull().default({}).$type<Record<string, unknown>>(),
    createdAt: appTimestamp('created_at').default(sql`now()`).notNull(),
}, (table) => ({
    orgCreatedIdx: index('audit_logs_org_created_idx').on(table.organizationId, table.createdAt),
    entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
}))

export type AuditLog = typeof auditLogsSchema.$inferSelect

// ---------------------------------------------------------------------------
// CRM Segments
// ---------------------------------------------------------------------------

export const crmSegmentsSchema = pgTable('crm_segments', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 7 }).default('#4361ee'),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
}, (table) => ({
    orgIdx: index('crm_segments_org_idx').on(table.organizationId),
}))

// ---------------------------------------------------------------------------
// CRM Companies
// ---------------------------------------------------------------------------

export const crmCompaniesSchema = pgTable('crm_companies', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    industry: varchar('industry', { length: 100 }),
    website: varchar('website', { length: 512 }),
    email: varchar('email', { length: 150 }),
    phone: varchar('phone', { length: 50 }),
    city: varchar('city', { length: 100 }),
    address: text('address'),
    employeesCount: integer('employees_count'),
    annualRevenue: integer('annual_revenue'),
    status: varchar('status', { length: 50 }).default('active').notNull(),
    ownerUserId: integer('owner_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    segmentId: integer('segment_id').references(() => crmSegmentsSchema.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at'),
}, (table) => ({
    orgIdx: index('crm_companies_org_idx').on(table.organizationId),
    statusIdx: index('crm_companies_status_idx').on(table.status),
}))

export type CrmCompany = typeof crmCompaniesSchema.$inferSelect

// ---------------------------------------------------------------------------
// CRM Contacts
// ---------------------------------------------------------------------------

export const crmContactsSchema = pgTable('crm_contacts', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    companyId: integer('company_id').references(() => crmCompaniesSchema.id, { onDelete: 'set null' }),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }),
    email: varchar('email', { length: 150 }),
    phone: varchar('phone', { length: 50 }),
    position: varchar('position', { length: 255 }),
    source: varchar('source', { length: 100 }),
    status: varchar('status', { length: 50 }).default('active').notNull(),
    ownerUserId: integer('owner_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    segmentId: integer('segment_id').references(() => crmSegmentsSchema.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at'),
}, (table) => ({
    orgIdx: index('crm_contacts_org_idx').on(table.organizationId),
    emailIdx: index('crm_contacts_email_idx').on(table.email),
}))

export type CrmContact = typeof crmContactsSchema.$inferSelect

export const crmContactTagsSchema = pgTable('crm_contact_tags', {
    contactId: integer('contact_id').references(() => crmContactsSchema.id, { onDelete: 'cascade' }).notNull(),
    tagId: integer('tag_id').references(() => tagsSchema.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.contactId, table.tagId] }),
}))

// ---------------------------------------------------------------------------
// CRM Leads
// ---------------------------------------------------------------------------

export const crmLeadsSchema = pgTable('crm_leads', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    contactId: integer('contact_id').references(() => crmContactsSchema.id, { onDelete: 'set null' }),
    companyId: integer('company_id').references(() => crmCompaniesSchema.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    amount: integer('amount').default(0).notNull(),
    currency: varchar('currency', { length: 3 }).default('RUB').notNull(),
    stage: varchar('stage', { length: 50 }).default('new').notNull(),
    priority: varchar('priority', { length: 20 }).default('medium').notNull(),
    probability: integer('probability').default(0).notNull(),
    source: varchar('source', { length: 100 }),
    responsibleUserId: integer('responsible_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    pipelineId: integer('pipeline_id').references(() => pipelinesSchema.id, { onDelete: 'set null' }),
    columnId: integer('column_id').references(() => columnSchema.id, { onDelete: 'set null' }),
    lostReason: text('lost_reason'),
    expectedCloseDate: appTimestamp('expected_close_date'),
    closedAt: appTimestamp('closed_at'),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at'),
}, (table) => ({
    orgIdx: index('crm_leads_org_idx').on(table.organizationId),
    stageIdx: index('crm_leads_stage_idx').on(table.stage),
    responsibleIdx: index('crm_leads_responsible_idx').on(table.responsibleUserId),
}))

export type CrmLead = typeof crmLeadsSchema.$inferSelect

export const crmLeadTagsSchema = pgTable('crm_lead_tags', {
    leadId: integer('lead_id').references(() => crmLeadsSchema.id, { onDelete: 'cascade' }).notNull(),
    tagId: integer('tag_id').references(() => tagsSchema.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.leadId, table.tagId] }),
}))

export const crmLeadSourcesSchema = pgTable('crm_lead_sources', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    code: varchar('code', { length: 80 }),
    color: varchar('color', { length: 7 }),
    active: boolean('active').default(true).notNull(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    orgIdx: index('crm_lead_sources_org_idx').on(table.organizationId),
}))

export type CrmLeadSource = typeof crmLeadSourcesSchema.$inferSelect

export const crmDealStagesSchema = pgTable('crm_deal_stages', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    code: varchar('code', { length: 80 }).notNull(),
    position: integer('position').default(0).notNull(),
    probability: integer('probability').default(0).notNull(),
    color: varchar('color', { length: 7 }),
    isWon: boolean('is_won').default(false).notNull(),
    isLost: boolean('is_lost').default(false).notNull(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
}, (table) => ({
    orgPositionIdx: index('crm_deal_stages_org_position_idx').on(table.organizationId, table.position),
}))

export type CrmDealStage = typeof crmDealStagesSchema.$inferSelect

export const crmDealsSchema = pgTable('crm_deals', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    leadId: integer('lead_id').references(() => crmLeadsSchema.id, { onDelete: 'set null' }),
    contactId: integer('contact_id').references(() => crmContactsSchema.id, { onDelete: 'set null' }),
    companyId: integer('company_id').references(() => crmCompaniesSchema.id, { onDelete: 'set null' }),
    stageId: integer('stage_id').references(() => crmDealStagesSchema.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    amount: integer('amount').default(0).notNull(),
    currency: varchar('currency', { length: 3 }).default('RUB').notNull(),
    probability: integer('probability').default(0).notNull(),
    status: varchar('status', { length: 50 }).default('open').notNull(),
    source: varchar('source', { length: 100 }),
    ownerUserId: integer('owner_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    expectedCloseDate: appTimestamp('expected_close_date'),
    closedAt: appTimestamp('closed_at'),
    nextStep: text('next_step'),
    notes: text('notes'),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at'),
}, (table) => ({
    orgIdx: index('crm_deals_org_idx').on(table.organizationId),
    stageIdx: index('crm_deals_stage_idx').on(table.stageId),
    ownerIdx: index('crm_deals_owner_idx').on(table.ownerUserId),
}))

export type CrmDeal = typeof crmDealsSchema.$inferSelect

export const crmDealLineItemsSchema = pgTable('crm_deal_line_items', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    dealId: integer('deal_id').references(() => crmDealsSchema.id, { onDelete: 'cascade' }).notNull(),
    productId: integer('product_id'),
    serviceId: integer('service_id'),
    itemType: varchar('item_type', { length: 30 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    quantity: integer('quantity').default(1).notNull(),
    unitPrice: integer('unit_price').default(0).notNull(),
    costPrice: integer('cost_price').default(0).notNull(),
    currency: varchar('currency', { length: 3 }).default('RUB').notNull(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    dealIdx: index('crm_deal_line_items_deal_idx').on(table.dealId),
}))

export type CrmDealLineItem = typeof crmDealLineItemsSchema.$inferSelect

export const crmActivitySchema = pgTable('crm_activity', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: integer('entity_id').notNull(),
    actorUserId: integer('actor_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    kind: varchar('kind', { length: 64 }).notNull(),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    createdAt: appTimestamp('created_at').default(sql`now()`).notNull(),
}, (table) => ({
    entityIdx: index('crm_activity_entity_idx').on(table.entityType, table.entityId, table.createdAt),
}))

export const crmDocumentsSchema = pgTable('crm_documents', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: integer('entity_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    kind: varchar('kind', { length: 80 }).default('attachment').notNull(),
    fileName: varchar('file_name', { length: 512 }),
    mimeType: varchar('mime_type', { length: 255 }),
    sizeBytes: integer('size_bytes'),
    templateCode: varchar('template_code', { length: 120 }),
    generatedPayload: jsonb('generated_payload').notNull().default({}).$type<Record<string, unknown>>(),
    createdByUserId: integer('created_by_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    entityIdx: index('crm_documents_entity_idx').on(table.entityType, table.entityId),
}))

export type CrmDocument = typeof crmDocumentsSchema.$inferSelect

export const crmCommunicationsSchema = pgTable('crm_communications', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: integer('entity_id').notNull(),
    channel: varchar('channel', { length: 40 }).notNull(),
    direction: varchar('direction', { length: 20 }).default('outbound').notNull(),
    subject: varchar('subject', { length: 255 }),
    body: text('body'),
    externalId: varchar('external_id', { length: 255 }),
    status: varchar('status', { length: 40 }).default('draft').notNull(),
    actorUserId: integer('actor_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    entityIdx: index('crm_communications_entity_idx').on(table.entityType, table.entityId),
}))

export type CrmCommunication = typeof crmCommunicationsSchema.$inferSelect

export const automationRulesSchema = pgTable('automation_rules', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    triggerType: varchar('trigger_type', { length: 80 }).notNull(),
    conditions: jsonb('conditions').notNull().default({}).$type<Record<string, unknown>>(),
    actions: jsonb('actions').notNull().default([]).$type<Record<string, unknown>[]>(),
    active: boolean('active').default(true).notNull(),
    createdByUserId: integer('created_by_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
}, (table) => ({
    orgIdx: index('automation_rules_org_idx').on(table.organizationId),
}))

export type AutomationRule = typeof automationRulesSchema.$inferSelect

export const automationRunsSchema = pgTable('automation_runs', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    ruleId: integer('rule_id').references(() => automationRulesSchema.id, { onDelete: 'set null' }),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: integer('entity_id'),
    status: varchar('status', { length: 40 }).default('queued').notNull(),
    payload: jsonb('payload').notNull().default({}).$type<Record<string, unknown>>(),
    error: text('error'),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    ruleIdx: index('automation_runs_rule_idx').on(table.ruleId, table.createdAt),
}))

export type AutomationRun = typeof automationRunsSchema.$inferSelect

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const productCategoriesSchema = pgTable('product_categories', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    parentId: integer('parent_id'),
    color: varchar('color', { length: 7 }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    orgIdx: index('product_categories_org_idx').on(table.organizationId),
}))

export type ProductCategory = typeof productCategoriesSchema.$inferSelect

export const productsSchema = pgTable('products', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    categoryId: integer('category_id').references(() => productCategoriesSchema.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    sku: varchar('sku', { length: 100 }),
    description: text('description'),
    price: integer('price').default(0).notNull(),
    costPrice: integer('cost_price').default(0).notNull(),
    currency: varchar('currency', { length: 3 }).default('RUB').notNull(),
    unit: varchar('unit', { length: 50 }).default('шт').notNull(),
    stockQuantity: integer('stock_quantity').default(0).notNull(),
    minStockQuantity: integer('min_stock_quantity').default(0).notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at'),
}, (table) => ({
    orgIdx: index('products_org_idx').on(table.organizationId),
    skuIdx: index('products_sku_idx').on(table.organizationId, table.sku),
}))

export type Product = typeof productsSchema.$inferSelect

export const warehousesSchema = pgTable('warehouses', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 80 }),
    address: text('address'),
    responsibleUserId: integer('responsible_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    active: boolean('active').default(true).notNull(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
}, (table) => ({
    orgIdx: index('warehouses_org_idx').on(table.organizationId),
}))

export type Warehouse = typeof warehousesSchema.$inferSelect

export const stockMovementsSchema = pgTable('stock_movements', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    productId: integer('product_id').references(() => productsSchema.id, { onDelete: 'cascade' }).notNull(),
    warehouseId: integer('warehouse_id').references(() => warehousesSchema.id, { onDelete: 'set null' }),
    targetWarehouseId: integer('target_warehouse_id').references(() => warehousesSchema.id, { onDelete: 'set null' }),
    type: varchar('type', { length: 40 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitCost: integer('unit_cost').default(0).notNull(),
    reason: text('reason'),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: integer('reference_id'),
    actorUserId: integer('actor_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    productIdx: index('stock_movements_product_idx').on(table.productId, table.createdAt),
    warehouseIdx: index('stock_movements_warehouse_idx').on(table.warehouseId, table.createdAt),
}))

export type StockMovement = typeof stockMovementsSchema.$inferSelect

export const productPriceHistorySchema = pgTable('product_price_history', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    productId: integer('product_id').references(() => productsSchema.id, { onDelete: 'cascade' }).notNull(),
    price: integer('price').notNull(),
    costPrice: integer('cost_price').default(0).notNull(),
    currency: varchar('currency', { length: 3 }).default('RUB').notNull(),
    changedByUserId: integer('changed_by_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    productIdx: index('product_price_history_product_idx').on(table.productId, table.createdAt),
}))

export type ProductPriceHistory = typeof productPriceHistorySchema.$inferSelect

export const purchasesSchema = pgTable('purchases', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    supplierCompanyId: integer('supplier_company_id').references(() => crmCompaniesSchema.id, { onDelete: 'set null' }),
    productId: integer('product_id').references(() => productsSchema.id, { onDelete: 'set null' }),
    warehouseId: integer('warehouse_id').references(() => warehousesSchema.id, { onDelete: 'set null' }),
    quantity: integer('quantity').default(0).notNull(),
    unitCost: integer('unit_cost').default(0).notNull(),
    status: varchar('status', { length: 40 }).default('planned').notNull(),
    expectedAt: appTimestamp('expected_at'),
    receivedAt: appTimestamp('received_at'),
    createdByUserId: integer('created_by_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    orgIdx: index('purchases_org_idx').on(table.organizationId, table.createdAt),
}))

export type Purchase = typeof purchasesSchema.$inferSelect

export const servicesSchema = pgTable('catalog_services', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }),
    price: integer('price').default(0).notNull(),
    currency: varchar('currency', { length: 3 }).default('RUB').notNull(),
    unit: varchar('unit', { length: 50 }).default('час').notNull(),
    durationHours: integer('duration_hours'),
    active: boolean('active').default(true).notNull(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at'),
}, (table) => ({
    orgIdx: index('catalog_services_org_idx').on(table.organizationId),
}))

export type CatalogService = typeof servicesSchema.$inferSelect

export const serviceTariffsSchema = pgTable('service_tariffs', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    serviceId: integer('service_id').references(() => servicesSchema.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    price: integer('price').default(0).notNull(),
    costPrice: integer('cost_price').default(0).notNull(),
    currency: varchar('currency', { length: 3 }).default('RUB').notNull(),
    durationHours: integer('duration_hours'),
    active: boolean('active').default(true).notNull(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    serviceIdx: index('service_tariffs_service_idx').on(table.serviceId),
}))

export type ServiceTariff = typeof serviceTariffsSchema.$inferSelect

export const serviceExecutorsSchema = pgTable('service_executors', {
    serviceId: integer('service_id').references(() => servicesSchema.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => usersSchema.id, { onDelete: 'cascade' }).notNull(),
    costRate: integer('cost_rate').default(0).notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    pk: primaryKey({ columns: [table.serviceId, table.userId] }),
}))

export const salesQuotesSchema = pgTable('sales_quotes', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    dealId: integer('deal_id').references(() => crmDealsSchema.id, { onDelete: 'set null' }),
    companyId: integer('company_id').references(() => crmCompaniesSchema.id, { onDelete: 'set null' }),
    contactId: integer('contact_id').references(() => crmContactsSchema.id, { onDelete: 'set null' }),
    number: varchar('number', { length: 80 }).notNull(),
    status: varchar('status', { length: 40 }).default('draft').notNull(),
    subtotal: integer('subtotal').default(0).notNull(),
    discount: integer('discount').default(0).notNull(),
    total: integer('total').default(0).notNull(),
    currency: varchar('currency', { length: 3 }).default('RUB').notNull(),
    validUntil: appTimestamp('valid_until'),
    createdByUserId: integer('created_by_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
}, (table) => ({
    orgIdx: index('sales_quotes_org_idx').on(table.organizationId, table.createdAt),
}))

export type SalesQuote = typeof salesQuotesSchema.$inferSelect

export const salesInvoicesSchema = pgTable('sales_invoices', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    dealId: integer('deal_id').references(() => crmDealsSchema.id, { onDelete: 'set null' }),
    quoteId: integer('quote_id').references(() => salesQuotesSchema.id, { onDelete: 'set null' }),
    number: varchar('number', { length: 80 }).notNull(),
    status: varchar('status', { length: 40 }).default('draft').notNull(),
    total: integer('total').default(0).notNull(),
    paidAmount: integer('paid_amount').default(0).notNull(),
    currency: varchar('currency', { length: 3 }).default('RUB').notNull(),
    issuedAt: appTimestamp('issued_at'),
    dueAt: appTimestamp('due_at'),
    paidAt: appTimestamp('paid_at'),
    createdByUserId: integer('created_by_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
}, (table) => ({
    orgIdx: index('sales_invoices_org_idx').on(table.organizationId, table.createdAt),
}))

export type SalesInvoice = typeof salesInvoicesSchema.$inferSelect

export const realtimeBoardJournalSchema = pgTable('realtime_board_journal', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    boardId: varchar('board_id', { length: 120 }).notNull(),
    actorUserId: integer('actor_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    eventType: varchar('event_type', { length: 80 }).notNull(),
    cardType: varchar('card_type', { length: 40 }),
    cardId: integer('card_id'),
    payload: jsonb('payload').notNull().default({}).$type<Record<string, unknown>>(),
    createdAt: appTimestamp('created_at').default(sql`now()`),
}, (table) => ({
    boardIdx: index('realtime_board_journal_board_idx').on(table.organizationId, table.boardId, table.createdAt),
}))

export type RealtimeBoardJournal = typeof realtimeBoardJournalSchema.$inferSelect

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projectsSchema = pgTable('projects', {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id').references(() => organizationsSchema.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).default('planning').notNull(),
    priority: varchar('priority', { length: 20 }).default('medium').notNull(),
    ownerUserId: integer('owner_user_id').references(() => usersSchema.id, { onDelete: 'set null' }),
    startDate: appTimestamp('start_date'),
    endDate: appTimestamp('end_date'),
    budget: integer('budget').default(0).notNull(),
    currency: varchar('currency', { length: 3 }).default('RUB').notNull(),
    progress: integer('progress').default(0).notNull(),
    color: varchar('color', { length: 7 }).default('#6366f1'),
    createdAt: appTimestamp('created_at').default(sql`now()`),
    updatedAt: appTimestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()),
    deletedAt: appTimestamp('deleted_at'),
}, (table) => ({
    orgIdx: index('projects_org_idx').on(table.organizationId),
    statusIdx: index('projects_status_idx').on(table.status),
    ownerIdx: index('projects_owner_idx').on(table.ownerUserId),
}))

export type Project = typeof projectsSchema.$inferSelect

export const projectMembersSchema = pgTable('project_members', {
    projectId: integer('project_id').references(() => projectsSchema.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => usersSchema.id, { onDelete: 'cascade' }).notNull(),
    role: varchar('role', { length: 30 }).default('member').notNull(),
    joinedAt: appTimestamp('joined_at').default(sql`now()`),
}, (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.userId] }),
    projectIdx: index('project_members_project_idx').on(table.projectId),
    userIdx: index('project_members_user_idx').on(table.userId),
}))

export type ProjectMember = typeof projectMembersSchema.$inferSelect
