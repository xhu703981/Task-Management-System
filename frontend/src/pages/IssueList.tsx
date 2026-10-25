import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Filter, LayoutList, Plus, SlidersHorizontal, Sparkles, Trash2, X, Zap } from 'lucide-react'
import { Menu, type MenuEntry } from '../components/Menu'
import { IssueRow } from '../components/IssueRow'
import { LabelDot, allLabels } from '../components/labels'
import { sprintEntries } from '../components/IssueContextMenu'
import { Avatar, IssueTypeIcon, Modal, PriorityIcon, ProjectAvatar, StatusIcon } from '../components/ui'
import { SummaryPanel } from './Summary'
import { ISSUE_TYPES, PRIORITIES, STATUSES, priorityName, statusMeta, typeMeta } from '../data/meta'
import { useStore, useUi } from '../data/store'
import { getIssues } from '../data/api'
import type { Issue, IssueType, Priority, Status } from '../data/types'

type GroupBy = 'status' | 'priority' | 'type' | 'assignee' | 'epic' | 'none'
type OrderBy = 'priority' | 'created' | 'updated'
type Filters = { status: Status[]; priority: Priority[]; type: IssueType[]; assignee: (string | null)[]; label: string[] }
const NO_FILTERS: Filters = { status: [], priority: [], type: [], assignee: [], label: [] }

const TABS = [
  { id: 'all', label: 'All issues', match: () => true },
  { id: 'open', label: 'Open', match: (i: Issue) => i.status !== 'done' },
  { id: 'backlog', label: 'Backlog', match: (i: Issue) => i.sprintId === null && i.status !== 'done' },
  { id: 'done', label: 'Done', match: (i: Issue) => i.status === 'done' },
]

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])

/** Shared list view used by a project's Issues tab, a sprint's issues, and My issues. */
export function IssueListView({ title, issues, projectId, emptyText }: { title: ReactNode; issues: Issue[]; projectId?: string; emptyText: string }) {
  const { db, user, canWrite, bulkUpdate, bulkDelete } = useStore()
  const ui = useUi()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'all'
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [orderBy, setOrderBy] = useState<OrderBy>('priority')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)

  useEffect(() => setSelected(new Set()), [projectId])

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v === null) next.delete(k)
    else next.set(k, v)
    setParams(next, { replace: true })
  }

  const visible = useMemo(() => {
    const tabMatch = TABS.find((t) => t.id === tab)?.match ?? (() => true)
    const sorted = issues
      .filter(tabMatch)
      .filter((i) => !filters.status.length || filters.status.includes(i.status))
      .filter((i) => !filters.priority.length || filters.priority.includes(i.priority))
      .filter((i) => !filters.type.length || filters.type.includes(i.type))
      .filter((i) => !filters.assignee.length || filters.assignee.includes(i.assigneeId))
      // Labels match ignoring case, so a "Bug" filter also finds issues labeled "bug".
      .filter((i) => !filters.label.length || i.labels.some((l) => filters.label.some((f) => f.toLowerCase() === l.toLowerCase())))
    return sorted.sort((a, b) =>
      orderBy === 'priority' ? a.priority - b.priority || b.updatedAt - a.updatedAt : orderBy === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt,
    )
  }, [issues, tab, filters, orderBy])

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All issues', icon: null as ReactNode, issues: visible }]
    if (groupBy === 'status')
      return STATUSES.map((s) => ({ key: s.id, label: s.name, icon: <StatusIcon status={s.id} />, issues: visible.filter((i) => i.status === s.id), status: s.id }))
    if (groupBy === 'priority')
      return PRIORITIES.map((p) => ({ key: String(p.id), label: p.name, icon: <PriorityIcon priority={p.id} />, issues: visible.filter((i) => i.priority === p.id) }))
    if (groupBy === 'type')
      return ISSUE_TYPES.map((t) => ({ key: t.id, label: t.name, icon: <IssueTypeIcon type={t.id} />, issues: visible.filter((i) => i.type === t.id) }))
    if (groupBy === 'epic') {
      const ids = [...new Set(visible.filter((i) => i.type !== 'epic').map((i) => i.parentId))]
      return ids.map((id) => {
        const epic = db.issues.find((i) => i.id === id)
        return { key: id ?? 'none', label: epic ? `${epic.key} ${epic.title}` : 'No epic', icon: <Zap size={14} />, issues: visible.filter((i) => i.type !== 'epic' && i.parentId === id) }
      })
    }
    const ids = [...new Set(visible.map((i) => i.assigneeId))]
    return ids.map((id) => ({ key: id ?? 'none', label: user(id)?.name ?? 'Unassigned', icon: <Avatar user={user(id)} size={16} />, issues: visible.filter((i) => i.assigneeId === id) }))
  }, [visible, groupBy, user, db.issues])

  const scopedUsers = projectId ? db.projects.find((p) => p.id === projectId)!.memberIds : db.users.map((u) => u.id)
  const openAt = (e: React.MouseEvent, entries: MenuEntry[]) => {
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({ x: r.right - 240, y: r.bottom + 4, entries })
  }

  const filterEntries = (): MenuEntry[] => [
    {
      label: 'Status',
      icon: <StatusIcon status="todo" />,
      submenu: { entries: STATUSES.map((s) => ({ label: s.name, icon: <StatusIcon status={s.id} />, checked: filters.status.includes(s.id), onSelect: () => setFilters((f) => ({ ...f, status: toggle(f.status, s.id) })) })) },
    },
    {
      label: 'Priority',
      icon: <PriorityIcon priority={2} />,
      submenu: { entries: PRIORITIES.map((p) => ({ label: p.name, icon: <PriorityIcon priority={p.id} />, checked: filters.priority.includes(p.id), onSelect: () => setFilters((f) => ({ ...f, priority: toggle(f.priority, p.id) })) })) },
    },
    {
      label: 'Type',
      icon: <IssueTypeIcon type="task" />,
      submenu: { entries: ISSUE_TYPES.map((t) => ({ label: t.name, icon: <IssueTypeIcon type={t.id} />, checked: filters.type.includes(t.id), onSelect: () => setFilters((f) => ({ ...f, type: toggle(f.type, t.id) })) })) },
    },
    {
      label: 'Assignee',
      icon: <Avatar user={null} size={16} />,
      submenu: {
        searchable: true,
        entries: [null, ...scopedUsers].map((id) => ({
          label: user(id)?.name ?? 'Unassigned',
          icon: <Avatar user={user(id)} size={16} />,
          checked: filters.assignee.includes(id),
          onSelect: () => setFilters((f) => ({ ...f, assignee: toggle(f.assignee, id) })),
        })),
      },
    },
    {
      label: 'Labels',
      icon: <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--text-tertiary)', display: 'inline-block', margin: 4 }} />,
      submenu: {
        searchable: true,
        entries: allLabels(issues).map((name) => ({
          label: name,
          icon: <LabelDot name={name} />,
          checked: filters.label.includes(name),
          onSelect: () => setFilters((f) => ({ ...f, label: toggle(f.label, name) })),
        })),
      },
    },
  ]

  const GROUP_NAMES: Record<GroupBy, string> = { status: 'Status', priority: 'Priority', type: 'Type', assignee: 'Assignee', epic: 'Epic', none: 'No grouping' }
  const displayEntries = (): MenuEntry[] => [
    { kind: 'label', label: 'Grouping' },
    ...(Object.keys(GROUP_NAMES) as GroupBy[]).map((g) => ({ label: GROUP_NAMES[g], checked: groupBy === g, onSelect: () => setGroupBy(g) })),
    { kind: 'divider' },
    { kind: 'label', label: 'Ordering' },
    ...(['priority', 'created', 'updated'] as OrderBy[]).map((o) => ({ label: o === 'priority' ? 'Priority' : o === 'created' ? 'Created' : 'Last updated', checked: orderBy === o, onSelect: () => setOrderBy(o) })),
  ]

  const activeFilterCount = filters.status.length + filters.priority.length + filters.type.length + filters.assignee.length + filters.label.length
  const selectedIds = [...selected]
  const clearSelection = () => setSelected(new Set())
  // A bulk sprint move only makes sense inside one project (sprints belong to one).
  const selectionProject = new Set(db.issues.filter((i) => selected.has(i.id)).map((i) => i.projectId))
  const oneProject = selectionProject.size === 1 ? [...selectionProject][0] : null
  const bulk = (patch: Parameters<typeof bulkUpdate>[1]) => {
    bulkUpdate(selectedIds, patch)
    clearSelection()
  }

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">{title}</div>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setParam('tab', t.id === 'all' ? null : t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button className="btn sm ghost" onClick={(e) => openAt(e, filterEntries())}>
          <Filter size={14} /> Filter{activeFilterCount ? ` · ${activeFilterCount}` : ''}
        </button>
        <button className="btn sm ghost" onClick={(e) => openAt(e, displayEntries())}>
          <SlidersHorizontal size={14} /> Display
        </button>
        <button className={`icon-btn ai${aiOpen ? ' active' : ''}`} aria-label="AI summary" title="Summarize this view" onClick={() => setAiOpen(!aiOpen)}>
          <Sparkles size={16} />
        </button>
      </div>

      {(activeFilterCount > 0 || selected.size > 0) && (
        <div className="row" style={{ padding: '6px 16px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 6 }}>
          {selected.size > 0 ? (
            <>
              <span className="label">{selected.size} selected</span>
              <button className="btn sm" onClick={(e) => openAt(e, STATUSES.map((s) => ({ label: s.name, icon: <StatusIcon status={s.id} />, onSelect: () => bulk({ status: s.id }) })))}>
                Set status
              </button>
              <button className="btn sm" onClick={(e) => openAt(e, PRIORITIES.map((p) => ({ label: p.name, icon: <PriorityIcon priority={p.id} />, onSelect: () => bulk({ priority: p.id }) })))}>
                Set priority
              </button>
              <button className="btn sm" disabled={!oneProject} title={oneProject ? undefined : 'Select issues of one project'} onClick={(e) => oneProject && openAt(e, sprintEntries(db.sprints, oneProject, null, (sprintId) => bulk({ sprintId })).map((x) => ('checked' in x ? { ...x, checked: false } : x)))}>
                Move to sprint
              </button>
              <button className="btn sm danger-outline" onClick={() => setConfirmBulkDelete(true)}>
                <Trash2 size={14} /> Delete
              </button>
              <button className="btn sm ghost" onClick={clearSelection}>
                Clear selection
              </button>
            </>
          ) : (
            <>
              {filters.status.map((s) => <FilterChip key={s} label={`Status: ${statusMeta(s).name}`} onRemove={() => setFilters((f) => ({ ...f, status: toggle(f.status, s) }))} />)}
              {filters.priority.map((p) => <FilterChip key={p} label={`Priority: ${priorityName(p)}`} onRemove={() => setFilters((f) => ({ ...f, priority: toggle(f.priority, p) }))} />)}
              {filters.type.map((t) => <FilterChip key={t} label={`Type: ${typeMeta(t).name}`} onRemove={() => setFilters((f) => ({ ...f, type: toggle(f.type, t) }))} />)}
              {filters.assignee.map((a) => <FilterChip key={a ?? 'none'} label={`Assignee: ${user(a)?.name ?? 'Unassigned'}`} onRemove={() => setFilters((f) => ({ ...f, assignee: toggle(f.assignee, a) }))} />)}
              {filters.label.map((l) => <FilterChip key={l} label={`Label: ${l}`} onRemove={() => setFilters((f) => ({ ...f, label: toggle(f.label, l) }))} />)}
              <button className="btn sm ghost" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
            </>
          )}
        </div>
      )}

      <div className="content-body">
        <div className="content-main">
          {visible.length === 0 ? (
            <div className="empty-state">
              <LayoutList size={32} className="faint" />
              <div>{issues.length === 0 ? emptyText : 'No issues match this view.'}</div>
              {projectId && issues.length === 0 && canWrite(projectId) && (
                <button className="btn primary" onClick={() => ui.setNewIssue({ projectId })}>
                  <Plus size={14} /> Create issue
                </button>
              )}
            </div>
          ) : (
            groups
              .filter((g) => g.issues.length)
              .map((g) => (
                <section key={g.key}>
                  <div className="group-header">
                    {g.icon}
                    <span>{g.label}</span>
                    <span className="count">{g.issues.length}</span>
                    <span className="spacer" />
                    {projectId && canWrite(projectId) && (
                      <button
                        className="icon-btn"
                        aria-label={`New issue in ${g.label}`}
                        onClick={() => ui.setNewIssue({ projectId, ...(groupBy === 'status' ? { status: g.key as Status } : {}) })}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                  {g.issues.map((i) => (
                    <IssueRow
                      key={i.id}
                      issue={i}
                      selected={selected.has(i.id)}
                      onToggleSelect={() =>
                        setSelected((s) => {
                          const n = new Set(s)
                          if (n.has(i.id)) n.delete(i.id)
                          else n.add(i.id)
                          return n
                        })
                      }
                    />
                  ))}
                </section>
              ))
          )}
        </div>
        {aiOpen && (
          <aside className="right-panel">
            <SummaryPanel issues={visible} scopeKey={`${projectId}-${tab}-${JSON.stringify(filters)}`} onClose={() => setAiOpen(false)} />
          </aside>
        )}
      </div>
      {menu && <Menu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />}
      {confirmBulkDelete && (
        <Modal onClose={() => setConfirmBulkDelete(false)} width={420}>
          <div style={{ padding: '20px 20px 8px' }}>
            <h2 className="title-md">Delete {selected.size} issues?</h2>
            <p className="muted" style={{ margin: '8px 0 12px' }}>All of them are deleted, or none if you can’t delete one of them. This can’t be undone.</p>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setConfirmBulkDelete(false)}>Cancel</button>
            <button
              className="btn danger"
              onClick={async () => {
                setConfirmBulkDelete(false)
                if (await bulkDelete(selectedIds)) clearSelection()
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="chip" style={{ paddingRight: 2 }}>
      {label}
      <button className="icon-btn" style={{ width: 18, height: 18 }} aria-label={`Remove ${label}`} onClick={onRemove}>
        <X size={12} />
      </button>
    </span>
  )
}

/** Header crumb shared by every page of a project: avatar, name, then the page name. */
export function ProjectCrumb({ projectId, children }: { projectId: string; children: ReactNode }) {
  const { project } = useStore()
  const p = project(projectId)
  return (
    <>
      <ProjectAvatar project={p} size={16} /> {p.name} <span className="sep">›</span> {children}
    </>
  )
}

/** Resolves :projectKey from the URL; renders a not-found message when there's no such project. */
export function useRouteProject() {
  const { projectKey } = useParams()
  const { projectByKey } = useStore()
  return projectByKey(projectKey ?? '')
}

export default function ProjectIssues() {
  const { db } = useStore()
  const project = useRouteProject()
  if (!project) return <div className="empty-state">Project not found.</div>
  return (
    <IssueListView
      key={project.id}
      projectId={project.id}
      title={<ProjectCrumb projectId={project.id}>Issues</ProjectCrumb>}
      issues={db.issues.filter((i) => i.projectId === project.id)}
      emptyText={`${project.name} has no issues yet.`}
    />
  )
}

export function MyIssues() {
  const { db, loadIssues, toast } = useStore()
  //This is the box. issues is what's in the box right now; setIssues is how we put something new in.
// - <ApiIssue[]> tells TypeScript: "this box holds a list of backend issues."
// - ([]) means it starts empty, because at time 0ms we don't have an answer yet.

  useEffect(() => {
    getIssues()
      .then((data) => loadIssues(data))
      .catch((err) => toast(err.message))
  }, [])
  //This is "ask the backend once, after the first render."
// - getIssues() sends GET /api/issues.
// - .then((data) => ...) says what to do when the answer arrives: put it in the box with setIssues(data). That makes React call MyIssues() again.
// - [] at the end means "only once." Without it, we'd get the infinite loop from before.

  return <IssueListView title="My issues" issues={db.issues.filter((i) => i.assigneeId === db.meId)} emptyText="Nothing is assigned to you." />
}
