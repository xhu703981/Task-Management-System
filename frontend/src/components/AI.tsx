import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronRight, Copy, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { statusMeta } from '../data/meta'
import { useStore, type Store } from '../data/store'
import type { Comment, Issue } from '../data/types'
import { timeAgo } from './ui'

/** A bullet is plain text interleaved with issue references rendered as clickable ID chips. */
export type Segment = string | { issueId: string }
export type Bullet = Segment[]

const DAY = 86_400_000
const OPEN = new Set(['backlog', 'todo', 'in_progress', 'in_review'])

/*
 * Mock "AI" summarizers. They build the narrative deterministically from the data so the UI
 * has realistic content; swap them for a backend LLM call later (same Bullet[] shape).
 */
export function summarizeIssues(store: Store, issues: Issue[], sinceDays: number): Bullet[] {
  const since = Date.now() - sinceDays * DAY
  const active = issues.filter((i) => i.updatedAt >= since || i.createdAt >= since)
  if (active.length < 3) return []
  const completed = issues.filter((i) => i.completedAt && i.completedAt >= since)
  const inReview = issues.filter((i) => i.status === 'in_review')
  const open = issues.filter((i) => OPEN.has(i.status))
  const atRisk = open
    .filter((i) => i.priority === 1 || (i.dueDate !== null && i.dueDate < Date.now() + 2 * DAY))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
  const unassigned = open.filter((i) => !i.assigneeId)
  const load = new Map<string, number>()
  open.forEach((i) => i.assigneeId && load.set(i.assigneeId, (load.get(i.assigneeId) ?? 0) + 1))
  const [topId, topCount] = [...load.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]

  const bullets: Bullet[] = []
  bullets.push([
    `Progress: ${completed.length} issue${completed.length === 1 ? '' : 's'} completed in the last ${sinceDays} days; ${open.length} remain open, ${inReview.length} waiting in review.`,
  ])
  if (completed.length) {
    const shipped = completed.sort((a, b) => b.completedAt! - a.completedAt!).slice(0, 3)
    bullets.push(['Shipped: ', ...shipped.flatMap((i, n): Segment[] => [{ issueId: i.id }, ` ${i.title}${n < shipped.length - 1 ? '; ' : '.'}`])])
  }
  if (atRisk.length) {
    bullets.push([
      'At risk: ',
      ...atRisk.flatMap((i, n): Segment[] => [
        { issueId: i.id },
        ` (${i.priority === 1 ? 'urgent' : 'due soon'}, ${statusMeta(i.status).name.toLowerCase()})${n < atRisk.length - 1 ? ', ' : '.'}`,
      ]),
    ])
  }
  if (inReview.length > 2) bullets.push([`Blocker: review queue is building up (${inReview.length} issues), starting with `, { issueId: inReview[0].id }, '.'])
  if (unassigned.length) bullets.push([`${unassigned.length} open issue${unassigned.length === 1 ? ' has' : 's have'} no owner, e.g. `, { issueId: unassigned[0].id }, '. Consider assigning them during triage.'])
  if (topId) bullets.push([`Workload: ${store.user(topId)!.name} holds the most open work (${topCount} issues).`])
  return bullets.slice(0, 6)
}

export function summarizeIssue(store: Store, issue: Issue, comments: Comment[]): Bullet[] {
  const a = store.user(issue.assigneeId)
  const bullets: Bullet[] = [
    [`Currently ${statusMeta(issue.status).name.toLowerCase()}${a ? `, owned by ${a.name}` : ', unassigned'}.`],
    [`Problem: ${issue.description.split('\n').find((l) => l.trim()) ?? issue.title}`],
  ]
  if (comments.length) {
    const last = comments[comments.length - 1]
    bullets.push([`Discussion: ${comments.length} comment${comments.length === 1 ? '' : 's'}; latest from ${store.user(last.authorId)!.name}: “${last.body.slice(0, 90)}${last.body.length > 90 ? '…' : ''}”`])
  } else bullets.push(['No discussion yet.'])
  if (issue.dueDate) bullets.push([`Due ${new Date(issue.dueDate).toLocaleDateString()}${issue.dueDate < Date.now() ? ' (overdue)' : ''}.`])
  return bullets
}

export type AiState = 'generating' | 'ready' | 'empty' | 'error'

/** Runs a (mock) summarizer with a fake latency and tracks the generation time for staleness. */
export function useAiSummary(compute: () => Bullet[], scopeKey: string) {
  const [params] = useSearchParams()
  const forceError = params.get('aiError') === '1'
  const [state, setState] = useState<AiState>('generating')
  const [bullets, setBullets] = useState<Bullet[]>([])
  const [generatedAt, setGeneratedAt] = useState(0)
  const computeRef = useRef(compute)
  computeRef.current = compute
  const failedOnce = useRef(false)

  const regenerate = useCallback(() => {
    setState('generating')
    const t = setTimeout(() => {
      if (forceError && !failedOnce.current) {
        failedOnce.current = true
        setState('error')
        return
      }
      const b = computeRef.current()
      setBullets(b)
      setGeneratedAt(Date.now())
      setState(b.length ? 'ready' : 'empty')
    }, 1200)
    return () => clearTimeout(t)
  }, [forceError])

  useEffect(() => regenerate(), [regenerate, scopeKey])

  return { state, bullets, generatedAt, regenerate }
}

export function BulletText({ bullet }: { bullet: Bullet }) {
  const { db, issueKey } = useStore()
  const navigate = useNavigate()
  return (
    <>
      {bullet.map((s, i) => {
        if (typeof s === 'string') return <span key={i}>{s}</span>
        const issue = db.issues.find((x) => x.id === s.issueId)
        if (!issue) return <span key={i} className="mono faint">deleted</span>
        return (
          <button key={i} className="id-chip" title={issue.title} onClick={() => navigate(`/issue/${issue.id}`)}>
            {issueKey(issue)}
          </button>
        )
      })}
    </>
  )
}

export function AIBlock({
  title,
  state,
  bullets,
  generatedAt,
  staleCount,
  generatingLabel,
  onRegenerate,
  collapsible,
  actions,
}: {
  title: string
  state: AiState
  bullets: Bullet[]
  generatedAt: number
  staleCount: number
  generatingLabel: string
  onRegenerate: () => void
  collapsible?: boolean
  actions?: ReactNode
}) {
  const { db, issueKey, toast } = useStore()
  const [open, setOpen] = useState(true)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const plain = () =>
    bullets
      .map((b) => '• ' + b.map((s) => (typeof s === 'string' ? s : (() => { const i = db.issues.find((x) => x.id === s.issueId); return i ? issueKey(i) : '' })())).join(''))
      .join('\n')

  return (
    <section className="ai-block" aria-busy={state === 'generating'}>
      <header>
        {collapsible && (
          <button className="icon-btn" style={{ width: 20, height: 20, marginLeft: -4 }} aria-label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        <Sparkles size={16} className="sparkle" />
        <span>{title}</span>
        <span className="spacer" />
        {actions}
      </header>
      {open && (
        <>
          {state === 'generating' && (
            <div>
              <div className="muted" style={{ marginTop: 8 }}>{generatingLabel}</div>
              {[92, 78, 85, 60].map((w) => (
                <div key={w} className="skeleton shimmer-line" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
          {state === 'empty' && <p className="muted" style={{ margin: '8px 0 0' }}>Not enough activity in this period.</p>}
          {state === 'error' && (
            <div className="row" style={{ marginTop: 8 }}>
              <AlertTriangle size={14} color="var(--danger)" />
              <span className="muted">Couldn’t generate a summary.</span>
              <button className="btn sm" onClick={onRegenerate}>
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}
          {state === 'ready' && (
            <>
              {staleCount > 0 && (
                <div className="stale">
                  <AlertTriangle size={14} />
                  <span style={{ flex: 1 }}>
                    {staleCount} issue{staleCount === 1 ? '' : 's'} changed since this summary
                  </span>
                  <button className="btn sm ghost" style={{ color: 'inherit' }} onClick={onRegenerate}>
                    Refresh
                  </button>
                </div>
              )}
              <ul>
                {bullets.map((b, i) => (
                  <li key={i}>
                    <BulletText bullet={b} />
                  </li>
                ))}
              </ul>
              <footer>
                <span>Generated {timeAgo(generatedAt)}</span>
                <span className="spacer" />
                <button className="icon-btn" aria-label="Regenerate" title="Regenerate" onClick={onRegenerate}>
                  <RefreshCw size={14} className="sparkle" />
                </button>
                <button
                  className="icon-btn"
                  aria-label="Copy"
                  title="Copy"
                  onClick={() => {
                    navigator.clipboard?.writeText(plain()).catch(() => {})
                    toast('Summary copied')
                  }}
                >
                  <Copy size={14} />
                </button>
                <button className={`icon-btn${vote === 'up' ? ' active' : ''}`} aria-label="Helpful" onClick={() => setVote(vote === 'up' ? null : 'up')}>
                  <ThumbsUp size={14} />
                </button>
                <button className={`icon-btn${vote === 'down' ? ' active' : ''}`} aria-label="Not helpful" onClick={() => setVote(vote === 'down' ? null : 'down')}>
                  <ThumbsDown size={14} />
                </button>
              </footer>
            </>
          )}
        </>
      )}
    </section>
  )
}
