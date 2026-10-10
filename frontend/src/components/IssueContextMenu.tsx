import {
  Bell, BellOff, CalendarDays, Copy, CopyPlus, ExternalLink, FolderKanban, GitBranch, Link2,
  ListPlus, Repeat, Star, Tag, Trash2, CheckCircle2, UserCircle2, Clock,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Menu, type MenuEntry } from './Menu'
import { Avatar, PriorityIcon, StatusIcon, shortDate } from './ui'
import { PRIORITIES, STATUSES } from '../data/meta'
import { useStore, useUi } from '../data/store'
import type { Issue } from '../data/types'

const DAY = 86_400_000
const endOfDay = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * DAY)
  d.setHours(23, 59, 0, 0)
  return d.getTime()
}

export function cycleOptions(cycles: { id: string; number: number; start: number; end: number }[]) {
  const now = Date.now()
  const sorted = [...cycles].sort((a, b) => a.start - b.start)
  const currentIdx = sorted.findIndex((c) => c.start <= now && now < c.end)
  return sorted
    .filter((c) => c.end > now)
    .map((c) => {
      const idx = sorted.indexOf(c)
      const tag = idx === currentIdx ? 'Current' : idx === currentIdx + 1 ? 'Next' : 'Upcoming'
      return { cycle: c, label: `Cycle ${c.number} · ${tag}`, dates: `${shortDate(c.start)} – ${shortDate(c.end)}` }
    })
}

function useIssueEntries(issue: Issue): MenuEntry[] {
  const { db, updateIssue, user, issueKey, toast, createIssue } = useStore()
  const { setConfirmDeleteId, setNewIssueTeamId } = useUi()
  const navigate = useNavigate()
  const team = db.teams.find((t) => t.id === issue.teamId)!
  const members = team.memberIds.map((id) => user(id)!).filter(Boolean)
  const key = issueKey(issue)

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    toast(`Copied ${what} to clipboard`)
  }

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
        entries: PRIORITIES.map((p) => ({
          label: p.name,
          icon: <PriorityIcon priority={p.id} />,
          checked: issue.priority === p.id,
          onSelect: () => updateIssue(issue.id, { priority: p.id }),
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
          { label: 'No assignee', icon: <Avatar user={null} size={16} />, checked: issue.assigneeId === null, onSelect: () => updateIssue(issue.id, { assigneeId: null }) },
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
    {
      label: 'Labels',
      icon: <Tag size={16} />,
      shortcut: ['L'],
      hotkey: 'l',
      submenu: {
        searchable: true,
        placeholder: 'Add labels…',
        entries: db.labels.map((l) => {
          const has = issue.labelIds.includes(l.id)
          return {
            label: l.name,
            icon: <span style={{ width: 8, height: 8, borderRadius: 4, background: l.color, display: 'inline-block' }} />,
            checked: has,
            onSelect: () => updateIssue(issue.id, { labelIds: has ? issue.labelIds.filter((x) => x !== l.id) : [...issue.labelIds, l.id] }),
          }
        }),
      },
    },
    {
      label: 'Project',
      icon: <FolderKanban size={16} />,
      shortcut: ['⇧P'],
      hotkey: 'shift+p',
      submenu: {
        entries: [
          { label: 'No project', checked: !issue.projectId, onSelect: () => updateIssue(issue.id, { projectId: null }) },
          ...db.projects
            .filter((p) => p.teamId === issue.teamId)
            .map((p) => ({ label: p.name, icon: <FolderKanban size={14} />, checked: issue.projectId === p.id, onSelect: () => updateIssue(issue.id, { projectId: p.id }) })),
        ],
      },
    },
    ...(team.cyclesEnabled ? [{
      label: 'Cycle',
      icon: <Repeat size={16} />,
      shortcut: ['⇧C'],
      hotkey: 'shift+c',
      submenu: {
        entries: [
          ...cycleOptions(db.cycles.filter((c) => c.teamId === issue.teamId)).map((o) => ({
            label: `${o.label}  ${o.dates}`,
            icon: <Repeat size={14} />,
            checked: issue.cycleId === o.cycle.id,
            onSelect: () => updateIssue(issue.id, { cycleId: o.cycle.id }),
          })),
          { kind: 'divider' as const },
          { label: 'No cycle', checked: issue.cycleId === null, onSelect: () => updateIssue(issue.id, { cycleId: null }) },
        ],
      },
    }] : []),
    { kind: 'divider' },
    {
      label: 'Create related',
      icon: <ListPlus size={16} />,
      submenu: {
        entries: [
          { label: 'Sub-issue', icon: <GitBranch size={14} />, onSelect: () => setNewIssueTeamId(issue.teamId) },
          { label: 'Related issue', icon: <Link2 size={14} />, onSelect: () => setNewIssueTeamId(issue.teamId) },
        ],
      },
    },
    {
      label: 'Mark as',
      icon: <CheckCircle2 size={16} />,
      submenu: {
        entries: [
          { label: 'Completed', icon: <StatusIcon status="done" />, onSelect: () => updateIssue(issue.id, { status: 'done' }) },
          { label: 'Canceled', icon: <StatusIcon status="canceled" />, onSelect: () => updateIssue(issue.id, { status: 'canceled' }) },
        ],
      },
    },
    { kind: 'divider' },
    {
      label: 'Copy',
      icon: <Copy size={16} />,
      submenu: {
        entries: [
          { label: 'Copy ID', shortcut: ['Ctrl', '.'], onSelect: () => copy(key, 'ID') },
          { label: 'Copy URL', shortcut: ['Ctrl', '⇧', ','], onSelect: () => copy(`${location.origin}/issue/${issue.id}`, 'URL') },
          { label: 'Copy title', onSelect: () => copy(issue.title, 'title') },
          { label: 'Copy git branch name', onSelect: () => copy(`${key.toLowerCase()}-${issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`, 'branch name') },
        ],
      },
    },
    {
      label: 'Make a copy…',
      icon: <CopyPlus size={16} />,
      onSelect: () =>
        createIssue({
          teamId: issue.teamId,
          title: `${issue.title} (copy)`,
          description: issue.description,
          status: issue.status,
          priority: issue.priority,
          assigneeId: issue.assigneeId,
          labelIds: issue.labelIds,
          cycleId: issue.cycleId,
        }),
    },
    {
      label: 'Open in',
      icon: <ExternalLink size={16} />,
      submenu: {
        entries: [
          { label: 'Open issue', onSelect: () => navigate(`/issue/${issue.id}`) },
          { label: 'New tab', onSelect: () => window.open(`/issue/${issue.id}`, '_blank') },
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
        toast(issue.favorite ? `${key} removed from favorites` : `${key} added to favorites`)
      },
    },
    {
      label: issue.subscribed ? 'Unsubscribe' : 'Subscribe',
      icon: issue.subscribed ? <BellOff size={16} /> : <Bell size={16} />,
      shortcut: ['⇧S'],
      hotkey: 'shift+s',
      onSelect: () => {
        updateIssue(issue.id, { subscribed: !issue.subscribed })
        toast(issue.subscribed ? `Unsubscribed from ${key}` : `Subscribed to ${key}`)
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
          onSelect: () => toast(`Reminder set for ${key}: ${when.toLowerCase()}`),
        })),
      },
    },
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
