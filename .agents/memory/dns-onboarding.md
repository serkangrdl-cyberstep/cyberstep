---
name: DNS Monitor & Onboarding Emails
description: DNS change monitoring system + D+3/D+7 onboarding email crons; key design decisions and runtime quirks
---

# DNS Monitor & Onboarding Emails

## DNS Monitor

### DB tables (raw SQL in `ensureDnsTables()` in `index.ts`)
- `dns_watched_domains` — customer_id + domain, max 10 per customer, `is_active`, `last_checked_at`
- `dns_snapshots` — JSONB A/MX/NS/TXT/CNAME per check-cycle; only inserted on first snapshot OR when diff detected
- `dns_change_events` — diffs with severity (NS/MX=critical, A/CNAME=high, TXT=medium), `soc_case_id`

### Cron (`services/dns-cron.ts`, `startDnsCrons()`)
- Fires every 5 min, processes **all** active domains (no LIMIT — SLA guarantee)
- Run-lock (`dnsRunInProgress` flag) prevents concurrent runs from overlapping
- 500 ms sleep between domains throttles DNS resolver load

### JSONB deserialization — critical quirk
pg/drizzle returns JSONB columns as already-parsed JS objects, NOT strings.
Calling `JSON.parse()` on an already-parsed object throws `SyntaxError` and aborts change detection.
**Fix**: use `parseJsonb<T>(val, fallback)` helper in `services/dnsResolver.ts` that checks `typeof val === "string"` before parsing.

**Why**: pg driver deserializes JSONB automatically; raw JSON.parse is only safe on string columns.

### SOC case creation
Use `createCaseWithNumber()` from `services/soc/soc-cases.ts` — NOT raw INSERT.
Raw INSERT into `soc_cases` skips the unique case_number retry loop and will collide.

### Snapshot insert policy
- No previous snapshot → insert baseline, return (no diff possible)
- Previous snapshot exists, no changes → only UPDATE `last_checked_at`, skip new snapshot row (avoids table bloat)
- Previous snapshot exists, changes detected → insert new snapshot + insert change_event rows

### Routes
- Portal: `/api/portal/dns-monitor/domains` (GET/POST/DELETE) + `/changes` + `/snapshot/:domain`
- Admin: `/api/admin-panel/dns-monitor/changes|domains|stats`
- Admin changes query: ordered by severity (critical→high→medium→low), then `detected_at DESC`; JOINs `soc_cases` to expose `case_number` for deep-link

### Frontend
- `/hesabim/dns-izleme` — full standalone page: per-domain expandable view with current snapshot + change history, record-type filter on global change list
- `/panel/dns-izleme` — admin page: severity-prioritized table, clickable SOC case link (`/panel/soc?case=<id>`)
- **Domain Tarama page** (`pages/domain-scan.tsx`): DNS monitoring panel embedded after scan results — logged-in users can add/remove the scanned domain from monitoring and see current snapshot + recent changes inline

## Onboarding Email Series

### Columns (via `ensureOnboardingEmailColumns()` in `index.ts`)
- `customers.onboarding_d3_sent_at TIMESTAMP`
- `customers.onboarding_d7_sent_at TIMESTAMP`

### Cron
Daily 10:30 Istanbul in `index.ts`. Finds customers where `created_at` falls in the target window AND sent_at is NULL.

### Email functions (`services/email.ts`)
- `sendOnboardingD3Email` — assessment reminder (day 3)
- `sendOnboardingD7Email` — full assessment upsell + benchmark (day 7)
- D+0 welcome email is NOT yet wired into registration — this is a separate follow-up item.

**How to apply**: D+0 should fire in `routes/customer-auth/index.ts` POST /auth/register.
