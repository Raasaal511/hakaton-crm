const TYPES = {
  Server: Symbol.for('Server'),

  AuthController: Symbol.for('AuthController'),
  AuthService: Symbol.for('AuthService'),
  AuthRepository: Symbol.for('AuthRepository'),

  OrganizationController: Symbol.for('OrganizationController'),
  OrganizationService: Symbol.for('OrganizationService'),
  OrganizationRepository: Symbol.for('OrganizationRepository'),
  OrganizationAccessService: Symbol.for('OrganizationAccessService'),
  RbacService: Symbol.for('RbacService'),
  AuditService: Symbol.for('AuditService'),

  DepartmentController: Symbol.for('DepartmentController'),
  DepartmentService: Symbol.for('DepartmentService'),
  DepartmentRepository: Symbol.for('DepartmentRepository'),
  DepartmentAccessService: Symbol.for('DepartmentAccessService'),
  PolicyResolverService: Symbol.for('PolicyResolverService'),

  PipelinesRepository: Symbol.for('PipelinesRepository'),
  PipelinesService: Symbol.for('PipelinesService'),
  PipelinesController: Symbol.for('PipelinesController'),
  UserFavoritePipelinesRepository: Symbol.for('UserFavoritePipelinesRepository'),

  ColumnRepository: Symbol.for('ColumnRepository'),
  ColumnService: Symbol.for('ColumnService'),
  ColumnController: Symbol.for('ColumnController'),

  TasksRepository: Symbol.for('TasksRepository'),
  TaskAttachmentsRepository: Symbol.for('TaskAttachmentsRepository'),
  TaskCommentsRepository: Symbol.for('TaskCommentsRepository'),
  TaskActivityRepository: Symbol.for('TaskActivityRepository'),
  TaskActivityService: Symbol.for('TaskActivityService'),
  TasksService: Symbol.for('TasksService'),
  TasksController: Symbol.for('TasksController'),

  TagsRepository: Symbol.for('TagsRepository'),
  TagsService: Symbol.for('TagsService'),
  TagsController: Symbol.for('TagsController'),

  AdminController: Symbol.for('AdminController'),
  AdminService: Symbol.for('AdminService'),
  AdminRepository: Symbol.for('AdminRepository'),

  AnalyticsController: Symbol.for('AnalyticsController'),
  AnalyticsService: Symbol.for('AnalyticsService'),
  AnalyticsRepository: Symbol.for('AnalyticsRepository'),

  WebPushSubscriptionsRepository: Symbol.for('WebPushSubscriptionsRepository'),
  WebPushService: Symbol.for('WebPushService'),
  PushController: Symbol.for('PushController'),

  CrmRepository: Symbol.for('CrmRepository'),
  CrmService: Symbol.for('CrmService'),
  CrmController: Symbol.for('CrmController'),

  CatalogRepository: Symbol.for('CatalogRepository'),
  CatalogService: Symbol.for('CatalogService'),
  CatalogController: Symbol.for('CatalogController'),

  AiService: Symbol.for('AiService'),
  AiController: Symbol.for('AiController'),

  ProjectsRepository: Symbol.for('ProjectsRepository'),
  ProjectsService: Symbol.for('ProjectsService'),
  ProjectsController: Symbol.for('ProjectsController'),

  DB: Symbol.for('DB'),
}
export { TYPES }
