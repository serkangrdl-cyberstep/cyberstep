---
name: Customer integrations framework
description: Per-customer security tool integration config, service clients, and push helper for Jira/FortiManager/QRadar/FortiSIEM/CrowdStrike/TrendMicro
---

## What was built

DB tables (created via SQL + Drizzle schema):
- `customer_integrations` — per-customer integration configs (type, config JSONB, active, last_sync_*)
- `integration_events` — event log for all pushes and tests

Service clients: `artifacts/api-server/src/services/integrations.ts`
- All 6 clients in one file: `jiraTestConnection`, `jiraCreateIssue`, `jiraBulkCreateFromFindings`, `fortiManagerPushBlocklist`, `qradarSendEvents`, `fortiSIEMSendIncidents`, `crowdStrikeGetToken`, `crowdStrikePushIOCs`, `trendMicroPushIOCs`, `testIntegration` (dispatcher)
- Shared `jsonRequest()` helper (http/https, no external deps)

API routes: `artifacts/api-server/src/routes/integrations/index.ts`
- GET /api/integrations, POST /api/integrations, PATCH /api/integrations/:id, DELETE /api/integrations/:id
- POST /api/integrations/:id/test, POST /api/integrations/test-config (no save)
- GET /api/integrations/:id/events
- Exported: `pushToCustomerIntegrations(customerId, eventType, payload)` — call from domain-scan/assessment routes to auto-push

Frontend: `artifacts/cyberstep/src/pages/customer/integrations.tsx` at `/entegrasyonlarim`
- Full CRUD UI: add/edit modal with per-type field definitions, test button, events history dialog, toggle active, delete confirm

**Why:**
- zod must be added to api-server/package.json (not in deps by default — uses @workspace/api-zod for generated schemas)
- req.params["id"] pattern needed (not req.params.id) for Express 5 TS compatibility
- drizzle .set() accepts `Record<string, any>` for mixed-type updates

**Auto-push not yet wired:** `pushToCustomerIntegrations` is exported but not called from domain-scan or assessment routes. Domain scans use tenantId, integrations use customerId — these need reconciliation before wiring auto-push.
