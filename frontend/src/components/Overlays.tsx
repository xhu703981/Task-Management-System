import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, CircleDot, Columns3, Inbox, Layers, ListTodo, Plus, Repeat, Settings, Sparkles, Tag, X, Search, PanelLeft, Zap } from 'lucide-react'
import { Menu, type MenuEntry } from './Menu'
import { Avatar, IssueTypeIcon, Modal, PriorityIcon, ProjectAvatar, StatusIcon, Toggle } from './ui'
import { epicEntries, sprintEntries } from './IssueContextMenu'
import { allLabels, labelEntries } from './labels'
import { ISSUE_TYPES, PRIORITIES, STATUSES, priorityName, statusMeta, typeMeta } from '../data/meta'
import { useStore, useUi, type NewIssueDraft } from '../data/store'
import type { Issue, IssueType, Priority, Status } from '../data/types'

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span style={{ flex: 1 }}>{t.message}</span>
          {t.undo && (
            <button
              className="btn sm ghost"
              onClick={() => {
                t.undo!()
                dismissToast(t.id)
              }}
            >
              Undo
            </button>
          )}
          <button className="icon-btn" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function ConfirmDelete() {
  const { confirmDeleteId, setConfirmDeleteId } = useUi()
  const { db, deleteIssue } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const issue = db.issues.find((i) => i.id === confirmDeleteId)
  if (!issue) return null
  const children = db.issues.filter((i) => i.parentId === issue.id).length
  const close = () => setConfirmDeleteId(null)
  const confirm = () => {
    deleteIssue(issue.id)
    close()
    if (location.pathname.toLowerCase() === `/issue/${issue.key.toLowerCase()}`) navigate(-1)
  }
  return (
    <Modal onClose={close} width={420}>
      <div style={{ padding: '20px 20px 8px' }}>
        <h2 className="title-md">Delete {issue.key}?</h2>
        <p className="muted" style={{ margin: '8px 0 12px' }}>
          “{issue.title}” and its comments will be deleted. This can’t be undone.
          {children > 0 && ` Its ${children} child issue${children === 1 ? '' : 's'} will stay, without an epic.`}
        </p>
      </div>
      <div className="modal-footer">
        <button className="btn" onClick={close}>Cancel</button>
        <button className="btn danger" autoFocus onClick={confirm}>Delete</button>
      </div>
    </Modal>
  )
}

/** The project the current page belongs to (/project/KEY/… or /issue/KEY-12), if any. */
export const useCurrentProjectId = (): string | undefined => {
  const { projectByKey, issueByKey } = useStore()
  const path = useLocation().pathname
  const projectKey = path.match(/^\/project\/([^/]+)/)?.[1]
  if (projectKey) return projectByKey(projectKey)?.id
  const issueKey = path.match(/^\/issue\/([^/]+)/)?.[1]
  return issueKey ? issueByKey(issueKey)?.projectId : undefined
}

/* ---------- New issue modal ---------- */

type MenuAt = { x: number; y: number; entries: MenuEntry[]; searchable?: boolean }

export function NewIssueModal() {
  const { newIssue, setNewIssue } = useUi()
  if (!newIssue) return null
  return <NewIssueForm key={JSON.stringify(newIssue)} draft={newIssue} onClose={() => setNewIssue(null)} />
}

function NewIssueForm({ draft, onClose }: { draft: NewIssueDraft; onClose: () => void }) {
  const { db, user, createIssue, canWrite } = useStore()
  const [projectId, setProjectId] = useState(draft.projectId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<IssueType>(draft.type ?? 'task')
  const [status, setStatus] = useState<Status>(draft.status ?? 'todo')
  const [priority, setPriority] = useState<Priority>(3)
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(draft.parentId ?? null)
  const [sprintId, setSprintId] = useState<string | null>(draft.sprintId ?? null)
  const [labels, setLabels] = useState<string[]>([])
  const [storyPoints, setStoryPoints] = useState(0)
  const [createMore, setCreateMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [menu, setMenu] = useState<MenuAt | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  // Only projects I can write to; Viewers can't create issues.
  const projects = db.projects.filter((p) => canWrite(p.id) && !p.isArchived)
  const project = db.projects.find((p) => p.id === projectId)!
  const assignee = user(assigneeId)
  const epic = db.issues.find((i) => i.id === parentId)
  const sprint = db.sprints.find((s) => s.id === sprintId)

  const openMenu = (e: React.MouseEvent, entries: MenuEntry[], searchable?: boolean) => {
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({ x: r.left, y: r.bottom + 4, entries, searchable })
  }

  const submit = async () => {
    if (!title.trim()) return titleRef.current?.focus()
    if (saving) return
    setSaving(true)
    const created = await createIssue({ projectId, title: title.trim(), description, type, status, priority, assigneeId, parentId: type === 'epic' ? null : parentId, sprintId, labels, storyPoints, dueDate: null })
    setSaving(false)
    // On failure the reason shows as a toast and the form stays open, so nothing typed is lost.
    if (!created) return
    if (createMore) {
      setTitle('')
      setDescription('')
      titleRef.current?.focus()
    } else onClose()
  }

  return (
    <Modal onClose={() => !menu && onClose()} width={720}>
      <div
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
        }}
      >
        <div className="row" style={{ padding: '14px 16px 0' }}>
          <button
            className="chip"
            onClick={(e) =>
              openMenu(
                e,
                projects.map((p) => ({
                  label: p.name,
                  icon: <ProjectAvatar project={p} size={16} />,
                  checked: p.id === projectId,
                  onSelect: () => {
                    setProjectId(p.id)
                    // Assignee, epic and sprint belong to one project.
                    setAssigneeId(null)
                    setParentId(null)
                    setSprintId(null)
                  },
                })),
              )
            }
          >
            <ProjectAvatar project={project} size={14} /> {project.key}
          </button>
          <ChevronRight size={14} className="faint" />
          <button className="chip" onClick={(e) => openMenu(e, ISSUE_TYPES.map((t) => ({ label: t.name, icon: <IssueTypeIcon type={t.id} />, checked: t.id === type, onSelect: () => setType(t.id) })))}>
            <IssueTypeIcon type={type} size={14} /> {typeMeta(type).name}
          </button>
          <span className="muted">New issue</span>
          <span className="spacer" />
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            ref={titleRef}
            autoFocus
            className="plain-input"
            style={{ fontSize: 18, fontWeight: 600, lineHeight: '28px' }}
            placeholder={type === 'epic' ? 'Epic name' : 'Issue title'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="plain-input"
            style={{ minHeight: 120, resize: 'none' }}
            placeholder="Add description…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="row" style={{ padding: '0 16px 14px', flexWrap: 'wrap', gap: 6 }}>
          <button className="chip" onClick={(e) => openMenu(e, STATUSES.map((s) => ({ label: s.name, icon: <StatusIcon status={s.id} />, checked: s.id === status, onSelect: () => setStatus(s.id) })))}>
            <StatusIcon status={status} size={12} /> {statusMeta(status).name}
          </button>
          <button className="chip" onClick={(e) => openMenu(e, PRIORITIES.map((p) => ({ label: p.name, icon: <PriorityIcon priority={p.id} />, checked: p.id === priority, onSelect: () => setPriority(p.id) })))}>
            <PriorityIcon priority={priority} size={12} /> {priorityName(priority)}
          </button>
          <button
            className="chip"
            onClick={(e) =>
              openMenu(
                e,
                [
                  { label: 'Unassigned', icon: <Avatar user={null} size={16} />, checked: !assigneeId, onSelect: () => setAssigneeId(null) },
                  ...project.memberIds.map((id) => user(id)!).filter(Boolean).map((m) => ({ label: m.name, icon: <Avatar user={m} size={16} />, checked: m.id === assigneeId, onSelect: () => setAssigneeId(m.id) })),
                ],
                true,
              )
            }
          >
            <Avatar user={assignee} size={14} /> {assignee?.name ?? 'Assignee'}
          </button>
          {type !== 'epic' && (
            <button className="chip" onClick={(e) => openMenu(e, epicEntries(db.issues, projectId, parentId, setParentId), true)}>
              <Zap size={12} /> {epic ? epic.title : 'Epic'}
            </button>
          )}
          <button className="chip" onClick={(e) => openMenu(e, sprintEntries(db.sprints, projectId, sprintId, setSprintId))}>
            <Repeat size={12} /> {sprint?.name ?? 'Backlog'}
          </button>
          <button className="chip" onClick={(e) => openMenu(e, labelEntries(allLabels(db.issues), labels, setLabels), true)}>
            <Tag size={12} /> {labels.length ? labels.join(', ') : 'Labels'}
          </button>
          <label className="chip" title="Story points">
            Points
            <input
              type="number"
              min={0}
              className="points-input"
              aria-label="Story points"
              value={storyPoints}
              onChange={(e) => setStoryPoints(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
          </label>
        </div>
        <div className="modal-footer">
          <label className="row muted" style={{ cursor: 'pointer' }}>
            <Toggle on={createMore} onChange={setCreateMore} label="Create more" /> Create more
          </label>
          <button className="btn primary" onClick={submit} disabled={saving}>
            Create {typeMeta(type).name.toLowerCase()}
          </button>
        </div>
      </div>
      {menu && <Menu x={menu.x} y={menu.y} entries={menu.entries} searchable={menu.searchable} onClose={() => setMenu(null)} />}
    </Modal>
  )
}

/** Open the New issue modal in the project the page belongs to, else my first writable project. */
export function useOpenNewIssue() {
  const { db, canWrite } = useStore()
  const { setNewIssue } = useUi()
  const current = useCurrentProjectId()
  return (extra: Omit<NewIssueDraft, 'projectId'> = {}) => {
    const projectId = current && canWrite(current) ? current : db.projects.find((p) => canWrite(p.id) && !p.isArchived)?.id
    if (projectId) setNewIssue({ projectId, ...extra })
  }
}

/* ---------- Command palette ---------- */

interface Command {
  group: string
  label: string
  icon: React.ReactNode
  hint?: string
  run: () => void
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useUi()
  if (!paletteOpen) return null
  return <Palette onClose={() => setPaletteOpen(false)} />
}

function Palette({ onClose }: { onClose: () => void }) {
  const { db } = useStore()
  const { setSidebarCollapsed } = useUi()
  const openNewIssue = useOpenNewIssue()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => navigate(path)
    const base: Command[] = [
      { group: 'Actions', label: 'Create new issue', icon: <Plus size={16} />, hint: 'C', run: () => openNewIssue() },
      { group: 'Actions', label: 'Toggle sidebar', icon: <PanelLeft size={16} />, hint: '[', run: () => setSidebarCollapsed((v) => !v) },
      { group: 'Navigation', label: 'Go to Inbox', icon: <Inbox size={16} />, run: go('/inbox') },
      { group: 'Navigation', label: 'Go to My issues', icon: <CircleDot size={16} />, run: go('/my-issues') },
      { group: 'Navigation', label: 'Go to Settings', icon: <Settings size={16} />, hint: 'G S', run: go('/settings/profile') },
      { group: 'Navigation', label: 'Go to AI Summaries', icon: <Sparkles size={16} />, run: go('/summaries') },
      ...db.projects.flatMap((p) => [
        { group: 'Navigation', label: `${p.name}: Backlog`, icon: <ListTodo size={16} />, run: go(`/project/${p.key}/backlog`) },
        { group: 'Navigation', label: `${p.name}: Board`, icon: <Columns3 size={16} />, run: go(`/project/${p.key}/board`) },
        { group: 'Navigation', label: `${p.name}: Issues`, icon: <Layers size={16} />, run: go(`/project/${p.key}/issues`) },
        { group: 'Navigation', label: `${p.name}: Summary`, icon: <Sparkles size={16} />, run: go(`/project/${p.key}/summary`) },
      ]),
    ]
    const issues: Command[] = db.issues.map((i: Issue) => ({
      group: 'Issues',
      label: `${i.key} ${i.title}`,
      icon: <IssueTypeIcon type={i.type} />,
      run: go(`/issue/${i.key}`),
    }))
    return [...base, ...issues]
  }, [db, navigate, openNewIssue, setSidebarCollapsed])

  const q = query.trim().toLowerCase()
  const results = (q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands.filter((c) => c.group !== 'Issues')).slice(0, 30)

  const run = (c: Command) => {
    onClose()
    c.run()
  }

  return (
    <Modal onClose={onClose} width={640}>
      <div className="palette">
        <div className="row" style={{ paddingLeft: 16 }}>
          <Search size={16} className="faint" />
          <input
            autoFocus
            style={{ flex: 1 }}
            placeholder="Type a command or search issues…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter' && results[active]) run(results[active])
            }}
          />
        </div>
        <div className="palette-results">
          {results.map((c, i) => (
            <div key={c.group + c.label}>
              {(i === 0 || results[i - 1].group !== c.group) && <div className="menu-label">{c.group}</div>}
              <button className={`menu-item${i === active ? ' open' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => run(c)}>
                <span className="menu-icon">{c.icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                {c.hint && <span className="shortcut">{c.hint}</span>}
              </button>
            </div>
          ))}
          {results.length === 0 && <div className="menu-label" style={{ padding: 16 }}>No results</div>}
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Global keyboard shortcuts ---------- */

export function GlobalHotkeys({ onLogout }: { onLogout: () => void }) {
  const ui = useUi()
  const openNewIssue = useOpenNewIssue()
  const navigate = useNavigate()

  useEffect(() => {
    let pendingG = 0
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return
      const overlayOpen = ui.newIssue || ui.paletteOpen || ui.contextMenu || ui.confirmDeleteId
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ui.setPaletteOpen((v) => !v)
        return
      }
      if (e.altKey && e.shiftKey && e.code === 'KeyQ') {
        e.preventDefault()
        onLogout()
        return
      }
      if (overlayOpen || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '[') {
        ui.setSidebarCollapsed((v) => !v)
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        // On a project's page (or one of its issues), the new issue goes into that project.
        openNewIssue()
      } else if (e.key === 'g') {
        pendingG = Date.now()
      } else if (e.key === 's' && Date.now() - pendingG < 1000) {
        navigate('/settings/profile')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ui, navigate, onLogout, openNewIssue])

  return null
}
