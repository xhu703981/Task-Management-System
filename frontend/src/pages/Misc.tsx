import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FolderKanban, Inbox as InboxIcon, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Menu, type MenuEntry } from '../components/Menu'
import { Avatar, Modal, StatusIcon, TeamAvatar, timeAgo } from '../components/ui'
import { PROJECT_STATUSES } from '../data/meta'
import { useStore } from '../data/store'
import type { Project, ProjectStatus } from '../data/types'

export function Inbox() {
  const { db, me, user, issueKey } = useStore()
  const items = db.activity
    .filter((a) => a.actorId !== me.id)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 40)
  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">Inbox</div>
      </div>
      <div className="content-main">
        {items.length === 0 ? (
          <div className="empty-state">
            <InboxIcon size={32} className="faint" /> You’re all caught up.
          </div>
        ) : (
          items.map((a) => {
            const issue = db.issues.find((i) => i.id === a.issueId)
            if (!issue) return null
            return (
              <Link key={a.id} to={`/issue/${issue.id}`} className="issue-row" style={{ height: 52, gap: 12, padding: '0 16px' }}>
                <Avatar user={user(a.actorId)} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="mono faint">{issueKey(issue)}</span>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</span>
                  </div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    {user(a.actorId)?.name} {a.text}
                  </div>
                </div>
                <StatusIcon status={issue.status} />
                <span className="faint" style={{ fontSize: 12, width: 56, textAlign: 'right' }}>{timeAgo(a.createdAt)}</span>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}

export function Projects() {
  const { teamKey } = useParams()
  const { db, me, team, teamByKey, deleteProject } = useStore()
  const navigate = useNavigate()
  const scopeTeam = teamKey ? teamByKey(teamKey) : undefined
  const projects = db.projects.filter((p) => !scopeTeam || p.teamId === scopeTeam.id)
  // You can only create projects in teams you're a member of (an Admin may see other teams too).
  const myTeams = db.teams.filter((t) => t.memberIds.includes(me.id))
  const [editing, setEditing] = useState<Project | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)

  const rowMenu = (p: Project): MenuEntry[] => {
    const t = team(p.teamId)
    // Same rule as the backend: any member edits; only team owners and Admins delete.
    const canDelete = t.ownerIds.includes(me.id) || me.role === 'Admin'
    return [
      { label: 'Edit project…', icon: <Pencil size={16} />, onSelect: () => setEditing(p) },
      ...(canDelete ? [{ label: 'Delete project…', icon: <Trash2 size={16} />, danger: true, onSelect: () => setConfirmDelete(p) }] : []),
    ]
  }

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          {scopeTeam && (
            <>
              <TeamAvatar team={scopeTeam} size={16} /> {scopeTeam.name} <span className="sep">›</span>
            </>
          )}
          Projects
        </div>
        <span className="spacer" />
        <button className="btn sm" disabled={myTeams.length === 0} onClick={() => setEditing('new')}>
          <Plus size={14} /> New project
        </button>
      </div>
      <div className="content-main">
        {projects.length === 0 && (
          <div className="empty-state">
            <FolderKanban size={32} className="faint" /> No projects yet.
          </div>
        )}
        {projects.map((p) => {
          const issues = db.issues.filter((i) => i.projectId === p.id && i.status !== 'canceled')
          const done = issues.filter((i) => i.status === 'done').length
          const t = team(p.teamId)
          const status = PROJECT_STATUSES.find((s) => s.id === p.status)!
          return (
            <div key={p.id} className="issue-row" style={{ height: 48, gap: 12, padding: '0 24px' }} onClick={() => navigate(`/project/${p.id}`)}>
              <FolderKanban size={16} className="faint" />
              <span style={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.description || undefined}>
                {p.name}
              </span>
              <span className="chip">
                <span className="dot" style={{ background: status.color }} /> {status.name}
              </span>
              <span className="chip">
                <TeamAvatar team={t} size={12} /> {t.key}
              </span>
              <div style={{ width: 160 }}>
                <div className="progress" title={`${done} of ${issues.length} completed`}>
                  {done > 0 && <div style={{ width: `${(done / Math.max(1, issues.length)) * 100}%`, background: 'var(--accent)' }} />}
                </div>
              </div>
              <span className="muted" style={{ width: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {done} / {issues.length}
              </span>
              <button
                className="icon-btn"
                aria-label={`Actions for ${p.name}`}
                onClick={(e) => {
                  e.stopPropagation() // open the menu, not the project
                  const r = e.currentTarget.getBoundingClientRect()
                  setMenu({ x: r.right - 240, y: r.bottom + 4, entries: rowMenu(p) })
                }}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          )
        })}
      </div>
      {menu && <Menu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />}
      {editing && (
        <ProjectModal
          project={editing === 'new' ? null : editing}
          teams={myTeams}
          defaultTeamId={scopeTeam && myTeams.some((t) => t.id === scopeTeam.id) ? scopeTeam.id : myTeams[0]?.id}
          onClose={() => setEditing(null)}
        />
      )}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} width={420}>
          <div style={{ padding: '20px 20px 8px' }}>
            <h2 className="title-md">Delete {confirmDelete.name}?</h2>
            <p className="muted" style={{ margin: '8px 0 12px' }}>Its issues are kept and become “No project”. This can’t be undone.</p>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button
              className="btn danger"
              onClick={() => {
                deleteProject(confirmDelete.id)
                setConfirmDelete(null)
              }}
            >
              Delete project
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

/** Create (project = null) or edit a project. The team can only be picked when creating. */
function ProjectModal({ project, teams, defaultTeamId, onClose }: { project: Project | null; teams: { id: string; name: string }[]; defaultTeamId?: string; onClose: () => void }) {
  const { createProject, updateProject } = useStore()
  const [teamId, setTeamId] = useState(project?.teamId ?? defaultTeamId ?? '')
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'planned')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    const fields = { name: name.trim(), description, status }
    // On failure (e.g. the name is taken) the reason shows as a toast and the form stays open.
    const ok = project ? await updateProject(project.id, fields) : await createProject(teamId, fields)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal onClose={onClose} width={480}>
      <form onSubmit={submit}>
        <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="title-md">{project ? 'Edit project' : 'New project'}</h2>
          {!project && (
            <label className="field">
              <span>Team</span>
              <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Name</span>
            <input className="input" autoFocus maxLength={255} placeholder="e.g. Q4 launch" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea className="textarea" rows={3} placeholder="What is this project about?" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="field">
            <span>Status</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim() || saving}>
            {project ? 'Save' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
