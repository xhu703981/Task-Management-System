import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Bookmark, Bug, Check, Zap } from 'lucide-react'
import { priorityMeta, statusMeta, typeMeta } from '../data/meta'
import type { IssueType, Priority, Project, Status, User } from '../data/types'

export function StatusIcon({ status, size = 14 }: { status: Status; size?: number }) {
  const c = statusMeta(status).color
  const common = { width: size, height: size, viewBox: '0 0 14 14', fill: 'none' as const }
  switch (status) {
    case 'todo':
      return (
        <svg {...common} aria-label="To Do">
          <circle cx="7" cy="7" r="6" stroke={c} strokeWidth="1.5" />
        </svg>
      )
    case 'in_progress':
    case 'in_review': {
      // Pie fill: half for in progress, three quarters for in review.
      const d = status === 'in_progress' ? 'M7 3.5 A3.5 3.5 0 0 1 7 10.5 Z' : 'M7 3.5 A3.5 3.5 0 1 1 3.5 7 L7 7 Z'
      return (
        <svg {...common} aria-label={statusMeta(status).name}>
          <circle cx="7" cy="7" r="6" stroke={c} strokeWidth="1.5" />
          <path d={d} fill={c} />
        </svg>
      )
    }
    case 'done':
      return (
        <svg {...common} aria-label="Done">
          <circle cx="7" cy="7" r="6.5" fill={c} />
          <path d="M4.4 7.2l1.8 1.8 3.5-3.6" stroke="var(--bg-panel)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

/** Jira-style arrows: two up (Highest), one up, equals (Medium), one down, two down (Lowest). */
export function PriorityIcon({ priority, size = 14 }: { priority: Priority; size?: number }) {
  const { name, color } = priorityMeta(priority)
  const chevron = (y: number, up: boolean) => (
    <path key={y} d={up ? `M3 ${y + 3} L7 ${y} L11 ${y + 3}` : `M3 ${y} L7 ${y + 3} L11 ${y}`} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  )
  const paths =
    priority === 1 ? [chevron(2.5, true), chevron(7, true)]
    : priority === 2 ? [chevron(5, true)]
    : priority === 3 ? [<path key="m" d="M3 5h8M3 9h8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />]
    : priority === 4 ? [chevron(5, false)]
    : [chevron(2.5, false), chevron(7, false)]
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-label={name}>
      <title>{name}</title>
      {paths}
    </svg>
  )
}

const TYPE_ICONS = { task: Check, bug: Bug, story: Bookmark, epic: Zap }

export function IssueTypeIcon({ type, size = 14 }: { type: IssueType; size?: number }) {
  const Icon = TYPE_ICONS[type]
  const { name, color } = typeMeta(type)
  return (
    <span className="type-icon" style={{ width: size, height: size, background: color }} title={name} aria-label={name}>
      <Icon size={size - 4} strokeWidth={3} />
    </span>
  )
}

export const initials = (name: string) => {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase()
}

export function Avatar({ user, size = 20 }: { user: User | null; size?: number }) {
  if (!user)
    return (
      <span className="avatar empty" style={{ width: size, height: size }} title="No assignee">
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 10 10">
          <circle cx="5" cy="3.5" r="2" fill="currentColor" />
          <path d="M1.5 9.5a3.5 3.5 0 017 0" fill="currentColor" />
        </svg>
      </span>
    )
  if (user.avatarUrl)
    return <img className="avatar" src={user.avatarUrl} alt={user.name} title={user.name} style={{ width: size, height: size, objectFit: 'cover' }} />
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: user.color, fontSize: Math.max(8, size * 0.42) }}
      title={user.name}
    >
      {initials(user.name)}
    </span>
  )
}

export function ProjectAvatar({ project, size = 18 }: { project: Pick<Project, 'name' | 'color'>; size?: number }) {
  return (
    <span
      className="avatar square"
      style={{ width: size, height: size, background: project.color, fontSize: Math.max(8, size * 0.45) }}
    >
      {project.name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)} />
}

export function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="shortcut">
      {keys.map((k, i) => (
        <span key={i}>{k}</span>
      ))}
    </span>
  )
}

export function SettingsRow({ title, desc, children }: { title: ReactNode; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="text">
        <div style={{ fontWeight: 500 }}>{title}</div>
        {desc && <div className="desc">{desc}</div>}
      </div>
      {children && <div className="control">{children}</div>}
    </div>
  )
}

export function Modal({ onClose, width, children }: { onClose: () => void; width: number; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }} role="dialog">
        {children}
      </div>
    </div>,
    document.body,
  )
}

const MIN = 60_000
export function timeAgo(t: number) {
  const diff = Date.now() - t
  if (diff < MIN) return 'just now'
  if (diff < 60 * MIN) return `${Math.floor(diff / MIN)}m ago`
  if (diff < 24 * 60 * MIN) return `${Math.floor(diff / (60 * MIN))}h ago`
  const d = Math.floor(diff / (24 * 60 * MIN))
  return d < 30 ? `${d}d ago` : new Date(t).toLocaleDateString()
}

export const shortDate = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
