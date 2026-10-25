import type { Db } from './types'

// The parts of the app the backend doesn't have yet (workspace settings, integrations, API keys,
// webhooks, sessions). People, projects, sprints, issues and comments come from the API at login.

const DAY = 86_400_000
const now = Date.now()
const daysAgo = (d: number) => now - d * DAY

export function createSeed(): Db {
  return {
    meId: '',
    workspaces: [{ id: 'ws-1', name: 'TaskManagement', slug: 'taskmanagement', color: '#5e6ad2', defaultProjectId: '' }],
    currentWorkspaceId: 'ws-1',
    users: [],
    projects: [],
    sprints: [],
    issues: [],
    comments: [],
    activity: [],
    integrations: [
      { id: 'github', name: 'GitHub', description: 'Link pull requests and commits to issues.', color: '#24292e', enabled: true },
      { id: 'slack', name: 'Slack', description: 'Create issues and get notifications in Slack.', color: '#4a154b', enabled: true },
      { id: 'figma', name: 'Figma', description: 'Embed live Figma designs in issues.', color: '#a259ff', enabled: false },
      { id: 'gdrive', name: 'Google Drive', description: 'Attach Docs, Sheets and Slides to issues.', color: '#1fa463', enabled: false },
      { id: 'zapier', name: 'Zapier', description: 'Automate workflows with 5,000+ apps.', color: '#ff4a00', enabled: false },
    ],
    apiKeys: [{ id: 'k1', label: 'CI script', prefix: 'tm_api_7Hk2', createdAt: daysAgo(30), lastUsed: daysAgo(1) }],
    webhooks: [{ id: 'w1', url: 'https://example.com/hooks/taskmanagement', events: ['Issue', 'Comment'], enabled: true }],
    sessions: [
      { id: 's1', device: 'Chrome on Windows', location: 'Atlanta, US', lastActive: now, current: true },
      { id: 's2', device: 'Safari on iPhone', location: 'Atlanta, US', lastActive: daysAgo(2), current: false },
    ],
    connected: [
      { provider: 'GitHub', handle: null },
      { provider: 'GitLab', handle: null },
      { provider: 'Google', handle: null },
      { provider: 'Slack', handle: null },
    ],
    security: { allowedDomains: [], ssoEnabled: false, invitePermission: 'admins' },
  }
}
