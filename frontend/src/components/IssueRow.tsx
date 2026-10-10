import { useNavigate } from 'react-router-dom'
import { Repeat } from 'lucide-react'
import { Avatar, PriorityIcon, StatusIcon, shortDate } from './ui'
import { useStore, useUi } from '../data/store'
import type { Issue } from '../data/types'

export function IssueLabels({ issue }: { issue: Issue }) {
  const { db } = useStore()
  return (
    <>
      {issue.labelIds.map((id) => {
        const l = db.labels.find((x) => x.id === id)
        return l ? (
          <span key={id} className="chip">
            <span className="dot" style={{ background: l.color }} />
            {l.name}
          </span>
        ) : null
      })}
    </>
  )
}

export function IssueRow({ issue, selected, onToggleSelect }: { issue: Issue; selected: boolean; onToggleSelect: () => void }) {
  const { db, user, issueKey } = useStore()
  const { setContextMenu } = useUi()
  const navigate = useNavigate()
  const cycle = db.cycles.find((c) => c.id === issue.cycleId)
  return (
    <div
      className={`issue-row${selected ? ' selected' : ''}`}
      onClick={(e) => (e.ctrlKey || e.metaKey || e.shiftKey ? onToggleSelect() : navigate(`/issue/${issue.id}`))}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenu({ issueId: issue.id, x: e.clientX, y: e.clientY })
      }}
    >
      <span className="check-slot" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="checkbox" checked={selected} onChange={onToggleSelect} aria-label="Select issue" />
      </span>
      <PriorityIcon priority={issue.priority} />
      <span className="id mono">{issueKey(issue)}</span>
      <StatusIcon status={issue.status} />
      <span className="title">{issue.title}</span>
      <span className="meta">
        <IssueLabels issue={issue} />
        {cycle && (
          <span className="chip">
            <Repeat size={12} /> Cycle {cycle.number}
          </span>
        )}
        <Avatar user={user(issue.assigneeId)} size={18} />
        <span className="date">{shortDate(issue.createdAt)}</span>
      </span>
    </div>
  )
}
