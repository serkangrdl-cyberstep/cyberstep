---
name: Admin panel white-screen crashes
description: Why cyberstep admin menu pages can show a blank screen and how to prevent it
---

# Admin panel white-screen ("açılmıyor")

`AdminLayout` now wraps its content area in an `AdminErrorBoundary` (keyed by `location`), so a render-time throw in one admin page no longer blanks the whole shell/sidebar — it shows a fallback for that page only. The public `App.tsx` `<Switch>` is still unguarded, so non-admin pages remain vulnerable.

Two compounding root causes produced these crashes historically:
1. Pages whose `queryFn` did `fetch(...).then(r => r.json())` with no `r.ok` check. On a non-2xx the body is an error object `{ error: "..." }`, which then hits `.map/.filter/.sort` and throws. Fix: use `adminFetchJson` (`@/lib/admin-fetch`), which throws on `!ok` so React Query keeps the query's default value (e.g. `[]`).
2. Backend tenant-scoped routes returned `403 NO_TENANT` because the admin session had no `tenantId` and the `tenants` table was empty. See `tenant-auto-provision.md`.

## Rule
Every admin page must tolerate `undefined` query data on first render (TanStack Query returns `data: undefined` before the fetch resolves), AND read queries should go through `adminFetchJson` rather than raw `fetch().then(r=>r.json())`.

**How to apply:**
- Destructure with defaults for arrays: `const { data: rows = [] } = useQuery(...)`.
- Guard objects with full optional chaining or `?? {}` / conditional render.
- **Footgun:** `obj?.a.b` only guards `a`, not `b` — if `obj` is undefined, `obj?.a` is undefined and `.b` still throws. Always write `obj?.a?.b`.
- New admin pages must render inside `AdminLayout` (it provides the sidebar + ErrorBoundary). A page that builds its own outer `<div className="min-h-screen">` instead of using `AdminLayout` loses the sidebar entirely (this was the `/panel/saglik` bug).
- `AdminLayout` requires a `title` prop; omitting it fails typecheck.
- Sidebar nav is grouped: `NAV_SECTIONS` (array of `{title, items[]}`), not a flat list — add new items into the right section.
