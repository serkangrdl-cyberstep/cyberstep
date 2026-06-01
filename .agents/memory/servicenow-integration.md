---
name: ServiceNow Incident Entegrasyonu
description: SOC case ↔ ServiceNow INC çift yönlü senkronizasyon; tablo yapısı, route prefix'leri, cron.
---

## DB Tabloları (ensureServiceNowTables ile oluşturulur — Drizzle şeması lib/db/src/schema/servicenow.ts)
- `servicenow_configs` — customer başına 1 kayıt (UNIQUE(customer_id)); instance_url, username, api_token_enc (AES-256), assignment_group, category, active
- `servicenow_incidents` — soc_case_id UNIQUE; sn_sys_id, sn_number, sn_state (1=New, 6=Resolved, 7=Closed)

## Priority / State Mapping
- critical→1, high→2, medium→3, low→4 (SN priority/urgency/impact)
- RESOLVE_STATE=6, CLOSE_STATE=7

## API Routes
- Portal: `/api/integrations/servicenow` (GET/POST/PUT/DELETE + `/test` + `/:id/toggle` + `/incidents`)
- Admin: `/api/admin-panel/servicenow/summary` + `/configs` + `/incidents`

## SOC Hooks (setImmediate fire-and-forget)
- `soc-triage.ts` openCase() → `openServiceNowIncident()` (yeni case açıldığında)
- `routes/soc/index.ts` PATCH status→resolved/closed/false_positive → `resolveServiceNowIncident()`

## Cron
- `*/15 * * * *` → `syncServiceNowIncidents()` — SN'de elle kapatılan INC'leri CyberStep'e yansıtır

## ON CONFLICT
- POST /api/integrations/servicenow uses `ON CONFLICT (customer_id) DO UPDATE` — requires the UNIQUE index created by ensureServiceNowTables

## Frontend
- `/hesabim/entegrasyonlarim` → ServiceNowSection component (bağla/test/incidents list)
- `/panel/servicenow` → AdminServiceNow page (summary stats + config list + incident table)
- Admin nav: "Güvenlik Operasyonları" altında Network icon ile eklendi

**Why:** Tek müşteri başına tek config; UNIQUE index + upsert pattern ile idempotent POST.
