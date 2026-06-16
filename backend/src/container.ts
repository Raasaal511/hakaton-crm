import 'reflect-metadata'
import { Container } from 'inversify'
import { TYPES } from './types.js'
import { db } from './infra/database/drizzle/client.js'
import { AuthRepository } from './infra/database/drizzle/auth/auth.repository.js'
import { OrganizationRepository } from './infra/database/drizzle/organization/organization.repository.js'
import { DepartmentRepository } from './infra/database/drizzle/department/department.repository.js'
import { ColumnRepository } from './infra/database/drizzle/columns/columns.repositoty.js'
import { PipelinesRepository } from './infra/database/drizzle/pipelines/pipelines.repository.js'
import { UserFavoritePipelinesRepository } from './infra/database/drizzle/favorite-pipelines/user-favorite-pipelines.repository.js'
import { TasksRepository } from './infra/database/drizzle/tasks/tasks.repository.js'
import { TaskAttachmentsRepository } from './infra/database/drizzle/task-attachments/task-attachments.repository.js'
import { TaskCommentsRepository } from './infra/database/drizzle/task-comments/task-comments.repository.js'
import { TaskActivityRepository } from './infra/database/drizzle/task-activity/task-activity.repository.js'
import { TagsRepository } from './infra/database/drizzle/tags/tags.repository.js'
import { AuthService } from './services/auth.service.js'
import { OrganizationService } from './services/organization.service.js'
import { OrganizationAccessService } from './services/organization-access.service.js'
import { RbacService } from './services/rbac.service.js'
import { AuditService } from './services/audit.service.js'
import { DepartmentAccessService } from './services/department-access.service.js'
import { PolicyResolverService } from './services/policy-resolver.service.js'
import { DepartmentService } from './services/department.service.js'
import { ColumnService } from './services/column.service.js'
import { PipelinesService } from './services/pipelines.service.js'
import { TasksService } from './services/tasks.service.js'
import { TaskActivityService } from './services/task-activity.service.js'
import { TagsService } from './services/tags.service.js'
import { AuthController } from './controllers/auth.controller.js'
import { OrganizationController } from './controllers/organization.controller.js'
import { DepartmentController } from './controllers/department.controller.js'
import { ColumnsController } from './controllers/columns.controller.js'
import { PipelinesController } from './controllers/pipelines.controller.js'
import { TasksController } from './controllers/tasks.controller.js'
import { TagsController } from './controllers/tags.controller.js'
import { AdminController } from './controllers/admin.controller.js'
import { AdminService } from './services/admin.service.js'
import { AdminRepository } from './infra/database/drizzle/admin/admin.repository.js'
import { AnalyticsController } from './controllers/analytics.controller.js'
import { PushController } from './controllers/push.controller.js'
import { AnalyticsService } from './services/analytics.service.js'
import { AnalyticsRepository } from './infra/database/drizzle/analytics/analytics.repository.js'
import { Server } from './api/server.js'
import { WebPushSubscriptionsRepository } from './infra/database/drizzle/web-push/web-push-subscriptions.repository.js'
import { WebPushService } from './services/web-push.service.js'
import { CrmRepository } from './modules/crm/crm.repository.js'
import { CrmService } from './modules/crm/crm.service.js'
import { CrmController } from './modules/crm/crm.controller.js'
import { CatalogRepository } from './modules/catalog/catalog.repository.js'
import { CatalogService } from './modules/catalog/catalog.service.js'
import { CatalogController } from './modules/catalog/catalog.controller.js'
import { AiService } from './modules/ai/ai.service.js'
import { AiController } from './modules/ai/ai.controller.js'
import { ProjectsRepository } from './modules/projects/projects.repository.js'
import { ProjectsService } from './modules/projects/projects.service.js'
import { ProjectsController } from './modules/projects/projects.controller.js'

const container = new Container()

container.bind(TYPES.DB).toConstantValue(db)
container.bind(TYPES.Server).to(Server).inSingletonScope()

container.bind(TYPES.AuthRepository).to(AuthRepository)
container.bind(TYPES.AuthService).to(AuthService)
container.bind(TYPES.AuthController).to(AuthController)

container.bind(TYPES.OrganizationRepository).to(OrganizationRepository)
container.bind(TYPES.OrganizationAccessService).to(OrganizationAccessService)
container.bind(TYPES.RbacService).to(RbacService)
container.bind(TYPES.AuditService).to(AuditService)
container.bind(TYPES.OrganizationService).to(OrganizationService)
container.bind(TYPES.OrganizationController).to(OrganizationController)

container.bind(TYPES.DepartmentRepository).to(DepartmentRepository)
container.bind(TYPES.DepartmentAccessService).to(DepartmentAccessService)
container.bind(TYPES.PolicyResolverService).to(PolicyResolverService)
container.bind(TYPES.DepartmentService).to(DepartmentService)
container.bind(TYPES.DepartmentController).to(DepartmentController)

container.bind(TYPES.PipelinesRepository).to(PipelinesRepository)
container.bind(TYPES.UserFavoritePipelinesRepository).to(UserFavoritePipelinesRepository)
container.bind(TYPES.PipelinesService).to(PipelinesService)
container.bind(TYPES.PipelinesController).to(PipelinesController)

container.bind(TYPES.ColumnRepository).to(ColumnRepository)
container.bind(TYPES.ColumnService).to(ColumnService)
container.bind(TYPES.ColumnController).to(ColumnsController)

container.bind(TYPES.TasksRepository).to(TasksRepository)
container.bind(TYPES.TaskAttachmentsRepository).to(TaskAttachmentsRepository)
container.bind(TYPES.TaskCommentsRepository).to(TaskCommentsRepository)
container.bind(TYPES.TaskActivityRepository).to(TaskActivityRepository)
container.bind(TYPES.TaskActivityService).to(TaskActivityService)
container.bind(TYPES.TasksService).to(TasksService)
container.bind(TYPES.TasksController).to(TasksController)

container.bind(TYPES.TagsRepository).to(TagsRepository)
container.bind(TYPES.TagsService).to(TagsService)
container.bind(TYPES.TagsController).to(TagsController)

container.bind(TYPES.AdminRepository).to(AdminRepository)
container.bind(TYPES.AdminService).to(AdminService)
container.bind(TYPES.AdminController).to(AdminController)

container.bind(TYPES.AnalyticsRepository).to(AnalyticsRepository)
container.bind(TYPES.AnalyticsService).to(AnalyticsService)
container.bind(TYPES.AnalyticsController).to(AnalyticsController)

container.bind(TYPES.WebPushSubscriptionsRepository).to(WebPushSubscriptionsRepository)
container.bind(TYPES.WebPushService).to(WebPushService).inSingletonScope()
container.bind(TYPES.PushController).to(PushController)

container.bind(TYPES.CrmRepository).to(CrmRepository)
container.bind(TYPES.CrmService).to(CrmService)
container.bind(TYPES.CrmController).to(CrmController)

container.bind(TYPES.CatalogRepository).to(CatalogRepository)
container.bind(TYPES.CatalogService).to(CatalogService)
container.bind(TYPES.CatalogController).to(CatalogController)

container.bind(TYPES.AiService).to(AiService).inSingletonScope()
container.bind(TYPES.AiController).to(AiController)

container.bind(TYPES.ProjectsRepository).to(ProjectsRepository)
container.bind(TYPES.ProjectsService).to(ProjectsService)
container.bind(TYPES.ProjectsController).to(ProjectsController)

export { container }
