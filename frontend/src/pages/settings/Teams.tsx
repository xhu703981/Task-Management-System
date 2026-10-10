import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { Avatar, SettingsRow, StatusIcon, TeamAvatar, Toggle } from '../../components/ui'
import { PageHeader } from './Personal'
import { TEAM_COLORS } from '../../data/meta'
import { useStore } from '../../data/store'
import type { Team } from '../../data/types'

const KEY_RE = /^[A-Z0-9]{1,5}$/

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {TEAM_COLORS.map((c) => (
        <button key={c} type="button" aria-label={`Color ${c}`} className={`color-swatch${c === value ? ' selected' : ''}`} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  )
}

export function TeamSettings() {
  const { teamKey } = useParams()
  const { teamByKey } = useStore()
  const team = teamByKey(teamKey ?? '')
  if (!team) return <div className="empty-state">Team not found.</div>
  return <TeamSettingsForm key={team.id} team={team} />
}

function TeamSettingsForm({ team }: { team: Team }) {
  const { db, user, updateTeam, toast } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState(team.name)
  const [key, setKey] = useState(team.key)
  const [addId, setAddId] = useState('')
  const keyTaken = db.teams.some((t) => t.id !== team.id && t.key === key)
  const keyError = !KEY_RE.test(key) ? '1–5 letters or digits' : keyTaken ? 'Identifier already used by another team' : null
  const dirty = name !== team.name || key !== team.key
  const nonMembers = db.users.filter((u) => u.status === 'Active' && !team.memberIds.includes(u.id))

  return (
    <div className="settings-page">
      <div className="row" style={{ gap: 12, marginBottom: 32 }}>
        <TeamAvatar team={team} size={32} />
        <div>
          <h1 className="title-lg">{team.name}</h1>
          <p className="muted" style={{ margin: 0 }}>Team settings</p>
        </div>
      </div>

      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim() || keyError) return
          updateTeam(team.id, { name: name.trim(), key })
          toast('Team updated')
          if (key !== team.key) navigate(`/settings/teams/${key}`, { replace: true })
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Identifier — used in issue IDs ({key || '…'}-123)</span>
          <input className="input mono" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} />
          {keyError && <span className="danger-text label">{keyError}</span>}
        </label>
        <div className="field">
          <span>Icon color</span>
          <ColorPicker value={team.color} onChange={(c) => updateTeam(team.id, { color: c })} />
        </div>
        <div>
          <button className="btn primary" type="submit" disabled={!dirty || !!keyError || !name.trim()}>Save</button>
        </div>
      </form>

      <section className="settings-section">
        <h3>Members · {team.memberIds.length}</h3>
        <div className="card">
          {team.memberIds.map((id) => {
            const u = user(id)
            if (!u) return null
            return (
              <div key={id} className="row" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <Avatar user={u} size={24} />
                <span style={{ flex: 1, fontWeight: 500 }}>{u.name}</span>
                <span className="muted">{u.email}</span>
                <button
                  className="icon-btn"
                  aria-label={`Remove ${u.name}`}
                  disabled={team.memberIds.length === 1}
                  onClick={() => updateTeam(team.id, { memberIds: team.memberIds.filter((m) => m !== id) })}
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
          {nonMembers.length > 0 && (
            <div className="row card-pad">
              <select className="select" value={addId} onChange={(e) => setAddId(e.target.value)} aria-label="Add member">
                <option value="">Add a member…</option>
                {nonMembers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <button
                className="btn"
                disabled={!addId}
                onClick={() => {
                  updateTeam(team.id, { memberIds: [...team.memberIds, addId] })
                  setAddId('')
                }}
              >
                Add
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h3>Workflow statuses</h3>
        <div className="card" style={{ padding: '4px 16px' }}>
          {team.statuses.map((s, i) => (
            <div key={s.id} className="row" style={{ height: 40, borderBottom: i < team.statuses.length - 1 ? '1px solid var(--border-subtle)' : 0 }}>
              <StatusIcon status={s.id} />
              <input
                className="plain-input"
                value={s.name}
                aria-label={`Status name ${s.name}`}
                onChange={(e) => updateTeam(team.id, { statuses: team.statuses.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Cycles</h3>
        <div className="card" style={{ padding: '0 16px' }}>
          <SettingsRow title="Enable cycles" desc="Time-boxed iterations for planning work.">
            <Toggle on={team.cyclesEnabled} label="Enable cycles" onChange={(v) => updateTeam(team.id, { cyclesEnabled: v })} />
          </SettingsRow>
          {team.cyclesEnabled && (
            <SettingsRow title="Cycle length">
              <select className="select" style={{ width: 140 }} value={team.cycleLengthWeeks} onChange={(e) => updateTeam(team.id, { cycleLengthWeeks: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((w) => (
                  <option key={w} value={w}>{w} week{w > 1 ? 's' : ''}</option>
                ))}
              </select>
            </SettingsRow>
          )}
        </div>
      </section>
    </div>
  )
}

const autoKey = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, _, all) => (all.length > 1 ? w[0] : w.slice(0, 3)))
    .join('')
    .slice(0, 5)

export function CreateTeam() {
  const { db, createTeam } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyEdited, setKeyEdited] = useState(false)
  const [color, setColor] = useState(TEAM_COLORS[2])
  const [copyFrom, setCopyFrom] = useState('')
  const effectiveKey = keyEdited ? key : autoKey(name)
  const keyError = !effectiveKey ? null : !KEY_RE.test(effectiveKey) ? '1–5 letters or digits' : db.teams.some((t) => t.key === effectiveKey) ? 'Identifier already in use' : null

  return (
    <div className="settings-page">
      <PageHeader title="Create a team" desc="Teams own their own issues, cycles and workflow." />
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim() || !effectiveKey || keyError) return
          const t = createTeam({ name: name.trim(), key: effectiveKey, color }, copyFrom || null)
          navigate(`/team/${t.key}/issues`)
        }}
      >
        <div className="row" style={{ gap: 12 }}>
          <TeamAvatar team={{ name: name || '?', color }} size={32} />
          <label className="field" style={{ flex: 1 }}>
            <span>Team name</span>
            <input className="input" autoFocus placeholder="e.g. Engineering" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Identifier — used in issue IDs ({effectiveKey || 'ENG'}-123)</span>
          <input
            className="input mono"
            value={effectiveKey}
            onChange={(e) => {
              setKeyEdited(true)
              setKey(e.target.value.toUpperCase())
            }}
          />
          {keyError && <span className="danger-text label">{keyError}</span>}
        </label>
        <div className="field">
          <span>Icon color</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <label className="field">
          <span>Copy settings from</span>
          <select className="select" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
            <option value="">Don’t copy settings</option>
            {db.teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <div className="row">
          <button className="btn primary" type="submit" disabled={!name.trim() || !effectiveKey || !!keyError}>Create team</button>
          <button className="btn ghost" type="button" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
