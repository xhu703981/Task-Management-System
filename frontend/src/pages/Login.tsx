import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../data/api'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="empty-state" style={{ height: '100%' }}>
      <form
        onSubmit={onSubmit}
        className="card"
        style={{ width: 320, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}
      >
        <h1 className="title-lg" style={{ color: 'var(--text-primary)' }}>Log in</h1>
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
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="danger-text">{error}</div>}
        <button className="btn primary" type="submit" disabled={submitting || !username || !password}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
