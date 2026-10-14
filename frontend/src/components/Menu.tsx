import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, Search } from 'lucide-react'

export type MenuEntry =
  | { kind: 'divider' }
  | { kind: 'label'; label: string }
  /** Hidden until something is typed in the search box; then shows the entry `make` builds from it (if any). */
  | { kind: 'create'; make: (query: string) => MenuEntry | null }
  | {
      kind?: 'item'
      label: string
      icon?: ReactNode
      shortcut?: string[]
      /** e.g. "s", "shift+c", "ctrl+delete", "alt+f" — active while the root menu is open */
      hotkey?: string
      danger?: boolean
      disabled?: boolean
      checked?: boolean
      onSelect?: () => void
      submenu?: { entries: MenuEntry[]; searchable?: boolean; placeholder?: string }
    }

type Item = Extract<MenuEntry, { label: string; kind?: 'item' }>
const isItem = (e: MenuEntry): e is Item => e.kind === undefined || e.kind === 'item'

export function matchesHotkey(e: KeyboardEvent, hotkey: string) {
  const parts = hotkey.toLowerCase().split('+')
  const key = parts.pop()!
  const want = { ctrl: parts.includes('ctrl'), shift: parts.includes('shift'), alt: parts.includes('alt') }
  if (want.ctrl !== (e.ctrlKey || e.metaKey) || want.shift !== e.shiftKey || want.alt !== e.altKey) return false
  // With Alt/Shift held, e.key can be a different character, so fall back to e.code.
  return e.key.toLowerCase() === key || e.code.toLowerCase() === `key${key}`
}

interface Anchor {
  x: number
  y: number
  /** Left edge of the parent item, used to flip a submenu left when it would overflow. */
  flipX?: number
}

interface PanelProps {
  entries: MenuEntry[]
  anchor: Anchor
  onClose: () => void
  searchable?: boolean
  placeholder?: string
  width?: number
  openIndex: number | null
  setOpenIndex: (i: number | null) => void
}

function Panel({ entries, anchor, onClose, searchable, placeholder, width, openIndex, setOpenIndex }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pos, setPos] = useState({ left: anchor.x, top: anchor.y })
  const [query, setQuery] = useState('')
  const [childOpen, setChildOpen] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width: w, height: h } = el.getBoundingClientRect()
    let left = anchor.x
    let top = anchor.y
    if (left + w > window.innerWidth - 8) left = anchor.flipX !== undefined ? anchor.flipX - w - 4 : window.innerWidth - w - 8
    if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8)
    setPos({ left: Math.max(8, left), top })
  }, [anchor.x, anchor.y, anchor.flipX])

  const q = query.trim()
  const visible = entries.flatMap((e): MenuEntry[] => {
    if (e.kind === 'create') {
      const made = q ? e.make(q) : null
      return made ? [made] : []
    }
    return !q || (isItem(e) && e.label.toLowerCase().includes(q.toLowerCase())) ? [e] : []
  })

  const openItem = openIndex !== null ? visible[openIndex] : null
  const openRect = openIndex !== null ? itemRefs.current[openIndex]?.getBoundingClientRect() : undefined

  return (
    <div ref={ref} className="menu" style={{ ...pos, width }} role="menu">
      {searchable && (
        <div className="menu-search row">
          <Search size={14} className="faint" style={{ marginLeft: 8 }} />
          <input autoFocus placeholder={placeholder ?? 'Search…'} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      {visible.map((e, i) => {
        if (e.kind === 'divider') return <div key={i} className="menu-divider" />
        if (e.kind === 'label') return <div key={i} className="menu-label">{e.label}</div>
        if (e.kind === 'create') return null
        return (
          <button
            key={i}
            ref={(el) => (itemRefs.current[i] = el)}
            className={`menu-item${e.danger ? ' danger' : ''}${e.disabled ? ' disabled' : ''}${openIndex === i ? ' open' : ''}`}
            role="menuitem"
            onMouseEnter={() => !e.disabled && setOpenIndex(e.submenu ? i : null)}
            onClick={() => {
              if (e.disabled) return
              if (e.submenu) return setOpenIndex(i)
              e.onSelect?.()
              onClose()
            }}
          >
            {e.icon && <span className="menu-icon">{e.icon}</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
            <span className="shortcut">
              {e.shortcut?.map((k) => <span key={k}>{k}</span>)}
              {e.checked && <Check size={14} color="var(--text-primary)" />}
              {e.submenu && <ChevronRight size={14} />}
            </span>
          </button>
        )
      })}
      {visible.length === 0 && <div className="menu-label">No results</div>}
      {openItem && isItem(openItem) && openItem.submenu && openRect && (
        <Panel
          key={openIndex}
          entries={openItem.submenu.entries}
          searchable={openItem.submenu.searchable}
          placeholder={openItem.submenu.placeholder}
          anchor={{ x: openRect.right + 4, y: openRect.top - 4, flipX: openRect.left }}
          onClose={onClose}
          openIndex={childOpen}
          setOpenIndex={setChildOpen}
        />
      )}
    </div>
  )
}

/** A floating menu with hover submenus, outside-click / Escape to close, and hotkeys. */
export function Menu({
  x,
  y,
  entries,
  onClose,
  width,
  searchable,
  placeholder,
}: {
  x: number
  y: number
  entries: MenuEntry[]
  onClose: () => void
  width?: number
  searchable?: boolean
  placeholder?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (openIndex !== null) setOpenIndex(null)
        else onClose()
        return
      }
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (openIndex !== null) return
      const i = entries.findIndex((en) => isItem(en) && en.hotkey && !en.disabled && matchesHotkey(e, en.hotkey))
      if (i === -1) return
      e.preventDefault()
      e.stopPropagation()
      const entry = entries[i] as Item
      if (entry.submenu) setOpenIndex(i)
      else {
        entry.onSelect?.()
        onClose()
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [entries, onClose, openIndex])

  return createPortal(
    <div ref={wrapRef} onContextMenu={(e) => e.preventDefault()}>
      <Panel
        entries={entries}
        anchor={{ x, y }}
        onClose={onClose}
        width={width}
        searchable={searchable}
        placeholder={placeholder}
        openIndex={openIndex}
        setOpenIndex={setOpenIndex}
      />
    </div>,
    document.body,
  )
}
