import { Link, useParams } from 'react-router-dom'
import { FolderKanban, Inbox as InboxIcon } from 'lucide-react'
import { Avatar, StatusIcon, TeamAvatar, timeAgo } from '../components/ui'
import { useStore } from '../data/store'

export function Inbox() {
  const { db, me, user, issueKey } = useStore()
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
              <Link key={a.id} to={`/issue/${issue.id}`} className="issue-row" style={{ height: 52, gap: 12, padding: '0 16px' }}>
                <Avatar user={user(a.actorId)} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="mono faint">{issueKey(issue)}</span>
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

export function Projects() {
  const { teamKey } = useParams()
  const { db, team, teamByKey } = useStore()
  const scopeTeam = teamKey ? teamByKey(teamKey) : undefined
  const projects = db.projects.filter((p) => !scopeTeam || p.teamId === scopeTeam.id)
  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          {scopeTeam && (
            <>
              <TeamAvatar team={scopeTeam} size={16} /> {scopeTeam.name} <span className="sep">›</span>
            </>
          )}
          Projects
        </div>
      </div>
      <div className="content-main">
        {projects.length === 0 && (
          <div className="empty-state">
            <FolderKanban size={32} className="faint" /> No projects yet.
          </div>
        )}
        {projects.map((p) => {
          const issues = db.issues.filter((i) => i.projectId === p.id && i.status !== 'canceled')
          const done = issues.filter((i) => i.status === 'done').length
          const t = team(p.teamId)
          return (
            <div key={p.id} className="issue-row" style={{ height: 48, gap: 12, padding: '0 24px', cursor: 'default' }}>
              <FolderKanban size={16} className="faint" />
              <span style={{ fontWeight: 500, flex: 1 }}>{p.name}</span>
              <span className="chip">
                <TeamAvatar team={t} size={12} /> {t.key}
              </span>
              <div style={{ width: 160 }}>
                <div className="progress" title={`${done} of ${issues.length} completed`}>
                  {done > 0 && <div style={{ width: `${(done / Math.max(1, issues.length)) * 100}%`, background: 'var(--accent)' }} />}
                </div>
              </div>
              <span className="muted" style={{ width: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {done} / {issues.length}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}
