# Linear Clone — Frontend

React 18 + Vite + TypeScript implementation of `Linear Clone — UI Design Plan.md`. All data is in-memory mock data (`src/data/mock.ts`); nothing persists across reloads yet.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # type-check + production build
```

## Layout

| Path | What |
| --- | --- |
| `src/styles/tokens.css` | Design tokens (colors, type, radii) from the design plan |
| `src/data/` | Types, mock seed, and the store (React context) — swap the store's functions for API calls when the backend lands |
| `src/components/` | Shared pieces: status/priority icons, avatar, `Menu` (submenus + hotkeys), issue context menu, AI block + mock summarizer, overlays |
| `src/layouts/` | Workspace shell and Settings shell |
| `src/pages/` | Screens 1–10 + AI Summary |

## Shortcuts

`C` new issue · `Ctrl K` command palette · `[` toggle sidebar · `G` then `S` settings · `Alt ⇧ Q` log out.
On a right-clicked issue: `S` status, `P` priority, `A` assignee, `⇧D` due date, `L` labels, `⇧P` project, `⇧C` cycle, `Alt F` favorite, `⇧S` unsubscribe, `⇧H` remind, `Ctrl Delete` delete.

## Not real yet

- AI summaries come from a deterministic summarizer in `src/components/AI.tsx` (`summarizeIssues`, `summarizeIssue`), with fake latency. Replace them with a backend LLM call that returns the same `Bullet[]` shape. Add `?aiError=1` to a URL to see the error state.
- Auth, workspace switching, passkeys, desktop download, and workspace deletion are UI-only (they show a toast).
