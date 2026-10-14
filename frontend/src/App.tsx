import { useCallback } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { StoreProvider, UiProvider, useStore, useUi } from './data/store'
import { WorkspaceShell } from './layouts/WorkspaceShell'
import { SettingsShell } from './layouts/SettingsShell'
import { AuthGate } from './components/AuthGate'
import { clearToken } from './data/api'
import { IssueContextMenu } from './components/IssueContextMenu'
import { CommandPalette, ConfirmDelete, GlobalHotkeys, NewIssueModal, Toasts } from './components/Overlays'
import TeamIssues, { MyIssues, ProjectIssues } from './pages/IssueList'
import IssueDetail from './pages/IssueDetail'
import Login from './pages/Login'
import Cycles, { CycleDetail } from './pages/Cycles'
import TeamSummary, { AllSummaries } from './pages/Summary'
import { Inbox, Projects } from './pages/Misc'
import { ConnectedAccounts, Profile, SecurityAccess } from './pages/settings/Personal'
import { ApiSettings, MembersSettings, SecuritySettings, TeamsSettings, WorkspaceSettings } from './pages/settings/Admin'
import { CreateTeam, TeamSettings } from './pages/settings/Teams'
import { IntegrationDetail, Integrations } from './pages/settings/Integrations'

function Home() {
  const { db, team } = useStore()
  const ws = db.workspaces.find((w) => w.id === db.currentWorkspaceId)!
  if (!ws.defaultTeamId) return <Navigate to="/my-issues" replace /> // you're in no team yet
  return <Navigate to={`/team/${team(ws.defaultTeamId).key}/issues`} replace />
}

function AppRoutes() {
  const ui = useUi()
  const navigate = useNavigate()
  const logout = useCallback(() => {
    ui.setContextMenu(null)
    ui.setPaletteOpen(false)
    ui.setNewIssueTeamId(null)
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
          <Route path="projects" element={<Projects />} />
          <Route path="summaries" element={<AllSummaries />} />
          <Route path="team/:teamKey/issues" element={<TeamIssues />} />
          <Route path="team/:teamKey/cycles" element={<Cycles />} />
          <Route path="team/:teamKey/cycles/:cycleId" element={<CycleDetail />} />
          <Route path="team/:teamKey/projects" element={<Projects />} />
          <Route path="project/:projectId" element={<ProjectIssues />} />
          <Route path="team/:teamKey/summary" element={<TeamSummary />} />
          <Route path="issue/:issueId" element={<IssueDetail />} />
        </Route>
        <Route path="settings" element={<SettingsShell />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route path="security-access" element={<SecurityAccess />} />
          <Route path="connected-accounts" element={<ConnectedAccounts />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="integrations/:integrationId" element={<IntegrationDetail />} />
          <Route path="workspace" element={<WorkspaceSettings />} />
          <Route path="teams" element={<TeamsSettings />} />
          <Route path="teams/:teamKey" element={<TeamSettings />} />
          <Route path="members" element={<MembersSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="api" element={<ApiSettings />} />
          <Route path="new-team" element={<CreateTeam />} />
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
