---
name: ISR LeadGen & Enterprise Sales
description: Outbound sales automation — domain scanning, teaser report generation, pipeline management, and customer enterprise portal
---

## Tables
- `enterprise_prospects` — target domains with status FSM (new → scanning → scanned → teaser_sent → interested → won/lost)
- `teaser_reports` — Claude-generated teaser reports with preview token, findings JSON, CTA capture fields
- `enterprise_contracts` + `enterprise_contract_services` — contract line items
- `enterprise_invoices` — invoice lifecycle
- `lead_scan_queue` — domains queued for enrichment
- `contact_enrichment_log` — Apollo/Hunter API results
- `sales_team` — sales rep management
- `lead_campaigns` — segmented outbound campaigns

## Services (api-server/src/services/)
- `apolloService.ts` — enriches contacts via Apollo API (APOLLO_API_KEY env); returns empty array if not set
- `hunterService.ts` — finds email patterns via Hunter API (HUNTER_API_KEY env); returns empty array if not set
- `leadScoringService.ts` — scores leads 0-100 using domain scan data + company signals
- `teaserReportService.ts` — Claude AI generates teaser report JSON; `generatePreviewToken()` creates crypto random hex

## Routes
- `/api/enterprise/*` — admin-protected CRUD for prospects, contracts, invoices; public `/preview/:token` endpoint
- `/api/enterprise/my-prospect` — customer-facing: looks up prospect by email domain, returns teaser report data
- `/api/enterprise/my-prospect/contact` — customer submits contact form → marks CTA clicked + updates prospect status to interested
- `/api/lead-gen/*` — admin-protected queue, campaigns, sales team management

## Frontend
- Admin pages: `/panel/enterprise/prospects`, `/panel/enterprise/pipeline`, `/panel/enterprise/contracts`, `/panel/lead-gen/queue`, `/panel/lead-gen/campaigns`
- Public: `/preview/:token` — standalone teaser report viewer with CTA form
- Customer portal: `/hesabim/enterprise` — shows prospect status + teaser report link + contact form; falls back to "no prospect yet" CTA

## Key patterns
- Teaser generation is fire-and-forget (setImmediate); frontend polls every 5s while status=scanning
- Customer prospect lookup is by email domain (e.g. user@acme.com → looks for acme.com in enterprise_prospects)
- Preview page is fully public (no auth), reads teaserReportsTable by previewToken
- Admin nav uses Telescope, Handshake, ListTodo, Target icons from lucide-react

**Why:** Outbound ISR motion — sales team adds a domain, system auto-generates a teaser, sends preview link; customer sees it in their portal
