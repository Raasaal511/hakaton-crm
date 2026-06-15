import { sql } from "drizzle-orm";
import { pgTable, text, integer, serial, varchar, index, primaryKey, pgEnum, boolean, jsonb } from "drizzle-orm/pg-core";
import { appTimestamp } from './appTimestamp.js'
import type { DepartmentPermissions } from '../../../entities/department/department.permissions.js'
import type { DepartmentPolicies } from '../../../entities/department/department.policies.js'
import type { UserPreferences } from '../../../entities/user/user.preferences.js'

export const organizationRoleEnum = pgEnum('organization_role', ['owner', 'admin', 'member', 'viewer'])
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
