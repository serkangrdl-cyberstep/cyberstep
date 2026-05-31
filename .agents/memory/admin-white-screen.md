---
name: Admin panel white-screen crashes
description: Why cyberstep admin menu pages can show a blank screen and how to prevent it
---

# Admin panel white-screen ("açılmıyor")

The cyberstep frontend has **no React ErrorBoundary** around its routes (`App.tsx` uses bare `<Switch>`). So any render-time throw in a page component blanks the whole page — the user reports it as the menu item "açılmıyor" (won't open).

## Rule
Every admin page must tolerate `undefined` query data on first render (TanStack Query returns `data: undefined` before the fetch resolves).

**Why:** without an ErrorBoundary, one unguarded access = permanent white screen, because the throw happens before the query can repopulate.

**How to apply:**
- Destructure with defaults for arrays: `const { data: rows = [] } = useQuery(...)`.
- Guard objects with full optional chaining or `?? {}` / conditional render.
- **Footgun:** `obj?.a.b` only guards `a`, not `b` — if `obj` is undefined, `obj?.a` is undefined and `.b` still throws. Always write `obj?.a?.b`. This was the exact cause of the ai-costs and domain-taramalar white screens.
- `AdminLayout` requires a `title` prop; omitting it fails typecheck (it renders `{title}` so it won't crash at runtime, but the build breaks).

A route-level ErrorBoundary around admin pages would make this class of bug non-fatal — recommended future hardening.
