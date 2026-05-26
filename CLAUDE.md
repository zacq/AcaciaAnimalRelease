# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start Vite dev server at localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build locally
npm run lint       # ESLint check
```

No test runner is configured. `countIntegrity.js` utilities are pure functions and can be tested directly with Node if needed.

## Environment

Credentials live in `dar-app/.env` (gitignored — never commit):

```
VITE_AIRTABLE_API_KEY=...
VITE_AIRTABLE_BASE_ID=...
VITE_JWT_SECRET=...
```

All Vite env vars are exposed to the browser bundle. This is acceptable for farm-internal use; do not add secrets beyond what's already there.

## Architecture

**Stack:** React 19 + Vite, Tailwind CSS v4 (`@tailwindcss/vite` plugin), Zustand, React Router v7, Axios. No backend — all data is read/written directly to Airtable via REST.

### Data flow

```
Airtable REST API
      ↓  (src/api/*.js — one file per table)
  Axios client (src/api/airtable.js)
      ↓
  Zustand stores (src/store/)
      ↓
  React pages + components
```

Every API module calls the shared Axios client in `src/api/airtable.js`, which injects the Bearer token and handles 401/429 globally. Never call Airtable directly from components.

### Airtable tables

Seven tables in base `app4rMbHScFlgXIYs`:

| Table | API module |
|---|---|
| Staff | `staffService.js` |
| Groups | `groupsService.js` |
| Daily Sessions | `sessionsService.js` |
| Animal Movements | `movementsService.js` |
| Animal Registry | `registryService.js` |
| Field Updates | `fieldUpdatesService.js` |
| Grazing Grounds | `grazingGroundsService.js` |

**Daily Sessions** is the pivot table. One record exists per group per day (7 total). Sessions are auto-created by `useTodaySessions` if missing.

### Auth

JWT-free. Login fetches the Staff record by username, compares `hashPassword(input)` against the stored `Password Hash` field (Math.imul-based hash in `src/utils/auth.js`), then saves user data to `sessionStorage`. An 8-hour inactivity timer clears the session on mouse/key/touch events.

Role→route mapping enforced by `ProtectedRoute` wrapping every route in `App.jsx`.

### Routing / roles

Three roles with separate nav sets and page access:

| Role | Landing | Pages |
|---|---|---|
| Supervisor | `/dashboard` | AM Session, PM Session, Live Map, History, Settings |
| Herdsman | `/field` | Field View only |
| Farm Manager | `/manager` | Overview, Live Map, History |

### State management

`sessionStore` (Zustand) holds all runtime data: `sessions`, `groups`, `movements` (keyed by sessionId), `fieldUpdates` (keyed by sessionId). It is populated on mount by `useTodaySessions` and mutated optimistically via `updateSessionLocally` / `addMovementLocally` / `removeMovementLocally` before API writes.

`alertStore` holds dismissable banner alerts (`addAlert`, `dismissBannerAlert`).

### Key hook: `useTodaySessions`

Accepts an optional `dateStr` (yyyy-MM-dd string, **not** a Date object — passing a Date causes an infinite re-render loop because useCallback's dependency comparison fails on object references). On mount it fetches groups + sessions, auto-creates any missing sessions, then loads movements and field updates for each session in parallel.

### Count integrity

`src/utils/countIntegrity.js` — pure functions implementing PRD §9 rules:
- `computeMovementImpact(reason)` — maps movement reason to ±1 source/dest counts
- `computeFarmTotals(sessions, movementsMap)` — builds per-group tally rows for PM page
- `farmGrandTotal(rows)` — aggregates across all groups

Used by `PMSessionPage` to compute variance and flag discrepancies.

### Styling

Tailwind v4 — use `@theme` tokens defined in `src/index.css` for colours (`green-primary`, `green-deep`, `green-mid`, `green-light`, `amber`, `amber-pale`, `off-white`). Do not hardcode hex values in components. Do not add `tailwind.config.js` — v4 has no config file.

### Mobile layout

- `NavBar` renders a **desktop sidebar** (`hidden md:flex`) and a **fixed bottom tab bar** (`md:hidden`) for mobile.
- `AppShell` adds `pb-24 md:pb-0` to prevent content hiding under the bottom nav.
- The Group Tally table switches to per-group cards on mobile (`md:hidden` / `hidden md:block` in `SupervisorDashboard`). `GroupTallyRow` accepts `variant="card"` for the mobile layout.

### Group order

Seven groups rendered in this fixed order everywhere — do not change the array, do not use en-dashes (use regular hyphens):

```js
['Annex Farm', 'Main Farm', 'Horsefield',
 'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males',
 'Sick/Vulnerable Flock']
```

`Sick/Vulnerable Flock` is always enclosure-only — its Grazing Ground input renders as a locked "Enclosure (N/A)" field in `GrazingGroundInput`.

**Horsefield is always fixed at 3 horses.** The horse count never changes day-to-day regardless of movements. When seeding or computing PM counts, always hard-code Horsefield to 3. The group still participates in the daily session (grazing ground, herdsman, signatures) but its AM and PM count are always 3.

### Offline support

`src/utils/offlineCache.js` provides a localStorage queue used by `FieldViewPage` (Herdsman role) to buffer writes when `navigator.onLine` is false and replay them on reconnect.

### Deployment

Hosted on Netlify. `netlify.toml` sets build command, publish dir, and the SPA catch-all redirect (`/* /index.html 200`) required for React Router client-side routing.
