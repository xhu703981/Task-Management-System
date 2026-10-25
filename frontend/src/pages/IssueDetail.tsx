import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, MoreHorizontal, Pencil, Plus, Repeat, Reply, Star, Tag, Trash2, Zap } from 'lucide-react'
import { Menu, type MenuEntry } from '../components/Menu'
import { AIBlock, summarizeIssue, useAiSummary } from '../components/AI'
import { IssueLabels } from '../components/IssueRow'
import { allLabels, labelEntries } from '../components/labels'
import { epicEntries, sprintEntries } from '../components/IssueContextMenu'
import { Avatar, IssueTypeIcon, PriorityIcon, ProjectAvatar, StatusIcon, timeAgo } from '../components/ui'
import { ISSUE_TYPES, PRIORITIES, STATUSES, priorityName, statusMeta, typeMeta } from '../data/meta'
import { useStore, useUi } from '../data/store'
import type { Comment, Issue } from '../data/types'

export default function IssueDetail() {
  const { issueKey } = useParams()
  const { issueByKey } = useStore()
  const issue = issueByKey(issueKey ?? '')
  if (!issue)
    return (
      <div className="empty-state">
        <div>This issue doesn’t exist, was deleted, or is in a project you can’t see.</div>
        <Link className="btn" to="/">Back to issues</Link>
      </div>
    )
  return <IssueDetailView key={issue.id} issue={issue} />
}

const dateInput = (t: number | null) => {
  if (t === null) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function IssueDetailView({ issue }: { issue: Issue }) {
  const store = useStore()
  const { db, me, user, project, updateIssue, loadComments, addComment, editComment, deleteComment, canWrite, roleIn } = store
  const { setContextMenu, setNewIssue } = useUi()
  const navigate = useNavigate()
  const p = project(issue.projectId)
  const writable = canWrite(p.id)
  const [title, setTitle] = useState(issue.title)
  const [description, setDescription] = useState(issue.description)
  const [points, setPoints] = useState(String(issue.storyPoints))
  // If the saved issue changes (e.g. the backend refused an edit and it was undone), show the saved values again.
  useEffect(() => setTitle(issue.title), [issue.title])
  useEffect(() => setDescription(issue.description), [issue.description])
  useEffect(() => setPoints(String(issue.storyPoints)), [issue.storyPoints])
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [replying, setReplying] = useState<{ id: string; text: string } | null>(null)
  // This component is remounted per issue (key={issue.id}), so this runs once each time an issue is opened.
  useEffect(() => {
    loadComments(issue.id)
  }, [issue.id])
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[]; searchable?: boolean } | null>(null)

  const comments = db.comments.filter((c) => c.issueId === issue.id).sort((a, b) => a.createdAt - b.createdAt)
  const roots = comments.filter((c) => !c.parentId || !comments.some((x) => x.id === c.parentId))
  const repliesTo = (id: string) => comments.filter((c) => c.parentId === id)
  const children = db.issues.filter((i) => i.parentId === issue.id)
  const epic = db.issues.find((i) => i.id === issue.parentId)
  const sprint = db.sprints.find((s) => s.id === issue.sprintId)
  const activity = db.activity.filter((a) => a.issueId === issue.id).slice().sort((a, b) => a.createdAt - b.createdAt)

  const ai = useAiSummary(() => summarizeIssue(store, issue, comments), issue.id)
  const staleCount = ai.generatedAt && issue.updatedAt > ai.generatedAt ? 1 : 0

  const openAt = (e: React.MouseEvent, entries: MenuEntry[], searchable?: boolean) => {
    if (!writable) return
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({ x: r.left, y: r.bottom + 4, entries, searchable })
  }

  // Same rules as the backend: only the author edits; the author or a project Admin deletes.
  const commentMenu = (c: Comment): MenuEntry[] => {
    const entries: MenuEntry[] = []
    if (c.authorId === me.id) entries.push({ label: 'Edit comment', icon: <Pencil size={16} />, onSelect: () => setEditing({ id: c.id, text: c.body }) })
    if (c.authorId === me.id || roleIn(p.id) === 'Admin') {
      const n = repliesTo(c.id).length
      entries.push({ label: n ? `Delete comment and ${n} repl${n === 1 ? 'y' : 'ies'}` : 'Delete comment', icon: <Trash2 size={16} />, danger: true, onSelect: () => deleteComment(c.id) })
    }
    return entries
  }

  const saveEdit = async () => {
    if (!editing || !editing.text.trim()) return
    const original = comments.find((c) => c.id === editing.id)
    if (editing.text.trim() === original?.body || (await editComment(editing.id, editing.text.trim()))) setEditing(null)
  }

  const saveReply = async () => {
    if (!replying || !replying.text.trim()) return
    if (await addComment(issue.id, replying.text.trim(), replying.id)) setReplying(null)
  }

  const savePoints = () => {
    const n = Math.max(0, Math.floor(Number(points) || 0))
    if (n !== issue.storyPoints) updateIssue(issue.id, { storyPoints: n })
    else setPoints(String(n))
  }

  const assignee = user(issue.assigneeId)
  const reporter = user(issue.reporterId)

  const renderComment = (c: Comment, depth: number) => {
    const actions = commentMenu(c)
    const isEditing = editing?.id === c.id
    const author = user(c.authorId)
    return (
      <div key={c.id} style={{ marginLeft: depth ? 30 : 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="activity-item">
          <Avatar user={author} size={20} />
          <div className="comment">
            <div className="row" style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 500 }}>{author?.name ?? 'Former member'}</span>
              <span className="faint" style={{ fontSize: 12 }}>
                {timeAgo(c.createdAt)}
                {c.edited && ' (edited)'}
              </span>
              <span className="spacer" />
              {writable && !isEditing && (
                <button className="icon-btn" style={{ width: 22, height: 22 }} aria-label="Reply" title="Reply" onClick={() => setReplying({ id: c.id, text: '' })}>
                  <Reply size={14} />
                </button>
              )}
              {actions.length > 0 && !isEditing && (
                <button
                  className="icon-btn"
                  style={{ width: 22, height: 22 }}
                  aria-label="Comment actions"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setMenu({ x: r.left, y: r.bottom + 4, entries: actions })
                  }}
                >
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
                  onChange={(e) => setEditing({ id: c.id, text: e.target.value })}
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
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
            )}
          </div>
        </div>
        {replying?.id === c.id && (
          <div className="comment" style={{ marginLeft: 30, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              className="plain-input"
              style={{ resize: 'none', minHeight: 40 }}
              autoFocus
              aria-label="Reply"
              placeholder={`Reply to ${author?.name ?? 'this comment'}…`}
              value={replying.text}
              onChange={(e) => setReplying({ id: c.id, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveReply()
                if (e.key === 'Escape') setReplying(null)
              }}
            />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn sm ghost" onClick={() => setReplying(null)}>Cancel</button>
              <button className="btn sm" disabled={!replying.text.trim()} onClick={saveReply}>Reply</button>
            </div>
          </div>
        )}
        {repliesTo(c.id).map((r) => renderComment(r, depth + 1))}
      </div>
    )
  }

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <ProjectAvatar project={p} size={16} />
          <Link to={`/project/${p.key}/backlog`} className="muted">{p.name}</Link>
          {epic && (
            <>
              <span className="sep">›</span>
              <Link to={`/issue/${epic.key}`} className="muted row" style={{ gap: 4 }}>
                <IssueTypeIcon type="epic" size={14} /> {epic.key}
              </Link>
            </>
          )}
          <span className="sep">›</span>
          <IssueTypeIcon type={issue.type} size={14} />
          <span className="mono">{issue.key}</span>
          {!writable && <span className="badge-pill">View only</span>}
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
              readOnly={!writable}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title.trim() !== issue.title && updateIssue(issue.id, { title: title.trim() })}
              aria-label="Issue title"
            />
            <textarea
              className="plain-input"
              style={{ minHeight: 140, resize: 'vertical', lineHeight: '22px' }}
              placeholder={writable ? 'Add description…' : 'No description.'}
              readOnly={!writable}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== issue.description && updateIssue(issue.id, { description })}
            />

            {issue.type === 'epic' && (
              <section>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className="label muted">Issues in this epic</span>
                  <span className="faint label">{children.length ? `${children.filter((s) => s.status === 'done').length}/${children.length} done` : ''}</span>
                  <span className="spacer" />
                  {writable && (
                    <button className="btn sm ghost" onClick={() => setNewIssue({ projectId: p.id, parentId: issue.id, type: 'story' })}>
                      <Plus size={14} /> Add issue
                    </button>
                  )}
                </div>
                {children.length === 0 && <div className="faint">No issues yet. Add one, or set the Epic field of an existing issue.</div>}
                {children.map((s) => (
                  <div key={s.id} className="issue-row" style={{ paddingLeft: 8 }} onClick={() => navigate(`/issue/${s.key}`)}>
                    <IssueTypeIcon type={s.type} />
                    <span className="id mono">{s.key}</span>
                    <StatusIcon status={s.status} />
                    <span className="title">{s.title}</span>
                    <PriorityIcon priority={s.priority} />
                    <Avatar user={user(s.assigneeId)} size={18} />
                  </div>
                ))}
              </section>
            )}

            <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
              <h3 className="title-md" style={{ fontSize: 14, marginBottom: 12 }}>Activity</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="activity-item faint">
                  <Avatar user={reporter} size={18} />
                  <span>{reporter?.name ?? 'Someone'} created the issue · {timeAgo(issue.createdAt)}</span>
                </div>
                {activity.map((a) => (
                  <div key={a.id} className="activity-item faint">
                    <Avatar user={user(a.actorId)} size={18} />
                    <span>
                      <span className="muted">{user(a.actorId)?.name}</span> {a.text} · {timeAgo(a.createdAt)}
                    </span>
                  </div>
                ))}
                {roots.map((c) => renderComment(c, 0))}
                {writable ? (
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
                ) : (
                  <div className="faint" style={{ marginLeft: 30 }}>Viewers can read comments but not write them.</div>
                )}
              </div>
            </section>
          </div>
        </div>

        <aside className="props-sidebar">
          <Prop label="Status">
            <button className="prop-btn" disabled={!writable} onClick={(e) => openAt(e, STATUSES.map((s) => ({ label: s.name, icon: <StatusIcon status={s.id} />, checked: s.id === issue.status, onSelect: () => updateIssue(issue.id, { status: s.id }) })))}>
              <StatusIcon status={issue.status} /> {statusMeta(issue.status).name}
            </button>
          </Prop>
          <Prop label="Type">
            <button className="prop-btn" disabled={!writable} onClick={(e) => openAt(e, ISSUE_TYPES.map((t) => ({ label: t.name, icon: <IssueTypeIcon type={t.id} />, checked: t.id === issue.type, onSelect: () => updateIssue(issue.id, { type: t.id }) })))}>
              <IssueTypeIcon type={issue.type} /> {typeMeta(issue.type).name}
            </button>
          </Prop>
          <Prop label="Priority">
            <button className="prop-btn" disabled={!writable} onClick={(e) => openAt(e, PRIORITIES.map((pr) => ({ label: pr.name, icon: <PriorityIcon priority={pr.id} />, checked: pr.id === issue.priority, onSelect: () => updateIssue(issue.id, { priority: pr.id }) })))}>
              <PriorityIcon priority={issue.priority} /> {priorityName(issue.priority)}
            </button>
          </Prop>
          <Prop label="Assignee">
            <button
              className="prop-btn"
              disabled={!writable}
              onClick={(e) =>
                openAt(
                  e,
                  [
                    { label: 'Unassigned', icon: <Avatar user={null} size={16} />, checked: !issue.assigneeId, onSelect: () => updateIssue(issue.id, { assigneeId: null }) },
                    ...p.memberIds.map((id) => user(id)!).filter(Boolean).map((m) => ({ label: m.name, icon: <Avatar user={m} size={16} />, checked: m.id === issue.assigneeId, onSelect: () => updateIssue(issue.id, { assigneeId: m.id }) })),
                  ],
                  true,
                )
              }
            >
              <Avatar user={assignee} size={18} /> {assignee?.name ?? <span className="faint">Unassigned</span>}
            </button>
          </Prop>
          <Prop label="Reporter">
            <span className="prop-btn" style={{ cursor: 'default' }}>
              <Avatar user={reporter} size={18} /> {reporter?.name ?? <span className="faint">Former member</span>}
            </span>
          </Prop>
          {issue.type !== 'epic' && (
            <Prop label="Epic">
              <button className="prop-btn" disabled={!writable} onClick={(e) => openAt(e, epicEntries(db.issues, p.id, issue.parentId, (parentId) => updateIssue(issue.id, { parentId })), true)}>
                <Zap size={14} /> {epic ? epic.title : <span className="faint">No epic</span>}
              </button>
            </Prop>
          )}
          <Prop label="Sprint">
            <button className="prop-btn" disabled={!writable} onClick={(e) => openAt(e, sprintEntries(db.sprints, p.id, issue.sprintId, (sprintId) => updateIssue(issue.id, { sprintId })))}>
              <Repeat size={14} /> {sprint ? sprint.name : <span className="faint">Backlog</span>}
            </button>
          </Prop>
          <Prop label="Story points">
            <input
              className="prop-btn"
              type="number"
              min={0}
              readOnly={!writable}
              aria-label="Story points"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              onBlur={savePoints}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </Prop>
          <Prop label="Labels">
            <button
              className="prop-btn"
              disabled={!writable}
              style={{ flexWrap: 'wrap', height: 'auto', minHeight: 28, padding: '4px 8px' }}
              onClick={(e) => openAt(e, labelEntries(allLabels(db.issues), issue.labels, (labels) => updateIssue(issue.id, { labels })), true)}
            >
              {issue.labels.length ? <IssueLabels issue={issue} /> : <span className="faint row"><Tag size={14} /> Add label</span>}
            </button>
          </Prop>
          <Prop label="Due date">
            <label className="prop-btn" style={{ gap: 6 }}>
              <CalendarDays size={14} />
              <input
                type="date"
                className="date-input"
                readOnly={!writable}
                aria-label="Due date"
                value={dateInput(issue.dueDate)}
                style={{ color: issue.dueDate && issue.dueDate < Date.now() && issue.status !== 'done' ? 'var(--danger)' : undefined }}
                onChange={(e) => {
                  if (!writable) return
                  const v = e.target.value
                  if (!v) return updateIssue(issue.id, { dueDate: null })
                  const [y, m, d] = v.split('-').map(Number)
                  updateIssue(issue.id, { dueDate: new Date(y, m - 1, d, 23, 59).getTime() })
                }}
              />
            </label>
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
