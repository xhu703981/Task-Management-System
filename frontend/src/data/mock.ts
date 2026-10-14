import type { Db, Issue, Priority, Status } from './types'

// In-memory seed data. Replace with API calls once the backend exists.

const DAY = 86_400_000
const now = Date.now()
const daysAgo = (d: number) => now - d * DAY

// Small deterministic PRNG so the seed looks the same on every reload.
let seed = 42
const rand = () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
  return seed / 2_147_483_648
}
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]

const STATUS_FLOW: { id: Status; name: string }[] = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'todo', name: 'Todo' },
  { id: 'in_progress', name: 'In Progress' },
  { id: 'in_review', name: 'In Review' },
  { id: 'done', name: 'Done' },
  { id: 'canceled', name: 'Canceled' },
]

const ENG_TITLES = [
  'Sidebar collapse state is lost on reload',
  'Add keyboard shortcut hints to context menu',
  'Command palette search ranks archived issues first',
  'Migrate issue list to virtualized rendering',
  'Board view drag-and-drop drops card in wrong column',
  'Support markdown tables in issue description',
  'Webhook retries should back off exponentially',
  'Cycle burn-up chart double counts canceled issues',
  'Invite email links expire too quickly',
  'Add SSO enforcement for workspace admins',
  'Rate limit the public API per key',
  'Dark mode contrast on disabled nav items',
  'Slack notifications send duplicate messages',
  'GitHub PR links not attaching to issues',
  'Make issue IDs copyable from the row',
  'Filter by label returns stale results',
  'Due date picker ignores workspace timezone',
  'Speed up initial workspace load',
  'Sub-issue progress not shown in parent row',
  'Add "Create more" option to new issue modal',
  'Paginate activity feed on long issues',
  'Toast undo does not restore assignee',
  'Remove legacy v1 API endpoints',
  'Audit log for member role changes',
  'Team identifier change breaks old links',
  'Bulk edit status for selected issues',
  'AI summary should cite issue IDs',
  'Show cycle dates in the cycle submenu',
  'Members table sorts invited users last',
  'Session list shows wrong device name on Windows',
  'Figma embeds fail to render in comments',
  'Add personal API key scopes',
  'Integration cards misalign at 1280px',
  'Search field in assignee menu loses focus',
  'Export issues to CSV',
  'Priority icon too faint on hover rows',
  'Notifications badge count off by one',
  'Allowed email domains accepts invalid input',
  'Draft issues lost when modal closes',
  'Add weekly digest email for team summary',
]

const KEY_TITLES = [
  'Write onboarding checklist for new members',
  'Set up staging environment',
  'Define cycle cadence for Q4',
  'Collect feedback on AI summary prototype',
  'Clean up label taxonomy',
  'Plan design review for settings pages',
  'Document API key rotation process',
  'Review integration permissions',
  'Prepare demo for Friday',
  'Archive completed projects',
  'Decide on default team for new members',
  'Update workspace logo',
]

const DESCRIPTIONS = [
  'Steps to reproduce:\n1. Open the team issues list\n2. Trigger the action described in the title\n3. Observe the behavior\n\nExpected: it works like Linear.\nActual: it does not.',
  'We have had several reports about this from users this week. Scope it small first, then follow up.',
  'Context: this came out of the design review. The goal is parity with Linear before we add our own twists.',
  'Low effort, high polish. Should be a quick win for the cycle.',
]

function makeIssues(teamId: string, titles: string[], cycleIds: string[], projectIds: string[], memberIds: string[]): Issue[] {
  return titles.map((title, i) => {
    const status = pick<Status>(['backlog', 'todo', 'todo', 'in_progress', 'in_progress', 'in_review', 'done', 'done', 'done', 'canceled'])
    const created = daysAgo(Math.floor(rand() * 40) + 1)
    const updated = created + Math.floor(rand() * (now - created))
    const completed = status === 'done' ? updated : null
    return {
      id: `${teamId}-${i + 1}`,
      teamId,
      number: i + 1,
      title,
      description: pick(DESCRIPTIONS),
      status,
      priority: pick<Priority>([0, 1, 2, 2, 3, 3, 3, 4]),
      assigneeId: rand() < 0.15 ? null : pick(memberIds),
      labels: rand() < 0.7 ? [pick(['Bug', 'Feature', 'Improvement', 'Design', 'Infra'])] : [],
      cycleId: status === 'backlog' ? null : pick([...cycleIds, null]),
      projectId: rand() < 0.5 ? pick(projectIds) : null,
      parentId: null,
      dueDate: rand() < 0.3 ? now + Math.floor(rand() * 14 - 3) * DAY : null,
      createdAt: created,
      updatedAt: updated,
      completedAt: completed,
      favorite: false,
      subscribed: true,
    }
  })
}

const engIssues = makeIssues('eng', ENG_TITLES, ['eng-c11', 'eng-c12', 'eng-c13'], ['p-web', 'p-api'], ['u-keya', 'u-lucas', 'u-maya', 'u-diego', 'u-priya'])
const keyIssues = makeIssues('key', KEY_TITLES, ['key-c3', 'key-c4'], ['p-ops'], ['u-keya', 'u-lucas'])
// A couple of sub-issues so the detail page has something to show.
engIssues[4].parentId = engIssues[3].id
engIssues[17].parentId = engIssues[3].id

export function createSeed(): Db {
  const issues = [...engIssues, ...keyIssues]
  return {
    meId: 'u-keya',
    workspaces: [
      { id: 'ws-1', name: 'TaskManagement', slug: 'taskmanagement', color: '#5e6ad2', defaultTeamId: 'eng' },
      { id: 'ws-2', name: 'Side Project', slug: 'side-project', color: '#4cb782', defaultTeamId: 'eng' },
    ],
    currentWorkspaceId: 'ws-1',
    users: [
      { id: 'u-keya', name: 'Keya Wang', username: 'keyawang', email: 'keya@example.com', color: '#5e6ad2', role: 'Admin', status: 'Active' },
      { id: 'u-lucas', name: 'Lucas Young', username: 'lucas', email: 'lucas@example.com', color: '#4cb782', role: 'Member', status: 'Active' },
      { id: 'u-maya', name: 'Maya Chen', username: 'maya', email: 'maya@example.com', color: '#f2994a', role: 'Member', status: 'Active' },
      { id: 'u-diego', name: 'Diego Ruiz', username: 'diego', email: 'diego@example.com', color: '#eb5757', role: 'Member', status: 'Active' },
      { id: 'u-priya', name: 'Priya Shah', username: 'priya', email: 'priya@example.com', color: '#a78bfa', role: 'Guest', status: 'Active' },
      { id: 'u-sam', name: 'sam@example.com', username: 'sam', email: 'sam@example.com', color: '#6b6b73', role: 'Member', status: 'Invited' },
    ],
    teams: [
      { id: 'eng', key: 'ENG', name: 'Team 2', color: '#5e6ad2', memberIds: ['u-keya', 'u-lucas', 'u-maya', 'u-diego', 'u-priya'], ownerIds: ['u-keya'], cyclesEnabled: true, cycleLengthWeeks: 2, statuses: STATUS_FLOW },
      { id: 'key', key: 'KEY', name: 'Keya Wang - Team 1', color: '#f2994a', memberIds: ['u-keya', 'u-lucas'], ownerIds: ['u-keya'], cyclesEnabled: true, cycleLengthWeeks: 1, statuses: STATUS_FLOW },
    ],
    cycles: [
      { id: 'eng-c11', teamId: 'eng', number: 11, start: daysAgo(17), end: daysAgo(3) },
      { id: 'eng-c12', teamId: 'eng', number: 12, start: daysAgo(3), end: now + 11 * DAY },
      { id: 'eng-c13', teamId: 'eng', number: 13, start: now + 11 * DAY, end: now + 25 * DAY },
      { id: 'key-c3', teamId: 'key', number: 3, start: daysAgo(2), end: now + 5 * DAY },
      { id: 'key-c4', teamId: 'key', number: 4, start: now + 5 * DAY, end: now + 12 * DAY },
    ],
    projects: [
      { id: 'p-web', teamId: 'eng', name: 'Web app parity', description: '', status: 'in_progress' },
      { id: 'p-api', teamId: 'eng', name: 'Public API v2', description: '', status: 'planned' },
      { id: 'p-ops', teamId: 'key', name: 'Team operations', description: '', status: 'in_progress' },
    ],
    issues,
    comments: [
      { id: 'c1', issueId: 'eng-1', authorId: 'u-lucas', body: 'I can reproduce this on Chrome and Edge. Looks like we never write the state to storage.', createdAt: daysAgo(3), edited: false },
      { id: 'c2', issueId: 'eng-1', authorId: 'u-keya', body: 'Let\'s persist it per workspace. Lucas, can you take it this cycle?', createdAt: daysAgo(2), edited: false },
      { id: 'c3', issueId: 'eng-1', authorId: 'u-lucas', body: 'Yes, PR coming tomorrow.', createdAt: daysAgo(1), edited: false },
    ],
    activity: issues
      .filter((i) => i.updatedAt > daysAgo(7))
      .map((i, n) => ({
        id: `a-seed-${n}`,
        issueId: i.id,
        actorId: i.assigneeId ?? 'u-keya',
        text: i.status === 'done' ? 'completed' : i.status === 'in_progress' ? 'started' : 'updated',
        createdAt: i.updatedAt,
      })),
    integrations: [
      { id: 'github', name: 'GitHub', description: 'Link pull requests and commits to issues.', color: '#24292e', enabled: true },
      { id: 'slack', name: 'Slack', description: 'Create issues and get notifications in Slack.', color: '#4a154b', enabled: true },
      { id: 'figma', name: 'Figma', description: 'Embed live Figma designs in issues.', color: '#a259ff', enabled: false },
      { id: 'gdrive', name: 'Google Drive', description: 'Attach Docs, Sheets and Slides to issues.', color: '#1fa463', enabled: false },
      { id: 'zapier', name: 'Zapier', description: 'Automate workflows with 5,000+ apps.', color: '#ff4a00', enabled: false },
    ],
    apiKeys: [{ id: 'k1', label: 'CI script', prefix: 'lin_api_7Hk2', createdAt: daysAgo(30), lastUsed: daysAgo(1) }],
    webhooks: [{ id: 'w1', url: 'https://example.com/hooks/linear', events: ['Issue', 'Comment'], enabled: true }],
    sessions: [
      { id: 's1', device: 'Chrome on Windows', location: 'Atlanta, US', lastActive: now, current: true },
      { id: 's2', device: 'Safari on iPhone', location: 'Atlanta, US', lastActive: daysAgo(2), current: false },
      { id: 's3', device: 'Desktop app on macOS', location: 'New York, US', lastActive: daysAgo(9), current: false },
    ],
    connected: [
      { provider: 'GitHub', handle: 'keyawang' },
      { provider: 'GitLab', handle: null },
      { provider: 'Google', handle: 'keya@example.com' },
      { provider: 'Slack', handle: null },
    ],
    security: { allowedDomains: ['example.com'], ssoEnabled: false, invitePermission: 'admins' },
  }
}
