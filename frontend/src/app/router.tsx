import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { RouteFallbackSkeleton } from 'shared/ui'

const DashboardPage = lazy(() => import('pages/dashboard').then((m) => ({ default: m.DashboardPage })))
const ContactsPage = lazy(() => import('pages/crm/contacts').then((m) => ({ default: m.ContactsPage })))
const CompaniesPage = lazy(() => import('pages/crm/companies').then((m) => ({ default: m.CompaniesPage })))
const LeadsPage = lazy(() => import('pages/crm/leads').then((m) => ({ default: m.LeadsPage })))
const ProductsPage = lazy(() => import('pages/catalog/products').then((m) => ({ default: m.ProductsPage })))
const ServicesPage = lazy(() => import('pages/catalog/services').then((m) => ({ default: m.ServicesPage })))

const AuthPage = lazy(() => import('pages/auth').then((m) => ({ default: m.AuthPage })))
const RegisterPage = lazy(() => import('pages/register').then((m) => ({ default: m.RegisterPage })))
const HomeEntryPage = lazy(() => import('pages/home').then((m) => ({ default: m.HomeEntryPage })))
const AdminPage = lazy(() => import('pages/admin').then((m) => ({ default: m.AdminPage })))
const OrganizationPage = lazy(() =>
  import('pages/organization').then((m) => ({ default: m.OrganizationPage }))
)
const OrganizationSettingsPage = lazy(() =>
  import('pages/organization').then((m) => ({ default: m.OrganizationSettingsPage }))
)
const OrgUsersPage = lazy(() => import('pages/organization').then((m) => ({ default: m.OrgUsersPage })))
const OrganizationAnalyticsPage = lazy(() =>
  import('pages/organization').then((m) => ({ default: m.OrganizationAnalyticsPage }))
)
const MyTasksPage = lazy(() => import('pages/my-tasks').then((m) => ({ default: m.MyTasksPage })))
const GlobalMyTasksPage = lazy(() =>
  import('pages/my-tasks').then((m) => ({ default: m.GlobalMyTasksPage }))
)
const FavoritePipelinesPage = lazy(() =>
  import('pages/favorite-pipelines').then((m) => ({ default: m.FavoritePipelinesPage }))
)
const DepartmentPage = lazy(() =>
  import('pages/department').then((m) => ({ default: m.DepartmentPage }))
)
const DepartmentSettingsPage = lazy(() =>
  import('pages/department').then((m) => ({ default: m.DepartmentSettingsPage }))
)
const DepartmentMembersPage = lazy(() =>
  import('pages/department').then((m) => ({ default: m.DepartmentMembersPage }))
)
const DepartmentTagsPage = lazy(() =>
  import('pages/department').then((m) => ({ default: m.DepartmentTagsPage }))
)
const DepartmentPipelinePage = lazy(() =>
  import('pages/department').then((m) => ({ default: m.DepartmentPipelinePage }))
)
const PipelineSettingsPage = lazy(() =>
  import('pages/department').then((m) => ({ default: m.PipelineSettingsPage }))
)
const TaskPage = lazy(() => import('pages/task').then((m) => ({ default: m.TaskPage })))
const ProfilePage = lazy(() => import('pages/profile').then((m) => ({ default: m.ProfilePage })))
const ProfileAppearancePage = lazy(() =>
  import('pages/profile').then((m) => ({ default: m.ProfileAppearancePage })),
)
const ProfileNotificationsPage = lazy(() =>
  import('pages/profile').then((m) => ({ default: m.ProfileNotificationsPage })),
)
const FinancePage = lazy(() => import('pages/finance/FinancePage').then((m) => ({ default: m.FinancePage })))
const ProjectsPage = lazy(() => import('pages/stub/StubPage').then((m) => ({ default: m.ProjectsPage })))
const AiPage = lazy(() => import('pages/ai/AiPage').then((m) => ({ default: m.AiPage })))
const ReportsPage = lazy(() => import('pages/stub/StubPage').then((m) => ({ default: m.ReportsPage })))

function RouteFallback() {
  return <RouteFallbackSkeleton />
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/appearance" element={<ProfileAppearancePage />} />
        <Route path="/profile/notifications" element={<ProfileNotificationsPage />} />
        <Route path="/my-tasks" element={<GlobalMyTasksPage />} />
        <Route path="/" element={<HomeEntryPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/organizations/create" element={<Navigate to="/" replace />} />
        <Route path="/organizations/:id" element={<OrganizationPage />} />
        <Route path="/organizations/:id/settings" element={<OrganizationSettingsPage />} />
        <Route path="/organizations/:id/users" element={<OrgUsersPage />} />
        <Route path="/organizations/:id/analytics" element={<OrganizationAnalyticsPage />} />
        <Route path="/organizations/:id/my-tasks" element={<MyTasksPage />} />
        <Route path="/favorite-pipelines" element={<FavoritePipelinesPage />} />
        <Route path="/organizations/:id/favorites" element={<Navigate to="/favorite-pipelines" replace />} />
        <Route path="/departments/:id" element={<DepartmentPage />} />
        <Route path="/departments/:id/pipelines/:pipelineId" element={<DepartmentPipelinePage />} />
        <Route
          path="/departments/:id/pipelines/:pipelineId/settings"
          element={<PipelineSettingsPage />}
        />
        <Route path="/departments/:id/settings" element={<DepartmentSettingsPage />} />
        <Route path="/departments/:id/members" element={<DepartmentMembersPage />} />
        <Route path="/departments/:id/tags" element={<DepartmentTagsPage />} />
        <Route path="/tasks/:id" element={<TaskPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/crm/contacts" element={<ContactsPage />} />
        <Route path="/crm/companies" element={<CompaniesPage />} />
        <Route path="/crm/leads" element={<LeadsPage />} />
        <Route path="/catalog/products" element={<ProductsPage />} />
        <Route path="/catalog/services" element={<ServicesPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/ai" element={<AiPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
