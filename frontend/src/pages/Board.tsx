import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Columns3, Zap } from 'lucide-react'
import { Avatar, IssueTypeIcon, PriorityIcon, StatusIcon } from '../components/ui'
import { CompleteSprintModal, daysLeft, sprintDates } from './Sprints'
import { ProjectCrumb, useRouteProject } from './IssueList'
import { STATUSES } from '../data/meta'
import { useStore, useUi } from '../data/store'
import type { Issue, Status } from '../data/types'

function Card({ issue, draggable }: { issue: Issue; draggable: boolean }) {
  const { db, user } = useStore()
  const { setContextMenu } = useUi()
  const navigate = useNavigate()
  const epic = db.issues.find((i) => i.id === issue.parentId)
  return (
    <div
      className="board-card"
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData('text/issue', issue.id)}
      onClick={() => navigate(`/issue/${issue.key}`)}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenu({ issueId: issue.id, x: e.clientX, y: e.clientY })
      }}
    >
      <div style={{ fontWeight: 500 }}>{issue.title}</div>
      {epic && (
        <span className="chip epic-chip" style={{ alignSelf: 'flex-start' }}>
          <Zap size={11} /> {epic.title}
        </span>
      )}
      <div className="row" style={{ gap: 6 }}>
        <IssueTypeIcon type={issue.type} />
        <span className="mono faint">{issue.key}</span>
        <span className="spacer" />
        <PriorityIcon priority={issue.priority} />
        {issue.storyPoints > 0 && <span className="points">{issue.storyPoints}</span>}
        <Avatar user={user(issue.assigneeId)} size={18} />
      </div>
    </div>
  )
}

/** The Scrum board: the active sprint's issues, one column per status. Drag a card to change its status. */
export default function Board() {
  const { db, me, canWrite, updateIssue } = useStore()
  const project = useRouteProject()
  const [dragOver, setDragOver] = useState<Status | null>(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const [completing, setCompleting] = useState(false)
  if (!project) return <div className="empty-state">Project not found.</div>
  const sprint = db.sprints.find((s) => s.projectId === project.id && s.status === 'active')
  const writable = canWrite(project.id)
  const issues = sprint
    ? db.issues.filter((i) => i.sprintId === sprint.id && (!onlyMine || i.assigneeId === me.id)).sort((a, b) => a.priority - b.priority || a.number - b.number)
    : []
  const left = sprint ? daysLeft(sprint) : null

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <ProjectCrumb projectId={project.id}>{sprint ? sprint.name : 'Board'}</ProjectCrumb>
          {sprint && <span className="faint" style={{ fontWeight: 400 }}>{sprintDates(sprint)}</span>}
        </div>
        <span className="spacer" />
        {sprint && (
          <>
            {left !== null && <span className="muted">{left} day{left === 1 ? '' : 's'} left</span>}
            <button className={`btn sm${onlyMine ? '' : ' ghost'}`} onClick={() => setOnlyMine(!onlyMine)} aria-pressed={onlyMine}>
              Only my issues
            </button>
            {writable && (
              <button className="btn sm" onClick={() => setCompleting(true)}>
                Complete sprint
              </button>
            )}
          </>
        )}
      </div>
      <div className="content-main">
        {!sprint ? (
          <div className="empty-state">
            <Columns3 size={32} className="faint" />
            No active sprint. Plan one and start it from the backlog.
            <Link className="btn" to={`/project/${project.key}/backlog`}>Go to backlog</Link>
          </div>
        ) : (
          <>
            {sprint.goal && <div className="muted" style={{ padding: '10px 16px 0' }}>Goal: {sprint.goal}</div>}
            <div className="board">
              {STATUSES.map((s) => {
                const col = issues.filter((i) => i.status === s.id)
                return (
                  <div
                    key={s.id}
                    className="board-col"
                    style={{ outline: dragOver === s.id ? '1px dashed var(--border-strong)' : undefined, borderRadius: 8, minHeight: 200 }}
                    onDragOver={(e) => {
                      if (!writable) return
                      e.preventDefault()
                      setDragOver(s.id)
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData('text/issue')
                      const issue = db.issues.find((i) => i.id === id)
                      if (issue && issue.status !== s.id) updateIssue(id, { status: s.id })
                      setDragOver(null)
                    }}
                  >
                    <div className="board-col-header">
                      <StatusIcon status={s.id} /> {s.name} <span className="faint">{col.length}</span>
                    </div>
                    {col.map((i) => (
                      <Card key={i.id} issue={i} draggable={writable} />
                    ))}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      {completing && sprint && <CompleteSprintModal sprint={sprint} onClose={() => setCompleting(false)} />}
    </>
  )
}
