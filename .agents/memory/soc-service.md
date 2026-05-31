---
name: AI Destekli SOC Servisi
description: Multi-tenant SOC automation (triage/playbook/escalation/SLA) built on Fortinet fabric_events; engine, WS, crons, cost logging, and the non-obvious safety constraints.
---

# AI Destekli SOC Servisi

Multi-tenant SOC layer on top of the Fortinet Fabric ingestion. Lives in
`artifacts/api-server/src/services/soc/*`, routes in `routes/soc/index.ts`,
schema in `lib/db/src/schema/soc.ts`. Frontend: `/panel/soc`, `/panel/ai-costs`,
`/hesabim/soc`.

## Architecture (durable decisions)

- **Adapted to run natively on Replit**, NOT the original Docker/compose spec:
  reuse existing HTTPS `fabric_events` ingestion (no raw syslog daemon); Redis
  replaced by an in-process TTL Map cache (`soc-cache.ts`); no Prometheus; no
  compose. WhatsApp/Slack notifiers are pluggable stubs — only email is wired
  (`soc-notify.ts`), unconnected channels are logged not sent.
- **4-layer triage** (`soc-triage.ts` `triageAlert`): Tier0 deterministic rules
  (whitelist / duplicate-batch / already-blocked / known-IoC auto-block) → Tier1
  Claude Haiku (`claude-haiku-4-5`, confirmed available) → Tier2 Claude Sonnet
  (`claude-sonnet-4-6`) → case creation + playbook + notify.
- **AI cost is ESTIMATED**, never measured: the Claude AI fn returns text only,
  so `soc-cost.ts` derives input/output tokens from char heuristics per model and
  logs to `ai_usage_log`. Cache hits log cost 0.
- Fire-and-forget + polling everywhere (mirrors the rest of the app); live updates
  also pushed over WS.

## Non-obvious constraints (the why)

- **`SOC_ADMIN_EMAIL` must fail closed.** It defaults to `""`, and admin/cost
  emails are skipped when empty. **Why:** a hardcoded personal-email fallback was
  flagged as a cross-tenant data-leak — customer incident titles/narratives/IPs
  would be mailed to an external address if the env was unset. Never reintroduce a
  literal fallback recipient for any admin notification.
- **Case numbers (`CS-SOC-YYYY-NNNNN`) collide under concurrency.** They're built
  from `count(*)+1` against a UNIQUE column. Always create cases via
  `createCaseWithNumber()` (soc-cases.ts), which retries on PG error `23505`.
  Don't pre-generate the number and call `createCase` directly in concurrent paths.
- **The triage cron must not overlap.** `soc-cron.ts` guards `processTriageQueue`
  with an in-process `triageRunning` flag (5-min schedule can otherwise double-
  process the same untriaged `fabric_events` rows). There is no distributed lock —
  this assumes a single api-server instance.

## Tenant isolation (verified correct, keep it that way)

- `/api/portal/soc/*` scopes every query by `session.customerId`; case detail
  re-checks `socCase.customerId === session customerId` before returning activity.
- WS portal feed (`/ws/portal/soc`) binds `customerId` from the session at upgrade
  and only forwards events whose `customerId` matches. `/ws/soc` is admin-only.

## Gotchas

- DB changes applied via idempotent psql DDL, NOT `drizzle push` (push prompts to
  drop unrelated `newsletter_subscribers`).
- `fabric_events` gained SOC triage columns (`socTriaged`, `socTriagedAt`,
  `socTriageAction`, `socTriageLevel`); `customers` gained `socTier` + `socEnabled`.
- Demo e2e: `POST /api/admin/soc/demo/trigger` body `{customerId}` synthesizes 3
  events and runs the full pipeline.
