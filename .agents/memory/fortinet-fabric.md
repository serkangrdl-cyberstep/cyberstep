---
name: Fortinet Security Fabric integration
description: Per-customer FortiGate/FortiAnalyzer ingestion + Claude correlation + optional FortiManager auto-block
---

# Fortinet Security Fabric

Per-customer Fortinet integration: HTTPS-only event ingestion, Claude correlation engine, optional FortiManager auto-block, 5-step customer wizard, admin panel, crons, demo mode. Turkish UI, no emojis.

## Key constraints / decisions

- **HTTPS-only ingestion.** Replit's reverse proxy routes external traffic by HTTP path only — a raw TCP/UDP syslog socket listener is NOT externally reachable. So there is no syslog server; FortiAnalyzer must use its HTTPS log-forward endpoint. The `syslogServer.ts` from the original spec is intentionally omitted.
- **Ingest routes deliver the body as raw text** (`express.text({type: () => true})`), not parsed JSON. The parser therefore must `JSON.parse` string bodies itself before falling back to FortiLog/CEF line parsing. **Why:** without this, JSON forwards are misclassified as `unknown` plain text.
- **Public ingest always returns 200** so Fortinet devices don't retry-storm on bad/unknown tokens.
- **Critical/high events trigger immediate correlation** (fire-and-forget) from the ingest handler; everything else is picked up by the 15-min batch cron.

## Security rules (do not regress)

- **`ENCRYPTION_KEY` must be a Secret, never a shared env var.** Shared env vars are written to `.replit`, which is git-tracked → committing the key leaks it. It encrypts FortiManager credentials (AES-256-GCM). The crypto layer returns null (no crash) when the key is absent; FM features just disable until it's set.
- **Ingestion tokens live in the URL path** (`/fabric/webhook/:token`, `/fabric/syslog/:token`, `/fabric/verify/:token` — all POST). The pino-http request serializer in `app.ts` masks these path segments so tokens never land in logs.

## Public API contract (spec-mandated — do not rename)

- Public ingestion endpoints are exactly `POST /api/fabric/webhook/:token`, `POST /api/fabric/syslog/:token`, `POST /api/fabric/verify/:token` (verify is POST, not GET). The demo trigger is `POST /api/fabric/demo/trigger` and is **admin-guarded** (picks the most recent integration, or one by `integrationId` in the body). **Why:** the task acceptance criteria pin these exact paths; an earlier `/api/public/fabric/ingest/...` naming was rejected in code review. The customer wizard also has a self-service `POST /api/portal/fabric/demo`, separate from the admin trigger.
- Admin must expose a **global event stream** (`GET /api/admin/fabric/events`) in addition to correlations/streams; the customer portal dashboard must render events, correlations, **block history**, and **discovered fabric devices** — all four, not just events/correlations.
- **AI correlation context must be tenant-scoped.** `domain_scans` has no `customerId` — it links by `email`. Filter the latest scan by the customer's email, or another tenant's scan leaks into the Claude prompt.

## FortiManager JSON-RPC gotchas (do not regress)

- **FM returns HTTP 200 even on logical failure** — must check the JSON body `result[0].status.code === 0`. A `rpcStatus()` helper enforces this on every write (address create, group set, policy install) and read (verify, discovery); a non-zero install fails the block instead of being best-effort.
- **Block-group update must append, not clobber.** `set` on `addrgrp` with `member:[x]` overwrites the whole member list. `fmBlockIp` first `get`s current members, merges (dedup), then `set`s the union — otherwise each new block silently removes all previously blocked IPs.

## AI

- Correlation uses `getClaudeAiFn()` → `(prompt: string) => Promise<string>`; heuristic fallback if AI fails. Critical/high correlations send a Turkish email alert via `sendMail`.

## Parser severity/eventType quirks (validated against real FortiGate formats)

- **CEF severity is inverted vs FortiGate syslog.** CEF uses 0-10 where HIGHER = more severe; FortiGate syslog `pri`/`level` use 0-7 where LOWER = more severe. `fabric-parser.ts` has one numeric `mapSeverity` that assumes syslog semantics, so CEF header severity (e.g. `9`) was misread as `info`. Fix: `mapCefSeverity()` maps the CEF header number to a word in the CEF branch *before* `normalizeFromKv`. **Why:** a real critical CEF event was silently downgraded to info and never triggered correlation. Do not route CEF severity through the plain numeric path.
- **Prefer FortiGate `subtype` over `type` for eventType.** Real UTM logs carry `type=utm` with the meaningful class in `subtype` (ips/virus/webfilter/app-ctrl). `deriveEventType()` uses `subtype` when `type` ∈ CONTAINER_TYPES (utm/traffic/event/anomaly/voip/waf/dlp/gtp), matching demo data granularity. Plain `type` collapses all threats to "utm".
- **attackName key order matters.** `app` (app-control) and `catdesc` (webfilter) must come before generic `msg`, or app-ctrl/webfilter events fall back to the description string instead of the real indicator.
