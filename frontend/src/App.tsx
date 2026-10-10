import { useCallback, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { StoreProvider, UiProvider, useStore, useUi } from './data/store'
import { WorkspaceShell } from './layouts/WorkspaceShell'
import { SettingsShell } from './layouts/SettingsShell'
import { IssueContextMenu } from './components/IssueContextMenu'
import { CommandPalette, ConfirmDelete, GlobalHotkeys, NewIssueModal, Toasts } from './components/Overlays'
import TeamIssues, { MyIssues } from './pages/IssueList'
import IssueDetail from './pages/IssueDetail'
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
  return <Navigate to={`/team/${team(ws.defaultTeamId).key}/issues`} replace />
}

function LoggedOut({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="empty-state" style={{ height: '100%' }}>
      <h1 className="title-lg" style={{ color: 'var(--text-primary)' }}>You’ve been logged out</h1>
      <button className="btn primary" autoFocus onClick={onLogin}>Log back in</button>
    </div>
  )
}

function AppRoutes() {
  const [loggedOut, setLoggedOut] = useState(false)
  const ui = useUi()
  const navigate = useNavigate()
  const logout = useCallback(() => {
    ui.setContextMenu(null)
    ui.setPaletteOpen(false)
    ui.setNewIssueTeamId(null)
    setLoggedOut(true)
  }, [ui])

  if (loggedOut)
    return (
      <LoggedOut
        onLogin={() => {
          setLoggedOut(false)
          navigate('/')
        }}
      />
    )

  return (
    <>
      <Routes>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <IssueContextMenu />
      <NewIssueModal />
      <CommandPalette />
      <ConfirmDelete />
      <Toasts />
      <GlobalHotkeys onLogout={logout} />
    </>
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
