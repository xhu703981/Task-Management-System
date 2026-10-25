import { useState } from 'react'
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Plus, Repeat, Search, Trash2 } from 'lucide-react'
import { Menu, type MenuEntry } from '../components/Menu'
import { IssueRow } from '../components/IssueRow'
import { Modal } from '../components/ui'
import { openSprints } from '../components/IssueContextMenu'
import { CompleteSprintModal, SprintModal, sprintDates, sprintStats } from './Sprints'
import { ProjectCrumb, useRouteProject } from './IssueList'
import { STATUSES } from '../data/meta'
import { useStore, useUi } from '../data/store'
import type { Issue, Sprint } from '../data/types'

type SprintDialog = { mode: 'create' | 'edit' | 'start'; sprint?: Sprint } | { mode: 'complete'; sprint: Sprint } | { mode: 'delete'; sprint: Sprint }

/** A drop zone: dropping an issue row here moves it into this sprint (or the backlog when sprintId is null). */
function useDropZone(sprintId: string | null, enabled: boolean) {
  const { db, updateIssue } = useStore()
  const [over, setOver] = useState(false)
  if (!enabled) return { over: false, props: {} }
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        setOver(true)
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        setOver(false)
        const id = e.dataTransfer.getData('text/issue')
        const issue = db.issues.find((i) => i.id === id)
        if (issue && issue.sprintId !== sprintId) updateIssue(id, { sprintId })
      },
    },
  }
}

/** The status mix of a group of issues, as small counters: 3 to do · 1 in progress · 2 done. */
function StatusCounts({ issues }: { issues: Issue[] }) {
  return (
    <span className="row" style={{ gap: 4 }}>
      {STATUSES.map((s) => {
        const n = issues.filter((i) => i.status === s.id).length
        return (
          <span key={s.id} className="status-count" style={{ background: s.color }} title={`${n} ${s.name}`}>
            {n}
          </span>
        )
      })}
    </span>
  )
}

function SprintSection({ sprint, issues, canWrite, canManage, canStart, onDialog }: {
  sprint: Sprint
  issues: Issue[]
  canWrite: boolean
  canManage: boolean
  canStart: boolean
  onDialog: (d: SprintDialog) => void
}) {
  const [open, setOpen] = useState(true)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const drop = useDropZone(sprint.id, canWrite)
  const st = sprintStats(issues)
  const entries: MenuEntry[] = [
    { label: 'Edit sprint', icon: <Pencil size={16} />, onSelect: () => onDialog({ mode: 'edit', sprint }) },
    ...(canManage ? [{ label: 'Delete sprint', icon: <Trash2 size={16} />, danger: true, onSelect: () => onDialog({ mode: 'delete', sprint }) }] : []),
  ]
  return (
    <section className={`backlog-section${drop.over ? ' drop-over' : ''}`} {...drop.props}>
      <div className="backlog-header">
        <button className="icon-btn" style={{ width: 20, height: 20 }} aria-label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Repeat size={14} className="faint" />
        <span style={{ fontWeight: 600 }}>{sprint.name}</span>
        <span className="faint">{sprintDates(sprint)}</span>
        <span className="faint">({st.total} issue{st.total === 1 ? '' : 's'}{st.points ? ` · ${st.points} pts` : ''})</span>
        {sprint.status === 'active' && <span className="badge-pill green">Active</span>}
        <span className="spacer" />
        <StatusCounts issues={issues} />
        {canWrite && sprint.status === 'planned' && (
          <button className="btn sm" disabled={!canStart} title={canStart ? undefined : 'Complete the active sprint first'} onClick={() => onDialog({ mode: 'start', sprint })}>
            Start sprint
          </button>
        )}
        {canWrite && sprint.status === 'active' && (
          <button className="btn sm" onClick={() => onDialog({ mode: 'complete', sprint })}>
            Complete sprint
          </button>
        )}
        {canWrite && (
          <button
            className="icon-btn"
            aria-label={`Actions for ${sprint.name}`}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setMenu({ x: r.right - 200, y: r.bottom + 4 })
            }}
          >
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>
      {open && sprint.goal && <div className="faint" style={{ padding: '0 16px 6px 44px', fontSize: 12 }}>{sprint.goal}</div>}
      {open && (issues.length ? issues.map((i) => <IssueRow key={i.id} issue={i} draggable={canWrite} showSprint={false} />) : (
        <div className="backlog-empty">Plan this sprint by dragging issues here from the backlog.</div>
      ))}
      {menu && <Menu x={menu.x} y={menu.y} width={200} entries={entries} onClose={() => setMenu(null)} />}
    </section>
  )
}

export default function Backlog() {
  const { db, canWrite, canManage, deleteSprint } = useStore()
  const { setNewIssue } = useUi()
  const project = useRouteProject()
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<SprintDialog | null>(null)
  const writable = project ? canWrite(project.id) : false
  const backlogDrop = useDropZone(null, writable)
  if (!project) return <div className="empty-state">Project not found.</div>

  const q = query.trim().toLowerCase()
  const matches = (i: Issue) => !q || i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)
  const byRank = (a: Issue, b: Issue) => a.priority - b.priority || a.number - b.number
  const issues = db.issues.filter((i) => i.projectId === project.id && i.type !== 'epic' && matches(i))
  const sprints = openSprints(db.sprints, project.id)
  const hasActive = sprints.some((s) => s.status === 'active')
  // Like Jira, finished issues that never were in a sprint drop out of the backlog.
  const backlog = issues.filter((i) => i.sprintId === null && i.status !== 'done').sort(byRank)

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <ProjectCrumb projectId={project.id}>Backlog</ProjectCrumb>
        </div>
        <span className="spacer" />
        <div className="search-box">
          <Search size={14} className="faint" />
          <input placeholder="Search backlog" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search backlog" />
        </div>
        {writable && (
          <button className="btn sm" onClick={() => setDialog({ mode: 'create' })}>
            <Plus size={14} /> Create sprint
          </button>
        )}
      </div>
      <div className="content-main backlog-page">
        {sprints.map((s) => (
          <SprintSection
            key={s.id}
            sprint={s}
            issues={issues.filter((i) => i.sprintId === s.id).sort(byRank)}
            canWrite={writable}
            canManage={canManage(project.id)}
            canStart={!hasActive}
            onDialog={setDialog}
          />
        ))}
        <section className={`backlog-section${backlogDrop.over ? ' drop-over' : ''}`} {...backlogDrop.props}>
          <div className="backlog-header">
            <span style={{ fontWeight: 600, marginLeft: 6 }}>Backlog</span>
            <span className="faint">({backlog.length} issue{backlog.length === 1 ? '' : 's'})</span>
            <span className="spacer" />
            <StatusCounts issues={backlog} />
            {writable && (
              <button className="btn sm ghost" onClick={() => setNewIssue({ projectId: project.id, sprintId: null })}>
                <Plus size={14} /> Create issue
              </button>
            )}
          </div>
          {backlog.length ? backlog.map((i) => <IssueRow key={i.id} issue={i} draggable={writable} showSprint={false} />) : (
            <div className="backlog-empty">{q ? 'No backlog issues match.' : 'Your backlog is empty.'}</div>
          )}
        </section>
      </div>

      {dialog && (dialog.mode === 'create' || dialog.mode === 'edit' || dialog.mode === 'start') && (
        <SprintModal mode={dialog.mode} projectId={project.id} sprint={dialog.sprint} onClose={() => setDialog(null)} />
      )}
      {dialog?.mode === 'complete' && <CompleteSprintModal sprint={dialog.sprint} onClose={() => setDialog(null)} />}
      {dialog?.mode === 'delete' && (
        <Modal onClose={() => setDialog(null)} width={420}>
          <div style={{ padding: '20px 20px 8px' }}>
            <h2 className="title-md">Delete {dialog.sprint.name}?</h2>
            <p className="muted" style={{ margin: '8px 0 12px' }}>Its issues aren’t deleted; they move back to the backlog.</p>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setDialog(null)}>Cancel</button>
            <button
              className="btn danger"
              onClick={() => {
                deleteSprint(dialog.sprint.id)
                setDialog(null)
              }}
            >
              Delete sprint
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
