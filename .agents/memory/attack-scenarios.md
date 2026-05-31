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
- **Model: claude-haiku-4-5** (not sonnet) — switched for speed; target ~20-30s vs ~2min with sonnet. max_tokens=2000. Generates 2 scenarios (not 3). STALE_MS=2min.

**Why non-streaming:** Claude must return valid JSON; streaming partial JSON cannot be rendered as structured cards. Full response → parse → show cards gives cleaner UX than streaming markdown.

## Full-access inline rendering
- Gating is purely frontend: GET/POST `/api/domain-scan/:id/attack-scenarios` are PUBLIC (no authz). Anonymous free-scan flow depends on this, so do not add ownership checks without redesigning the free flow (known IDOR tradeoff).
- Full-access users (`subscriptionPlan` in [full,pro], incl. test@cyberstep.io) render the complete `<AttackScenarioPanel>` inline in the "Detaylı Güvenlik Raporu" branch; non-full users keep the teaser counts + upsell.
- `AttackScenarioPanel` self-triggers generation on mount for ANY non-complete status (none/error/generating) via POST, so full details always load and stuck runs self-heal.
- The main page's `attackTeaser` state is still used by the locked branch and to gate the PDF button (`attackTeaserStatus === "loading"`) — keep that effect even though the full branch no longer reads the counts.

## Orphaned generation recovery (the real "AI didn't show" cause)
- **Symptom:** a scan stuck in `attack_scenarios_status='generating'` forever with no JSON; frontend polls indefinitely showing only the scan summary. Root cause is NOT gating and NOT Claude — it's that fire-and-forget background jobs die when the server restarts (a deploy/publish) mid-run, leaving the status orphaned with no recovery path.
- **Fix pattern:** a dedicated `attack_scenarios_started_at` timestamp + a compare-and-set claim (`claimGeneration()` in attack-scenarios.ts). A single conditional UPDATE transitions to "generating" only when eligible (none/error/null, complete-without-json, OR a stale "generating" whose startedAt is older than STALE_MS=4min); it returns rows only to the winner, so the caller knows whether to launch the job. This both recovers orphaned runs and prevents concurrent POSTs (mount + retry) from launching duplicate Claude jobs.
  - **Why a real timestamp, not `createdAt`:** `createdAt` is the scan time, not the generation-start time, so using it as a staleness proxy falsely restarts healthy runs on any scan older than the window. Always measure staleness from when generation actually started.
- **Latency is genuinely Claude:** prod generation of 3 detailed Turkish scenarios takes ~2 min (dev ~50s). The app fires instantly and polls (304 until done). Loading copy tells users it takes 1-2 min; frontend poll has a 4.5-min hard timeout → error state with manual "Tekrar Dene" (deliberately manual, not auto-retry, to avoid restart loops on legit-but-slow runs).
- **DB push gotcha:** `pnpm --filter @workspace/db run push` can block on an UNRELATED interactive destructive prompt (e.g. newsletter_subscribers unique constraint). For a purely additive nullable column, apply `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` directly on dev; the schema file stays source-of-truth for the publish-time prod migration.
