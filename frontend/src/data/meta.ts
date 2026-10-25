import type { IssueType, Priority, ProjectRole, SprintStatus, Status } from './types'

export const STATUSES: { id: Status; name: string; color: string }[] = [
  { id: 'todo', name: 'To Do', color: 'var(--status-todo)' },
  { id: 'in_progress', name: 'In Progress', color: 'var(--status-in-progress)' },
  { id: 'in_review', name: 'In Review', color: 'var(--status-in-review)' },
  { id: 'done', name: 'Done', color: 'var(--status-done)' },
]

export const statusMeta = (id: Status) => STATUSES.find((s) => s.id === id)!

export const PRIORITIES: { id: Priority; name: string; color: string }[] = [
  { id: 1, name: 'Highest', color: 'var(--danger)' },
  { id: 2, name: 'High', color: 'var(--priority-urgent)' },
  { id: 3, name: 'Medium', color: 'var(--warning)' },
  { id: 4, name: 'Low', color: 'var(--status-in-review)' },
  { id: 5, name: 'Lowest', color: 'var(--accent)' },
]

export const priorityMeta = (p: Priority) => PRIORITIES.find((x) => x.id === p)!
export const priorityName = (p: Priority) => priorityMeta(p).name

export const ISSUE_TYPES: { id: IssueType; name: string; color: string }[] = [
  { id: 'task', name: 'Task', color: '#4b9fea' },
  { id: 'bug', name: 'Bug', color: '#eb5757' },
  { id: 'story', name: 'Story', color: '#4cb782' },
  { id: 'epic', name: 'Epic', color: '#a78bfa' },
]

export const typeMeta = (t: IssueType) => ISSUE_TYPES.find((x) => x.id === t)!

export const SPRINT_STATUSES: Record<SprintStatus, string> = { planned: 'Planned', active: 'Active', completed: 'Completed' }

export const PROJECT_ROLES: { id: ProjectRole; desc: string }[] = [
  { id: 'Admin', desc: 'Manages settings, members and sprints' },
  { id: 'Member', desc: 'Creates and edits issues, comments and sprints' },
  { id: 'Viewer', desc: 'Can only read' },
]

export const COLORS = ['#5e6ad2', '#4cb782', '#f2994a', '#eb5757', '#a78bfa', '#26b5ce', '#f2c94c', '#bb87fc']
