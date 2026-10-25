import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, RefreshCw, Sparkles, X } from 'lucide-react'
import { AIBlock, summarizeIssues, useAiSummary } from '../components/AI'
import { LabelDot, allLabels } from '../components/labels'
import { Avatar, IssueTypeIcon, PriorityIcon, ProjectAvatar, StatusIcon, timeAgo } from '../components/ui'
import { useRouteProject } from './IssueList'
import { ISSUE_TYPES, PRIORITIES, STATUSES } from '../data/meta'
import { useStore } from '../data/store'
import type { Issue, Project, Sprint } from '../data/types'

const DAY = 86_400_000
type Range = '7' | '14' | '30' | 'sprint'

/* ---------- Chart helpers ---------- */

function useTooltip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null)
  const bind = (content: ReactNode) => ({
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX + 12, y: e.clientY + 12, content }),
    onMouseLeave: () => setTip(null),
  })
  const node = tip && (
    <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  )
  return { bind, node, setTip }
}

function HBars({ rows, unit = '' }: { rows: { key: string; label: ReactNode; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  const { bind, node } = useTooltip()
  return (
    <div>
      {rows.map((r) => (
        <div key={r.key} className="hbar-row" {...bind(unit ? <><b>{r.value}{unit}</b> of labelled issues</> : <><b>{r.value}</b> issues</>)}>
          <span className="lbl">{r.label}</span>
          <div className="hbar-track">
            {r.value > 0 && <div className="hbar" style={{ width: `${(r.value / max) * 100}%`, background: 'var(--accent)' }} />}
          </div>
          <span className="val">{r.value}{unit}</span>
        </div>
      ))}
      {node}
    </div>
  )
}

function Donut({ slices }: { slices: { key: string; label: string; value: number; color: string; icon: ReactNode }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const { bind, node } = useTooltip()
  const R = 64
  const r = 44
  const gap = 0.025 // radians of surface gap between segments
  let angle = -Math.PI / 2
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const sweep = (s.value / total) * Math.PI * 2
      const a0 = angle + (sweep > gap * 2 ? gap : 0)
      const a1 = angle + sweep - (sweep > gap * 2 ? gap : 0)
      angle += sweep
      const large = a1 - a0 > Math.PI ? 1 : 0
      const p = (rad: number, a: number) => `${80 + rad * Math.cos(a)} ${80 + rad * Math.sin(a)}`
      const d =
        sweep >= Math.PI * 2 - 0.001
          ? `M ${p(R, 0)} A ${R} ${R} 0 1 1 ${p(R, Math.PI)} A ${R} ${R} 0 1 1 ${p(R, 0)} M ${p(r, 0)} A ${r} ${r} 0 1 0 ${p(r, Math.PI)} A ${r} ${r} 0 1 0 ${p(r, 0)} Z`
          : `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`
      return { ...s, d }
    })
  return (
    <div className="row" style={{ gap: 24, alignItems: 'center' }}>
      <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="Issues by status">
        {total === 0 && <circle cx="80" cy="80" r={(R + r) / 2} stroke="var(--bg-hover)" strokeWidth={R - r} fill="none" />}
        {arcs.map((a) => (
          <path key={a.key} d={a.d} fill={a.color} fillRule="evenodd" {...bind(<>{a.label}: <b>{a.value}</b> ({Math.round((a.value / total) * 100)}%)</>)} />
        ))}
        <text x="80" y="78" textAnchor="middle" fill="var(--text-primary)" fontSize="22" fontWeight="600">{total}</text>
        <text x="80" y="96" textAnchor="middle" fill="var(--text-tertiary)" fontSize="11">issues</text>
      </svg>
      <div className="legend" style={{ flex: 1 }}>
        {slices.map((s) => (
          <div key={s.key} className="legend-item">
            {s.icon} {s.label} <span className="val">{s.value}</span>
          </div>
        ))}
      </div>
      {node}
    </div>
  )
}

function BurnUp({ issues, start, end }: { issues: Issue[]; start: number; end: number }) {
  const { setTip, node } = useTooltip()
  const W = 480
  const H = 180
  const pad = { l: 28, r: 64, t: 12, b: 24 }
  const days = Math.max(1, Math.round((end - start) / DAY))
  const today = Math.min(days, Math.max(0, Math.floor((Date.now() - start) / DAY)))
  const pts = Array.from({ length: today + 1 }, (_, d) => {
    const t = start + (d + 1) * DAY
    return {
      d,
      scope: issues.filter((i) => i.createdAt < t).length || issues.length,
      done: issues.filter((i) => i.completedAt !== null && i.completedAt < t).length,
    }
  })
  const maxY = Math.max(1, issues.length)
  const x = (d: number) => pad.l + (d / days) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b)
  const line = (k: 'scope' | 'done') => pts.map((p, i) => `${i ? 'L' : 'M'} ${x(p.d)} ${y(p[k])}`).join(' ')
  const last = pts[pts.length - 1]
  const ticks = [0, Math.round(maxY / 2), maxY]
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div>
      <div className="legend" style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
        <span className="legend-item"><span style={{ width: 12, height: 2, background: 'var(--text-tertiary)' }} /> Scope</span>
        <span className="legend-item"><span style={{ width: 12, height: 2, background: 'var(--accent)' }} /> Completed</span>
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Sprint burn-up"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          const d = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * days)
          const p = pts[Math.min(pts.length - 1, Math.max(0, d))]
          setHover(p.d)
          setTip({ x: e.clientX + 12, y: e.clientY + 12, content: <>Day {p.d + 1}<br />Scope <b>{p.scope}</b> · Completed <b>{p.done}</b></> })
        }}
        onMouseLeave={() => {
          setHover(null)
          setTip(null)
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border-subtle)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--text-tertiary)">{t}</text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} fontSize="10" fill="var(--text-tertiary)">Day 1</text>
        <text x={W - pad.r} y={H - 6} fontSize="10" fill="var(--text-tertiary)" textAnchor="end">Day {days}</text>
        <path d={`${line('done')} L ${x(last.d)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill="var(--accent)" opacity="0.1" />
        <path d={line('scope')} stroke="var(--text-tertiary)" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <path d={line('done')} stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--border-strong)" strokeWidth="1" />}
        <circle cx={x(last.d)} cy={y(last.done)} r="4" fill="var(--accent)" stroke="var(--bg-panel)" strokeWidth="2" />
        <text x={x(last.d) + 8} y={y(last.done) + 4} fontSize="11" fill="var(--text-primary)">{last.done} done</text>
        <text x={x(last.d) + 8} y={y(last.scope) - 4} fontSize="11" fill="var(--text-secondary)">{last.scope} scope</text>
      </svg>
      {node}
    </div>
  )
}

/* ---------- Summary page ---------- */

function rangeBounds(range: Range, sprint: Sprint | undefined) {
  if (range === 'sprint' && sprint?.start) return { since: sprint.start, days: Math.max(1, Math.ceil((Date.now() - sprint.start) / DAY)) }
  const days = range === 'sprint' ? 14 : Number(range)
  return { since: Date.now() - days * DAY, days }
}

export default function ProjectSummary() {
  const store = useStore()
  const { db, user, issueKey } = store
  const navigate = useNavigate()
  const project = useRouteProject()
  const [range, setRange] = useState<Range>('14')
  const issues = useMemo(() => (project ? db.issues.filter((i) => i.projectId === project.id) : []), [db.issues, project])
  const sprint = project ? db.sprints.find((s) => s.projectId === project.id && s.status === 'active') : undefined
  const { since, days } = rangeBounds(range, sprint)
  const ai = useAiSummary(() => summarizeIssues(store, issues, days), `${project?.id}-${range}`)
  if (!project) return <div className="empty-state">Project not found.</div>

  const prevSince = since - days * DAY
  const count = (pred: (i: Issue) => boolean) => issues.filter(pred).length
  const tiles = [
    { label: 'Completed', now: count((i) => !!i.completedAt && i.completedAt >= since), prev: count((i) => !!i.completedAt && i.completedAt >= prevSince && i.completedAt < since) },
    { label: 'Updated', now: count((i) => i.updatedAt >= since), prev: count((i) => i.updatedAt >= prevSince && i.updatedAt < since) },
    { label: 'Created', now: count((i) => i.createdAt >= since), prev: count((i) => i.createdAt >= prevSince && i.createdAt < since) },
    { label: 'Due soon', now: count((i) => i.dueDate !== null && i.dueDate < Date.now() + 7 * DAY && i.status !== 'done'), prev: null as number | null },
  ]
  const open = issues.filter((i) => i.status !== 'done')
  const staleCount = ai.generatedAt ? issues.filter((i) => i.updatedAt > ai.generatedAt).length : 0
  const activity = db.activity
    .filter((a) => a.createdAt >= since && issues.some((i) => i.id === a.issueId))
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8)
  const workload = [
    ...project.memberIds.map((id) => ({ key: id, label: <><Avatar user={user(id)} size={16} /> {user(id)?.name}</>, value: open.filter((i) => i.assigneeId === id).length })),
    { key: 'none', label: <><Avatar user={null} size={16} /> Unassigned</>, value: open.filter((i) => !i.assigneeId).length },
  ]
  const labelled = issues.filter((i) => i.labels.length)

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <ProjectAvatar project={project} size={16} /> {project.name} <span className="sep">·</span> Summary
        </div>
        <span className="spacer" />
        <select className="select" style={{ width: 160, height: 28 }} value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Time range">
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="sprint">Active sprint</option>
        </select>
        <button className="btn sm" onClick={ai.regenerate} disabled={ai.state === 'generating'}>
          <RefreshCw size={14} className="ai-icon" /> Regenerate
        </button>
      </div>
      <div className="content-main">
        <div className="summary-page">
          <div className="full">
            <AIBlock
              title="AI overview"
              {...ai}
              staleCount={staleCount}
              onRegenerate={ai.regenerate}
              generatingLabel={`Summarizing ${issues.length} issues…`}
            />
          </div>
          <div className="full stat-tiles">
            {tiles.map((t) => {
              const delta = t.prev === null ? null : t.now - t.prev
              return (
                <div key={t.label} className="card stat-tile">
                  <div className="muted label">{t.label}</div>
                  <div className="num">{t.now}</div>
                  <div className="delta">{delta === null ? 'next 7 days' : `${delta >= 0 ? '+' : ''}${delta} vs previous ${days}d`}</div>
                </div>
              )
            })}
          </div>
          <div className="card card-pad">
            <h4>Status overview</h4>
            <Donut slices={STATUSES.map((s) => ({ key: s.id, label: s.name, value: count((i) => i.status === s.id), color: s.color, icon: <StatusIcon status={s.id} /> }))} />
          </div>
          <div className="card card-pad">
            <h4>Recent activity</h4>
            {activity.length === 0 && <div className="muted">No activity in this period.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activity.map((a) => {
                const issue = db.issues.find((i) => i.id === a.issueId)
                return (
                  <div key={a.id} className="row" style={{ alignItems: 'flex-start' }}>
                    <Avatar user={user(a.actorId)} size={20} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 500 }}>{user(a.actorId)?.name}</span> <span className="muted">{a.text}</span>{' '}
                      {issue && (
                        <button className="id-chip" title={issue.title} onClick={() => navigate(`/issue/${issue.key}`)}>
                          {issueKey(issue)}
                        </button>
                      )}
                    </div>
                    <span className="faint" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{timeAgo(a.createdAt)}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="card card-pad">
            <h4>Priority breakdown <span className="faint" style={{ fontWeight: 400 }}>· open issues</span></h4>
            <HBars rows={PRIORITIES.map((p) => ({ key: String(p.id), label: <><PriorityIcon priority={p.id} /> {p.name}</>, value: open.filter((i) => i.priority === p.id).length }))} />
          </div>
          <div className="card card-pad">
            <h4>Workload <span className="faint" style={{ fontWeight: 400 }}>· open issues</span></h4>
            <HBars rows={workload} />
          </div>
          <div className="card card-pad">
            <h4>Issue types</h4>
            <HBars rows={ISSUE_TYPES.map((t) => ({ key: t.id, label: <><IssueTypeIcon type={t.id} /> {t.name}</>, value: count((i) => i.type === t.id) }))} />
          </div>
          <div className="card card-pad">
            <h4>Labels</h4>
            <HBars
              unit="%"
              rows={allLabels(issues).map((name) => ({
                key: name,
                label: <><LabelDot name={name} /> {name}</>,
                value: Math.round((issues.filter((i) => i.labels.some((l) => l.toLowerCase() === name.toLowerCase())).length / Math.max(1, labelled.length)) * 100),
              }))}
            />
            <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>% of labelled issues</div>
          </div>
          <div className="card card-pad">
            <h4>Sprint progress {sprint && <span className="faint" style={{ fontWeight: 400 }}>· {sprint.name}</span>}</h4>
            {sprint?.start && sprint.end ? <BurnUp issues={issues.filter((i) => i.sprintId === sprint.id)} start={sprint.start} end={sprint.end} /> : <div className="muted">No active sprint.</div>}
          </div>
        </div>
      </div>
    </>
  )
}

/** Right-panel version, scoped to whatever the list header is showing. */
export function SummaryPanel({ issues, scopeKey, onClose }: { issues: Issue[]; scopeKey: string; onClose: () => void }) {
  const store = useStore()
  const ai = useAiSummary(() => summarizeIssues(store, issues, 14), scopeKey)
  const staleCount = ai.generatedAt ? issues.filter((i) => i.updatedAt > ai.generatedAt).length : 0
  return (
    <AIBlock
      title="Summary of this view"
      {...ai}
      staleCount={staleCount}
      onRegenerate={ai.regenerate}
      generatingLabel={`Summarizing ${issues.length} issues…`}
      actions={
        <button className="icon-btn" aria-label="Close summary" onClick={onClose}>
          <X size={14} />
        </button>
      }
    />
  )
}

function ProjectSummaryCard({ project }: { project: Project }) {
  const store = useStore()
  const issues = store.db.issues.filter((i) => i.projectId === project.id)
  const ai = useAiSummary(() => summarizeIssues(store, issues, 14), project.id)
  const staleCount = ai.generatedAt ? issues.filter((i) => i.updatedAt > ai.generatedAt).length : 0
  return (
    <AIBlock
      title={project.name}
      {...ai}
      staleCount={staleCount}
      onRegenerate={ai.regenerate}
      generatingLabel={`Summarizing ${issues.length} issues…`}
      actions={
        <Link to={`/project/${project.key}/summary`} className="btn sm ghost">
          Open summary <ArrowRight size={14} />
        </Link>
      }
    />
  )
}

export function AllSummaries() {
  const { db } = useStore()
  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <Sparkles size={16} className="sparkle" style={{ color: 'var(--ai-from)' }} /> AI Summaries
        </div>
        <span className="faint">Last 14 days, all your projects</span>
      </div>
      <div className="content-main">
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 880 }}>
          {db.projects.map((p) => (
            <ProjectSummaryCard key={p.id} project={p} />
          ))}
        </div>
      </div>
    </>
  )
}
