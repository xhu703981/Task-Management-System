import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createSeed } from './mock'
import { statusMeta, priorityName, TEAM_COLORS } from './meta'
import * as api from './api'
import type { Db, Issue, Priority, Status, Team, Toast, User } from './types'

let idCounter = 1000
export const newId = (prefix: string) => `${prefix}-${++idCounter}`

type IssuePatch = Partial<Omit<Issue, 'id' | 'teamId' | 'number'>>

/* ---------- Backend → app shapes. Backend ids are numbers; app ids are strings. ---------- */

const toUser = (u: api.ApiUser): User => ({
  id: String(u.id),
  name: u.name,
  username: u.username,
  email: u.email,
  role: u.role,
  color: TEAM_COLORS[u.id % TEAM_COLORS.length],
  status: 'Active',
})

/** The backend has no teams, labels, cycles, etc. yet: those come from the local copy, or defaults. */
const toIssue = (d: Db, a: api.ApiIssue): Issue => {
  const local = d.issues.find((i) => i.id === String(a.id))
  const updatedAt = Date.parse(a.updated_at)
  return {
    teamId: d.workspaces.find((w) => w.id === d.currentWorkspaceId)!.defaultTeamId,
    labelIds: [],
    cycleId: null,
    projectId: null,
    parentId: null,
    dueDate: null,
    favorite: false,
    subscribed: true,
    ...local,
    id: String(a.id),
    number: a.id,
    title: a.title,
    description: a.description,
    status: a.status as Status,
    priority: a.priority as Priority,
    assigneeId: a.assignee_id === null ? null : String(a.assignee_id),
    createdAt: Date.parse(a.created_at),
    updatedAt,
    completedAt: a.status === 'done' ? local?.completedAt ?? updatedAt : null,
  }
}

export interface NewIssueInput {
  teamId: string
  title: string
  description: string
  status: Issue['status']
  priority: Issue['priority']
  assigneeId: string | null
  labelIds: string[]
  cycleId: string | null
}

function useStoreValue() {
  const [db, setDb] = useState<Db>(createSeed)
  const [toasts, setToasts] = useState<Toast[]>([])
  const dbRef = useRef(db)
  dbRef.current = db

  const me = db.users.find((u) => u.id === db.meId)!
  const user = (id: string | null) => (id ? db.users.find((u) => u.id === id) ?? null : null)
  const team = (id: string) => db.teams.find((t) => t.id === id)!
  const teamByKey = (key: string) => db.teams.find((t) => t.key.toLowerCase() === key.toLowerCase())
  const issueKey = (issue: Issue) => `${team(issue.teamId).key}-${issue.number}`

  const dismissToast = useCallback((id: string) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const toast = useCallback(
    (message: string, undo?: () => void) => {
      const id = newId('toast')
      setToasts((ts) => [...ts, { id, message, undo }])
      setTimeout(() => dismissToast(id), 5000)
    },
    [dismissToast],
  )

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
    if ('cycleId' in patch) return patch.cycleId ? 'moved to a cycle' : 'removed from cycle'
    if (patch.labelIds) return 'updated labels'
    if ('dueDate' in patch) return patch.dueDate ? 'set a due date' : 'removed due date'
    if ('projectId' in patch) return patch.projectId ? 'moved to a project' : 'removed from project'
    return null
  }

  /** After login: swap the mock people and issues for the real ones. Every team gets every real user. */
  const loadSession = (me: api.ApiUser, users: api.ApiUser[], issues: api.ApiIssue[]) =>
    setDb((d) => {
      const ids = users.map((u) => String(u.id))
      const next: Db = { ...d, meId: String(me.id), users: users.map(toUser), teams: d.teams.map((t) => ({ ...t, memberIds: ids })), issues: [] }
      return { ...next, issues: issues.map((a) => toIssue(next, a)) }
    })

  const loadIssues = (issues: api.ApiIssue[]) => setDb((d) => ({ ...d, issues: issues.map((a) => toIssue(d, a)) }))

  /** Replace one issue with the backend's copy of it. */
  const putIssue = (a: api.ApiIssue) =>
    setDb((d) => ({ ...d, issues: d.issues.map((i) => (i.id === String(a.id) ? toIssue(d, a) : i)) }))

  /** Change the screen right away, then save to the backend; if the backend says no, undo and show why. */
  const updateIssue = (id: string, patch: IssuePatch) => {
    const before = dbRef.current.issues.find((i) => i.id === id)
    setLocalIssue(id, patch)
    // Only these fields exist on the backend; labels, cycle, favorite, etc. stay in this browser.
    const fields: api.ApiIssueFields = {}
    if (patch.title !== undefined) fields.title = patch.title
    if (patch.description !== undefined) fields.description = patch.description
    if (patch.status !== undefined) fields.status = patch.status
    if (patch.priority !== undefined) fields.priority = patch.priority
    if ('assigneeId' in patch) fields.assignee_id = patch.assigneeId ? Number(patch.assigneeId) : null
    if (!before || Object.keys(fields).length === 0) return
    api
      .updateIssue(Number(id), fields)
      .then(putIssue)
      .catch((err) => {
        setDb((d) => ({ ...d, issues: d.issues.map((i) => (i.id === id ? before : i)) }))
        toast(err.message)
      })
  }

  const setLocalIssue = (id: string, patch: IssuePatch) =>
    setDb((d) => {
      const t = Date.now()
      let next: Db = {
        ...d,
        issues: d.issues.map((i) =>
          i.id === id
            ? {
                ...i,
                ...patch,
                updatedAt: t,
                completedAt: patch.status ? (patch.status === 'done' ? t : null) : i.completedAt,
              }
            : i,
        ),
      }
      const text = describePatch(d, patch)
      if (text) next = logActivity(next, id, text)
      return next
    })

  const deleteIssue = (id: string) => {
    const issue = dbRef.current.issues.find((i) => i.id === id)
    if (!issue) return
    api
      .deleteIssue(Number(id))
      .then(() => {
        setDb((db) => ({ ...db, issues: db.issues.filter((i) => i.id !== id) }))
        toast(`${issueKey(issue)} deleted`)
      })
      .catch((err) => toast(err.message))
  }

  const createIssue = (input: NewIssueInput) => {
    api
      .createIssue({
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        assignee_id: input.assigneeId ? Number(input.assigneeId) : null,
      })
      .then((a) => {
        // Team, labels and cycle aren't on the backend yet, so keep what was picked in this browser.
        setDb((d) => {
          const issue: Issue = { ...toIssue(d, a), teamId: input.teamId, labelIds: input.labelIds, cycleId: input.cycleId }
          return logActivity({ ...d, issues: [issue, ...d.issues] }, issue.id, 'created the issue')
        })
        toast(`${team(input.teamId).key}-${a.id} created`)
      })
      .catch((err) => toast(err.message))
  }

  const addComment = (issueId: string, body: string) =>
    setDb((d) => ({
      ...d,
      comments: [...d.comments, { id: newId('c'), issueId, authorId: d.meId, body, createdAt: Date.now() }],
    }))

  const createTeam = (input: Pick<Team, 'name' | 'key' | 'color'>, copyFromId: string | null): Team => {
    const d = dbRef.current
    const source = copyFromId ? d.teams.find((t) => t.id === copyFromId) : undefined
    const created: Team = {
      id: newId('team'),
      ...input,
      memberIds: [d.meId],
      cyclesEnabled: source?.cyclesEnabled ?? false,
      cycleLengthWeeks: source?.cycleLengthWeeks ?? 2,
      statuses: source ? source.statuses.map((s) => ({ ...s })) : d.teams[0].statuses.map((s) => ({ ...s })),
    }
    setDb((db) => ({ ...db, teams: [...db.teams, created] }))
    toast(`Team "${created.name}" created`)
    return created
  }

  const updateTeam = (id: string, patch: Partial<Team>) =>
    setDb((d) => ({ ...d, teams: d.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))

  const updateUser = (id: string, patch: Partial<User>) =>
    setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))

  const inviteMembers = (emails: string[], role: User['role']) => {
    setDb((d) => ({
      ...d,
      users: [
        ...d.users,
        ...emails
          .filter((e) => !d.users.some((u) => u.email === e))
          .map((email) => ({
            id: newId('u'),
            name: email,
            username: email.split('@')[0],
            email,
            color: '#6b6b73',
            role,
            status: 'Invited' as const,
          })),
      ],
    }))
    toast(emails.length === 1 ? `Invite sent to ${emails[0]}` : `${emails.length} invites sent`)
  }

  const removeMember = (id: string) => {
    setDb((d) => ({
      ...d,
      users: d.users.filter((u) => u.id !== id),
      teams: d.teams.map((t) => ({ ...t, memberIds: t.memberIds.filter((m) => m !== id) })),
    }))
    toast('Member removed')
  }

  return {
    db,
    setDb,
    me,
    user,
    team,
    teamByKey,
    issueKey,
    toasts,
    toast,
    dismissToast,
    loadSession,
    loadIssues,
    updateIssue,
    deleteIssue,
    createIssue,
    addComment,
    createTeam,
    updateTeam,
    updateUser,
    inviteMembers,
    removeMember,
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

function useUiValue() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [newIssueTeamId, setNewIssueTeamId] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  return useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      newIssueTeamId,
      setNewIssueTeamId,
      paletteOpen,
      setPaletteOpen,
      contextMenu,
      setContextMenu,
      confirmDeleteId,
      setConfirmDeleteId,
    }),
    [sidebarCollapsed, newIssueTeamId, paletteOpen, contextMenu, confirmDeleteId],
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
