import {
  Bell, BellOff, CalendarDays, Copy, CopyPlus, ExternalLink, Layers, Plus, Repeat, Star, Tag, Trash2, UserCircle2, Clock, Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Menu, type MenuEntry } from './Menu'
import { allLabels, labelEntries } from './labels'
import { Avatar, IssueTypeIcon, PriorityIcon, StatusIcon, shortDate } from './ui'
import { ISSUE_TYPES, PRIORITIES, STATUSES } from '../data/meta'
import { useStore, useUi } from '../data/store'
import type { Issue, Sprint } from '../data/types'

const DAY = 86_400_000
const endOfDay = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * DAY)
  d.setHours(23, 59, 0, 0)
  return d.getTime()
}

/** Sprints an issue can be planned into: the active one first, then planned ones. Completed sprints are closed. */
export function openSprints(sprints: Sprint[], projectId: string) {
  return sprints
    .filter((s) => s.projectId === projectId && s.status !== 'completed')
    .sort((a, b) => (a.status === b.status ? Number(a.id) - Number(b.id) : a.status === 'active' ? -1 : 1))
}

export const sprintLabel = (s: Sprint) => `${s.name}${s.status === 'active' ? ' · Active' : ''}${s.start && s.end ? `  ${shortDate(s.start)} – ${shortDate(s.end)}` : ''}`

/** Entries for the Sprint submenu / prop: open sprints, then Backlog. */
export function sprintEntries(sprints: Sprint[], projectId: string, current: string | null, onPick: (id: string | null) => void): MenuEntry[] {
  return [
    ...openSprints(sprints, projectId).map((s) => ({ label: sprintLabel(s), icon: <Repeat size={14} />, checked: s.id === current, onSelect: () => onPick(s.id) })),
    { kind: 'divider' as const },
    { label: 'Backlog', icon: <Layers size={14} />, checked: current === null, onSelect: () => onPick(null) },
  ]
}

/** Entries for the Epic submenu / prop: the project's epics, then none. */
export function epicEntries(issues: Issue[], projectId: string, current: string | null, onPick: (id: string | null) => void): MenuEntry[] {
  return [
    ...issues
      .filter((i) => i.projectId === projectId && i.type === 'epic')
      .map((e) => ({ label: `${e.key} ${e.title}`, icon: <Zap size={14} />, checked: e.id === current, onSelect: () => onPick(e.id) })),
    { kind: 'divider' as const },
    { label: 'No epic', checked: current === null, onSelect: () => onPick(null) },
  ]
}

function useIssueEntries(issue: Issue): MenuEntry[] {
  const { db, project, updateIssue, user, toast, createIssue, canWrite } = useStore()
  const { setConfirmDeleteId, setNewIssue } = useUi()
  const navigate = useNavigate()
  const p = project(issue.projectId)
  const members = p.memberIds.map((id) => user(id)!).filter(Boolean)

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    toast(`Copied ${what} to clipboard`)
  }

  const readOnly: MenuEntry[] = [
    {
      label: 'Copy',
      icon: <Copy size={16} />,
      submenu: {
        entries: [
          { label: 'Copy key', shortcut: ['Ctrl', '.'], onSelect: () => copy(issue.key, 'key') },
          { label: 'Copy URL', shortcut: ['Ctrl', '⇧', ','], onSelect: () => copy(`${location.origin}/issue/${issue.key}`, 'URL') },
          { label: 'Copy title', onSelect: () => copy(issue.title, 'title') },
          { label: 'Copy git branch name', onSelect: () => copy(`${issue.key.toLowerCase()}-${issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`, 'branch name') },
        ],
      },
    },
    {
      label: 'Open in',
      icon: <ExternalLink size={16} />,
      submenu: {
        entries: [
          { label: 'Open issue', onSelect: () => navigate(`/issue/${issue.key}`) },
          { label: 'New tab', onSelect: () => window.open(`/issue/${issue.key}`, '_blank') },
        ],
      },
    },
    { kind: 'divider' },
    {
      label: issue.favorite ? 'Unfavorite' : 'Favorite',
      icon: <Star size={16} />,
      shortcut: ['Alt', 'F'],
      hotkey: 'alt+f',
      onSelect: () => {
        updateIssue(issue.id, { favorite: !issue.favorite })
        toast(issue.favorite ? `${issue.key} removed from favorites` : `${issue.key} added to favorites`)
      },
    },
    {
      label: issue.subscribed ? 'Unsubscribe' : 'Subscribe',
      icon: issue.subscribed ? <BellOff size={16} /> : <Bell size={16} />,
      shortcut: ['⇧S'],
      hotkey: 'shift+s',
      onSelect: () => {
        updateIssue(issue.id, { subscribed: !issue.subscribed })
        toast(issue.subscribed ? `Unsubscribed from ${issue.key}` : `Subscribed to ${issue.key}`)
      },
    },
    {
      label: 'Remind me',
      icon: <Clock size={16} />,
      shortcut: ['⇧H'],
      hotkey: 'shift+h',
      submenu: {
        entries: ['In one hour', 'Tomorrow', 'Next week'].map((when) => ({
          label: when,
          onSelect: () => toast(`Reminder set for ${issue.key}: ${when.toLowerCase()}`),
        })),
      },
    },
  ]

  // Viewers can only read; the backend would refuse every edit anyway.
  if (!canWrite(issue.projectId)) return readOnly

  return [
    {
      label: 'Status',
      icon: <StatusIcon status={issue.status} />,
      shortcut: ['S'],
      hotkey: 's',
      submenu: {
        entries: STATUSES.map((s) => ({
          label: s.name,
          icon: <StatusIcon status={s.id} />,
          checked: issue.status === s.id,
          onSelect: () => updateIssue(issue.id, { status: s.id }),
        })),
        searchable: true,
        placeholder: 'Change status…',
      },
    },
    {
      label: 'Priority',
      icon: <PriorityIcon priority={issue.priority} />,
      shortcut: ['P'],
      hotkey: 'p',
      submenu: {
        entries: PRIORITIES.map((pr) => ({
          label: pr.name,
          icon: <PriorityIcon priority={pr.id} />,
          checked: issue.priority === pr.id,
          onSelect: () => updateIssue(issue.id, { priority: pr.id }),
        })),
      },
    },
    {
      label: 'Assignee',
      icon: <UserCircle2 size={16} />,
      shortcut: ['A'],
      hotkey: 'a',
      submenu: {
        searchable: true,
        placeholder: 'Assign to…',
        entries: [
          { label: 'Unassigned', icon: <Avatar user={null} size={16} />, checked: issue.assigneeId === null, onSelect: () => updateIssue(issue.id, { assigneeId: null }) },
          ...members.map((m) => ({
            label: m.name,
            icon: <Avatar user={m} size={16} />,
            checked: issue.assigneeId === m.id,
            onSelect: () => updateIssue(issue.id, { assigneeId: m.id }),
          })),
        ],
      },
    },
    {
      label: 'Type',
      icon: <IssueTypeIcon type={issue.type} />,
      shortcut: ['T'],
      hotkey: 't',
      submenu: {
        entries: ISSUE_TYPES.map((t) => ({
          label: t.name,
          icon: <IssueTypeIcon type={t.id} />,
          checked: issue.type === t.id,
          onSelect: () => updateIssue(issue.id, { type: t.id }),
        })),
      },
    },
    {
      label: 'Labels',
      icon: <Tag size={16} />,
      shortcut: ['L'],
      hotkey: 'l',
      submenu: {
        searchable: true,
        placeholder: 'Add labels…',
        entries: labelEntries(allLabels(db.issues), issue.labels, (labels) => updateIssue(issue.id, { labels })),
      },
    },
    ...(issue.type !== 'epic'
      ? [{
          label: 'Epic',
          icon: <Zap size={16} />,
          shortcut: ['⇧E'],
          hotkey: 'shift+e',
          submenu: { searchable: true, entries: epicEntries(db.issues, issue.projectId, issue.parentId, (parentId) => updateIssue(issue.id, { parentId })) },
        }]
      : []),
    {
      label: 'Sprint',
      icon: <Repeat size={16} />,
      shortcut: ['⇧C'],
      hotkey: 'shift+c',
      submenu: { entries: sprintEntries(db.sprints, issue.projectId, issue.sprintId, (sprintId) => updateIssue(issue.id, { sprintId })) },
    },
    {
      label: 'Due date',
      icon: <CalendarDays size={16} />,
      shortcut: ['⇧D'],
      hotkey: 'shift+d',
      submenu: {
        entries: [
          { label: 'Today', onSelect: () => updateIssue(issue.id, { dueDate: endOfDay(0) }) },
          { label: 'Tomorrow', onSelect: () => updateIssue(issue.id, { dueDate: endOfDay(1) }) },
          { label: 'In one week', onSelect: () => updateIssue(issue.id, { dueDate: endOfDay(7) }) },
          { label: 'In two weeks', onSelect: () => updateIssue(issue.id, { dueDate: endOfDay(14) }) },
          ...(issue.dueDate ? [{ kind: 'divider' as const }, { label: 'Remove due date', onSelect: () => updateIssue(issue.id, { dueDate: null }) }] : []),
        ],
      },
    },
    { kind: 'divider' },
    ...(issue.type === 'epic'
      ? [{ label: 'Add issue to epic…', icon: <Plus size={16} />, onSelect: () => setNewIssue({ projectId: issue.projectId, parentId: issue.id, type: 'story' as const }) }]
      : []),
    {
      label: 'Make a copy…',
      icon: <CopyPlus size={16} />,
      onSelect: () =>
        createIssue({
          projectId: issue.projectId,
          title: `${issue.title} (copy)`,
          description: issue.description,
          type: issue.type,
          status: issue.status,
          priority: issue.priority,
          assigneeId: issue.assigneeId,
          parentId: issue.parentId,
          sprintId: issue.sprintId,
          labels: issue.labels,
          storyPoints: issue.storyPoints,
          dueDate: issue.dueDate,
        }),
    },
    ...readOnly,
    { kind: 'divider' },
    {
      label: 'Delete',
      icon: <Trash2 size={16} />,
      shortcut: ['Ctrl', 'Delete'],
      hotkey: 'ctrl+delete',
      danger: true,
      onSelect: () => setConfirmDeleteId(issue.id),
    },
  ]
}

function IssueContextMenuInner({ issue, x, y }: { issue: Issue; x: number; y: number }) {
  const { setContextMenu } = useUi()
  const entries = useIssueEntries(issue)
  return <Menu x={x} y={y} entries={entries} onClose={() => setContextMenu(null)} width={240} />
}

/** Rendered once at the app root; opened by right-clicking any issue row or card. */
export function IssueContextMenu() {
  const { contextMenu } = useUi()
  const { db } = useStore()
  const issue = contextMenu ? db.issues.find((i) => i.id === contextMenu.issueId) : undefined
  if (!contextMenu || !issue) return null
  return <IssueContextMenuInner issue={issue} x={contextMenu.x} y={contextMenu.y} />
}
