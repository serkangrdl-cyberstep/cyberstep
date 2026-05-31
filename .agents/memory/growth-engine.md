---
name: Growth Engine
description: Proactive sales automation — fireTrigger(), crons, competitor tool, benchmark lead magnet, admin panel
---

## What it is
Central outbound automation system that fires personalized Claude-generated emails based on signal triggers (SSL expiry, CVE alerts, sector breach, score drop, port change, EKAP tender, new company).

## Key files
- Service: `artifacts/api-server/src/services/growth-engine.ts`
- Routes: `artifacts/api-server/src/routes/growth-engine/index.ts` — mounted at `/growth-engine` prefix in routes/index.ts
- Schema: `lib/db/src/schema/growth-engine.ts`
- Frontend: `artifacts/cyberstep/src/pages/rakip-karsilastirma.tsx`, `sektor-raporu.tsx`, `admin/growth-engine.tsx`

## Route mounting
Growth-engine router is mounted with a path prefix: `router.use("/growth-engine", growthEngineRouter)` in routes/index.ts. Routes inside the file use relative paths like `/stats`, `/triggers` etc.

**Why:** Unlike health routes (which embed full paths like `/health/my-score`), growth-engine uses Express sub-router mounting. Both patterns exist in the codebase — pick one and be consistent within a file.

## DB tables (created via psql, not drizzle push)
All 7 tables: growth_triggers, competitor_checks, benchmark_downloads, sector_newsletter_subscribers, ekap_tenders, new_companies_registry, growth_engine_settings.

## Crons
Registered in `artifacts/api-server/src/index.ts` via `startGrowthEngineCrons()`:
- SSL expiry: 01:00 Istanbul daily
- CVE alert: 02:30 Istanbul daily  
- Port change: 04:00 Istanbul Sunday only

## fireTrigger() duplicate suppression
Checks `suppress_until` in growth_triggers table before sending. Default suppress window is 30 days (configurable per trigger_type in growth_engine_settings).
