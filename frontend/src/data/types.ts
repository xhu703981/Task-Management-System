export type Status = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'canceled'
/** 0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low (Linear's ordering) */
export type Priority = 0 | 1 | 2 | 3 | 4
export type Role = 'Admin' | 'Member' | 'Guest'

export interface User {
  id: string
  name: string
  username: string
  email: string
  color: string
  role: Role
  status: 'Active' | 'Invited'
  avatarUrl?: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  color: string
  logo?: string
  defaultTeamId: string
}

export interface Team {
  id: string
  key: string
  name: string
  color: string
  memberIds: string[]
  /** The members whose team role is 'owner'. */
  ownerIds: string[]
  cyclesEnabled: boolean
  cycleLengthWeeks: number
  statuses: { id: Status; name: string }[]
}

export interface Cycle {
  id: string
  teamId: string
  number: number
  start: number
  end: number
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Project {
  id: string
  teamId: string
  name: string
}

export interface Issue {
  id: string
  teamId: string
  number: number
  title: string
  description: string
  status: Status
  priority: Priority
  assigneeId: string | null
  labelIds: string[]
  cycleId: string | null
  projectId: string | null
  parentId: string | null
  dueDate: number | null
  createdAt: number
  updatedAt: number
  completedAt: number | null
  favorite: boolean
  subscribed: boolean
}

export interface Comment {
  id: string
  issueId: string
  authorId: string
  body: string
  createdAt: number
  edited: boolean
}

export interface Activity {
  id: string
  issueId: string
  actorId: string
  text: string
  createdAt: number
}

export interface Integration {
  id: string
  name: string
  description: string
  color: string
  enabled: boolean
}

export interface ApiKey {
  id: string
  label: string
  prefix: string
  createdAt: number
  lastUsed: number | null
}

export interface Webhook {
  id: string
  url: string
  events: string[]
  enabled: boolean
}

export interface Session {
  id: string
  device: string
  location: string
  lastActive: number
  current: boolean
}

export interface ConnectedAccount {
  provider: 'GitHub' | 'GitLab' | 'Google' | 'Slack'
  handle: string | null
}

export interface SecuritySettings {
  allowedDomains: string[]
  ssoEnabled: boolean
  invitePermission: 'admins' | 'members'
}

export interface Toast {
  id: string
  message: string
  undo?: () => void
}

export interface Db {
  meId: string
  workspaces: Workspace[]
  currentWorkspaceId: string
  users: User[]
  teams: Team[]
  cycles: Cycle[]
  labels: Label[]
  projects: Project[]
  issues: Issue[]
  comments: Comment[]
  activity: Activity[]
  integrations: Integration[]
  apiKeys: ApiKey[]
  webhooks: Webhook[]
  sessions: Session[]
  connected: ConnectedAccount[]
  security: SecuritySettings
}
