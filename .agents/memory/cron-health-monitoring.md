---
name: Cron Health Monitoring
description: DB-persistent cron job health tracking — wrapCron() pattern, table, admin UI, failure alerts
---

## The Pattern

`wrapCron(name, scheduleExpr, fn: () => Promise<number | void>)` in `cronRegistry.ts` returns a zero-arg async function suitable for `cron.schedule()`. It:
1. Prevents overlapping runs (in-memory isRunning check)
2. Inserts a `running` row in `cron_job_runs` at start
3. Calls `fn()` — fn returns processedCount (number) or void
4. Updates row to `ok` or `error` with count + duration_ms
5. Sends admin failure alert email (fire-and-forget via SOC_ADMIN_EMAIL or SMTP_USER)
6. Stores wrapped fn in `cronFns` Map — retrieve via `getCronFn(name)` for manual trigger

**Why:** Silent overnight failures were undetectable. DB persistence survives restarts; alerts surface failures immediately; overlap prevention stops double-execution bugs.

**How to apply:** Any new night cron should use `wrapCron()` instead of bare try/catch. The fn should return a count (number of records processed). If count is unknown, return 0.

## DB Table

```sql
CREATE TABLE IF NOT EXISTS cron_job_runs (
  id SERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  schedule_expr TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','error','skipped')),
  processed_count INTEGER,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Admin API Endpoints

- `GET /api/admin-panel/cron/status` — CRON_DEFS jobs + DB stats merged (for configured tab)
- `GET /api/admin-panel/cron/all-jobs` — ALL_NIGHT_JOBS catalog + DB stats (for health board tab)
- `GET /api/admin-panel/cron/history?job=&limit=` — raw run log
- `POST /api/admin-panel/cron/trigger/:name` — uses `getCronFn(name)` for DB-aware manual execution
- `PUT /api/admin-panel/cron/settings` — enable/disable + limit per job

## Instrumented Night Crons (index.ts)

| Job Name | Schedule | Description |
|---|---|---|
| crtsh | 0 3 * * 1 | crt.sh domain discovery |
| shodan | 0 3 * * * | Shodan passive recon |
| lead_qual | 0 4 * * * | Lead qualification |
| certstream_proc | 0 * * * * | Certstream queue processor |
| subscription_reminders | 0 10 * * * | Subscription expiry alerts |
| servicenow_health | 0 * * * * | ServiceNow connection health |
| attack_path_analysis | 0 2 * * * | CASM attack path analyzer |

## Frontend

3-tab UI at `/panel/cron-ayarlari`:
1. **Yapılandırılmış** — CRON_DEFS jobs with enable toggle, limit input, manual trigger, per-job history panel
2. **Tüm Job'lar** — ALL_NIGHT_JOBS health board with error alerts, nextRunAt, processedCount
3. **Geçmiş** — flat log of last 50 runs across all jobs

## nextCronDate()

Simple minute-by-minute iterator (up to 10080 min = 1 week). Handles: fixed hour/min, `*/N` step fields, weekday filter. Does NOT handle DOW ranges (0-5), `L`, `W`, `#` special chars — those patterns don't appear in our crons.
