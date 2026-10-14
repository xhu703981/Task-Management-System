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
  created_at: string  //json has no date type, so we use string and convert to Date in the frontend
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
  team_id: number
  number: number
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
  //async means this function waits on the network. Promise<ApiIssue[]> means it returns "a list of issues, later".
  // That "later" is why the page will need .then(...)
  const res = await fetch('/api/issues', {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error(`Could not load issues (${res.status})`)
  //res.ok is true for 200–299.
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

/** The shape of TeamOut on the backend. */
export interface ApiTeam {
  id: number
  name: string
  key: string
  color: string
  created_at: string
  members: { user_id: number; role: 'owner' | 'member' }[]
}

/** The shape of CommentOut on the backend. */
export interface ApiComment {
  id: number
  issue_id: number
  author_id: number
  body: string
  created_at: string
  updated_at: string
  edited: boolean
}

export const getUsers = (): Promise<ApiUser[]> => send('/users', 'GET')
export const getTeams = (): Promise<ApiTeam[]> => send('/teams', 'GET')
export const createTeam = (fields: { name: string; key: string; color: string }): Promise<ApiTeam> => send('/teams', 'POST', fields)
export const updateTeam = (id: number, fields: { name?: string; color?: string }): Promise<ApiTeam> => send(`/teams/${id}`, 'PATCH', fields)
export const addTeamMember = (id: number, userId: number): Promise<ApiTeam> => send(`/teams/${id}/members`, 'POST', { user_id: userId })
export const removeTeamMember = (id: number, userId: number): Promise<null> => send(`/teams/${id}/members/${userId}`, 'DELETE')
export const updateTeamMember = (id: number, userId: number, role: 'owner' | 'member'): Promise<ApiTeam> =>
  send(`/teams/${id}/members/${userId}`, 'PATCH', { role })
export const deleteTeam = (id: number): Promise<null> => send(`/teams/${id}`, 'DELETE')
export const createIssue = (fields: ApiIssueFields & { team_id: number; title: string }): Promise<ApiIssue> => send('/issues', 'POST', fields)
export const updateIssue = (id: number, fields: ApiIssueFields): Promise<ApiIssue> => send(`/issues/${id}`, 'PATCH', fields)
export const deleteIssue = (id: number): Promise<null> => send(`/issues/${id}`, 'DELETE')
export const getComments = (issueId: number): Promise<ApiComment[]> => send(`/issues/${issueId}/comments`, 'GET')
export const createComment = (issueId: number, body: string): Promise<ApiComment> => send(`/issues/${issueId}/comments`, 'POST', { body })
export const updateComment = (id: number, body: string): Promise<ApiComment> => send(`/comments/${id}`, 'PATCH', { body })
export const deleteComment = (id: number): Promise<null> => send(`/comments/${id}`, 'DELETE')
