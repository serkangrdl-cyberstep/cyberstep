---
name: Intelligence Report Engine
description: Aylık Türkiye+Azerbaycan siber güvenlik endeksi — Claude AI yazıyor, admin panel üretiyor/yayınlıyor
---

## Tables (migration 0003_tech_stack_intelligence.sql)
- `market_configs` — country_code UNIQUE; TR + AZ seeded; isActive=true only TR for now
- `intelligence_reports` — report_slug UNIQUE (format: `tr-2025-06`); status: generating→review→published
- `report_sector_details` — FK to intelligence_reports ON DELETE CASCADE
- `report_city_details`, `report_tech_trends`, `report_leads` — same FK pattern

## Services
- `dataAggregator.ts` — queries domain_scans + customer_tech_stack filtered by market TLDs (e.g. `.com.tr`); returns MonthlyAggregation
- `reportWriter.ts` — `generateMonthlyReport()` inserts row, fires setImmediate for Claude calls (3 parallel: summary, linkedin, pressRelease), updates status to "review" when done

## Claude pattern
- Model: `claude-sonnet-4-6`
- `callClaude(system, user, maxTokens)` → returns text string
- Fire-and-forget with setImmediate; status → "error" on failure

## Routes (under /api/admin-panel/intelligence/*)
- `GET /markets` — all market configs + last report per country
- `GET /reports[?countryCode=TR]` — list all reports
- `GET /reports/:id` — detail with sectors + leads
- `POST /generate` — body: `{countryCode, year, month}`; returns `{reportId}` immediately
- `PUT /reports/:id` — edit text fields (summary, linkedin, pressRelease)
- `POST /reports/:id/publish` — sets status=published + publishedAt
- `GET /reports/:id/leads`

## Admin UI
- `/panel/istihbarat` in "İstihbarat & Teknografi" NAV section
- Per-market "Generate" buttons; expandable report detail with sector bar chart, LinkedIn copy, leads list

## Key design
- `reportSlug` = `${countryCode.toLowerCase()}-${year}-${month.padStart(2,"0")}` — idempotent with onConflictDoUpdate
- Sector analysis is stub-estimated from scan counts (real breakdown requires sector classification on domains)
