import { Plus } from 'lucide-react'
import type { MenuEntry } from './Menu'
import { TEAM_COLORS } from '../data/meta'
import type { Issue } from '../data/types'

// Labels are free text on each issue (the backend merges "Bug"/"bug" within an issue, max 5, 32 chars each).
export const MAX_LABELS = 5
const MAX_LABEL_LENGTH = 32

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Labels have no stored color, so one is picked from the name: "Bug" and "bug" always get the same color. */
export function labelColor(name: string) {
  let h = 0
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TEAM_COLORS[h % TEAM_COLORS.length]
}

export const LabelDot = ({ name }: { name: string }) => (
  <span style={{ width: 8, height: 8, borderRadius: 4, background: labelColor(name), display: 'inline-block', flexShrink: 0 }} />
)

/** Every label used on these issues, once each ignoring case (the first spelling seen wins), A–Z. */
export function allLabels(issues: Issue[]): string[] {
  const found: string[] = []
  for (const issue of issues) for (const l of issue.labels) if (!found.some((f) => same(f, l))) found.push(l)
  return found.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/** Menu entries that toggle labels on `current`, plus "Create label" for a typed name nobody has used yet. */
export function labelEntries(known: string[], current: string[], onChange: (next: string[]) => void): MenuEntry[] {
  const full = current.length >= MAX_LABELS
  const names = [...known, ...current.filter((c) => !known.some((k) => same(k, c)))]
  return [
    ...names.map((name) => {
      const has = current.some((c) => same(c, name))
      return {
        label: name,
        icon: <LabelDot name={name} />,
        checked: has,
        disabled: !has && full,
        onSelect: () => onChange(has ? current.filter((c) => !same(c, name)) : [...current, name]),
      }
    }),
    {
      kind: 'create',
      make: (query) => {
        if (names.some((n) => same(n, query))) return null // already listed above
        if (query.length > MAX_LABEL_LENGTH) return { label: `Labels can be at most ${MAX_LABEL_LENGTH} characters`, disabled: true }
        if (full) return { label: `An issue can have at most ${MAX_LABELS} labels`, disabled: true }
        return { label: `Create label "${query}"`, icon: <Plus size={14} />, onSelect: () => onChange([...current, query]) }
      },
    },
  ]
}
