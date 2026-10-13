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

/** The shape of IssueOut on the backend. */
export interface ApiIssue {
  id: number
  title: string
  description: string
  status: string
  priority: number
  creator_id: number
  assignee_id: number | null
  created_at: string
  updated_at: string
}

export async function getIssues(): Promise<ApiIssue[]> {
  const res = await fetch('/api/issues', {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error(`Could not load issues (${res.status})`)
  return res.json()
}

/** fetch with the token attached; on failure, throws the backend's error message. */
async function send(path: string, method: string, body?: unknown) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    // FastAPI puts the message in "detail"; validation errors (422) make it a list instead.
    throw new Error(typeof data?.detail === 'string' ? data.detail : `Request failed (${res.status})`)
  }
  return res.status === 204 ? null : res.json()
}

/** Fields the backend lets you set on an issue (IssueCreate / IssueUpdate). */
export interface ApiIssueFields {
  title?: string
  description?: string
  status?: string
  priority?: number
  assignee_id?: number | null
}

export const getUsers = (): Promise<ApiUser[]> => send('/users', 'GET')
export const createIssue = (fields: ApiIssueFields & { title: string }): Promise<ApiIssue> => send('/issues', 'POST', fields)
export const updateIssue = (id: number, fields: ApiIssueFields): Promise<ApiIssue> => send(`/issues/${id}`, 'PATCH', fields)
export const deleteIssue = (id: number): Promise<null> => send(`/issues/${id}`, 'DELETE')
