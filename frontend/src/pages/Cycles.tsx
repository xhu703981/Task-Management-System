import { Link, useParams } from 'react-router-dom'
import { Repeat } from 'lucide-react'
import { IssueListView } from './IssueList'
import { TeamAvatar, shortDate } from '../components/ui'
import { useStore } from '../data/store'

export default function Cycles() {
  const { teamKey } = useParams()
  const { db, teamByKey } = useStore()
  const team = teamByKey(teamKey ?? '')
  if (!team) return <div className="empty-state">Team not found.</div>
  const now = Date.now()
  const cycles = db.cycles.filter((c) => c.teamId === team.id).sort((a, b) => b.start - a.start)

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <TeamAvatar team={team} size={16} /> {team.name} <span className="sep">›</span> Cycles
        </div>
      </div>
      <div className="content-main">
        {!team.cyclesEnabled ? (
          <div className="empty-state">
            <Repeat size={32} className="faint" />
            Cycles are turned off for this team.
            <Link className="btn" to={`/settings/teams/${team.key}`}>Team settings</Link>
          </div>
        ) : (
          cycles.map((c) => {
            const issues = db.issues.filter((i) => i.cycleId === c.id)
            const done = issues.filter((i) => i.status === 'done').length
            const started = issues.filter((i) => i.status === 'in_progress' || i.status === 'in_review').length
            const scope = issues.filter((i) => i.status !== 'canceled').length
            const tag = c.end < now ? 'Completed' : c.start <= now ? 'Current' : 'Upcoming'
            const pct = scope ? Math.round((done / scope) * 100) : 0
            return (
              <Link key={c.id} to={`/team/${team.key}/cycles/${c.id}`} className="issue-row" style={{ height: 56, gap: 16, padding: '0 24px' }}>
                <Repeat size={16} className="faint" />
                <div style={{ width: 180 }}>
                  <div style={{ fontWeight: 500 }}>Cycle {c.number}</div>
                  <div className="faint" style={{ fontSize: 12 }}>{shortDate(c.start)} – {shortDate(c.end)}</div>
                </div>
                <span className={`badge-pill${tag === 'Current' ? ' green' : ''}`}>{tag}</span>
                <span className="spacer" />
                <div style={{ width: 220 }}>
                  <div
                    className="progress"
                    title={`${done} completed, ${started} started, ${scope - done - started} not started`}
                  >
                    {done > 0 && <div style={{ width: `${(done / scope) * 100}%`, background: 'var(--accent)' }} />}
                    {started > 0 && <div style={{ width: `${(started / scope) * 100}%`, background: 'var(--status-in-progress)' }} />}
                  </div>
                </div>
                <span className="muted" style={{ width: 120, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {done} / {scope} · {pct}%
                </span>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}

export function CycleDetail() {
  const { teamKey, cycleId } = useParams()
  const { db, teamByKey } = useStore()
  const team = teamByKey(teamKey ?? '')
  const cycle = db.cycles.find((c) => c.id === cycleId)
  if (!team || !cycle) return <div className="empty-state">Cycle not found.</div>
  return (
    <IssueListView
      key={cycle.id}
      teamId={team.id}
      title={
        <>
          <TeamAvatar team={team} size={16} /> {team.name} <span className="sep">›</span>
          <Link to={`/team/${team.key}/cycles`} className="muted">Cycles</Link> <span className="sep">›</span> Cycle {cycle.number}
          <span className="faint" style={{ fontWeight: 400 }}>{shortDate(cycle.start)} – {shortDate(cycle.end)}</span>
        </>
      }
      issues={db.issues.filter((i) => i.cycleId === cycle.id)}
      emptyText="No issues in this cycle."
    />
  )
}
