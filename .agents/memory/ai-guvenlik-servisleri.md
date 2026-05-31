---
name: AI Güvenlik Servisleri
description: 3 new AI-powered security services — policy auto-update, tool monitoring, phishing simulation
---

## Özellik 7 — AI Politika Otogüncelleme (990 TL/yıl)
- DB: `ai_policy_documents`, `ai_policy_subscriptions`
- Routes: `routes/ai-policy/index.ts` → `/api/ai-policy/*`
- Service: `services/policy-generator.ts` → `generatePolicyDocument()`, `runQuarterlyPolicyUpdate()`
- Frontend: `pages/ai-politika.tsx` → `/ai-politika` (landing when logged out, management panel when logged in)
- Cron: `startQuarterlyPolicyUpdateCron()` — 1 Oca/Nis/Tem/Eki 03:00 Istanbul
- DOCX generation via `docx` npm package (Packer.toBuffer)
- Customer sector/employeeCount comes from `assessmentsTable.email` join (customers table has no sector column)

## Özellik 4 — AI Araç İzleme (490 TL/ay)
- DB: `ai_tool_policy_snapshots`, `ai_monitoring_subscriptions`, `ai_monitoring_alerts`
- Routes: `routes/ai-monitoring/index.ts` → `/api/ai-monitoring/*`
- Service: `services/ai-tool-monitor.ts` → `checkAllToolsForChanges()`
- Frontend: `pages/ai-arac-izleme.tsx` → `/ai-arac-izleme`
- Cron: `startAiToolMonitorCron()` — every Sunday 02:00 Istanbul
- Alerts trigger email via sendMail; severity: critical/important/minor

## Özellik 1 — AI Phishing Simülasyonu (1.990 TL tek seferlik)
- DB: `phishing_simulations`, `phishing_sim_osint_sources`
- Routes: `routes/phishing-sim/index.ts` → `/api/phishing-sim/*`
- Service: `services/osint-collector.ts` → `collectOSINT(domain)` — web scrape + DNS SPF/DMARC + HIBP
- Frontend: `pages/ai-phishing-simulasyonu.tsx` (3-step: landing→form→progress), `pages/ai-phishing-rapor.tsx`
- Report route in App.tsx: `/ai-phishing-simulasyonu/:id/rapor` (placed BEFORE Layout wrapper block)
- Session-based ownership: `ownedSimIds` in req.session; admin bypasses check
- Rate limit: 1 per domain per 30 days
- Claude generates 3 scenarios (CEO fraud, IT support phish, invoice fraud) as JSON array

## Pricing Page
- AI Güvenlik Servisleri section added before vCISO card
- 3 service cards + AI Koruma Paketi bundle (5.990 TL/yıl, 30% savings)

## Key constraints
- assessments table has no customerId FK — link by email: `WHERE email = customer.email`
- `osint as unknown as Record<string, unknown>` needed for Drizzle jsonb field assignment
- ReactNode condition: `Boolean(osint["key"])` not `osint["key"]` for unknown-typed objects
- Pre-existing TS errors in auth.ts, isr-imap.ts, referral/index.ts — ignore, do not touch
