import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../data/api'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const registering = mode === 'register'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // Signing up creates the account; then the same credentials log in.
      if (registering) await register({ username, email, password, ...(name.trim() ? { name: name.trim() } : {}) })
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  const ready = username && password && (!registering || (email && password.length >= 8))

  return (
    <div className="empty-state" style={{ height: '100%' }}>
      <form
        onSubmit={onSubmit}
        className="card"
        style={{ width: 320, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}
      >
        <h1 className="title-lg" style={{ color: 'var(--text-primary)' }}>{registering ? 'Create account' : 'Log in'}</h1>
        <label className="field">
          <span>Username</span>
          <input
            className="input"
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        {registering && (
          <>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Full name (optional)</span>
              <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          </>
        )}
        <label className="field">
          <span>Password{registering && ' (at least 8 characters)'}</span>
          <input
            className="input"
            type="password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="danger-text">{error}</div>}
        <button className="btn primary" type="submit" disabled={submitting || !ready}>
          {submitting ? (registering ? 'Creating…' : 'Logging in…') : registering ? 'Create account' : 'Log in'}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setMode(registering ? 'login' : 'register')
            setError('')
          }}
        >
          {registering ? 'I already have an account' : 'Create an account'}
        </button>
      </form>
    </div>
  )
}
