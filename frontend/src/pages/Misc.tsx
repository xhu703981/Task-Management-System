import { Link, useNavigate } from 'react-router-dom'
import { Inbox as InboxIcon, Plus, Zap } from 'lucide-react'
import { Avatar, StatusIcon, timeAgo } from '../components/ui'
import { ProjectCrumb, useRouteProject } from './IssueList'
import { statusMeta } from '../data/meta'
import { useStore, useUi } from '../data/store'

export function Inbox() {
  const { db, me, user } = useStore()
  const items = db.activity
    .filter((a) => a.actorId !== me.id)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 40)
  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">Inbox</div>
      </div>
      <div className="content-main">
        {items.length === 0 ? (
          <div className="empty-state">
            <InboxIcon size={32} className="faint" /> You’re all caught up.
          </div>
        ) : (
          items.map((a) => {
            const issue = db.issues.find((i) => i.id === a.issueId)
            if (!issue) return null
            return (
              <Link key={a.id} to={`/issue/${issue.key}`} className="issue-row" style={{ height: 52, gap: 12, padding: '0 16px' }}>
                <Avatar user={user(a.actorId)} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="mono faint">{issue.key}</span>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</span>
                  </div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    {user(a.actorId)?.name} {a.text}
                  </div>
                </div>
                <StatusIcon status={issue.status} />
                <span className="faint" style={{ fontSize: 12, width: 56, textAlign: 'right' }}>{timeAgo(a.createdAt)}</span>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}

/** A project's epics, each with the progress of the issues inside it. */
export function Epics() {
  const { db, user, canWrite } = useStore()
  const { setNewIssue } = useUi()
  const navigate = useNavigate()
  const project = useRouteProject()
  if (!project) return <div className="empty-state">Project not found.</div>
  const epics = db.issues.filter((i) => i.projectId === project.id && i.type === 'epic').sort((a, b) => a.number - b.number)

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <ProjectCrumb projectId={project.id}>Epics</ProjectCrumb>
        </div>
        <span className="spacer" />
        {canWrite(project.id) && (
          <button className="btn sm" onClick={() => setNewIssue({ projectId: project.id, type: 'epic' })}>
            <Plus size={14} /> New epic
          </button>
        )}
      </div>
      <div className="content-main">
        {epics.length === 0 && (
          <div className="empty-state">
            <Zap size={32} className="faint" /> No epics yet. An epic groups the stories, tasks and bugs of one bigger piece of work.
          </div>
        )}
        {epics.map((e) => {
          const children = db.issues.filter((i) => i.parentId === e.id)
          const done = children.filter((i) => i.status === 'done').length
          const lead = user(e.assigneeId)
          return (
            <div key={e.id} className="issue-row" style={{ height: 48, gap: 12, padding: '0 24px' }} onClick={() => navigate(`/issue/${e.key}`)}>
              <Zap size={16} style={{ color: 'var(--ai-from)' }} />
              <span className="mono faint">{e.key}</span>
              <span style={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.description || undefined}>
                {e.title}
              </span>
              <span className="chip">
                <StatusIcon status={e.status} size={12} /> {statusMeta(e.status).name}
              </span>
              <Avatar user={lead} size={18} />
              <div style={{ width: 160 }}>
                <div className="progress" title={`${done} of ${children.length} child issues done`}>
                  {done > 0 && <div style={{ width: `${(done / Math.max(1, children.length)) * 100}%`, background: 'var(--accent)' }} />}
                </div>
              </div>
              <span className="muted" style={{ width: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {done} / {children.length}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}
