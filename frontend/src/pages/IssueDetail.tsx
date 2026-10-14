import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, FolderKanban, MoreHorizontal, Pencil, Plus, Repeat, Star, Tag, Trash2 } from 'lucide-react'
import { Menu, type MenuEntry } from '../components/Menu'
import { AIBlock, summarizeIssue, useAiSummary } from '../components/AI'
import { IssueLabels } from '../components/IssueRow'
import { allLabels, labelEntries } from '../components/labels'
import { Avatar, PriorityIcon, StatusIcon, TeamAvatar, timeAgo } from '../components/ui'
import { cycleOptions } from '../components/IssueContextMenu'
import { PRIORITIES, STATUSES, priorityName, statusMeta } from '../data/meta'
import { useStore, useUi } from '../data/store'
import type { Comment, Issue } from '../data/types'

export default function IssueDetail() {
  const { issueId } = useParams()
  const { db } = useStore()
  const issue = db.issues.find((i) => i.id === issueId)
  if (!issue)
    return (
      <div className="empty-state">
        <div>This issue doesn’t exist or was deleted.</div>
        <Link className="btn" to="/">Back to issues</Link>
      </div>
    )
  return <IssueDetailView key={issue.id} issue={issue} />
}

function IssueDetailView({ issue }: { issue: Issue }) {
  const store = useStore()
  const { db, me, user, team, issueKey, updateIssue, loadComments, addComment, editComment, deleteComment } = store
  const { setContextMenu, setNewIssueTeamId } = useUi()
  const navigate = useNavigate()
  const t = team(issue.teamId)
  const [title, setTitle] = useState(issue.title)
  const [description, setDescription] = useState(issue.description)
  // If the saved issue changes (e.g. the backend refused an edit and it was undone), show the saved text again.
  useEffect(() => setTitle(issue.title), [issue.title])
  useEffect(() => setDescription(issue.description), [issue.description])
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  // This component is remounted per issue (key={issue.id}), so this runs once each time an issue is opened.
  useEffect(() => {
    loadComments(issue.id)
  }, [issue.id])
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[]; searchable?: boolean } | null>(null)

  const comments = db.comments.filter((c) => c.issueId === issue.id)
  const subIssues = db.issues.filter((i) => i.parentId === issue.id)
  const parent = db.issues.find((i) => i.id === issue.parentId)
  const activity = db.activity.filter((a) => a.issueId === issue.id)
  const timeline = [
    ...activity.map((a) => ({ kind: 'activity' as const, at: a.createdAt, a })),
    ...comments.map((c) => ({ kind: 'comment' as const, at: c.createdAt, c })),
  ].sort((x, y) => x.at - y.at)

  const ai = useAiSummary(() => summarizeIssue(store, issue, comments), issue.id)
  const staleCount = ai.generatedAt && issue.updatedAt > ai.generatedAt ? 1 : 0

  const openAt = (e: React.MouseEvent, entries: MenuEntry[], searchable?: boolean) => {
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({ x: r.left, y: r.bottom + 4, entries, searchable })
  }

  // Same rules as the backend: only the author edits; the author, a team owner or an Admin deletes.
  const commentMenu = (c: Comment): MenuEntry[] => {
    const entries: MenuEntry[] = []
    if (c.authorId === me.id) entries.push({ label: 'Edit comment', icon: <Pencil size={16} />, onSelect: () => setEditing({ id: c.id, text: c.body }) })
    if (c.authorId === me.id || t.ownerIds.includes(me.id) || me.role === 'Admin')
      entries.push({ label: 'Delete comment', icon: <Trash2 size={16} />, danger: true, onSelect: () => deleteComment(c.id) })
    return entries
  }

  const saveEdit = async () => {
    if (!editing || !editing.text.trim()) return
    const original = comments.find((c) => c.id === editing.id)
    if (editing.text.trim() === original?.body || (await editComment(editing.id, editing.text.trim()))) setEditing(null)
  }

  const cycle = db.cycles.find((c) => c.id === issue.cycleId)
  const project = db.projects.find((p) => p.id === issue.projectId)
  const assignee = user(issue.assigneeId)
  const DAY = 86_400_000

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <TeamAvatar team={t} size={16} />
          <Link to={`/team/${t.key}/issues`} className="muted">{t.name}</Link>
          <span className="sep">›</span>
          <span className="mono">{issueKey(issue)}</span>
        </div>
        <span className="spacer" />
        <button className={`icon-btn${issue.favorite ? ' active' : ''}`} aria-label="Favorite" onClick={() => updateIssue(issue.id, { favorite: !issue.favorite })}>
          <Star size={16} fill={issue.favorite ? 'currentColor' : 'none'} />
        </button>
        <button
          className="icon-btn"
          aria-label="More actions"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setContextMenu({ issueId: issue.id, x: r.right - 240, y: r.bottom + 4 })
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      <div className="issue-detail" style={{ minHeight: 0, flex: 1 }}>
        <div className="issue-main">
          <div className="issue-main-inner">
            {parent && (
              <div className="faint">
                Sub-issue of{' '}
                <Link to={`/issue/${parent.id}`} className="muted">
                  <span className="mono">{issueKey(parent)}</span> {parent.title}
                </Link>
              </div>
            )}
            <AIBlock
              title="Summarize this issue"
              collapsible
              {...ai}
              staleCount={staleCount}
              onRegenerate={ai.regenerate}
              generatingLabel="Reading the description and comment thread…"
            />
            <input
              className="issue-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== issue.title && updateIssue(issue.id, { title: title.trim() })}
              aria-label="Issue title"
            />
            <textarea
              className="plain-input"
              style={{ minHeight: 140, resize: 'vertical', lineHeight: '22px' }}
              placeholder="Add description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== issue.description && updateIssue(issue.id, { description })}
            />

            <section>
              <div className="row" style={{ marginBottom: 6 }}>
                <span className="label muted">Sub-issues</span>
                <span className="faint label">{subIssues.length ? `${subIssues.filter((s) => s.status === 'done').length}/${subIssues.length}` : ''}</span>
                <span className="spacer" />
                <button className="btn sm ghost" onClick={() => setNewIssueTeamId(issue.teamId)}>
                  <Plus size={14} /> Add sub-issue
                </button>
              </div>
              {subIssues.map((s) => (
                <div key={s.id} className="issue-row" style={{ paddingLeft: 8 }} onClick={() => navigate(`/issue/${s.id}`)}>
                  <PriorityIcon priority={s.priority} />
                  <span className="id mono">{issueKey(s)}</span>
                  <StatusIcon status={s.status} />
                  <span className="title">{s.title}</span>
                  <Avatar user={user(s.assigneeId)} size={18} />
                </div>
              ))}
            </section>

            <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
              <h3 className="title-md" style={{ fontSize: 14, marginBottom: 12 }}>Activity</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="activity-item faint">
                  <Avatar user={user(db.meId)} size={18} />
                  <span>Issue created · {timeAgo(issue.createdAt)}</span>
                </div>
                {timeline.map((x) => {
                  if (x.kind === 'comment') {
                    const actions = commentMenu(x.c)
                    const isEditing = editing?.id === x.c.id
                    return (
                    <div key={x.c.id} className="activity-item">
                      <Avatar user={user(x.c.authorId)} size={20} />
                      <div className="comment">
                        <div className="row" style={{ marginBottom: 4 }}>
                          <span style={{ fontWeight: 500 }}>{user(x.c.authorId)?.name}</span>
                          <span className="faint" style={{ fontSize: 12 }}>
                            {timeAgo(x.c.createdAt)}
                            {x.c.edited && ' (edited)'}
                          </span>
                          <span className="spacer" />
                          {actions.length > 0 && !isEditing && (
                            <button className="icon-btn" style={{ width: 22, height: 22 }} aria-label="Comment actions" onClick={(e) => openAt(e, actions)}>
                              <MoreHorizontal size={14} />
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <textarea
                              className="plain-input"
                              style={{ resize: 'vertical', minHeight: 48 }}
                              autoFocus
                              aria-label="Edit comment"
                              value={editing.text}
                              onChange={(e) => setEditing({ id: x.c.id, text: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit()
                                if (e.key === 'Escape') setEditing(null)
                              }}
                            />
                            <div className="row" style={{ justifyContent: 'flex-end' }}>
                              <button className="btn sm ghost" onClick={() => setEditing(null)}>Cancel</button>
                              <button className="btn sm" disabled={!editing.text.trim()} onClick={saveEdit}>Save</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{x.c.body}</div>
                        )}
                      </div>
                    </div>
                    )
                  }
                  return (
                    <div key={x.a.id} className="activity-item faint">
                      <Avatar user={user(x.a.actorId)} size={18} />
                      <span>
                        <span className="muted">{user(x.a.actorId)?.name}</span> {x.a.text} · {timeAgo(x.a.createdAt)}
                      </span>
                    </div>
                  )
                })}
                <form
                  className="comment"
                  style={{ marginLeft: 30, display: 'flex', flexDirection: 'column', gap: 8 }}
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!comment.trim() || posting) return
                    setPosting(true)
                    // Keep the text if saving fails, so nothing typed is lost.
                    if (await addComment(issue.id, comment.trim())) setComment('')
                    setPosting(false)
                  }}
                >
                  <textarea
                    className="plain-input"
                    style={{ resize: 'none', minHeight: 48 }}
                    placeholder="Leave a comment…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit()
                    }}
                  />
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn sm" type="submit" disabled={!comment.trim() || posting}>Comment</button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>

        <aside className="props-sidebar">
          <Prop label="Status">
            <button className="prop-btn" onClick={(e) => openAt(e, STATUSES.map((s) => ({ label: s.name, icon: <StatusIcon status={s.id} />, checked: s.id === issue.status, onSelect: () => updateIssue(issue.id, { status: s.id }) })))}>
              <StatusIcon status={issue.status} /> {statusMeta(issue.status).name}
            </button>
          </Prop>
          <Prop label="Priority">
            <button className="prop-btn" onClick={(e) => openAt(e, PRIORITIES.map((p) => ({ label: p.name, icon: <PriorityIcon priority={p.id} />, checked: p.id === issue.priority, onSelect: () => updateIssue(issue.id, { priority: p.id }) })))}>
              <PriorityIcon priority={issue.priority} /> {priorityName(issue.priority)}
            </button>
          </Prop>
          <Prop label="Assignee">
            <button
              className="prop-btn"
              onClick={(e) =>
                openAt(
                  e,
                  [
                    { label: 'No assignee', icon: <Avatar user={null} size={16} />, checked: !issue.assigneeId, onSelect: () => updateIssue(issue.id, { assigneeId: null }) },
                    ...t.memberIds.map((id) => user(id)!).map((m) => ({ label: m.name, icon: <Avatar user={m} size={16} />, checked: m.id === issue.assigneeId, onSelect: () => updateIssue(issue.id, { assigneeId: m.id }) })),
                  ],
                  true,
                )
              }
            >
              <Avatar user={assignee} size={18} /> {assignee?.name ?? <span className="faint">Assign</span>}
            </button>
          </Prop>
          <Prop label="Labels">
            <button
              className="prop-btn"
              style={{ flexWrap: 'wrap', height: 'auto', minHeight: 28, padding: '4px 8px' }}
              onClick={(e) =>
                openAt(e, labelEntries(allLabels(db.issues), issue.labels, (labels) => updateIssue(issue.id, { labels })), true)
              }
            >
              {issue.labels.length ? <IssueLabels issue={issue} /> : <span className="faint row"><Tag size={14} /> Add label</span>}
            </button>
          </Prop>
          {t.cyclesEnabled && (
            <Prop label="Cycle">
              <button
                className="prop-btn"
                onClick={(e) =>
                  openAt(e, [
                    ...cycleOptions(db.cycles.filter((c) => c.teamId === t.id)).map((o) => ({ label: `${o.label}  ${o.dates}`, checked: o.cycle.id === issue.cycleId, onSelect: () => updateIssue(issue.id, { cycleId: o.cycle.id }) })),
                    { kind: 'divider' as const },
                    { label: 'No cycle', checked: !issue.cycleId, onSelect: () => updateIssue(issue.id, { cycleId: null }) },
                  ])
                }
              >
                <Repeat size={14} /> {cycle ? `Cycle ${cycle.number}` : <span className="faint">Add to cycle</span>}
              </button>
            </Prop>
          )}
          <Prop label="Project">
            <button
              className="prop-btn"
              onClick={(e) =>
                openAt(e, [
                  { label: 'No project', checked: !issue.projectId, onSelect: () => updateIssue(issue.id, { projectId: null }) },
                  ...db.projects.filter((p) => p.teamId === t.id).map((p) => ({ label: p.name, checked: p.id === issue.projectId, onSelect: () => updateIssue(issue.id, { projectId: p.id }) })),
                ])
              }
            >
              <FolderKanban size={14} /> {project?.name ?? <span className="faint">Add to project</span>}
            </button>
          </Prop>
          <Prop label="Due date">
            <button
              className="prop-btn"
              onClick={(e) =>
                openAt(e, [
                  { label: 'Today', onSelect: () => updateIssue(issue.id, { dueDate: Date.now() }) },
                  { label: 'Tomorrow', onSelect: () => updateIssue(issue.id, { dueDate: Date.now() + DAY }) },
                  { label: 'In one week', onSelect: () => updateIssue(issue.id, { dueDate: Date.now() + 7 * DAY }) },
                  { kind: 'divider' },
                  { label: 'Remove due date', disabled: !issue.dueDate, onSelect: () => updateIssue(issue.id, { dueDate: null }) },
                ])
              }
            >
              <CalendarDays size={14} />{' '}
              {issue.dueDate ? (
                <span style={{ color: issue.dueDate < Date.now() && issue.status !== 'done' ? 'var(--danger)' : undefined }}>{new Date(issue.dueDate).toLocaleDateString()}</span>
              ) : (
                <span className="faint">Set due date</span>
              )}
            </button>
          </Prop>
        </aside>
      </div>
      {menu && <Menu x={menu.x} y={menu.y} entries={menu.entries} searchable={menu.searchable} onClose={() => setMenu(null)} />}
    </>
  )
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      {children}
    </div>
  )
}
