import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ChevronDown, ChevronRight, CircleDot, Download, FolderKanban, HelpCircle, Inbox, Layers, LogOut, Plus,
  Repeat, Search, Settings, Sparkles, SquarePen, UserPlus, Users,
} from 'lucide-react'
import { Menu, type MenuEntry } from '../components/Menu'
import { TeamAvatar, initials } from '../components/ui'
import { useStore, useUi } from '../data/store'

const navClass = ({ isActive }: { isActive: boolean }) => `nav-item${isActive ? ' selected' : ''}`

function WorkspaceAvatar({ name, color, size = 20 }: { name: string; color: string; size?: number }) {
  return (
    <span className="avatar square" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {initials(name)}
    </span>
  )
}

export function AccountMenu({ x, y, onClose, onLogout }: { x: number; y: number; onClose: () => void; onLogout: () => void }) {
  const { db, setDb, toast } = useStore()
  const navigate = useNavigate()
  const entries: MenuEntry[] = [
    { label: 'Settings', icon: <Settings size={16} />, shortcut: ['G', 'then', 'S'], onSelect: () => navigate('/settings/profile') },
    { label: 'Invite and manage members', icon: <UserPlus size={16} />, onSelect: () => navigate('/settings/members') },
    { kind: 'divider' },
    { label: 'Download desktop app', icon: <Download size={16} />, onSelect: () => toast('Desktop app is not part of this demo') },
    { kind: 'divider' },
    {
      label: 'Switch workspace',
      icon: <Repeat size={16} />,
      shortcut: ['O', 'then', 'W'],
      hotkey: 'o',
      submenu: {
        entries: [
          ...db.workspaces.map((w) => ({
            label: w.name,
            icon: <WorkspaceAvatar name={w.name} color={w.color} size={16} />,
            checked: w.id === db.currentWorkspaceId,
            onSelect: () => {
              setDb((d) => ({ ...d, currentWorkspaceId: w.id }))
              if (w.id !== db.currentWorkspaceId) toast(`Switched to ${w.name}`)
            },
          })),
          { kind: 'divider' as const },
          { label: 'Create or join workspace', icon: <Plus size={14} />, onSelect: () => toast('Workspace creation is not part of this demo') },
        ],
      },
    },
    { label: 'Log out', icon: <LogOut size={16} />, shortcut: ['Alt', '⇧', 'Q'], onSelect: onLogout },
  ]
  return <Menu x={x} y={y} entries={entries} onClose={onClose} width={260} />
}

function TeamGroup({ teamId }: { teamId: string }) {
  const { team } = useStore()
  const t = team(teamId)
  const [open, setOpen] = useState(true)
  const base = `/team/${t.key}`
  return (
    <div>
      <button className="nav-item" onClick={() => setOpen(!open)}>
        <TeamAvatar team={t} size={16} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
        {open ? <ChevronDown size={12} className="faint" /> : <ChevronRight size={12} className="faint" />}
      </button>
      {open && (
        <>
          <NavLink to={`${base}/issues`} className={({ isActive }) => navClass({ isActive }) + ' child'}>
            <Layers size={16} /> Issues
          </NavLink>
          {t.cyclesEnabled && (
            <NavLink to={`${base}/cycles`} className={({ isActive }) => navClass({ isActive }) + ' child'}>
              <Repeat size={16} /> Cycles
            </NavLink>
          )}
          <NavLink to={`${base}/projects`} className={({ isActive }) => navClass({ isActive }) + ' child'}>
            <FolderKanban size={16} /> Projects
          </NavLink>
          <NavLink to={`${base}/summary`} className={({ isActive }) => navClass({ isActive }) + ' child'}>
            <Sparkles size={16} className="sparkle" /> Summary
          </NavLink>
        </>
      )}
    </div>
  )
}

export function WorkspaceShell({ onLogout }: { onLogout: () => void }) {
  const { db, me } = useStore()
  const ui = useUi()
  const [accountMenu, setAccountMenu] = useState<{ x: number; y: number } | null>(null)
  const [teamsOpen, setTeamsOpen] = useState(true)
  const ws = db.workspaces.find((w) => w.id === db.currentWorkspaceId)!
  const myTeams = db.teams.filter((t) => t.memberIds.includes(me.id))
  const inboxCount = db.activity.filter((a) => a.actorId !== me.id && Date.now() - a.createdAt < 3 * 86_400_000).length

  return (
    <div className="shell">
      <aside className={`sidebar${ui.sidebarCollapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-top">
          <button
            className="ws-switcher"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setAccountMenu({ x: r.left, y: r.bottom + 4 })
            }}
          >
            <WorkspaceAvatar name={ws.name} color={ws.color} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
            <ChevronDown size={12} className="faint" />
          </button>
          <span className="spacer" />
          <button className="icon-btn" aria-label="Search" title="Search (Ctrl K)" onClick={() => ui.setPaletteOpen(true)}>
            <Search size={16} />
          </button>
          <button className="icon-btn" aria-label="New issue" title="New issue (C)" onClick={() => ui.setNewIssueTeamId(myTeams[0]?.id ?? db.teams[0].id)}>
            <SquarePen size={16} />
          </button>
        </div>

        <NavLink to="/inbox" className={navClass}>
          <Inbox size={16} /> Inbox {inboxCount > 0 && <span className="badge">{inboxCount}</span>}
        </NavLink>
        <NavLink to="/my-issues" className={navClass}>
          <CircleDot size={16} /> My issues
        </NavLink>

        <div className="nav-section">
          <div className="section-header">Workspace</div>
          <NavLink to="/projects" className={navClass}>
            <FolderKanban size={16} /> Projects
          </NavLink>
          <NavLink to="/summaries" className={navClass}>
            <Sparkles size={16} className="sparkle" /> AI Summaries
          </NavLink>
        </div>

        <div className="nav-section">
          <button className="section-header" onClick={() => setTeamsOpen(!teamsOpen)}>
            Your teams {teamsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {teamsOpen && myTeams.map((t) => <TeamGroup key={t.id} teamId={t.id} />)}
        </div>

        <span className="spacer" />
        <NavLink to="/settings/members" className={navClass}>
          <Users size={16} /> Invite people
        </NavLink>
        <a className="nav-item" href="https://linear.app/docs" target="_blank" rel="noreferrer">
          <HelpCircle size={16} /> Help
        </a>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      {accountMenu && <AccountMenu x={accountMenu.x} y={accountMenu.y} onClose={() => setAccountMenu(null)} onLogout={onLogout} />}
    </div>
  )
}

