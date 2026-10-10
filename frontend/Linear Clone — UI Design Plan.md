# Linear Clone — UI Design Plan

Oct 10, 2026 · @heartbrokenboy

## Scope & design principles

V1 covers the Linear surfaces you highlighted — account menu, personal settings, workspace admin, teams, integrations, and the issue context menu — plus a Jira-style AI Summary page per team/project. Everything else in Linear (Initiatives, Releases, Pulse, Asks, Customer requests) appears in the nav as disabled placeholders so the layout is final from day one.

**In scope (from your screenshots)**

| Area | Items you marked |
| --- | --- |
| Account drop-down | Settings, Invite and manage members, Switch workspace, Log out |
| Personal settings | Profile, Security & access, Connected accounts |
| Administration | Workspace, Teams, Members, Security, API |
| Your teams | Team list, Create a team |
| Features | Integrations |
| Issue right-click | Status, Assignee, Cycle, Delete |
| Added | AI Summary page (from Jira) |

**Principles**

1. Dark-first, Linear density: 13px base text, 32px rows, no card shadows — hierarchy comes from contrast and 1px borders.
2. Keyboard everywhere: every menu item shows its shortcut on the right (S, A, ⇧C, Ctrl Delete), matching Linear.
3. One layout grammar: left sidebar (240px) + content pane with a 44px header. Settings reuse the same shell with a different sidebar.
4. AI is additive: the summary is a page and a panel, never a modal that blocks work.

## Design system

Build these as Figma variables and components before any screen; every screen below is assembled from them. Values approximate Linear's dark theme — tune by eye against your screenshots.

**Color variables (dark mode; add a light mode later as a second variable mode)**

| Token | Hex | Use |
| --- | --- | --- |
| bg/app | #0F0F10 | Window background, sidebar |
| bg/panel | #161618 | Content pane, menus |
| bg/elevated | #1E1E21 | Context menu, popovers, modals |
| bg/hover | #26262A | Row and menu hover |
| bg/selected | #2C2C31 | Active nav item (e.g. "Connected accounts", "Billing") |
| border/subtle | #232326 | Dividers, table lines |
| border/strong | #34343A | Inputs, menu outline |
| text/primary | #EDEDEF | Titles, active labels |
| text/secondary | #A0A0A8 | Nav labels, metadata |
| text/tertiary | #6B6B73 | Shortcuts, section headers ("Personal", "Features") |
| accent | #5E6AD2 | Primary button, focus ring, links |
| ai/accent | #A78BFA → #5E6AD2 gradient | AI Summary chip, sparkle icon, summary border |
| status/backlog | #6B6B73 | Status icon |
| status/todo | #A0A0A8 |  |
| status/in-progress | #F2C94C |  |
| status/done | #5E6AD2 |  |
| status/canceled | #4D4D55 |  |
| danger | #EB5757 | Delete, Log out confirm |
| priority/urgent | #F2994A |  |

**Typography** — Inter (or Inter Display for titles)

| Style | Size / line | Weight | Use |
| --- | --- | --- | --- |
| title/lg | 24 / 32 | 600 | Settings page titles |
| title/md | 16 / 24 | 600 | Issue title, card headings |
| body | 13 / 20 | 400 | Default everywhere |
| body/medium | 13 / 20 | 500 | Nav items, menu items |
| label | 12 / 16 | 500 | Section headers, chips |
| mono | 12 / 16 | 400 (JetBrains Mono) | Issue IDs (ENG-142), API keys |

**Spacing & shape** — 4px grid (4, 8, 12, 16, 24, 32, 48). Radius: 6px inputs/buttons/menu items, 8px menus and cards, 12px modals. Icons: 16px, 1.5px stroke (Lucide or Phosphor match Linear well).

**Core components** (build with variants + auto layout)

1. Nav item — states: default / hover / selected / disabled; slots: icon, label, count badge, shortcut.
2. Section header — uppercase-off, text/tertiary, optional collapse caret.
3. Menu item — icon, label, shortcut, submenu caret; variant: danger.
4. Menu — container with groups + 1px dividers; used for account drop-down and issue context menu.
5. Status icon — 6 variants (backlog circle dashed, todo circle, in-progress half circle, in-review, done check, canceled x).
6. Priority icon — none, urgent, high, medium, low (bars).
7. Avatar — 16 / 20 / 24 / 32px, image or initials ("KE", "LY"); team avatar = colored rounded square.
8. Button — primary / secondary / ghost / danger × sm (28px) / md (32px).
9. Input, Select, Toggle, Checkbox.
10. Issue row — status, ID, title, labels, cycle, assignee avatar, date.
11. Settings row — label + description left, control right, 1px divider.
12. Chip/label — color dot + text.
13. AI block — gradient 1px border, sparkle icon header, body text, footer actions (Regenerate, Copy, thumbs up/down).

## App shell & navigation

Two shells cover every screen: the **Workspace shell** for daily work and the **Settings shell** (entered via account menu → Settings or G then S). Design at 1440×900 desktop; add a 1280 check later.

**Workspace shell**

- Sidebar, 240px, bg/app, collapsible to 0 with the \[ key
  - Top row (44px): workspace switcher button — avatar "KE" + "keyawang" + caret — then Search (⌘K) and New issue (C) icon buttons on the right
  - Inbox, My issues
  - Section "Workspace": Projects, Views, **AI Summaries** (new, sparkle icon), Initiatives (disabled)
  - Section "Your teams": one collapsible group per team ("Team 2", "Keya Wang - Team 1") with children Issues, Cycles, Projects, Summary
  - Bottom: Invite people, Help
- Content pane, bg/panel, 8px inset radius on the top-left like Linear
  - Header (44px): breadcrumb (Team › Issues), view tabs (All / Active / Backlog), right side Display options + filter
  - Body: list view by default, board view as a toggle
- Optional right panel, 360px: issue detail peek or AI Summary panel

**Settings shell**

- Sidebar, 240px: "‹ Back to app", search field, then grouped nav exactly as in your screenshots:
  - Personal: Preferences, Profile, Notifications, Code & reviews, Security & access, Connected accounts, Agent personalization
  - Features: AI & Agents, Initiatives, Documents, Customer requests, Releases, Pulse, Asks, Emojis, Integrations
  - Administration: Workspace, Teams, Members, Security, API, Applications, Billing, Import & export
  - Your teams: Team 2, Keya Wang - Team 1, + Create a team
- Content: centered column, max-width 640px, 48px top padding, page title (title/lg) + description, then settings rows
- Items not in V1 scope render as Nav item / disabled so the nav matches Linear.

**Global overlays** (one frame each)

1. Account drop-down — anchored under the workspace switcher, 240px wide: Settings (G then S), Invite and manage members, divider, Download desktop app, divider, Switch workspace (O then W, submenu), Log out (Alt ⇧ Q).
2. Switch workspace submenu — list of workspaces with avatars + check on current, "Create or join workspace".
3. Command palette (⌘K) — 640px, search input, grouped results.
4. Issue context menu — see Screen 6.
5. Toasts — bottom-left, 320px, with Undo for delete.

## Screen-by-screen specs

Ten screens plus their states make V1. Build them in this order; each lists layout and the components it uses.

**1. Team issues — list view** (home screen)

- Header: "Team 2 › Issues", tabs All issues / Active / Backlog, right: Display, Filter, AI sparkle button (opens summary panel).
- Rows grouped by status (group header: status icon + name + count + "+"). Issue row: priority icon, ID (mono), status icon, title, labels, cycle chip, assignee avatar, created date.
- States: empty team, row hover, row selected (multi-select checkbox appears on hover), loading skeleton.

**2. Team issues — board view**

- Columns per status, 300px wide, cards with ID, title, priority, assignee, cycle. Same header with List/Board toggle.

**3. Issue detail**

- Two columns: main (title/md editable, description editor, sub-issues, activity + comments) and a 280px properties sidebar (Status, Priority, Assignee, Labels, Cycle, Project, Due date).
- Top of main column: collapsible AI block "Summarize this issue" — condenses description + comment thread into 3–5 bullets.

**4. New issue modal** (C)

- 720px modal: team chip, title input, description, property chips row (Status, Priority, Assignee, Labels, Cycle), "Create more" toggle, Create button.

**5. Cycles**

- Cycle list with progress bar (scope vs completed), dates, and a cycle detail page showing issues by status. Needed because Cycle is in the context menu.

**6. Issue context menu** (right-click)

- 240px Menu built exactly from your screenshot: Status (S ›), Priority (P ›), Assignee (A ›), Due date (⇧D ›), Labels (L ›), Project (⇧P ›), Cycle (⇧C ›), More properties ›; divider; Create related ›, Mark as ›; divider; Copy ›, Convert to ›, Make a copy…, Move ›, Open in ›; divider; Favorite (Alt F), Unsubscribe (⇧S), Remind me (⇧H ›); divider; Delete (Ctrl Delete, danger).
- Draw the four submenus you marked: Status (6 statuses with icons + check), Assignee (search field + members list + "No assignee"), Cycle (current, next, upcoming, "No cycle"), and a Delete confirmation dialog ("Delete ENG-142?" + Cancel / Delete).

**7. Personal settings**

| Page | Contents |
| --- | --- |
| Profile | Avatar upload (64px), Full name, Username, Email (read-only + change link), Save |
| Security & access | Password / passkeys, active sessions table (device, location, last active, Revoke), personal API keys |
| Connected accounts | Cards for GitHub, GitLab, Google, Slack: logo, status (Connected as @user / Not connected), Connect or Disconnect button |

**8. Workspace administration**

| Page | Contents |
| --- | --- |
| Workspace | Logo, workspace name, URL slug, default team, danger zone (Delete workspace) |
| Teams | Table: team avatar, name, identifier (ENG), members count, your role; "Create team" button |
| Members | Invite bar (emails + role select + Invite), table: avatar, name, email, role dropdown (Admin/Member/Guest), status (Active/Invited), row menu (Remove) |
| Security | Allowed email domains, SSO toggle, invite permissions (Admins only / All members) |
| API | Personal API keys list + "Create key" (shows key once, mono, copy button), webhooks list + "New webhook" |

"Invite and manage members" from the account menu deep-links to Members.

**9. Team settings + Create a team**

- Team page (e.g. "Team 2"): name, identifier, icon/color, members, workflow statuses editor, cycles toggle + cycle length.
- Create a team: single-column form — name, identifier (auto from name), icon color picker, "Copy settings from" select, Create.

**10. Integrations**

- Grid of integration cards, 3 columns, 280px: logo, name, one-line description, Enabled badge or "Add". V1 cards: GitHub, Slack, Figma, Google Drive, Zapier. Card click → detail page with configuration and Disconnect.

## AI Summary feature (Jira-style)

The AI Summary is a per-team (and per-project) page modeled on Jira's project Summary tab, with an AI-written narrative on top of the stat widgets. Your Jira screenshot didn't come through, so this follows Jira's standard Summary layout — send it and I'll align the widgets.

**Entry points**

1. Sidebar: team group → Summary; workspace-level "AI Summaries" for all teams.
2. Sparkle button in any list header → opens the summary as a 360px right panel scoped to the current filter.
3. Issue detail → "Summarize this issue" AI block (Screen 3).

**Summary page layout** (content pane, 2-column grid, 24px gap, cards bg/panel + border/subtle, 8px radius)

| Row | Left card | Right card |
| --- | --- | --- |
| Header | Title "Team 2 · Summary", time range select (Last 7 / 14 / 30 days, Current cycle), Regenerate button | — |
| 1 | **AI overview** (full width): 4–6 bullet narrative — progress, what shipped, blockers, at-risk items with linked issue IDs; footer: "Generated 2 min ago", Copy, thumbs up/down | — |
| 2 | Four stat tiles (full width): Completed, Updated, Created, Due soon — big number + delta vs previous period | — |
| 3 | Status overview: donut chart by status + legend with counts | Recent activity: feed of avatar + action + issue ID + time |
| 4 | Priority breakdown: horizontal bars Urgent → None | Team workload: per-assignee bar of open issues + "Unassigned" |
| 5 | Types of work: labels with % bars | Cycle progress: current cycle burn-up line |

**AI-specific states** (draw each as a variant of the AI block)

- Generating: shimmer lines + "Summarizing 48 issues…"
- Ready: bullets with issue ID chips that open the issue on click
- Stale: amber note "12 issues changed since this summary" + Refresh
- Empty: "Not enough activity in this period"
- Error: retry button

**Visual identity** — the only place the ai/accent gradient appears: 1px gradient border on the AI card, sparkle icon, and the Regenerate button's icon. Keeps AI content distinguishable from human-entered data.

**Open question:** should summaries also be sendable (Slack / email digest)? If yes, add a "Share" menu in the AI card footer and a weekly-digest toggle in team settings.

## Figma file structure & build order

One Figma file, six pages, built foundations-first so screens are pure assembly.

| Page | What goes on it |
| --- | --- |
| 00 Cover | Project name, version, status |
| 01 Foundations | Color variables (dark mode), text styles, spacing scale, icon set |
| 02 Components | All 13 components with variants and auto layout |
| 03 Shells | Workspace shell, Settings shell, overlays (account menu, switch workspace, ⌘K, context menu + submenus, toasts) |
| 04 Screens | Screens 1–10, one section per screen with its states side by side |
| 05 AI Summary | Summary page, right-panel version, issue-level AI block, all 5 AI states |
| 06 Prototype | Click-through flows (below) |

**Build order**

- [ ] Foundations: variables + text styles
- [ ] Components: Nav item, Menu item/Menu, Status & Priority icons, Avatar, Button, Input — then Issue row, Settings row, AI block
- [ ] Both shells + account drop-down
- [ ] Screen 1 (list) and Screen 6 (context menu + submenus)
- [ ] Screens 3, 4 (issue detail, new issue)
- [ ] Settings: Profile, Security & access, Connected accounts
- [ ] Admin: Workspace, Teams, Members, Security, API; Create a team; Integrations
- [ ] AI Summary page + panel + states
- [ ] Board view and Cycles
- [ ] Prototype flows

**Prototype flows to wire**

1. Account menu → Settings → Profile → Back to app.
2. Account menu → Invite and manage members → invite an email.
3. Right-click issue → Status › In progress; → Assignee › member; → Delete → confirm → toast with Undo.
4. Team sidebar → Summary → click an issue chip in the AI overview → Issue detail.
5. Settings → Your teams → Create a team → new team appears in sidebar.

**Frame specs** — Desktop 1440×900, 12-column layout grid off (Linear uses fixed sidebars), name frames "Screen / Area / State" (e.g. "Issues / List / Empty") so they map cleanly to React routes later.
