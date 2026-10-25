import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Repeat } from 'lucide-react'
import { IssueListView, ProjectCrumb, useRouteProject } from './IssueList'
import { Modal, shortDate } from '../components/ui'
import { openSprints } from '../components/IssueContextMenu'
import { SPRINT_STATUSES } from '../data/meta'
import { useStore } from '../data/store'
import type { Issue, Sprint } from '../data/types'

const DAY = 86_400_000

/* ---------- Dates: <input type="date"> works in local "YYYY-MM-DD" ---------- */

const toInput = (t: number | null) => {
  if (t === null) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** A sprint starts at the beginning of its first day and ends at the end of its last day. */
const fromInput = (v: string, endOfDay: boolean) => {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0).getTime()
}

export const sprintDates = (s: Sprint) => (s.start && s.end ? `${shortDate(s.start)} – ${shortDate(s.end)}` : 'No dates')

export const daysLeft = (s: Sprint) => (s.end ? Math.max(0, Math.ceil((s.end - Date.now()) / DAY)) : null)

/** Done / total issues and points, for progress bars. */
export function sprintStats(issues: Issue[]) {
  const done = issues.filter((i) => i.status === 'done')
  const points = (xs: Issue[]) => xs.reduce((n, i) => n + i.storyPoints, 0)
  return { total: issues.length, done: done.length, points: points(issues), donePoints: points(done) }
}

/**
 * Create a sprint, edit one, or start one. Starting needs dates (the backend refuses without them),
 * so the start form suggests today plus two weeks.
 */
export function SprintModal({ mode, projectId, sprint, onClose }: { mode: 'create' | 'edit' | 'start'; projectId: string; sprint?: Sprint; onClose: () => void }) {
  const { db, createSprint, updateSprint, startSprint } = useStore()
  const count = db.sprints.filter((s) => s.projectId === projectId).length
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [name, setName] = useState(sprint?.name ?? `Sprint ${count + 1}`)
  const [goal, setGoal] = useState(sprint?.goal ?? '')
  const [start, setStart] = useState(toInput(sprint?.start ?? (mode === 'start' ? today.getTime() : null)))
  const [end, setEnd] = useState(toInput(sprint?.end ?? (mode === 'start' ? today.getTime() + 13 * DAY : null)))
  const [saving, setSaving] = useState(false)
  const badDates = !!start && !!end && end < start
  const needsDates = mode === 'start' && (!start || !end)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || badDates || needsDates || saving) return
    setSaving(true)
    const input = { name: name.trim(), goal, start: fromInput(start, false), end: fromInput(end, true) }
    let ok: boolean
    if (mode === 'create') ok = !!(await createSprint(projectId, input))
    else ok = (await updateSprint(sprint!.id, input)) && (mode !== 'start' || (await startSprint(sprint!.id)))
    setSaving(false)
    if (ok) onClose()
  }

  const setWeeks = (w: number) => {
    const s = fromInput(start, false) ?? today.getTime()
    setStart(toInput(s))
    setEnd(toInput(s + (w * 7 - 1) * DAY))
  }

  return (
    <Modal onClose={onClose} width={480}>
      <form onSubmit={submit}>
        <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="title-md">{mode === 'create' ? 'Create sprint' : mode === 'edit' ? 'Edit sprint' : `Start ${sprint!.name}`}</h2>
          <label className="field">
            <span>Sprint name</span>
            <input className="input" autoFocus maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field">
            <span>Duration</span>
            <div className="row" style={{ gap: 6 }}>
              {[1, 2, 3, 4].map((w) => (
                <button key={w} type="button" className="btn sm" onClick={() => setWeeks(w)}>
                  {w} week{w > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <label className="field" style={{ flex: 1 }}>
              <span>Start date</span>
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>End date</span>
              <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          {badDates && <span className="danger-text label">The end date must be after the start date.</span>}
          {needsDates && <span className="muted label">A sprint needs a start and an end date before it starts.</span>}
          <label className="field">
            <span>Sprint goal</span>
            <textarea className="textarea" rows={3} placeholder="What should this sprint achieve?" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </label>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim() || badDates || needsDates || saving}>
            {mode === 'create' ? 'Create sprint' : mode === 'edit' ? 'Save' : 'Start sprint'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Complete the active sprint: its done issues stay with it, the rest move to a planned sprint or the backlog. */
export function CompleteSprintModal({ sprint, onClose }: { sprint: Sprint; onClose: () => void }) {
  const { db, completeSprint } = useStore()
  const issues = db.issues.filter((i) => i.sprintId === sprint.id)
  const open = issues.filter((i) => i.status !== 'done').length
  const planned = openSprints(db.sprints, sprint.projectId).filter((s) => s.status === 'planned')
  const [dest, setDest] = useState('')
  const [saving, setSaving] = useState(false)
  return (
    <Modal onClose={onClose} width={440}>
      <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="title-md">Complete {sprint.name}</h2>
        <p className="muted" style={{ margin: 0 }}>
          This sprint has <b>{issues.length - open}</b> completed issue{issues.length - open === 1 ? '' : 's'} and <b>{open}</b> open issue{open === 1 ? '' : 's'}.
        </p>
        {open > 0 && (
          <label className="field">
            <span>Move open issues to</span>
            <select className="select" value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="">Backlog</option>
              {planned.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            const ok = await completeSprint(sprint.id, dest || null)
            setSaving(false)
            if (ok) onClose()
          }}
        >
          Complete sprint
        </button>
      </div>
    </Modal>
  )
}

export default function Sprints() {
  const { db } = useStore()
  const project = useRouteProject()
  if (!project) return <div className="empty-state">Project not found.</div>
  const order = { active: 0, planned: 1, completed: 2 }
  const sprints = db.sprints.filter((s) => s.projectId === project.id).sort((a, b) => order[a.status] - order[b.status] || Number(b.id) - Number(a.id))

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <ProjectCrumb projectId={project.id}>Sprints</ProjectCrumb>
        </div>
        <span className="spacer" />
        <Link className="btn sm" to={`/project/${project.key}/backlog`}>Plan in backlog</Link>
      </div>
      <div className="content-main">
        {sprints.length === 0 && (
          <div className="empty-state">
            <Repeat size={32} className="faint" />
            No sprints yet. Create one from the backlog.
          </div>
        )}
        {sprints.map((s) => {
          const st = sprintStats(db.issues.filter((i) => i.sprintId === s.id))
          const pct = st.total ? Math.round((st.done / st.total) * 100) : 0
          return (
            <Link key={s.id} to={`/project/${project.key}/sprints/${s.id}`} className="issue-row" style={{ height: 56, gap: 16, padding: '0 24px' }}>
              <Repeat size={16} className="faint" />
              <div style={{ width: 220, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{s.name}</div>
                <div className="faint" style={{ fontSize: 12 }}>{sprintDates(s)}</div>
              </div>
              <span className={`badge-pill${s.status === 'active' ? ' green' : ''}`}>{SPRINT_STATUSES[s.status]}</span>
              <span className="faint" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.goal}</span>
              <div style={{ width: 200 }}>
                <div className="progress" title={`${st.done} of ${st.total} issues done`}>
                  {st.done > 0 && <div style={{ width: `${pct}%`, background: 'var(--accent)' }} />}
                </div>
              </div>
              <span className="muted" style={{ width: 150, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {st.done} / {st.total} · {st.donePoints}/{st.points} pts
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}

export function SprintIssues() {
  const { sprintId } = useParams()
  const { db } = useStore()
  const project = useRouteProject()
  const sprint = db.sprints.find((s) => s.id === sprintId)
  if (!project || !sprint) return <div className="empty-state">Sprint not found.</div>
  return (
    <IssueListView
      key={sprint.id}
      projectId={project.id}
      title={
        <ProjectCrumb projectId={project.id}>
          <Link to={`/project/${project.key}/sprints`} className="muted">Sprints</Link> <span className="sep">›</span> {sprint.name}
          <span className="faint" style={{ fontWeight: 400 }}>{sprintDates(sprint)} · {SPRINT_STATUSES[sprint.status]}</span>
        </ProjectCrumb>
      }
      issues={db.issues.filter((i) => i.sprintId === sprint.id)}
      emptyText="No issues in this sprint."
    />
  )
}
