import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createSeed } from './mock'
import { statusMeta, priorityName } from './meta'
import type { Db, Issue, Team, Toast, User } from './types'

let idCounter = 1000
export const newId = (prefix: string) => `${prefix}-${++idCounter}`

type IssuePatch = Partial<Omit<Issue, 'id' | 'teamId' | 'number'>>

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

  const updateIssue = (id: string, patch: IssuePatch) =>
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
    const d = dbRef.current
    const issue = d.issues.find((i) => i.id === id)
    if (!issue) return
    const index = d.issues.indexOf(issue)
    setDb((db) => ({ ...db, issues: db.issues.filter((i) => i.id !== id) }))
    toast(`${issueKey(issue)} deleted`, () =>
      setDb((db) => {
        const issues = [...db.issues]
        issues.splice(index, 0, issue)
        return { ...db, issues }
      }),
    )
  }

  const createIssue = (input: NewIssueInput): Issue => {
    const d = dbRef.current
    const number = Math.max(0, ...d.issues.filter((i) => i.teamId === input.teamId).map((i) => i.number)) + 1
    const t = Date.now()
    const issue: Issue = {
      ...input,
      id: `${input.teamId}-${number}`,
      number,
      projectId: null,
      parentId: null,
      dueDate: null,
      createdAt: t,
      updatedAt: t,
      completedAt: input.status === 'done' ? t : null,
      favorite: false,
      subscribed: true,
    }
    setDb((db) => logActivity({ ...db, issues: [issue, ...db.issues] }, issue.id, 'created the issue'))
    toast(`${team(issue.teamId).key}-${number} created`)
    return issue
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
