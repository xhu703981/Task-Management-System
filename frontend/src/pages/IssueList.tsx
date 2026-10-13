import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Filter, LayoutList, Columns3, Plus, SlidersHorizontal, Sparkles, X, Repeat } from 'lucide-react'
import { Menu, type MenuEntry } from '../components/Menu'
import { IssueRow } from '../components/IssueRow'
import { Avatar, PriorityIcon, StatusIcon, TeamAvatar } from '../components/ui'
import { SummaryPanel } from './Summary'
import { PRIORITIES, STATUSES, statusMeta } from '../data/meta'
import { useStore, useUi } from '../data/store'
import { getIssues } from '../data/api'
import type { Issue, Priority, Status } from '../data/types'

type GroupBy = 'status' | 'priority' | 'assignee' | 'none'
type OrderBy = 'priority' | 'created' | 'updated'
type Filters = { status: Status[]; priority: Priority[]; assignee: (string | null)[]; label: string[] }
const NO_FILTERS: Filters = { status: [], priority: [], assignee: [], label: [] }

const TABS = [
  { id: 'all', label: 'All issues', match: () => true },
  { id: 'active', label: 'Active', match: (i: Issue) => ['todo', 'in_progress', 'in_review'].includes(i.status) },
  { id: 'backlog', label: 'Backlog', match: (i: Issue) => i.status === 'backlog' },
]

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])

/** Shared list/board view used by team issues and My issues. */
export function IssueListView({ title, issues, teamId, emptyText }: { title: ReactNode; issues: Issue[]; teamId?: string; emptyText: string }) {
  const { db, user, updateIssue } = useStore()
  const ui = useUi()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'all'
  const view = params.get('view') === 'board' ? 'board' : 'list'
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [orderBy, setOrderBy] = useState<OrderBy>('priority')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [aiOpen, setAiOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)
  const [loading, setLoading] = useState(true)

  // Brief skeleton on scope change, standing in for a network fetch.
  useEffect(() => {
    setLoading(true)
    setSelected(new Set())
    const t = setTimeout(() => setLoading(false), 350)
    return () => clearTimeout(t)
  }, [teamId])

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
      .filter((i) => !filters.assignee.length || filters.assignee.includes(i.assigneeId))
      .filter((i) => !filters.label.length || i.labelIds.some((l) => filters.label.includes(l)))
    const prio = (p: Priority) => (p === 0 ? 5 : p)
    return sorted.sort((a, b) =>
      orderBy === 'priority' ? prio(a.priority) - prio(b.priority) || b.updatedAt - a.updatedAt : orderBy === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt,
    )
  }, [issues, tab, filters, orderBy])

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All issues', icon: null as ReactNode, issues: visible }]
    if (groupBy === 'status')
      return STATUSES.map((s) => ({ key: s.id, label: s.name, icon: <StatusIcon status={s.id} />, issues: visible.filter((i) => i.status === s.id), status: s.id }))
    if (groupBy === 'priority')
      return PRIORITIES.map((p) => ({ key: String(p.id), label: p.name, icon: <PriorityIcon priority={p.id} />, issues: visible.filter((i) => i.priority === p.id) }))
    const ids = [...new Set(visible.map((i) => i.assigneeId))]
    return ids.map((id) => ({ key: id ?? 'none', label: user(id)?.name ?? 'No assignee', icon: <Avatar user={user(id)} size={16} />, issues: visible.filter((i) => i.assigneeId === id) }))
  }, [visible, groupBy, user])

  const scopedUsers = teamId ? db.teams.find((t) => t.id === teamId)!.memberIds : db.users.filter((u) => u.status === 'Active').map((u) => u.id)
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
      label: 'Assignee',
      icon: <Avatar user={null} size={16} />,
      submenu: {
        searchable: true,
        entries: [null, ...scopedUsers].map((id) => ({
          label: user(id)?.name ?? 'No assignee',
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
        entries: db.labels.map((l) => ({
          label: l.name,
          icon: <span style={{ width: 8, height: 8, borderRadius: 4, background: l.color, display: 'inline-block' }} />,
          checked: filters.label.includes(l.id),
          onSelect: () => setFilters((f) => ({ ...f, label: toggle(f.label, l.id) })),
        })),
      },
    },
  ]

  const displayEntries = (): MenuEntry[] => [
    { kind: 'label', label: 'Grouping' },
    ...(['status', 'priority', 'assignee', 'none'] as GroupBy[]).map((g) => ({ label: g === 'none' ? 'No grouping' : g[0].toUpperCase() + g.slice(1), checked: groupBy === g, onSelect: () => setGroupBy(g) })),
    { kind: 'divider' },
    { kind: 'label', label: 'Ordering' },
    ...(['priority', 'created', 'updated'] as OrderBy[]).map((o) => ({ label: o === 'priority' ? 'Priority' : o === 'created' ? 'Created' : 'Last updated', checked: orderBy === o, onSelect: () => setOrderBy(o) })),
  ]

  const activeFilterCount = filters.status.length + filters.priority.length + filters.assignee.length + filters.label.length

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
        <div className="row" style={{ gap: 2 }}>
          <button className={`icon-btn${view === 'list' ? ' active' : ''}`} aria-label="List view" title="List" onClick={() => setParam('view', null)}>
            <LayoutList size={16} />
          </button>
          <button className={`icon-btn${view === 'board' ? ' active' : ''}`} aria-label="Board view" title="Board" onClick={() => setParam('view', 'board')}>
            <Columns3 size={16} />
          </button>
        </div>
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
              <button
                className="btn sm"
                onClick={(e) =>
                  openAt(
                    e,
                    STATUSES.map((s) => ({
                      label: s.name,
                      icon: <StatusIcon status={s.id} />,
                      onSelect: () => {
                        selected.forEach((id) => updateIssue(id, { status: s.id }))
                        setSelected(new Set())
                      },
                    })),
                  )
                }
              >
                Set status
              </button>
              <button className="btn sm ghost" onClick={() => setSelected(new Set())}>
                Clear selection
              </button>
            </>
          ) : (
            <>
              {filters.status.map((s) => <FilterChip key={s} label={`Status: ${statusMeta(s).name}`} onRemove={() => setFilters((f) => ({ ...f, status: toggle(f.status, s) }))} />)}
              {filters.priority.map((p) => <FilterChip key={p} label={`Priority: ${PRIORITIES.find((x) => x.id === p)!.name}`} onRemove={() => setFilters((f) => ({ ...f, priority: toggle(f.priority, p) }))} />)}
              {filters.assignee.map((a) => <FilterChip key={a ?? 'none'} label={`Assignee: ${user(a)?.name ?? 'None'}`} onRemove={() => setFilters((f) => ({ ...f, assignee: toggle(f.assignee, a) }))} />)}
              {filters.label.map((l) => <FilterChip key={l} label={`Label: ${db.labels.find((x) => x.id === l)!.name}`} onRemove={() => setFilters((f) => ({ ...f, label: toggle(f.label, l) }))} />)}
              <button className="btn sm ghost" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
            </>
          )}
        </div>
      )}

      <div className="content-body">
        <div className="content-main">
          {loading ? (
            <ListSkeleton />
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <LayoutList size={32} className="faint" />
              <div>{issues.length === 0 ? emptyText : 'No issues match this view.'}</div>
              {teamId && issues.length === 0 && (
                <button className="btn primary" onClick={() => ui.setNewIssueTeamId(teamId)}>
                  <Plus size={14} /> Create issue
                </button>
              )}
            </div>
          ) : view === 'board' ? (
            <Board issues={visible} />
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
                    {teamId && (
                      <button className="icon-btn" aria-label={`New issue in ${g.label}`} onClick={() => ui.setNewIssueTeamId(teamId)}>
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
            <SummaryPanel issues={visible} scopeKey={`${teamId}-${tab}-${JSON.stringify(filters)}`} onClose={() => setAiOpen(false)} />
          </aside>
        )}
      </div>
      {menu && <Menu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />}
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

function ListSkeleton() {
  return (
    <div aria-busy="true">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="issue-row" style={{ cursor: 'default' }}>
          <span className="check-slot" />
          <div className="skeleton" style={{ width: 14, height: 14 }} />
          <div className="skeleton" style={{ width: 48, height: 10 }} />
          <div className="skeleton" style={{ width: `${30 + ((i * 37) % 40)}%`, height: 10 }} />
        </div>
      ))}
    </div>
  )
}

function Board({ issues }: { issues: Issue[] }) {
  const { db, user, issueKey, updateIssue } = useStore()
  const { setContextMenu } = useUi()
  const navigate = useNavigate()
  const [dragOver, setDragOver] = useState<Status | null>(null)
  return (
    <div className="board">
      {STATUSES.map((s) => {
        const col = issues.filter((i) => i.status === s.id)
        return (
          <div
            key={s.id}
            className="board-col"
            style={{ outline: dragOver === s.id ? '1px dashed var(--border-strong)' : undefined, borderRadius: 8, minHeight: 200 }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(s.id)
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/issue')
              if (id) updateIssue(id, { status: s.id })
              setDragOver(null)
            }}
          >
            <div className="board-col-header">
              <StatusIcon status={s.id} /> {s.name} <span className="faint">{col.length}</span>
            </div>
            {col.map((i) => {
              const cycle = db.cycles.find((c) => c.id === i.cycleId)
              return (
                <div
                  key={i.id}
                  className="board-card"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/issue', i.id)}
                  onClick={() => navigate(`/issue/${i.id}`)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ issueId: i.id, x: e.clientX, y: e.clientY })
                  }}
                >
                  <div className="row">
                    <span className="mono faint">{issueKey(i)}</span>
                    <span className="spacer" />
                    <Avatar user={user(i.assigneeId)} size={18} />
                  </div>
                  <div style={{ fontWeight: 500 }}>{i.title}</div>
                  <div className="row" style={{ gap: 6 }}>
                    <PriorityIcon priority={i.priority} />
                    {cycle && (
                      <span className="chip">
                        <Repeat size={12} /> Cycle {cycle.number}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export default function TeamIssues() {
  const { teamKey } = useParams()
  const { db, teamByKey } = useStore()
  const team = teamByKey(teamKey ?? '')
  if (!team) return <div className="empty-state">Team not found.</div>
  return (
    <IssueListView
      key={team.id}
      teamId={team.id}
      title={
        <>
          <TeamAvatar team={team} size={16} /> {team.name} <span className="sep">›</span> Issues
        </>
      }
      issues={db.issues.filter((i) => i.teamId === team.id)}
      emptyText={`${team.name} has no issues yet.`}
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

  return <IssueListView title="My issues" issues={db.issues} emptyText="No issues yet." />
}
