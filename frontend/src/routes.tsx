import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ChatPage } from '@/pages/ChatPage'
import { WorkflowEditorPage } from '@/pages/WorkflowEditorPage'
import { SkillsPage } from '@/pages/SkillsPage'
import { SkillDetailPage } from '@/pages/SkillDetailPage'
import { TaskMonitorPage } from '@/pages/TaskMonitorPage'
import { TaskDetailPage } from '@/pages/TaskDetailPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { ReportDetailPage } from '@/pages/ReportDetailPage'
import { FindingsPage } from '@/pages/FindingsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('access_token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'workflows', element: <WorkflowEditorPage /> },
      { path: 'skills', element: <SkillsPage /> },
      { path: 'skills/:id', element: <SkillDetailPage /> },
      { path: 'tasks', element: <TaskMonitorPage /> },
      { path: 'tasks/:id', element: <TaskDetailPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'reports/:id', element: <ReportDetailPage /> },
      { path: 'findings', element: <FindingsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectsPage /> },
    ],
  },
  {
    path: '*',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
