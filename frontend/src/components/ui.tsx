import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { statusMeta } from '../data/meta'
import type { Priority, Status, Team, User } from '../data/types'

export function StatusIcon({ status, size = 14 }: { status: Status; size?: number }) {
  const c = statusMeta(status).color
  const r = 6
  const common = { width: size, height: size, viewBox: '0 0 14 14', fill: 'none' as const }
  switch (status) {
    case 'backlog':
      return (
        <svg {...common} aria-label="Backlog">
          <circle cx="7" cy="7" r={r} stroke={c} strokeWidth="1.5" strokeDasharray="1.4 1.6" />
        </svg>
      )
    case 'todo':
      return (
        <svg {...common} aria-label="Todo">
          <circle cx="7" cy="7" r={r} stroke={c} strokeWidth="1.5" />
        </svg>
      )
    case 'in_progress':
    case 'in_review': {
      // Pie fill: half for in progress, three quarters for in review.
      const d = status === 'in_progress' ? 'M7 3.5 A3.5 3.5 0 0 1 7 10.5 Z' : 'M7 3.5 A3.5 3.5 0 1 1 3.5 7 L7 7 Z'
      return (
        <svg {...common} aria-label={statusMeta(status).name}>
          <circle cx="7" cy="7" r={r} stroke={c} strokeWidth="1.5" />
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
    case 'canceled':
      return (
        <svg {...common} aria-label="Canceled">
          <circle cx="7" cy="7" r="6.5" fill={c} />
          <path d="M5 5l4 4M9 5l-4 4" stroke="var(--bg-panel)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
  }
}

export function PriorityIcon({ priority, size = 14 }: { priority: Priority; size?: number }) {
  if (priority === 0)
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" aria-label="No priority">
        {[2, 6, 10].map((x) => (
          <rect key={x} x={x - 0.75} y="6.25" width="2" height="1.5" rx="0.5" fill="var(--text-tertiary)" />
        ))}
      </svg>
    )
  if (priority === 1)
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" aria-label="Urgent">
        <rect x="1" y="1" width="12" height="12" rx="3" fill="var(--priority-urgent)" />
        <path d="M7 3.8v4" stroke="var(--bg-panel)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="7" cy="10" r="0.9" fill="var(--bg-panel)" />
      </svg>
    )
  const active = 5 - priority // high=3 bars, medium=2, low=1
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-label={['', '', 'High', 'Medium', 'Low'][priority]}>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1.5 + i * 4}
          y={9 - i * 3}
          width="3"
          height={3 + i * 3}
          rx="1"
          fill={i < active ? 'var(--text-secondary)' : 'var(--bg-selected)'}
        />
      ))}
    </svg>
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

export function TeamAvatar({ team, size = 18 }: { team: Pick<Team, 'name' | 'color'>; size?: number }) {
  return (
    <span
      className="avatar square"
      style={{ width: size, height: size, background: team.color, fontSize: Math.max(8, size * 0.45) }}
    >
      {team.name.trim()[0] ?? '?'}
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
