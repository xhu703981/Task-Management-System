export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'
/** 1 = Highest, 2 = High, 3 = Medium, 4 = Low, 5 = Lowest (Jira's ordering) */
export type Priority = 1 | 2 | 3 | 4 | 5
export type IssueType = 'task' | 'bug' | 'story' | 'epic'
/** Workspace role: Admins create projects and manage people. */
export type Role = 'Admin' | 'Member'
/** Role inside one project: Admins manage it, Members edit, Viewers only read. */
export type ProjectRole = 'Admin' | 'Member' | 'Viewer'

export interface User {
  id: string
  name: string
  username: string
  email: string
  color: string
  role: Role
  avatarUrl?: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  color: string
  logo?: string
  defaultProjectId: string
}

export interface Project {
  id: string
  /** Prefix of its issue keys (CIM-12). Fixed once the project exists. */
  key: string
  name: string
  description: string
  color: string
  leadId: string | null
  isArchived: boolean
  /** How many issues exist now (from the backend). */
  issueCount: number
  memberIds: string[]
  roles: Record<string, ProjectRole>
}

export type SprintStatus = 'planned' | 'active' | 'completed'

export interface Sprint {
  id: string
  projectId: string
  name: string
  goal: string
  status: SprintStatus
  start: number | null
  end: number | null
  completedAt: number | null
}

export interface Issue {
  id: string
  /** "CIM-12", stored by the backend. */
  key: string
  projectId: string
  number: number
  type: IssueType
  /** The epic this issue belongs to. */
  parentId: string | null
  title: string
  description: string
  status: Status
  priority: Priority
  assigneeId: string | null
  reporterId: string | null
  storyPoints: number
  /** null = in the backlog */
  sprintId: string | null
  /** Free-text labels, at most 5 (see components/labels.tsx). */
  labels: string[]
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
  authorId: string | null
  /** The comment this one replies to. */
  parentId: string | null
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
  projects: Project[]
  sprints: Sprint[]
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
