import { useRef, useState } from 'react'
import { Copy, KeyRound, Monitor, Smartphone, Laptop } from 'lucide-react'
import { Avatar, Modal, SettingsRow, timeAgo } from '../../components/ui'
import { newId, useStore } from '../../data/store'
import type { ApiKey, ConnectedAccount } from '../../data/types'

export function PageHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <header>
      <h1 className="title-lg">{title}</h1>
      {desc && <p>{desc}</p>}
    </header>
  )
}

/* ---------- Profile ---------- */

export function Profile() {
  const { me, updateUser, updateMe, toast } = useStore()
  const [name, setName] = useState(me.name)
  const [username, setUsername] = useState(me.username)
  const [email, setEmail] = useState(me.email)
  const fileRef = useRef<HTMLInputElement>(null)
  const dirty = name !== me.name || username !== me.username || email !== me.email

  const onFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      updateUser(me.id, { avatarUrl: String(reader.result) })
      toast('Avatar updated')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="settings-page">
      <PageHeader title="Profile" desc="Manage how you appear to others in this workspace." />
      <div className="row" style={{ gap: 16, marginBottom: 24 }}>
        <Avatar user={me} size={64} />
        <div className="row">
          <button className="btn sm" onClick={() => fileRef.current?.click()}>Upload image</button>
          {me.avatarUrl && (
            <button className="btn sm ghost" onClick={() => updateUser(me.id, { avatarUrl: undefined })}>Remove</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || !username.trim() || !email.trim()) return
          // On failure (e.g. the username is taken) the reason shows as a toast and the form keeps what was typed.
          if (await updateMe({ name: name.trim(), username: username.trim(), email: email.trim() })) toast('Profile saved')
        }}
      >
        <label className="field">
          <span>Full name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Username</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} />
        </label>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <div>
          <button className="btn primary" type="submit" disabled={!dirty}>Save</button>
        </div>
      </form>
    </div>
  )
}

/* ---------- API keys (shared by Security & access and Admin › API) ---------- */

export function ApiKeysSection({ title = 'Personal API keys' }: { title?: string }) {
  const { db, setDb, toast } = useStore()
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)

  const create = () => {
    if (!label.trim()) return
    const secret = 'lin_api_' + Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, '0')).join('')
    const key: ApiKey = { id: newId('k'), label: label.trim(), prefix: secret.slice(0, 12), createdAt: Date.now(), lastUsed: null }
    setDb((d) => ({ ...d, apiKeys: [...d.apiKeys, key] }))
    setRevealed(secret)
    setLabel('')
  }

  return (
    <section className="settings-section">
      <div className="row" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, flex: 1 }}>{title}</h3>
        <button className="btn sm" onClick={() => setCreating(true)}>Create key</button>
      </div>
      <div className="card">
        {db.apiKeys.length === 0 ? (
          <div className="card-pad muted">No API keys yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Label</th><th>Key</th><th>Created</th><th>Last used</th><th /></tr>
            </thead>
            <tbody>
              {db.apiKeys.map((k) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 500 }}>{k.label}</td>
                  <td className="mono faint">{k.prefix}…</td>
                  <td className="muted">{timeAgo(k.createdAt)}</td>
                  <td className="muted">{k.lastUsed ? timeAgo(k.lastUsed) : 'Never'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn sm danger-outline"
                      onClick={() => {
                        setDb((d) => ({ ...d, apiKeys: d.apiKeys.filter((x) => x.id !== k.id) }))
                        toast(`Revoked "${k.label}"`)
                      }}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {(creating || revealed) && (
        <Modal
          width={480}
          onClose={() => {
            setCreating(false)
            setRevealed(null)
          }}
        >
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="title-md">{revealed ? 'Your new API key' : 'Create API key'}</h2>
            {revealed ? (
              <>
                <p className="muted" style={{ margin: 0 }}>Copy this key now. You won’t be able to see it again.</p>
                <div className="secret-box">
                  <code>{revealed}</code>
                  <button
                    className="icon-btn"
                    aria-label="Copy key"
                    onClick={() => {
                      navigator.clipboard?.writeText(revealed).catch(() => {})
                      toast('API key copied')
                    }}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </>
            ) : (
              <label className="field">
                <span>Label</span>
                <input className="input" autoFocus placeholder="e.g. CI script" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
              </label>
            )}
          </div>
          <div className="modal-footer">
            {revealed ? (
              <button className="btn primary" onClick={() => { setRevealed(null); setCreating(false) }}>Done</button>
            ) : (
              <>
                <button className="btn" onClick={() => setCreating(false)}>Cancel</button>
                <button className="btn primary" disabled={!label.trim()} onClick={create}>Create</button>
              </>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}

/* ---------- Security & access ---------- */

export function SecurityAccess() {
  const { db, setDb, toast, changePassword } = useStore()
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '' })
  const deviceIcon = (d: string) => (d.includes('iPhone') ? <Smartphone size={16} /> : d.includes('Desktop') ? <Laptop size={16} /> : <Monitor size={16} />)

  return (
    <div className="settings-page">
      <PageHeader title="Security & access" desc="Manage how you sign in and where you’re signed in." />
      <section className="settings-section" style={{ marginTop: 0 }}>
        <h3>Sign-in methods</h3>
        <div className="card" style={{ padding: '0 16px' }}>
          <SettingsRow title="Password" desc="Change the password you log in with.">
            <button className="btn sm" onClick={() => setPwOpen(true)}>Change password</button>
          </SettingsRow>
          <SettingsRow title="Passkeys" desc="Sign in with your fingerprint, face or a security key.">
            <button className="btn sm" onClick={() => toast('Passkey registration is not part of this demo')}>
              <KeyRound size={14} /> Add passkey
            </button>
          </SettingsRow>
        </div>
      </section>

      <section className="settings-section">
        <div className="row" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, flex: 1 }}>Active sessions</h3>
          {db.sessions.some((s) => !s.current) && (
            <button
              className="btn sm ghost"
              onClick={() => {
                setDb((d) => ({ ...d, sessions: d.sessions.filter((s) => s.current) }))
                toast('Signed out of all other sessions')
              }}
            >
              Revoke all others
            </button>
          )}
        </div>
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Device</th><th>Location</th><th>Last active</th><th /></tr>
            </thead>
            <tbody>
              {db.sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="row">
                      <span className="faint">{deviceIcon(s.device)}</span> {s.device}
                    </span>
                  </td>
                  <td className="muted">{s.location}</td>
                  <td className="muted">{s.current ? <span className="badge-pill green">This device</span> : timeAgo(s.lastActive)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {!s.current && (
                      <button
                        className="btn sm danger-outline"
                        onClick={() => {
                          setDb((d) => ({ ...d, sessions: d.sessions.filter((x) => x.id !== s.id) }))
                          toast(`Revoked ${s.device}`)
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ApiKeysSection />

      {pwOpen && (
        <Modal onClose={() => setPwOpen(false)} width={420}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (pw.next.length < 8) return
              // A wrong current password comes back as a toast; the dialog stays open.
              if (!(await changePassword(pw.current, pw.next))) return
              setPwOpen(false)
              setPw({ current: '', next: '' })
              toast('Password changed')
            }}
          >
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 className="title-md">Change password</h2>
              <label className="field">
                <span>Current password</span>
                <input className="input" type="password" autoFocus value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              </label>
              <label className="field">
                <span>New password</span>
                <input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </label>
              {pw.next && pw.next.length < 8 && <span className="danger-text label">At least 8 characters.</span>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setPwOpen(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={!pw.current || pw.next.length < 8}>Update password</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ---------- Connected accounts ---------- */

export const PROVIDER_STYLE: Record<ConnectedAccount['provider'], { color: string; letter: string; desc: string }> = {
  GitHub: { color: '#24292e', letter: 'GH', desc: 'Link commits and pull requests to issues.' },
  GitLab: { color: '#fc6d26', letter: 'GL', desc: 'Link merge requests to issues.' },
  Google: { color: '#4285f4', letter: 'G', desc: 'Sign in with Google and attach Drive files.' },
  Slack: { color: '#4a154b', letter: 'S', desc: 'Get notifications and create issues from Slack.' },
}

export function ConnectedAccounts() {
  const { db, setDb, me, toast } = useStore()
  const set = (provider: ConnectedAccount['provider'], handle: string | null) =>
    setDb((d) => ({ ...d, connected: d.connected.map((c) => (c.provider === provider ? { ...c, handle } : c)) }))

  return (
    <div className="settings-page">
      <PageHeader title="Connected accounts" desc="Accounts linked to your personal profile." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {db.connected.map((c) => {
          const s = PROVIDER_STYLE[c.provider]
          return (
            <div key={c.provider} className="card card-pad row" style={{ gap: 12 }}>
              <span className="logo" style={{ background: s.color }}>{s.letter}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{c.provider}</div>
                <div className="muted">{c.handle ? `Connected as @${c.handle}` : s.desc}</div>
              </div>
              {c.handle ? (
                <button
                  className="btn sm danger-outline"
                  onClick={() => {
                    set(c.provider, null)
                    toast(`${c.provider} disconnected`)
                  }}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="btn sm primary"
                  onClick={() => {
                    set(c.provider, c.provider === 'Google' ? me.email : me.username)
                    toast(`${c.provider} connected`)
                  }}
                >
                  Connect
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
