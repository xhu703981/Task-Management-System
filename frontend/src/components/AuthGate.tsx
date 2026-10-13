import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { getIssues, getMe, getUsers } from '../data/api'
import { useStore } from '../data/store'

/** Wraps every page that needs a logged-in user. children = things that only exist while logged in. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loadSession } = useStore()
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>('checking')

  useEffect(() => {
    // Check the token first (fails → /login), then load the real people and issues before any page shows.
    getMe()
      .then((me) => Promise.all([getUsers(), getIssues()]).then(([users, issues]) => loadSession(me, users, issues)))
      .then(() => setStatus('in'))
      .catch(() => setStatus('out'))
  }, [])

  if (status === 'checking') return null
  if (status === 'out') return <Navigate to="/login" replace />
  return (
    <>
      <Outlet />
      {children}
    </>
  )
}
