// Talks to the FastAPI backend. Every path starts with /api, which Vite forwards to :8000.

const TOKEN_KEY = 'access_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

/** The shape of UserOut on the backend. */
export interface ApiUser {
  id: number
  email: string
  username: string
  name: string
  role: 'Admin' | 'Member' | 'Guest'
  created_at: string
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    body: new URLSearchParams({ username, password }),
  })
  if (res.status === 401) throw new Error('Incorrect username or password')
  if (!res.ok) throw new Error(`Login failed (${res.status})`)
  const data: { access_token: string } = await res.json()
  localStorage.setItem(TOKEN_KEY, data.access_token)
}

export async function getMe(): Promise<ApiUser> {
  const res = await fetch('/api/users/me', {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error('Not logged in')
  return res.json()
}
