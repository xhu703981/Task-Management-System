import type { Priority, ProjectStatus, Status } from './types'

export const STATUSES: { id: Status; name: string; color: string }[] = [
  { id: 'backlog', name: 'Backlog', color: 'var(--status-backlog)' },
  { id: 'todo', name: 'Todo', color: 'var(--status-todo)' },
  { id: 'in_progress', name: 'In Progress', color: 'var(--status-in-progress)' },
  { id: 'in_review', name: 'In Review', color: 'var(--status-in-review)' },
  { id: 'done', name: 'Done', color: 'var(--status-done)' },
  { id: 'canceled', name: 'Canceled', color: 'var(--status-canceled)' },
]

export const statusMeta = (id: Status) => STATUSES.find((s) => s.id === id)!

export const PROJECT_STATUSES: { id: ProjectStatus; name: string; color: string }[] = [
  { id: 'planned', name: 'Planned', color: 'var(--status-todo)' },
  { id: 'in_progress', name: 'In Progress', color: 'var(--status-in-progress)' },
  { id: 'completed', name: 'Completed', color: 'var(--status-done)' },
  { id: 'canceled', name: 'Canceled', color: 'var(--status-canceled)' },
]

export const PRIORITIES: { id: Priority; name: string }[] = [
  { id: 1, name: 'Urgent' },
  { id: 2, name: 'High' },
  { id: 3, name: 'Medium' },
  { id: 4, name: 'Low' },
  { id: 0, name: 'No priority' },
]

export const priorityName = (p: Priority) => PRIORITIES.find((x) => x.id === p)!.name

export const TEAM_COLORS = ['#5e6ad2', '#4cb782', '#f2994a', '#eb5757', '#a78bfa', '#26b5ce', '#f2c94c', '#bb87fc']
