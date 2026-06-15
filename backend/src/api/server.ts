import 'reflect-metadata'
import { injectable, inject } from 'inversify'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import config from 'config'
import { TYPES } from '../types.js'
import { AuthController } from '../controllers/auth.controller.js'
import { OrganizationController } from '../controllers/organization.controller.js'
import { DepartmentController } from '../controllers/department.controller.js'
import { ColumnsController } from '../controllers/columns.controller.js'
import { PipelinesController } from '../controllers/pipelines.controller.js'
import { TasksController } from '../controllers/tasks.controller.js'
import { TagsController } from '../controllers/tags.controller.js'
import { AdminController } from '../controllers/admin.controller.js'
import { AnalyticsController } from '../controllers/analytics.controller.js'
import { PushController } from '../controllers/push.controller.js'
import { AppError, RateLimitError } from '../infra/libs/errors.js'
import { MAX_TASK_ATTACHMENT_BYTES } from '../infra/libs/taskAttachmentValidation.js'
import { API_VERSION } from '../infra/libs/apiVersion.js'
import { CrmController } from '../modules/crm/crm.controller.js'
import { CatalogController } from '../modules/catalog/catalog.controller.js'
import fastifyWebsocket from '@fastify/websocket'
import { registerWsRoutes } from '../realtime/ws.server.js'

export interface IServer {
  start(): Promise<void>
}


@injectable()
export class Server implements IServer {
  constructor(
    @inject(TYPES.AuthController) private _auth: AuthController,
    @inject(TYPES.OrganizationController) private _organization: OrganizationController,
    @inject(TYPES.DepartmentController) private _department: DepartmentController,
    @inject(TYPES.PipelinesController) private _pipelines: PipelinesController,
    @inject(TYPES.ColumnController) private _columns: ColumnsController,
    @inject(TYPES.TasksController) private _tasks: TasksController,
    @inject(TYPES.TagsController) private _tags: TagsController,
    @inject(TYPES.AdminController) private _admin: AdminController,
    @inject(TYPES.AnalyticsController) private _analytics: AnalyticsController,
    @inject(TYPES.PushController) private _push: PushController,
    @inject(TYPES.CrmController) private _crm: CrmController,
    @inject(TYPES.CatalogController) private _catalog: CatalogController,
  ) { }

  public async start() {
    const server = Fastify()

    const serverConfig = config.get<{
      host: string
      port: number
      cors: string[]
      apiPrefix: string
      apiVersion?: string
    }>('server')
    const apiVersion = serverConfig.apiVersion ?? API_VERSION

    await server.register(cors, {
      origin: serverConfig.cors,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })

    await server.register(rateLimit, {
      max: 300,
      timeWindow: '1 minute',
      keyGenerator: (req) => {
        const auth = req.headers.authorization
        if (auth) return `user:${auth}`
        return req.ip
      },
      errorResponseBuilder: () => new RateLimitError()
    })

    server.setErrorHandler((error, req, reply) => {
      console.error(error)
      if (error instanceof AppError) {
        reply.status(error.statusCode).send({ error: error.message })
        return
      }
      const code = (error as { code?: string }).code
      if (code === 'FST_REQ_FILE_TOO_LARGE') {
        const mb = MAX_TASK_ATTACHMENT_BYTES / 1024 / 1024
        reply.status(413).send({ error: `Файл слишком большой (максимум ${mb} МБ)` })
        return
      }
      reply.status(500).send({ error: 'Ошибка сервера' })
    })

    await server.register(
      async (instance) => {
        instance.addHook('onSend', async (_request, reply, payload) => {
          reply.header('X-API-Version', apiVersion)
          return payload
        })

        instance.get('/version', async (_req, reply) => {
          return reply.send({ version: apiVersion })
        })

        await instance.register(multipart, {
          limits: {
            fileSize: MAX_TASK_ATTACHMENT_BYTES,
          },
        })

        await instance.register(this._auth.getMe)
        await instance.register(this._auth.login)
        await instance.register(this._auth.register)
        await instance.register(this._auth.updateProfile)
        await instance.register(this._auth.changePassword)
        await instance.register(this._auth.changeEmail)
        await instance.register(this._auth.getPreferences)
        await instance.register(this._auth.updatePreferences)

        await instance.register(this._push.getVapidPublicKey)
        await instance.register(this._push.subscribe)
        await instance.register(this._push.unsubscribe)

        await instance.register(this._organization.getUserOrganization)
        await instance.register(this._organization.addUserToOrganization)
        await instance.register(this._organization.getOrganizationMembers)
        await instance.register(this._organization.getOrganizationMembersWithDepartments)
        await instance.register(this._organization.updateMemberRole)
        await instance.register(this._organization.removeUserFromOrganization)
        await instance.register(this._organization.removeUsersFromOrganization)
        await instance.register(this._organization.getOrganizationById)
        await instance.register(this._organization.createOrganization)
        await instance.register(this._organization.updateOrganization)
        await instance.register(this._organization.deleteOrganization)

        await instance.register(this._department.getDepartmentsByOrganizationId)
        await instance.register(this._department.getDepartmentsMembersByOrganization)
        await instance.register(this._department.getDepartmentMembers)
        await instance.register(this._department.getDepartmentById)
        await instance.register(this._department.createDepartment)
        await instance.register(this._department.updateDepartment)
        await instance.register(this._department.getDepartmentPermissions)
        await instance.register(this._department.updateDepartmentPermissions)
        await instance.register(this._department.getDepartmentPolicies)
        await instance.register(this._department.updateDepartmentPolicies)
        await instance.register(this._department.deleteDepartment)
        await instance.register(this._department.reorderDepartments)
        await instance.register(this._department.addUserToDepartment)
        await instance.register(this._department.removeUserFromDepartment)
        await instance.register(this._department.updateDepartmentMemberRole)

        await instance.register(this._pipelines.getPipelinesByDepartmentId)
        await instance.register(this._pipelines.createPipeline)
        await instance.register(this._pipelines.createPipelineFromTemplate)
        await instance.register(this._pipelines.getPipelineTemplates)
        await instance.register(this._pipelines.listAllFavoritePipelines)
        await instance.register(this._pipelines.listFavoritePipelines)
        await instance.register(this._pipelines.addFavoritePipeline)
        await instance.register(this._pipelines.removeFavoritePipeline)
        await instance.register(this._pipelines.updatePipeline)
        await instance.register(this._pipelines.getPipelinePolicies)
        await instance.register(this._pipelines.updatePipelinePolicies)
        await instance.register(this._pipelines.updatePipelineColumnsPolicies)
        await instance.register(this._pipelines.deletePipeline)

        await instance.register(this._columns.getColumnsByPipeline)
        await instance.register(this._columns.getColumns)
        await instance.register(this._columns.createColumn)
        await instance.register(this._columns.updateColumn)
        await instance.register(this._columns.deleteColumn)
        await instance.register(this._columns.reorderColumns)
        await instance.register(this._columns.getColumnPolicies)
        await instance.register(this._columns.updateColumnPolicies)

        await instance.register(this._tasks.getTasksByDepartmentId)
        await instance.register(this._tasks.getMyTasksByOrganization)
        await instance.register(this._tasks.getMyTasksByOrganizationPaginated)
        await instance.register(this._tasks.getOverdueTasksByDepartmentId)
        await instance.register(this._tasks.getTasksByColumnId)
        await instance.register(this._tasks.getOverdueTasksByColumnId)
        await instance.register(this._tasks.getGlobalMyTasks)
        await instance.register(this._tasks.getPipelineCalendarTasks)
        await instance.register(this._tasks.getOrganizationCalendarTasks)
        await instance.register(this._tasks.getGlobalCalendarTasks)
        await instance.register(this._tasks.getTaskById)
        await instance.register(this._tasks.getTaskActivity)
        await instance.register(this._tasks.listTaskAttachments)
        await instance.register(this._tasks.createTask)
        await instance.register(this._tasks.createBroadcastTask)
        await instance.register(this._tasks.getBroadcastProgress)
        await instance.register(this._tasks.addBroadcastMember)
        await instance.register(this._tasks.removeBroadcastMember)
        await instance.register(this._tasks.updateTask)
        await instance.register(this._tasks.setTaskResponsibles)
        await instance.register(this._tasks.sendBackTask)
        await instance.register(this._tasks.rejectFromReview)
        await instance.register(this._tasks.deleteTask)
        await instance.register(this._tasks.reorderTasks)
        await instance.register(this._tasks.placeTask)
        await instance.register(this._tasks.uploadTaskAttachment)
        await instance.register(this._tasks.downloadTaskAttachment)
        await instance.register(this._tasks.deleteTaskAttachment)
        await instance.register(this._tasks.listTaskComments)
        await instance.register(this._tasks.addTaskComment)
        await instance.register(this._tasks.updateTaskComment)
        await instance.register(this._tasks.deleteTaskComment)

        await instance.register(this._tags.getTagsByDepartment)
        await instance.register(this._tags.searchTagsByDepartment)
        await instance.register(this._tags.createTagByDepartment)
        await instance.register(this._tags.updateTagByDepartment)
        await instance.register(this._tags.deleteTagByDepartment)
        await instance.register(this._tags.getTaskTags)
        await instance.register(this._tags.setTaskTags)
        await instance.register(this._tags.createTag)
        await instance.register(this._tags.updateTag)
        await instance.register(this._tags.deleteTag)

        await instance.register(this._admin.getStats)
        await instance.register(this._admin.getAllOrganizations)

        await instance.register(this._analytics.getOrganizationAnalytics)

        // CRM
        await instance.register(this._crm.getSegments)
        await instance.register(this._crm.createSegment)
        await instance.register(this._crm.deleteSegment)
        await instance.register(this._crm.getContacts)
        await instance.register(this._crm.createContact)
        await instance.register(this._crm.getContactById)
        await instance.register(this._crm.updateContact)
        await instance.register(this._crm.deleteContact)
        await instance.register(this._crm.getCompanies)
        await instance.register(this._crm.createCompany)
        await instance.register(this._crm.getCompanyById)
        await instance.register(this._crm.updateCompany)
        await instance.register(this._crm.deleteCompany)
        await instance.register(this._crm.getLeadKanban)
        await instance.register(this._crm.getLeadStats)
        await instance.register(this._crm.getLeads)
        await instance.register(this._crm.createLead)
        await instance.register(this._crm.getLeadById)
        await instance.register(this._crm.updateLead)
        await instance.register(this._crm.moveLead)
        await instance.register(this._crm.deleteLead)
        await instance.register(this._crm.getLeadSources)
        await instance.register(this._crm.createLeadSource)
        await instance.register(this._crm.getDealStages)
        await instance.register(this._crm.createDealStage)
        await instance.register(this._crm.getDeals)
        await instance.register(this._crm.createDeal)
        await instance.register(this._crm.getDealStats)
        await instance.register(this._crm.getDocuments)
        await instance.register(this._crm.createDocument)
        await instance.register(this._crm.getCommunications)
        await instance.register(this._crm.createCommunication)
        await instance.register(this._crm.getAutomationRules)
        await instance.register(this._crm.createAutomationRule)
        await instance.register(this._crm.getQuotes)
        await instance.register(this._crm.createQuote)
        await instance.register(this._crm.getInvoices)
        await instance.register(this._crm.createInvoice)
        await instance.register(this._crm.getActivity)

        // Catalog
        await instance.register(this._catalog.getCategories)
        await instance.register(this._catalog.createCategory)
        await instance.register(this._catalog.updateCategory)
        await instance.register(this._catalog.deleteCategory)
        await instance.register(this._catalog.getWarehouses)
        await instance.register(this._catalog.createWarehouse)
        await instance.register(this._catalog.getStockMovements)
        await instance.register(this._catalog.getInventorySummary)
        await instance.register(this._catalog.getProducts)
        await instance.register(this._catalog.createProduct)
        await instance.register(this._catalog.getProductById)
        await instance.register(this._catalog.updateProduct)
        await instance.register(this._catalog.deleteProduct)
        await instance.register(this._catalog.adjustStock)
        await instance.register(this._catalog.getServices)
        await instance.register(this._catalog.createService)
        await instance.register(this._catalog.getServiceById)
        await instance.register(this._catalog.updateService)
        await instance.register(this._catalog.deleteService)

      },
      { prefix: `/${serverConfig.apiPrefix}` }
    )

    await server.register(fastifyWebsocket)
    await server.register(registerWsRoutes)

    try {
      await server.listen({ port: serverConfig.port, host: serverConfig.host })
      console.log(
        `Сервер запущен на порту: ${serverConfig.port}, ${serverConfig.host}\nAPI v${apiVersion} `,
      )
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  }
}
