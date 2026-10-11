import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { getMe } from '../data/api'
import { useStore } from '../data/store'

/** Wraps every page that needs a logged-in user. children = things that only exist while logged in. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { me, updateUser } = useStore()
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>('checking')

  useEffect(() => {
    getMe()
      .then((user) => {
        // Real identity, mock world: put the real account on the mock "me" user.
        updateUser(me.id, { name: user.name, username: user.username, email: user.email, role: user.role })
        setStatus('in')
      })
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
