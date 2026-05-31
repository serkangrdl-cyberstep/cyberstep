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
- **Ingestion tokens live in the URL path** (`/fabric/ingest/:token` etc.). The pino-http request serializer in `app.ts` masks these path segments so tokens never land in logs.
- **AI correlation context must be tenant-scoped.** `domain_scans` has no `customerId` — it links by `email`. Filter the latest scan by the customer's email, or another tenant's scan leaks into the Claude prompt.

## AI

- Correlation uses `getClaudeAiFn()` → `(prompt: string) => Promise<string>`; heuristic fallback if AI fails. Critical/high correlations send a Turkish email alert via `sendMail`.
