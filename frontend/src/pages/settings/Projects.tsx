import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LogOut, Trash2, X } from 'lucide-react'
import { Avatar, Modal, ProjectAvatar, SettingsRow, Toggle } from '../../components/ui'
import { PageHeader } from './Personal'
import { COLORS, PROJECT_ROLES } from '../../data/meta'
import { useStore } from '../../data/store'
import type { Project, ProjectRole } from '../../data/types'

// Same rule as the backend: 2-10 capital letters or digits, starting with a letter.
const KEY_RE = /^[A-Z][A-Z0-9]{1,9}$/

export function ProjectSettings() {
  const { projectKey } = useParams()
  const { projectByKey } = useStore()
  const project = projectByKey(projectKey ?? '')
  if (!project) return <div className="empty-state">Project not found.</div>
  return <ProjectSettingsForm key={project.id} project={project} />
}

function ProjectSettingsForm({ project }: { project: Project }) {
  const { db, me, user, canManage, updateProject, addMember, setMemberRole, removeMember, deleteProject, toast } = useStore()
  const navigate = useNavigate()
  const admin = canManage(project.id)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [addId, setAddId] = useState('')
  const [addRole, setAddRole] = useState<ProjectRole>('Member')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [typed, setTyped] = useState('')
  const dirty = name !== project.name || description !== project.description
  const nonMembers = db.users.filter((u) => !project.memberIds.includes(u.id))
  const adminCount = project.memberIds.filter((id) => project.roles[id] === 'Admin').length

  return (
    <div className="settings-page">
      <div className="row" style={{ gap: 12, marginBottom: 32 }}>
        <ProjectAvatar project={project} size={32} />
        <div>
          <h1 className="title-lg">{project.name}</h1>
          <p className="muted" style={{ margin: 0 }}>Project settings{!admin && ' · only project Admins can change them'}</p>
        </div>
      </div>

      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          if (await updateProject(project.id, { name: name.trim(), description })) toast('Project updated')
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} readOnly={!admin} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Key — the prefix of every issue key ({project.key}-123). Fixed once the project exists.</span>
          <input className="input mono" value={project.key} readOnly />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="textarea" rows={3} readOnly={!admin} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="field">
          <span>Project lead</span>
          <select
            className="select"
            disabled={!admin}
            value={project.leadId ?? ''}
            onChange={(e) => updateProject(project.id, { leadId: e.target.value || null })}
          >
            <option value="">No lead</option>
            {project.memberIds.map((id) => (
              <option key={id} value={id}>{user(id)?.name}</option>
            ))}
          </select>
        </label>
        {admin && (
          <div>
            <button className="btn primary" type="submit" disabled={!dirty || !name.trim()}>Save</button>
          </div>
        )}
      </form>

      <section className="settings-section">
        <h3>Members · {project.memberIds.length}</h3>
        <div className="card">
          {project.memberIds.map((id) => {
            const u = user(id)
            if (!u) return null
            const role = project.roles[id]
            const lastAdmin = role === 'Admin' && adminCount === 1
            return (
              <div key={id} className="row" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <Avatar user={u} size={24} />
                <span style={{ flex: 1, fontWeight: 500 }}>
                  {u.name} {id === me.id && <span className="faint">(you)</span>} {id === project.leadId && <span className="badge-pill">Lead</span>}
                </span>
                <span className="muted">{u.email}</span>
                <select
                  className="select"
                  style={{ width: 110 }}
                  aria-label={`Role of ${u.name}`}
                  disabled={!admin}
                  title={lastAdmin ? 'A project needs at least one Admin' : undefined}
                  value={role}
                  onChange={(e) => setMemberRole(project.id, id, e.target.value as ProjectRole)}
                >
                  {PROJECT_ROLES.map((r) => (
                    <option key={r.id} value={r.id} title={r.desc}>{r.id}</option>
                  ))}
                </select>
                {(admin || id === me.id) && (
                  <button
                    className="icon-btn"
                    aria-label={id === me.id ? 'Leave project' : `Remove ${u.name}`}
                    title={lastAdmin ? 'A project needs at least one Admin' : id === me.id ? 'Leave project' : 'Remove from project'}
                    disabled={lastAdmin}
                    onClick={async () => {
                      // After leaving, only a workspace Admin can still see the project.
                      if ((await removeMember(project.id, id)) && id === me.id && me.role !== 'Admin') navigate('/settings/projects', { replace: true })
                    }}
                  >
                    {id === me.id ? <LogOut size={14} /> : <X size={14} />}
                  </button>
                )}
              </div>
            )
          })}
          {admin && nonMembers.length > 0 && (
            <div className="row card-pad">
              <select className="select" value={addId} onChange={(e) => setAddId(e.target.value)} aria-label="Add member">
                <option value="">Add a member…</option>
                {nonMembers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.username})</option>
                ))}
              </select>
              <select className="select" style={{ width: 110 }} value={addRole} onChange={(e) => setAddRole(e.target.value as ProjectRole)} aria-label="Role for new member">
                {PROJECT_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.id}</option>
                ))}
              </select>
              <button
                className="btn"
                disabled={!addId}
                onClick={() => {
                  addMember(project.id, addId, addRole)
                  setAddId('')
                }}
              >
                Add
              </button>
            </div>
          )}
        </div>
        <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
          {PROJECT_ROLES.map((r) => `${r.id}: ${r.desc.toLowerCase()}`).join(' · ')}
        </div>
      </section>

      {admin && (
        <>
          <section className="settings-section">
            <h3>Archive</h3>
            <div className="card" style={{ padding: '0 16px' }}>
              <SettingsRow title="Archived" desc="Archived projects stay readable but don’t take new issues from the New issue dialog.">
                <Toggle on={project.isArchived} label="Archived" onChange={(v) => updateProject(project.id, { isArchived: v })} />
              </SettingsRow>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="danger-text">Danger zone</h3>
            <div className="card danger-zone" style={{ padding: '0 16px' }}>
              <SettingsRow title="Delete project" desc="Deletes the project with all its issues, comments and sprints. This can’t be undone.">
                <button className="btn sm danger-outline" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} /> Delete project
                </button>
              </SettingsRow>
            </div>
          </section>
        </>
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} width={440}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="title-md">Delete {project.name}?</h2>
            <p className="muted" style={{ margin: 0 }}>
              Its {project.issueCount} issue{project.issueCount === 1 ? '' : 's'}, their comments and all sprints are deleted too. Type <b>{project.key}</b> to confirm.
            </p>
            <input className="input mono" autoFocus value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} />
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button
              className="btn danger"
              disabled={typed !== project.key}
              onClick={async () => {
                setConfirmDelete(false)
                if (await deleteProject(project.id)) navigate('/settings/projects', { replace: true })
              }}
            >
              Delete project
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** "Cloud Migration" → "CM", "Platform" → "PLA": a suggestion the user can overwrite. */
const autoKey = (name: string) => {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean)
  const key = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 3)
  return key.replace(/^[0-9]+/, '').slice(0, 10)
}

export function CreateProject() {
  const { db, me, createProject } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyEdited, setKeyEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const effectiveKey = keyEdited ? key : autoKey(name)
  const keyError = !effectiveKey ? null : !KEY_RE.test(effectiveKey) ? '2–10 capital letters or digits, starting with a letter' : db.projects.some((p) => p.key === effectiveKey) ? 'Key already in use' : null

  if (me.role !== 'Admin')
    return (
      <div className="settings-page">
        <PageHeader title="Create a project" desc="Only workspace Admins can create projects. Ask an Admin to create one and add you." />
      </div>
    )

  return (
    <div className="settings-page">
      <PageHeader title="Create a project" desc="A project holds its own issues, epics, sprints and members. You’ll be its lead and first Admin." />
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || !effectiveKey || keyError || saving) return
          setSaving(true)
          const p = await createProject({ name: name.trim(), key: effectiveKey, description })
          setSaving(false)
          if (p) navigate(`/project/${p.key}/backlog`)
        }}
      >
        <div className="row" style={{ gap: 12 }}>
          <ProjectAvatar project={{ name: name || '?', color: COLORS[(db.projects.length + 1) % COLORS.length] }} size={32} />
          <label className="field" style={{ flex: 1 }}>
            <span>Project name</span>
            <input className="input" autoFocus placeholder="e.g. Cloud Migration" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Key — the prefix of every issue key ({effectiveKey || 'CIM'}-123); it can’t change later</span>
          <input
            className="input mono"
            value={effectiveKey}
            onChange={(e) => {
              setKeyEdited(true)
              setKey(e.target.value.toUpperCase())
            }}
          />
          {keyError && <span className="danger-text label">{keyError}</span>}
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="textarea" rows={3} placeholder="What is this project about?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="row">
          <button className="btn primary" type="submit" disabled={!name.trim() || !effectiveKey || !!keyError || saving}>Create project</button>
          <button className="btn ghost" type="button" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
