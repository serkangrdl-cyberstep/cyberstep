---
name: Attack Scenario Analysis
description: Claude-powered attack chain generator for domain scan results — architecture, data flow, and key decisions
---

# Attack Scenario Analysis Feature

## Architecture
- **Backend**: `artifacts/api-server/src/routes/domain-scan/attack-scenarios.ts` — mounted via `router.use(attackScenariosRouter)` at end of domain-scan/index.ts (before `export default`)
- **DB columns**: `attack_scenarios_json JSONB`, `attack_scenarios_status TEXT` on `domain_scans` table
- **Types**: `AttackScenario` and `AttackScenariosResult` interfaces defined in `lib/db/src/schema/domain-scans.ts` (above the pgTable definition)
- **Frontend**: `AttackScenarioPanel` component in `artifacts/cyberstep/src/pages/domain-scan.tsx`, inserted just before Değerlendirme Upsell section

## Data Flow
1. POST `/api/domain-scan/:id/attack-scenarios` — marks status="generating", fires background Claude call, returns immediately
2. Frontend polls GET every 2.5s until status="complete" or "error"
3. GET `/api/domain-scan/:id/attack-scenarios` — returns `{ status, result }` from DB

## Claude Prompt Design
- Uses `claude-sonnet-4-6` via `anthropic.messages.create` (non-streaming — structured JSON output)
- Prompt feeds: email security (SPF/DMARC/DKIM), SSL, open ports (Shodan), CVEs (CVSS ≥7.0 filtered), threat intel (blacklists/URLhaus/USOM/VirusTotal/AbuseIPDB/SafeBrowsing), HIBP, Shadow IT, HTTP headers score, subdomain count, risk flags array
- Returns JSON: `{ risk_ozet, genel_tehdat_seviyesi, senaryolar[3], once_kapat[3] }`
- JSON extraction handles both ```json``` blocks and bare objects via regex

## Key Decisions
- `cisaKevMatches` and `otxData` are NOT in the DB (transient scan-time only) — excluded from prompt
- Non-streaming chosen over SSE because structured JSON output needs complete response to parse
- Fire-and-forget + polling chosen (same pattern as assessment report generation) for UX simplicity
- Scenarios expand/collapse with first scenario open by default
- MITRE technique codes are clickable links to attack.mitre.org

**Why non-streaming:** Claude must return valid JSON; streaming partial JSON cannot be rendered as structured cards. Full response → parse → show cards gives cleaner UX than streaming markdown.
