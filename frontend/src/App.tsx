import { useCallback } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { StoreProvider, UiProvider, useStore, useUi } from './data/store'
import { WorkspaceShell } from './layouts/WorkspaceShell'
import { SettingsShell } from './layouts/SettingsShell'
import { AuthGate } from './components/AuthGate'
import { clearToken } from './data/api'
import { IssueContextMenu } from './components/IssueContextMenu'
import { CommandPalette, ConfirmDelete, GlobalHotkeys, NewIssueModal, Toasts } from './components/Overlays'
import ProjectIssues, { MyIssues } from './pages/IssueList'
import IssueDetail from './pages/IssueDetail'
import Login from './pages/Login'
import Backlog from './pages/Backlog'
import Board from './pages/Board'
import Sprints, { SprintIssues } from './pages/Sprints'
import ProjectSummary, { AllSummaries } from './pages/Summary'
import { Epics, Inbox } from './pages/Misc'
import { ConnectedAccounts, Profile, SecurityAccess } from './pages/settings/Personal'
import { ApiSettings, MembersSettings, ProjectsSettings, SecuritySettings, WorkspaceSettings } from './pages/settings/Admin'
import { CreateProject, ProjectSettings } from './pages/settings/Projects'
import { IntegrationDetail, Integrations } from './pages/settings/Integrations'

function Home() {
  const { db, project } = useStore()
  const ws = db.workspaces.find((w) => w.id === db.currentWorkspaceId)!
  if (!ws.defaultProjectId) return <Navigate to="/my-issues" replace /> // you're in no project yet
  return <Navigate to={`/project/${project(ws.defaultProjectId).key}/board`} replace />
}

function AppRoutes() {
  const ui = useUi()
  const navigate = useNavigate()
  const logout = useCallback(() => {
    ui.setContextMenu(null)
    ui.setPaletteOpen(false)
    ui.setNewIssue(null)
    clearToken()
    navigate('/login', { replace: true })
  }, [ui, navigate])

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <AuthGate>
            <IssueContextMenu />
            <NewIssueModal />
            <CommandPalette />
            <ConfirmDelete />
            <Toasts />
            <GlobalHotkeys onLogout={logout} />
          </AuthGate>
        }
      >
        <Route element={<WorkspaceShell onLogout={logout} />}>
          <Route index element={<Home />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="my-issues" element={<MyIssues />} />
          <Route path="summaries" element={<AllSummaries />} />
          <Route path="project/:projectKey" element={<Navigate to="board" replace />} />
          <Route path="project/:projectKey/backlog" element={<Backlog />} />
          <Route path="project/:projectKey/board" element={<Board />} />
          <Route path="project/:projectKey/issues" element={<ProjectIssues />} />
          <Route path="project/:projectKey/epics" element={<Epics />} />
          <Route path="project/:projectKey/sprints" element={<Sprints />} />
          <Route path="project/:projectKey/sprints/:sprintId" element={<SprintIssues />} />
          <Route path="project/:projectKey/summary" element={<ProjectSummary />} />
          <Route path="issue/:issueKey" element={<IssueDetail />} />
        </Route>
        <Route path="settings" element={<SettingsShell />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route path="security-access" element={<SecurityAccess />} />
          <Route path="connected-accounts" element={<ConnectedAccounts />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="integrations/:integrationId" element={<IntegrationDetail />} />
          <Route path="workspace" element={<WorkspaceSettings />} />
          <Route path="projects" element={<ProjectsSettings />} />
          <Route path="projects/:projectKey" element={<ProjectSettings />} />
          <Route path="members" element={<MembersSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="api" element={<ApiSettings />} />
          <Route path="new-project" element={<CreateProject />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <UiProvider>
          <AppRoutes />
        </UiProvider>
      </StoreProvider>
    </BrowserRouter>
  )
}
