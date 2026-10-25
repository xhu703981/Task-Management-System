import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createSeed } from './mock'
import { COLORS, priorityName, statusMeta, typeMeta } from './meta'
import * as api from './api'
import type { Comment, Db, Issue, IssueType, Priority, Project, ProjectRole, Sprint, Status, Toast, User } from './types'

let idCounter = 1000
export const newId = (prefix: string) => `${prefix}-${++idCounter}`

export type IssuePatch = Partial<Omit<Issue, 'id' | 'key' | 'projectId' | 'number' | 'reporterId'>>

/* ---------- Backend → app shapes. Backend ids are numbers; app ids are strings. ---------- */

const str = (n: number | null) => (n === null ? null : String(n))
const num = (s: string | null | undefined) => (s ? Number(s) : null)
const time = (iso: string | null) => (iso === null ? null : Date.parse(iso))
const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString())

const toUser = (u: api.ApiUser): User => ({
  id: String(u.id),
  name: u.name,
  username: u.username,
  email: u.email,
  role: u.role,
  color: COLORS[u.id % COLORS.length],
})

const toProject = (a: api.ApiProject): Project => ({
  id: String(a.id),
  key: a.key,
  name: a.name,
  description: a.description,
  color: COLORS[a.id % COLORS.length],
  leadId: str(a.lead_id),
  isArchived: a.is_archived,
  issueCount: a.issue_count,
  memberIds: a.members.map((m) => String(m.user_id)),
  roles: Object.fromEntries(a.members.map((m) => [String(m.user_id), m.role])),
})

const toSprint = (a: api.ApiSprint): Sprint => ({
  id: String(a.id),
  projectId: String(a.project_id),
  name: a.name,
  goal: a.goal ?? '',
  status: a.status,
  start: time(a.start_date),
  end: time(a.end_date),
  completedAt: time(a.completed_date),
})

/** Favorite, subscribed and when it was completed aren't on the backend: they come from the local copy. */
const toIssue = (d: Db, a: api.ApiIssue): Issue => {
  const local = d.issues.find((i) => i.id === String(a.id))
  const updatedAt = Date.parse(a.updated_at)
  return {
    favorite: local?.favorite ?? false,
    subscribed: local?.subscribed ?? true,
    id: String(a.id),
    key: a.issue_key,
    projectId: String(a.project_id),
    number: a.number,
    type: a.issue_type,
    parentId: str(a.parent_id),
    title: a.title,
    description: a.description,
    status: a.status as Status,
    priority: a.priority as Priority,
    assigneeId: str(a.assignee_id),
    reporterId: str(a.reporter_id),
    storyPoints: a.story_points,
    sprintId: str(a.sprint_id),
    labels: a.labels,
    dueDate: time(a.due_date),
    createdAt: Date.parse(a.created_at),
    updatedAt,
    completedAt: a.status === 'done' ? local?.completedAt ?? updatedAt : null,
  }
}

const toComment = (a: api.ApiComment): Comment => ({
  id: String(a.id),
  issueId: String(a.issue_id),
  authorId: str(a.author_id),
  parentId: str(a.parent_id),
  body: a.content,
  createdAt: Date.parse(a.created_at),
  edited: a.is_edited,
})

/** The app's issue fields → the backend's (IssueUpdate). Favorite and subscribed stay in this browser. */
function issueFields(patch: IssuePatch): api.ApiIssueFields {
  const f: api.ApiIssueFields = {}
  if (patch.title !== undefined) f.title = patch.title
  if (patch.description !== undefined) f.description = patch.description
  if (patch.type !== undefined) f.issue_type = patch.type
  if (patch.status !== undefined) f.status = patch.status
  if (patch.priority !== undefined) f.priority = patch.priority
  if ('assigneeId' in patch) f.assignee_id = num(patch.assigneeId)
  if ('parentId' in patch) f.parent_id = num(patch.parentId)
  if ('sprintId' in patch) f.sprint_id = num(patch.sprintId)
  if (patch.storyPoints !== undefined) f.story_points = patch.storyPoints
  if (patch.labels !== undefined) f.labels = patch.labels
  if ('dueDate' in patch) f.due_date = iso(patch.dueDate ?? null)
  return f
}

export interface NewIssueInput {
  projectId: string
  title: string
  description: string
  type: IssueType
  status: Status
  priority: Priority
  assigneeId: string | null
  parentId: string | null
  sprintId: string | null
  labels: string[]
  storyPoints: number
  dueDate: number | null
}

export interface SprintInput {
  name: string
  goal: string
  start: number | null
  end: number | null
}

const sprintFields = (s: Partial<SprintInput>): api.ApiSprintFields => {
  const f: api.ApiSprintFields = {}
  if (s.name !== undefined) f.name = s.name
  if (s.goal !== undefined) f.goal = s.goal || null
  if ('start' in s) f.start_date = iso(s.start ?? null)
  if ('end' in s) f.end_date = iso(s.end ?? null)
  return f
}

function useStoreValue() {
  const [db, setDb] = useState<Db>(createSeed)
  const [toasts, setToasts] = useState<Toast[]>([])
  const dbRef = useRef(db)
  dbRef.current = db

  const me = db.users.find((u) => u.id === db.meId)!
  const user = (id: string | null) => (id ? db.users.find((u) => u.id === id) ?? null : null)
  const project = (id: string) => db.projects.find((p) => p.id === id)!
  const projectByKey = (key: string) => db.projects.find((p) => p.key.toLowerCase() === key.toLowerCase())
  const issueKey = (issue: Issue) => issue.key
  const issueByKey = (key: string) => db.issues.find((i) => i.key.toLowerCase() === key.toLowerCase())

  /** My effective role in a project (the same rule as the backend: workspace Admins act as project Admins). */
  const roleIn = (projectId: string): ProjectRole | null =>
    me?.role === 'Admin' ? 'Admin' : db.projects.find((p) => p.id === projectId)?.roles[db.meId] ?? null
  const canWrite = (projectId: string) => ['Admin', 'Member'].includes(roleIn(projectId) ?? '')
  const canManage = (projectId: string) => roleIn(projectId) === 'Admin'

  const dismissToast = useCallback((id: string) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const toast = useCallback(
    (message: string, undo?: () => void) => {
      const id = newId('toast')
      setToasts((ts) => [...ts, { id, message, undo }])
      setTimeout(() => dismissToast(id), 5000)
    },
    [dismissToast],
  )
  const fail = (err: unknown) => {
    toast((err as Error).message)
    return false as const
  }

  const logActivity = (d: Db, issueId: string, text: string): Db => ({
    ...d,
    activity: [{ id: newId('a'), issueId, actorId: d.meId, text, createdAt: Date.now() }, ...d.activity],
  })

  const describePatch = (d: Db, patch: IssuePatch): string | null => {
    if (patch.status) return `changed status to ${statusMeta(patch.status).name}`
    if ('assigneeId' in patch) {
      const u = d.users.find((x) => x.id === patch.assigneeId)
      return u ? `assigned to ${u.name}` : 'removed assignee'
    }
    if (patch.priority !== undefined) return `set priority to ${priorityName(patch.priority)}`
    if (patch.type) return `changed type to ${typeMeta(patch.type).name}`
    if ('sprintId' in patch) return patch.sprintId ? 'moved to a sprint' : 'moved to the backlog'
    if ('parentId' in patch) return patch.parentId ? 'added to an epic' : 'removed from its epic'
    if (patch.labels) return 'updated labels'
    if (patch.storyPoints !== undefined) return `estimated ${patch.storyPoints} points`
    if ('dueDate' in patch) return patch.dueDate ? 'set a due date' : 'removed due date'
    return null
  }

  /* ---------- Loading ---------- */

  /** After login: replace everything with the backend's people, projects, sprints and issues. */
  const loadSession = (me: api.ApiUser, users: api.ApiUser[], projects: api.ApiProject[], sprints: api.ApiSprint[], issues: api.ApiIssue[]) =>
    setDb((d) => {
      const realProjects = projects.map(toProject)
      const ws = d.workspaces.map((w) => ({
        ...w,
        defaultProjectId: realProjects.some((p) => p.id === w.defaultProjectId) ? w.defaultProjectId : realProjects[0]?.id ?? '',
      }))
      // Comments are fetched per issue when its page opens (loadComments), so start with none.
      const next: Db = { ...d, meId: String(me.id), users: users.map(toUser), projects: realProjects, workspaces: ws, sprints: sprints.map(toSprint), comments: [] }
      return { ...next, issues: issues.map((a) => toIssue(d, a)) }
    })

  const loadIssues = (issues: api.ApiIssue[]) => setDb((d) => ({ ...d, issues: issues.map((a) => toIssue(d, a)) }))

  /** Re-fetch issues (and this project's sprints), e.g. after a change that moved many issues at once. */
  const reload = async (projectId?: string) => {
    const [issues, sprints] = await Promise.all([api.getIssues(), projectId ? api.getSprints(Number(projectId)) : Promise.resolve(null)])
    setDb((d) => ({
      ...d,
      issues: issues.map((a) => toIssue(d, a)),
      sprints: sprints ? [...d.sprints.filter((s) => s.projectId !== projectId), ...sprints.map(toSprint)] : d.sprints,
    }))
  }

  const reloadProjects = () =>
    api.getProjects().then((ps) =>
      setDb((d) => {
        const projects = ps.map(toProject)
        const ids = new Set(projects.map((p) => p.id))
        // Projects I can no longer see take their issues and sprints with them.
        return { ...d, projects, issues: d.issues.filter((i) => ids.has(i.projectId)), sprints: d.sprints.filter((s) => ids.has(s.projectId)) }
      }),
    )

  /* ---------- Issues ---------- */

  const putIssue = (a: api.ApiIssue) =>
    setDb((d) => ({ ...d, issues: d.issues.map((i) => (i.id === String(a.id) ? toIssue(d, a) : i)) }))

  const setLocalIssue = (id: string, patch: IssuePatch) =>
    setDb((d) => {
      const t = Date.now()
      let next: Db = {
        ...d,
        issues: d.issues.map((i) =>
          i.id === id
            ? { ...i, ...patch, updatedAt: t, completedAt: patch.status ? (patch.status === 'done' ? t : null) : i.completedAt }
            : i,
        ),
      }
      const text = describePatch(d, patch)
      if (text) next = logActivity(next, id, text)
      return next
    })

  /** Change the screen right away, then save; if the backend says no, undo and show why. */
  const updateIssue = (id: string, patch: IssuePatch) => {
    const before = dbRef.current.issues.find((i) => i.id === id)
    if (!before) return
    setLocalIssue(id, patch)
    const fields = issueFields(patch)
    const keys = Object.keys(fields)
    if (keys.length === 0) return
    const undo = (err: unknown) => {
      setDb((d) => ({ ...d, issues: d.issues.map((i) => (i.id === id ? before : i)) }))
      fail(err)
    }
    // A status-only change (the board's drag and drop) uses the dedicated endpoint.
    if (keys.length === 1 && fields.status)
      api.moveIssueStatus(before.key, fields.status)
        .then((r) => setDb((d) => ({ ...d, issues: d.issues.map((i) => (i.id === id ? { ...i, updatedAt: Date.parse(r.updated_at) } : i)) })))
        .catch(undo)
    else api.updateIssue(before.key, fields).then(putIssue).catch(undo)
  }

  const createIssue = (input: NewIssueInput): Promise<Issue | null> =>
    api
      .createIssue({
        project_id: Number(input.projectId),
        title: input.title,
        description: input.description,
        issue_type: input.type,
        status: input.status,
        priority: input.priority,
        assignee_id: num(input.assigneeId),
        parent_id: num(input.parentId),
        sprint_id: num(input.sprintId),
        story_points: input.storyPoints,
        labels: input.labels,
        due_date: iso(input.dueDate),
      })
      .then((a) => {
        const issue = toIssue(dbRef.current, a)
        setDb((d) => ({
          ...logActivity({ ...d, issues: [issue, ...d.issues] }, issue.id, 'created the issue'),
          projects: d.projects.map((p) => (p.id === issue.projectId ? { ...p, issueCount: p.issueCount + 1 } : p)),
        }))
        toast(`${a.issue_key} created`)
        return issue
      })
      .catch((err) => (fail(err), null))

  /** Mirror the backend: deleting an epic keeps its children (parent → none); comments go with the issue. */
  const removeIssuesLocally = (ids: string[]) =>
    setDb((d) => ({
      ...d,
      issues: d.issues.filter((i) => !ids.includes(i.id)).map((i) => (i.parentId && ids.includes(i.parentId) ? { ...i, parentId: null } : i)),
      comments: d.comments.filter((c) => !ids.includes(c.issueId)),
      projects: d.projects.map((p) => ({ ...p, issueCount: p.issueCount - d.issues.filter((i) => i.projectId === p.id && ids.includes(i.id)).length })),
    }))

  const deleteIssue = (id: string) => {
    const issue = dbRef.current.issues.find((i) => i.id === id)
    if (!issue) return
    api
      .deleteIssue(issue.key)
      .then(() => {
        removeIssuesLocally([id])
        toast(`${issue.key} deleted`)
      })
      .catch(fail)
  }

  /** Same change on many issues; each succeeds or fails on its own (the backend reports per issue). */
  const bulkUpdate = async (ids: string[], patch: Pick<IssuePatch, 'status' | 'priority' | 'assigneeId' | 'sprintId'>) => {
    const keys = dbRef.current.issues.filter((i) => ids.includes(i.id)).map((i) => i.key)
    try {
      const r = await api.bulkUpdateIssues(keys, issueFields(patch))
      await reload()
      const failed = r.results.filter((x) => x.status === 'Failed')
      toast(failed.length ? `${r.summary.success_count} updated; ${failed[0].issue_key}: ${failed[0].error}` : `${r.summary.success_count} issues updated`)
    } catch (err) {
      fail(err)
    }
  }

  /** All or nothing: if any one can't be deleted, none are. */
  const bulkDelete = (ids: string[]) => {
    const keys = dbRef.current.issues.filter((i) => ids.includes(i.id)).map((i) => i.key)
    return api
      .bulkDeleteIssues(keys)
      .then(() => {
        removeIssuesLocally(ids)
        toast(`${keys.length} issues deleted`)
        return true
      })
      .catch(fail)
  }

  /* ---------- Comments ---------- */

  const keyOf = (issueId: string) => dbRef.current.issues.find((i) => i.id === issueId)!.key

  /** Replace this issue's comments with the backend's list. */
  const loadComments = (issueId: string) =>
    api
      .getComments(keyOf(issueId))
      .then((list) => setDb((d) => ({ ...d, comments: [...d.comments.filter((c) => c.issueId !== issueId), ...list.map(toComment)] })))
      .catch(fail)

  /** Resolves to true once saved, so the page only clears the comment box on success. */
  const addComment = (issueId: string, body: string, parentId: string | null = null): Promise<boolean> =>
    api
      .createComment(keyOf(issueId), body, num(parentId))
      .then((a) => {
        setDb((d) => ({ ...d, comments: [...d.comments, toComment(a)] }))
        return true
      })
      .catch(fail)

  /** Resolves to true once saved, so the page only closes the editor on success. */
  const editComment = (id: string, body: string): Promise<boolean> =>
    api
      .updateComment(Number(id), body)
      .then((a) => {
        setDb((d) => ({ ...d, comments: d.comments.map((c) => (c.id === id ? toComment(a) : c)) }))
        return true
      })
      .catch(fail)

  /** The backend deletes the replies too (parent_id ON DELETE CASCADE), all the way down. */
  const deleteComment = (id: string) =>
    api
      .deleteComment(Number(id))
      .then(() => {
        setDb((d) => {
          const gone = new Set([id])
          let grew = true
          while (grew) {
            grew = false
            for (const c of d.comments) if (c.parentId && gone.has(c.parentId) && !gone.has(c.id)) (gone.add(c.id), (grew = true))
          }
          return { ...d, comments: d.comments.filter((c) => !gone.has(c.id)) }
        })
        toast('Comment deleted')
      })
      .catch(fail)

  /* ---------- Projects and members ---------- */

  const putProject = (a: api.ApiProject) => {
    const p = toProject(a)
    setDb((d) => ({ ...d, projects: d.projects.some((x) => x.id === p.id) ? d.projects.map((x) => (x.id === p.id ? p : x)) : [...d.projects, p] }))
    return p
  }

  const createProject = (fields: { name: string; key: string; description: string }): Promise<Project | null> =>
    api
      .createProject(fields)
      .then((a) => {
        toast(`Project ${a.key} created`)
        return putProject(a)
      })
      .catch((err) => (fail(err), null))

  const updateProject = (id: string, fields: Partial<Pick<Project, 'name' | 'description' | 'leadId' | 'isArchived'>>): Promise<boolean> => {
    const f: api.ApiProjectFields = {}
    if (fields.name !== undefined) f.name = fields.name
    if (fields.description !== undefined) f.description = fields.description
    if ('leadId' in fields) f.lead_id = num(fields.leadId)
    if (fields.isArchived !== undefined) f.is_archived = fields.isArchived
    return api
      .updateProject(Number(id), f)
      .then((a) => (putProject(a), true))
      .catch(fail)
  }

  /** The backend deletes the project's issues and sprints with it (ON DELETE CASCADE). */
  const deleteProject = (id: string): Promise<boolean> =>
    api
      .deleteProject(Number(id))
      .then(() => {
        setDb((d) => ({
          ...d,
          projects: d.projects.filter((p) => p.id !== id),
          issues: d.issues.filter((i) => i.projectId !== id),
          sprints: d.sprints.filter((s) => s.projectId !== id),
        }))
        toast('Project deleted')
        return true
      })
      .catch(fail)

  const addMember = (projectId: string, userId: string, role: ProjectRole) =>
    api.addProjectMember(Number(projectId), Number(userId), role).then(putProject).catch(fail)

  const setMemberRole = (projectId: string, userId: string, role: ProjectRole) =>
    api.updateProjectMember(Number(projectId), Number(userId), role).then(putProject).catch(fail)

  /** Removing yourself (leaving) can hide the project from you, so then everything is re-fetched. */
  const removeMember = (projectId: string, userId: string): Promise<boolean> =>
    api
      .removeProjectMember(Number(projectId), Number(userId))
      .then(async () => {
        if (userId === dbRef.current.meId) {
          await reloadProjects()
          toast('You left the project')
        } else {
          await api.getProjects().then((ps) => ps.filter((p) => String(p.id) === projectId).forEach(putProject))
        }
        return true
      })
      .catch(fail)

  /* ---------- Sprints ---------- */

  const putSprint = (a: api.ApiSprint) => {
    const s = toSprint(a)
    setDb((d) => ({ ...d, sprints: d.sprints.some((x) => x.id === s.id) ? d.sprints.map((x) => (x.id === s.id ? s : x)) : [...d.sprints, s] }))
    return s
  }

  const createSprint = (projectId: string, input: SprintInput): Promise<Sprint | null> =>
    api
      .createSprint(Number(projectId), { name: input.name, ...sprintFields(input) })
      .then((a) => {
        toast(`${a.name} created`)
        return putSprint(a)
      })
      .catch((err) => (fail(err), null))

  const updateSprint = (id: string, input: Partial<SprintInput>): Promise<boolean> =>
    api
      .updateSprint(Number(id), sprintFields(input))
      .then((a) => (putSprint(a), true))
      .catch(fail)

  /** Its issues go back to the backlog (sprint_id ON DELETE SET NULL). */
  const deleteSprint = (id: string) =>
    api
      .deleteSprint(Number(id))
      .then(() => {
        setDb((d) => ({
          ...d,
          sprints: d.sprints.filter((s) => s.id !== id),
          issues: d.issues.map((i) => (i.sprintId === id ? { ...i, sprintId: null } : i)),
        }))
        toast('Sprint deleted; its issues are back in the backlog')
      })
      .catch(fail)

  const startSprint = (id: string): Promise<boolean> =>
    api
      .startSprint(Number(id))
      .then((a) => {
        putSprint(a)
        toast(`${a.name} started`)
        return true
      })
      .catch(fail)

  /** Unfinished issues move to the destination sprint (or the backlog) on the backend, so re-fetch after. */
  const completeSprint = (id: string, destinationId: string | null): Promise<boolean> => {
    const sprint = dbRef.current.sprints.find((s) => s.id === id)!
    return api
      .completeSprint(Number(id), num(destinationId))
      .then(async (r) => {
        await reload(sprint.projectId)
        toast(`${sprint.name} completed: ${r.completed_issues} done, ${r.moved_issues} moved`)
        return true
      })
      .catch(fail)
  }

  /* ---------- People ---------- */

  const putUser = (a: api.ApiUser) =>
    setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === String(a.id) ? { ...toUser(a), avatarUrl: u.avatarUrl } : u)) }))

  const updateMe = (fields: { name?: string; username?: string; email?: string }): Promise<boolean> =>
    api
      .updateMe(fields)
      .then((a) => (putUser(a), true))
      .catch(fail)

  const changePassword = (current: string, next: string): Promise<boolean> =>
    api
      .changePassword(current, next)
      .then(() => true)
      .catch(fail)

  const setUserRole = (id: string, role: User['role']) => api.setUserRole(Number(id), role).then(putUser).catch(fail)

  /** Only for things the backend doesn't store (the avatar picture). */
  const updateUser = (id: string, patch: Partial<User>) =>
    setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))

  return {
    db,
    setDb,
    me,
    user,
    project,
    projectByKey,
    issueKey,
    issueByKey,
    roleIn,
    canWrite,
    canManage,
    toasts,
    toast,
    dismissToast,
    loadSession,
    loadIssues,
    reload,
    updateIssue,
    createIssue,
    deleteIssue,
    bulkUpdate,
    bulkDelete,
    loadComments,
    addComment,
    editComment,
    deleteComment,
    createProject,
    updateProject,
    deleteProject,
    addMember,
    setMemberRole,
    removeMember,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint,
    updateMe,
    changePassword,
    setUserRole,
    updateUser,
  }
}

export type Store = ReturnType<typeof useStoreValue>
const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue()
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

/* ---------- UI state: overlays shared across screens ---------- */

export interface ContextMenuState {
  issueId: string
  x: number
  y: number
}

/** What the New issue modal opens with: the project, plus anything the place it was opened from implies. */
export interface NewIssueDraft {
  projectId: string
  type?: IssueType
  parentId?: string | null
  sprintId?: string | null
  status?: Status
}

function useUiValue() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [newIssue, setNewIssue] = useState<NewIssueDraft | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  return useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      newIssue,
      setNewIssue,
      paletteOpen,
      setPaletteOpen,
      contextMenu,
      setContextMenu,
      confirmDeleteId,
      setConfirmDeleteId,
    }),
    [sidebarCollapsed, newIssue, paletteOpen, contextMenu, confirmDeleteId],
  )
}

type Ui = ReturnType<typeof useUiValue>
const UiContext = createContext<Ui | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const value = useUiValue()
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUi() {
  const s = useContext(UiContext)
  if (!s) throw new Error('useUi outside UiProvider')
  return s
}
