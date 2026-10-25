import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ChevronLeft, Plus, Search } from 'lucide-react'
import { ProjectAvatar } from '../components/ui'
import { useStore } from '../data/store'

type NavEntry = { label: string; to: string }

const SECTIONS: { title: string; items: NavEntry[] }[] = [
  {
    title: 'Personal',
    items: [
      { label: 'Profile', to: '/settings/profile' },
      { label: 'Security & access', to: '/settings/security-access' },
      { label: 'Connected accounts', to: '/settings/connected-accounts' },
    ],
  },
  {
    title: 'Features',
    items: [
      { label: 'Integrations', to: '/settings/integrations' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Workspace', to: '/settings/workspace' },
      { label: 'Projects', to: '/settings/projects' },
      { label: 'Members', to: '/settings/members' },
      { label: 'Security', to: '/settings/security' },
      { label: 'API', to: '/settings/api' },
    ],
  },
]

const navClass = ({ isActive }: { isActive: boolean }) => `nav-item${isActive ? ' selected' : ''}`

export function SettingsShell() {
  const { db, me } = useStore()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const match = (label: string) => !q || label.toLowerCase().includes(q)
  const myProjects = db.projects.filter((p) => p.memberIds.includes(me.id))

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <NavLink to="/" className="nav-item" style={{ width: 'auto' }}>
            <ChevronLeft size={16} /> Back to app
          </NavLink>
        </div>
        <div className="settings-search">
          <Search size={14} />
          <input className="input" placeholder="Search settings" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {SECTIONS.map((s) => {
          const items = s.items.filter((i) => match(i.label))
          if (!items.length) return null
          return (
            <div key={s.title} className="nav-section" style={{ marginTop: 12 }}>
              <div className="section-header">{s.title}</div>
              {items.map((i) => (
                <NavLink key={i.label} to={i.to} end={i.to === '/settings/projects'} className={navClass}>
                  {i.label}
                </NavLink>
              ))}
            </div>
          )
        })}
        <div className="nav-section" style={{ marginTop: 12 }}>
          <div className="section-header">Your projects</div>
          {myProjects
            .filter((p) => match(p.name))
            .map((p) => (
              <NavLink key={p.id} to={`/settings/projects/${p.key}`} className={navClass}>
                <ProjectAvatar project={p} size={16} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </NavLink>
            ))}
          {me.role === 'Admin' && match('Create a project') && (
            <NavLink to="/settings/new-project" className={navClass}>
              <Plus size={16} /> Create a project
            </NavLink>
          )}
        </div>
      </aside>
      <main className="content">
        <div className="content-main">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
