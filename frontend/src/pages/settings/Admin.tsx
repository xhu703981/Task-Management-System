import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreHorizontal, Plus, Trash2, X } from 'lucide-react'
import { Menu } from '../../components/Menu'
import { Avatar, Modal, SettingsRow, TeamAvatar, Toggle, initials } from '../../components/ui'
import { ApiKeysSection, PageHeader } from './Personal'
import { newId, useStore } from '../../data/store'
import type { Role } from '../../data/types'

/* ---------- Workspace ---------- */

export function WorkspaceSettings() {
  const { db, setDb, toast } = useStore()
  const ws = db.workspaces.find((w) => w.id === db.currentWorkspaceId)!
  const [name, setName] = useState(ws.name)
  const [slug, setSlug] = useState(ws.slug)
  const [defaultTeamId, setDefaultTeamId] = useState(ws.defaultTeamId)
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const dirty = name !== ws.name || slug !== ws.slug || defaultTeamId !== ws.defaultTeamId
  const update = (patch: Partial<typeof ws>) => setDb((d) => ({ ...d, workspaces: d.workspaces.map((w) => (w.id === ws.id ? { ...w, ...patch } : w)) }))

  return (
    <div className="settings-page">
      <PageHeader title="Workspace" desc="Manage your workspace settings." />
      <div className="row" style={{ gap: 16, marginBottom: 24 }}>
        {ws.logo ? (
          <img src={ws.logo} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
        ) : (
          <span className="avatar square" style={{ width: 64, height: 64, background: ws.color, fontSize: 24, borderRadius: 12 }}>{initials(ws.name)}</span>
        )}
        <button className="btn sm" onClick={() => fileRef.current?.click()}>Upload logo</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const r = new FileReader()
            r.onload = () => update({ logo: String(r.result) })
            r.readAsDataURL(f)
          }}
        />
      </div>
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim() || !slug.trim()) return
          update({ name: name.trim(), slug: slug.trim(), defaultTeamId })
          toast('Workspace updated')
        }}
      >
        <label className="field">
          <span>Workspace name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Workspace URL</span>
          <div className="row" style={{ gap: 0 }}>
            <span className="input" style={{ width: 'auto', borderRight: 0, borderRadius: '6px 0 0 6px', display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>linear.app/</span>
            <input className="input" style={{ borderRadius: '0 6px 6px 0' }} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
          </div>
        </label>
        <label className="field">
          <span>Default team for new members</span>
          <select className="select" value={defaultTeamId} onChange={(e) => setDefaultTeamId(e.target.value)}>
            {db.teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <div>
          <button className="btn primary" type="submit" disabled={!dirty}>Save</button>
        </div>
      </form>

      <section className="settings-section">
        <h3 className="danger-text">Danger zone</h3>
        <div className="card danger-zone" style={{ padding: '0 16px' }}>
          <SettingsRow title="Delete workspace" desc="Permanently delete this workspace, its teams and all issues.">
            <button className="btn sm danger-outline" onClick={() => setConfirm(true)}>
              <Trash2 size={14} /> Delete workspace
            </button>
          </SettingsRow>
        </div>
      </section>

      {confirm && (
        <Modal onClose={() => setConfirm(false)} width={440}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="title-md">Delete {ws.name}?</h2>
            <p className="muted" style={{ margin: 0 }}>This can’t be undone. Type <b>{ws.name}</b> to confirm.</p>
            <input className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
            <button
              className="btn danger"
              disabled={typed !== ws.name}
              onClick={() => {
                setConfirm(false)
                setTyped('')
                toast('Workspace deletion is disabled in this demo')
              }}
            >
              Delete workspace
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ---------- Teams ---------- */

export function TeamsSettings() {
  const { db, me } = useStore()
  const navigate = useNavigate()
  return (
    <div className="settings-page">
      <div className="row" style={{ marginBottom: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h1 className="title-lg">Teams</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>Teams in this workspace.</p>
        </div>
        <button className="btn primary sm" onClick={() => navigate('/settings/new-team')}>
          <Plus size={14} /> Create team
        </button>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Identifier</th><th>Members</th><th>Your role</th></tr>
          </thead>
          <tbody>
            {db.teams.map((t) => (
              <tr key={t.id} className="clickable" onClick={() => navigate(`/settings/teams/${t.key}`)}>
                <td>
                  <span className="row">
                    <TeamAvatar team={t} size={20} /> <span style={{ fontWeight: 500 }}>{t.name}</span>
                  </span>
                </td>
                <td className="mono muted">{t.key}</td>
                <td className="muted">{t.memberIds.length}</td>
                <td className="muted">{t.memberIds.includes(me.id) ? (me.role === 'Admin' ? 'Admin' : 'Member') : 'Not a member'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- Members ---------- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function MembersSettings() {
  const { db, me, updateUser, inviteMembers, removeMember } = useStore()
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<Role>('Member')
  const [query, setQuery] = useState('')
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const parsed = emails.split(/[\s,;]+/).filter(Boolean)
  const invalid = parsed.filter((e) => !EMAIL.test(e))
  const q = query.toLowerCase()
  const users = db.users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))

  return (
    <div className="settings-page" style={{ maxWidth: 760 }}>
      <PageHeader title="Members" desc="Invite people to the workspace and manage their roles." />
      <form
        className="card card-pad"
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!parsed.length || invalid.length) return
          inviteMembers(parsed, role)
          setEmails('')
        }}
      >
        <span className="label muted">Invite by email</span>
        <div className="row">
          <input className="input" placeholder="email@example.com, another@example.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
          <select className="select" style={{ width: 120 }} value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
            <option>Admin</option>
            <option>Member</option>
            <option>Guest</option>
          </select>
          <button className="btn primary" type="submit" disabled={!parsed.length || invalid.length > 0}>Invite</button>
        </div>
        {invalid.length > 0 && <span className="danger-text label">Not a valid email: {invalid.join(', ')}</span>}
      </form>

      <div className="row" style={{ margin: '24px 0 8px' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, flex: 1 }}>{db.users.length} members</h3>
        <input className="input" style={{ width: 220, height: 28 }} placeholder="Search members" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="row">
                    <Avatar user={u} size={24} /> <span style={{ fontWeight: 500 }}>{u.name}</span>
                    {u.id === me.id && <span className="faint">(you)</span>}
                  </span>
                </td>
                <td className="muted">{u.email}</td>
                <td>
                  <select
                    className="select"
                    style={{ height: 28, width: 110 }}
                    value={u.role}
                    disabled={u.id === me.id}
                    onChange={(e) => updateUser(u.id, { role: e.target.value as Role })}
                    aria-label={`Role for ${u.name}`}
                  >
                    <option>Admin</option>
                    <option>Member</option>
                    <option>Guest</option>
                  </select>
                </td>
                <td>
                  <span className={`badge-pill${u.status === 'Active' ? ' green' : ' amber'}`}>{u.status}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {u.id !== me.id && (
                    <button
                      className="icon-btn"
                      aria-label={`Actions for ${u.name}`}
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect()
                        setRowMenu({ id: u.id, x: r.right - 200, y: r.bottom + 4 })
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rowMenu && (
        <Menu
          x={rowMenu.x}
          y={rowMenu.y}
          width={200}
          onClose={() => setRowMenu(null)}
          entries={[
            ...(db.users.find((u) => u.id === rowMenu.id)?.status === 'Invited'
              ? [{ label: 'Resend invite', onSelect: () => inviteMembers([db.users.find((u) => u.id === rowMenu.id)!.email], 'Member') }]
              : []),
            { label: 'Remove from workspace', icon: <Trash2 size={16} />, danger: true, onSelect: () => removeMember(rowMenu.id) },
          ]}
        />
      )}
    </div>
  )
}

/* ---------- Security ---------- */

export function SecuritySettings() {
  const { db, setDb, toast } = useStore()
  const sec = db.security
  const [domain, setDomain] = useState('')
  const set = (patch: Partial<typeof sec>) => setDb((d) => ({ ...d, security: { ...d.security, ...patch } }))
  const validDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain.trim())

  return (
    <div className="settings-page">
      <PageHeader title="Security" desc="Control who can join the workspace and how they sign in." />
      <section className="settings-section" style={{ marginTop: 0 }}>
        <h3>Allowed email domains</h3>
        <p className="muted" style={{ margin: '0 0 8px' }}>Anyone with a verified email on these domains can join without an invite.</p>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {sec.allowedDomains.length === 0 && <span className="faint">No domains yet.</span>}
            {sec.allowedDomains.map((d) => (
              <span key={d} className="chip" style={{ paddingRight: 2 }}>
                {d}
                <button className="icon-btn" style={{ width: 18, height: 18 }} aria-label={`Remove ${d}`} onClick={() => set({ allowedDomains: sec.allowedDomains.filter((x) => x !== d) })}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              const d = domain.trim().toLowerCase()
              if (!validDomain || sec.allowedDomains.includes(d)) return
              set({ allowedDomains: [...sec.allowedDomains, d] })
              setDomain('')
            }}
          >
            <input className="input" placeholder="company.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
            <button className="btn" type="submit" disabled={!validDomain}>Add domain</button>
          </form>
          {domain && !validDomain && <span className="danger-text label">Enter a domain like company.com</span>}
        </div>
      </section>
      <section className="settings-section">
        <h3>Authentication</h3>
        <div className="card" style={{ padding: '0 16px' }}>
          <SettingsRow title="SAML single sign-on" desc="Require members to sign in through your identity provider.">
            <Toggle
              on={sec.ssoEnabled}
              label="SAML SSO"
              onChange={(v) => {
                set({ ssoEnabled: v })
                toast(v ? 'SSO enabled' : 'SSO disabled')
              }}
            />
          </SettingsRow>
          <SettingsRow title="Invite permissions" desc="Who can invite new members to the workspace.">
            <select className="select" style={{ width: 180 }} value={sec.invitePermission} onChange={(e) => set({ invitePermission: e.target.value as typeof sec.invitePermission })}>
              <option value="admins">Admins only</option>
              <option value="members">All members</option>
            </select>
          </SettingsRow>
        </div>
      </section>
    </div>
  )
}

/* ---------- API ---------- */

export function ApiSettings() {
  const { db, setDb, toast } = useStore()
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const validUrl = /^https:\/\/\S+\.\S+/.test(url)

  return (
    <div className="settings-page">
      <PageHeader title="API" desc="Build on top of the workspace with API keys and webhooks." />
      <ApiKeysSection />
      <section className="settings-section">
        <div className="row" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, flex: 1 }}>Webhooks</h3>
          <button className="btn sm" onClick={() => setAdding(true)}>New webhook</button>
        </div>
        <div className="card">
          {adding && (
            <form
              className="row card-pad"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
              onSubmit={(e) => {
                e.preventDefault()
                if (!validUrl) return
                setDb((d) => ({ ...d, webhooks: [...d.webhooks, { id: newId('w'), url, events: ['Issue'], enabled: true }] }))
                setUrl('')
                setAdding(false)
                toast('Webhook created')
              }}
            >
              <input className="input" autoFocus placeholder="https://example.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button className="btn primary" type="submit" disabled={!validUrl}>Create</button>
              <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
            </form>
          )}
          {db.webhooks.length === 0 && !adding && <div className="card-pad muted">No webhooks yet.</div>}
          {db.webhooks.length > 0 && (
            <table className="table">
              <thead>
                <tr><th>URL</th><th>Events</th><th>Enabled</th><th /></tr>
              </thead>
              <tbody>
                {db.webhooks.map((w) => (
                  <tr key={w.id}>
                    <td className="mono" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.url}</td>
                    <td className="muted">{w.events.join(', ')}</td>
                    <td>
                      <Toggle on={w.enabled} label="Enabled" onChange={(v) => setDb((d) => ({ ...d, webhooks: d.webhooks.map((x) => (x.id === w.id ? { ...x, enabled: v } : x)) }))} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="icon-btn" aria-label="Delete webhook" onClick={() => setDb((d) => ({ ...d, webhooks: d.webhooks.filter((x) => x.id !== w.id) }))}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
