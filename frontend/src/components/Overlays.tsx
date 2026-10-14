import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, CircleDot, Inbox, Layers, Plus, Settings, Sparkles, Tag, Repeat, X, Search, PanelLeft } from 'lucide-react'
import { Menu, type MenuEntry } from './Menu'
import { Avatar, Modal, PriorityIcon, StatusIcon, TeamAvatar, Toggle } from './ui'
import { cycleOptions } from './IssueContextMenu'
import { allLabels, labelEntries } from './labels'
import { PRIORITIES, STATUSES, priorityName, statusMeta } from '../data/meta'
import { useStore, useUi } from '../data/store'
import type { Issue } from '../data/types'

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
  const { db, issueKey, deleteIssue } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const issue = db.issues.find((i) => i.id === confirmDeleteId)
  if (!issue) return null
  const close = () => setConfirmDeleteId(null)
  const confirm = () => {
    deleteIssue(issue.id)
    close()
    if (location.pathname === `/issue/${issue.id}`) navigate(-1)
  }
  return (
    <Modal onClose={close} width={420}>
      <div style={{ padding: '20px 20px 8px' }}>
        <h2 className="title-md">Delete {issueKey(issue)}?</h2>
        <p className="muted" style={{ margin: '8px 0 12px' }}>
          “{issue.title}” will be deleted. This can’t be undone.
        </p>
      </div>
      <div className="modal-footer">
        <button className="btn" onClick={close}>Cancel</button>
        <button className="btn danger" autoFocus onClick={confirm}>Delete</button>
      </div>
    </Modal>
  )
}

/* ---------- New issue modal ---------- */

type MenuAt = { x: number; y: number; entries: MenuEntry[]; searchable?: boolean }

export function NewIssueModal() {
  const { newIssueTeamId, setNewIssueTeamId } = useUi()
  if (!newIssueTeamId) return null
  return <NewIssueForm key={newIssueTeamId} initialTeamId={newIssueTeamId} onClose={() => setNewIssueTeamId(null)} />
}

function NewIssueForm({ initialTeamId, onClose }: { initialTeamId: string; onClose: () => void }) {
  const { db, user, createIssue } = useStore()
  const [teamId, setTeamId] = useState(initialTeamId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Issue['status']>('todo')
  const [priority, setPriority] = useState<Issue['priority']>(0)
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [labels, setLabels] = useState<string[]>([])
  const [cycleId, setCycleId] = useState<string | null>(null)
  const [createMore, setCreateMore] = useState(false)
  const [menu, setMenu] = useState<MenuAt | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const team = db.teams.find((t) => t.id === teamId)!
  const assignee = user(assigneeId)
  const cycle = db.cycles.find((c) => c.id === cycleId)

  const openMenu = (e: React.MouseEvent, entries: MenuEntry[], searchable?: boolean) => {
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({ x: r.left, y: r.bottom + 4, entries, searchable })
  }

  const submit = () => {
    if (!title.trim()) return titleRef.current?.focus()
    createIssue({ teamId, title: title.trim(), description, status, priority, assigneeId, labels, cycleId })
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
                db.teams.map((t) => ({
                  label: t.name,
                  icon: <TeamAvatar team={t} size={16} />,
                  checked: t.id === teamId,
                  onSelect: () => {
                    setTeamId(t.id)
                    setCycleId(null)
                    setAssigneeId(null)
                  },
                })),
              )
            }
          >
            <TeamAvatar team={team} size={14} /> {team.key}
          </button>
          <ChevronRight size={14} className="faint" />
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
            placeholder="Issue title"
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
          <button
            className="chip"
            onClick={(e) =>
              openMenu(e, STATUSES.map((s) => ({ label: s.name, icon: <StatusIcon status={s.id} />, checked: s.id === status, onSelect: () => setStatus(s.id) })))
            }
          >
            <StatusIcon status={status} size={12} /> {statusMeta(status).name}
          </button>
          <button
            className="chip"
            onClick={(e) =>
              openMenu(e, PRIORITIES.map((p) => ({ label: p.name, icon: <PriorityIcon priority={p.id} />, checked: p.id === priority, onSelect: () => setPriority(p.id) })))
            }
          >
            <PriorityIcon priority={priority} size={12} /> {priority ? priorityName(priority) : 'Priority'}
          </button>
          <button
            className="chip"
            onClick={(e) =>
              openMenu(
                e,
                [
                  { label: 'No assignee', icon: <Avatar user={null} size={16} />, checked: !assigneeId, onSelect: () => setAssigneeId(null) },
                  ...team.memberIds.map((id) => user(id)!).map((m) => ({ label: m.name, icon: <Avatar user={m} size={16} />, checked: m.id === assigneeId, onSelect: () => setAssigneeId(m.id) })),
                ],
                true,
              )
            }
          >
            <Avatar user={assignee} size={14} /> {assignee?.name ?? 'Assignee'}
          </button>
          <button
            className="chip"
            onClick={(e) => openMenu(e, labelEntries(allLabels(db.issues), labels, setLabels), true)}
          >
            <Tag size={12} /> {labels.length ? labels.join(', ') : 'Labels'}
          </button>
          {team.cyclesEnabled && (
            <button
              className="chip"
              onClick={(e) =>
                openMenu(e, [
                  ...cycleOptions(db.cycles.filter((c) => c.teamId === teamId)).map((o) => ({ label: o.label, checked: o.cycle.id === cycleId, onSelect: () => setCycleId(o.cycle.id) })),
                  { kind: 'divider' as const },
                  { label: 'No cycle', checked: !cycleId, onSelect: () => setCycleId(null) },
                ])
              }
            >
              <Repeat size={12} /> {cycle ? `Cycle ${cycle.number}` : 'Cycle'}
            </button>
          )}
        </div>
        <div className="modal-footer">
          <label className="row muted" style={{ cursor: 'pointer' }}>
            <Toggle on={createMore} onChange={setCreateMore} label="Create more" /> Create more
          </label>
          <button className="btn primary" onClick={submit}>
            Create issue
          </button>
        </div>
      </div>
      {menu && <Menu x={menu.x} y={menu.y} entries={menu.entries} searchable={menu.searchable} onClose={() => setMenu(null)} />}
    </Modal>
  )
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
  const { db, issueKey } = useStore()
  const { setNewIssueTeamId, setSidebarCollapsed } = useUi()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => navigate(path)
    const base: Command[] = [
      { group: 'Actions', label: 'Create new issue', icon: <Plus size={16} />, hint: 'C', run: () => setNewIssueTeamId(db.teams[0]?.id ?? null) },
      { group: 'Actions', label: 'Toggle sidebar', icon: <PanelLeft size={16} />, hint: '[', run: () => setSidebarCollapsed((v) => !v) },
      { group: 'Navigation', label: 'Go to Inbox', icon: <Inbox size={16} />, run: go('/inbox') },
      { group: 'Navigation', label: 'Go to My issues', icon: <CircleDot size={16} />, run: go('/my-issues') },
      { group: 'Navigation', label: 'Go to Settings', icon: <Settings size={16} />, hint: 'G S', run: go('/settings/profile') },
      { group: 'Navigation', label: 'Go to AI Summaries', icon: <Sparkles size={16} />, run: go('/summaries') },
      ...db.teams.flatMap((t) => [
        { group: 'Navigation', label: `${t.name}: Issues`, icon: <Layers size={16} />, run: go(`/team/${t.key}/issues`) },
        { group: 'Navigation', label: `${t.name}: Summary`, icon: <Sparkles size={16} />, run: go(`/team/${t.key}/summary`) },
      ]),
    ]
    const issues: Command[] = db.issues.map((i) => ({
      group: 'Issues',
      label: `${issueKey(i)} ${i.title}`,
      icon: <StatusIcon status={i.status} />,
      run: go(`/issue/${i.id}`),
    }))
    return [...base, ...issues]
  }, [db, issueKey, navigate, setNewIssueTeamId, setSidebarCollapsed])

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
  const { db, teamByKey } = useStore()
  const ui = useUi()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let pendingG = 0
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return
      const overlayOpen = ui.newIssueTeamId || ui.paletteOpen || ui.contextMenu || ui.confirmDeleteId
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
        const key = location.pathname.match(/^\/team\/([^/]+)/)?.[1]
        ui.setNewIssueTeamId((key && teamByKey(key)?.id) || (db.teams[0]?.id ?? null))
      } else if (e.key === 'g') {
        pendingG = Date.now()
      } else if (e.key === 's' && Date.now() - pendingG < 1000) {
        navigate('/settings/profile')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [db.teams, teamByKey, ui, navigate, location.pathname, onLogout])

  return null
}
