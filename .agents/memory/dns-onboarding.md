---
name: DNS Monitor & Onboarding Emails
description: DNS change monitoring system + D+3/D+7 onboarding email cron
---

# DNS Monitor & Onboarding Emails

## DNS Monitor (Task #22)

**DB tables** (created via raw SQL in `ensureDnsTables()` in `index.ts`):
- `dns_watched_domains` — customer_id + domain, max 10 per customer
- `dns_snapshots` — JSONB A/MX/NS/TXT/CNAME records per check
- `dns_change_events` — diffs with severity (NS/MX=critical, A/CNAME=high, TXT=medium)

**Cron**: `services/dns-cron.ts`, `startDnsCrons()`, every 5 min, processes up to 50 domains ordered by oldest-checked-first.

**SOC integration**: each change creates a SOC case via raw `INSERT INTO soc_cases`. Null is returned silently if soc_cases doesn't have a customer.

**Routes**:
- Portal: `/api/portal/dns-monitor/domains` (GET/POST/DELETE) + `/api/portal/dns-monitor/changes` + `/api/portal/dns-monitor/snapshot/:domain`
- Admin: `/api/admin-panel/dns-monitor/changes|domains|stats`

**Frontend**:
- `/hesabim/dns-izleme` — customer portal (add/remove domains, view changes with expand)
- `/panel/dns-izleme` — admin view (all customers)

**Why**: NS and MX changes are critical security signals (domain hijack, mail redirect). 5-minute polling via Node.js `dns/promises` — no external package needed.

## Onboarding Email Series

**Columns added** (via `ensureOnboardingEmailColumns()` in `index.ts`):
- `customers.onboarding_d3_sent_at TIMESTAMP`
- `customers.onboarding_d7_sent_at TIMESTAMP`

**Cron**: daily 10:30 Istanbul in `index.ts`. Finds customers where `created_at` is in [D-4, D-3) range for D+3 and [D-8, D-7) range for D+7 with NULL sent_at column.

**Email functions** (in `services/email.ts`):
- `sendOnboardingD3Email` — assessment reminder (day 3)
- `sendOnboardingD7Email` — full assessment upsell + stats (day 7)
- D+0 welcome email NOT yet hooked into registration — follow-up task #31

**How to apply**: D+0 should be added to `routes/customer-auth/index.ts` POST /auth/register (follow-up #31). D+3/D+7 are cron-driven and self-contained.
