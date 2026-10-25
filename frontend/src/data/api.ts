// Talks to the FastAPI backend. Every path starts with /api, which Vite forwards to :8000.

const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

/** The shape of UserOut on the backend. */
export interface ApiUser {
  id: number
  email: string
  username: string
  name: string
  role: 'Admin' | 'Member'
  created_at: string  //json has no date type, so we use string and convert to Date in the frontend
}

/** Ask the backend for a fresh 1-hour access token with the 7-day refresh token. */
async function refreshAccessToken(): Promise<boolean> {
  const refresh_token = localStorage.getItem(REFRESH_KEY)
  if (!refresh_token) return false
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  })
  if (!res.ok) return false
  const data: { access_token: string } = await res.json()
  localStorage.setItem(TOKEN_KEY, data.access_token)
  return true
}

/** fetch with the token attached. An expired access token is refreshed once and the request retried. */
async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const attempt = () =>
    fetch(`/api${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${getToken()}` } })
  const res = await attempt()
  if (res.status === 401 && (await refreshAccessToken())) return attempt()
  return res
}

/** The backend's error message: FastAPI puts it in "detail"; validation errors (422) make it a list instead. */
async function errorMessage(res: Response) {
  const data = await res.json().catch(() => null)
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.detail) && data.detail[0]?.msg) return String(data.detail[0].msg).replace(/^Value error, /, '')
  return `Request failed (${res.status})`
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (res.status === 401) throw new Error('Incorrect username or password')
  if (!res.ok) throw new Error(await errorMessage(res))
  const data: { access_token: string; refresh_token: string } = await res.json()
  localStorage.setItem(TOKEN_KEY, data.access_token)
  localStorage.setItem(REFRESH_KEY, data.refresh_token)
}

export async function register(fields: { username: string; email: string; password: string; name?: string }): Promise<void> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error(await errorMessage(res))
}

export async function getMe(): Promise<ApiUser> {
  const res = await authFetch('/users/me')
  if (!res.ok) throw new Error('Not logged in')
  return res.json()
}

/** The shape of IssueOut on the backend. */
export interface ApiIssue {
  id: number
  issue_key: string
  project_id: number
  number: number
  issue_type: 'task' | 'bug' | 'story' | 'epic'
  parent_id: number | null
  title: string
  description: string
  status: string
  priority: number
  assignee_id: number | null
  reporter_id: number | null
  story_points: number
  sprint_id: number | null
  labels: string[]
  due_date: string | null
  created_at: string
  updated_at: string
}

export async function getIssues(): Promise<ApiIssue[]> {
  //async means this function waits on the network. Promise<ApiIssue[]> means it returns "a list of issues, later".
  // That "later" is why the page will need .then(...)
  const res = await authFetch('/issues')
  if (!res.ok) throw new Error(`Could not load issues (${res.status})`)
  //res.ok is true for 200–299.
  return res.json()
}

/** authFetch with a JSON body; on failure, throws the backend's error message. */
async function send(path: string, method: string, body?: unknown) {
  const res = await authFetch(path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.status === 204 ? null : res.json()
}

/** Fields the backend lets you set on an issue (IssueCreate / IssueUpdate). */
export interface ApiIssueFields {
  title?: string
  description?: string
  issue_type?: string
  status?: string
  priority?: number
  assignee_id?: number | null
  parent_id?: number | null
  sprint_id?: number | null
  story_points?: number
  labels?: string[]
  due_date?: string | null
}

/** The shape of ProjectOut on the backend. */
export interface ApiProject {
  id: number
  name: string
  key: string
  description: string
  lead_id: number | null
  is_archived: boolean
  issue_count: number
  created_at: string
  updated_at: string
  members: { user_id: number; role: 'Admin' | 'Member' | 'Viewer'; joined_at: string }[]
}

export type ApiProjectFields = { name?: string; description?: string; lead_id?: number | null; is_archived?: boolean }

/** The shape of SprintOut on the backend. */
export interface ApiSprint {
  id: number
  project_id: number
  name: string
  goal: string | null
  status: 'planned' | 'active' | 'completed'
  start_date: string | null
  end_date: string | null
  completed_date: string | null
  created_by: number | null
  created_at: string
}

export type ApiSprintFields = { name?: string; goal?: string | null; start_date?: string | null; end_date?: string | null }

/** The shape of CommentOut on the backend. */
export interface ApiComment {
  id: number
  issue_id: number
  author_id: number | null
  parent_id: number | null
  content: string
  is_edited: boolean
  created_at: string
  updated_at: string
}

export interface ApiBulkResult {
  summary: { total: number; success_count: number; failure_count: number }
  results: { issue_key: string; status: 'Updated' | 'Failed'; updated_at: string | null; error: string | null }[]
}

const key = (issueKey: string) => encodeURIComponent(issueKey)

// Users
export const getUsers = (): Promise<ApiUser[]> => send('/users', 'GET')
export const updateMe = (fields: { name?: string; username?: string; email?: string }): Promise<ApiUser> => send('/users/me', 'PATCH', fields)
export const changePassword = (current_password: string, new_password: string): Promise<{ message: string }> =>
  send('/users/me/password', 'PATCH', { current_password, new_password })
export const setUserRole = (id: number, role: 'Admin' | 'Member'): Promise<ApiUser> => send(`/users/${id}/role`, 'PATCH', { role })

// Projects and members
export const getProjects = (): Promise<ApiProject[]> => send('/projects', 'GET')
export const createProject = (fields: { name: string; key: string; description: string }): Promise<ApiProject> => send('/projects', 'POST', fields)
export const updateProject = (id: number, fields: ApiProjectFields): Promise<ApiProject> => send(`/projects/${id}`, 'PATCH', fields)
export const deleteProject = (id: number): Promise<null> => send(`/projects/${id}`, 'DELETE')
export const addProjectMember = (id: number, userId: number, role: string): Promise<ApiProject> =>
  send(`/projects/${id}/members`, 'POST', { user_id: userId, role })
export const updateProjectMember = (id: number, userId: number, role: string): Promise<ApiProject> =>
  send(`/projects/${id}/members/${userId}`, 'PATCH', { role })
export const removeProjectMember = (id: number, userId: number): Promise<null> => send(`/projects/${id}/members/${userId}`, 'DELETE')

// Sprints
export const getSprints = (projectId: number): Promise<ApiSprint[]> => send(`/projects/${projectId}/sprints?limit=200`, 'GET')
export const createSprint = (projectId: number, fields: ApiSprintFields & { name: string }): Promise<ApiSprint> =>
  send(`/projects/${projectId}/sprints`, 'POST', fields)
export const updateSprint = (id: number, fields: ApiSprintFields): Promise<ApiSprint> => send(`/sprints/${id}`, 'PATCH', fields)
export const deleteSprint = (id: number): Promise<null> => send(`/sprints/${id}`, 'DELETE')
export const startSprint = (id: number): Promise<ApiSprint> => send(`/sprints/${id}/start`, 'POST')
export const completeSprint = (id: number, destinationSprintId: number | null): Promise<{ completed_issues: number; moved_issues: number }> =>
  send(`/sprints/${id}/complete`, 'POST', { destination_sprint_id: destinationSprintId })

// Issues
export const createIssue = (fields: ApiIssueFields & { project_id: number; title: string }): Promise<ApiIssue> => send('/issues', 'POST', fields)
export const updateIssue = (issueKey: string, fields: ApiIssueFields): Promise<ApiIssue> => send(`/issues/${key(issueKey)}`, 'PATCH', fields)
export const moveIssueStatus = (issueKey: string, status: string): Promise<{ issue_key: string; status: string; updated_at: string }> =>
  send(`/issues/${key(issueKey)}/status`, 'PUT', { status })
export const deleteIssue = (issueKey: string): Promise<null> => send(`/issues/${key(issueKey)}`, 'DELETE')
export const bulkUpdateIssues = (issueKeys: string[], updates: ApiIssueFields): Promise<ApiBulkResult> =>
  send('/issues/bulk', 'PATCH', { issue_keys: issueKeys, updates })
export const bulkDeleteIssues = (issueKeys: string[]): Promise<null> => send('/issues/bulk', 'DELETE', { issue_keys: issueKeys })

// Comments
export const getComments = (issueKey: string): Promise<ApiComment[]> => send(`/issues/${key(issueKey)}/comments`, 'GET')
export const createComment = (issueKey: string, content: string, parentId: number | null): Promise<ApiComment> =>
  send(`/issues/${key(issueKey)}/comments`, 'POST', { content, parent_id: parentId })
export const updateComment = (id: number, content: string): Promise<ApiComment> => send(`/comments/${id}`, 'PATCH', { content })
export const deleteComment = (id: number): Promise<null> => send(`/comments/${id}`, 'DELETE')
