---
name: Certstream Lead Addon
description: Real-time TR lead discovery via the existing Certstream WebSocket — architecture, wiring, and key constraints.
---

## Architecture

The existing `certstream-client.ts` already connects to wss://certstream.calidog.io for phishing detection. The lead addon reuses this **same WebSocket** — no second connection.

`handleCertForLeadDiscovery(cert)` is called fire-and-forget at the top of `processCertificate()`, before the phishing loop, so it runs for every cert regardless of watched domains.

## Key constraints

- **Never throw** from `handleCertForLeadDiscovery` — any exception would be swallowed by a `.catch(() => {})` wrapper, but still keep the function safe internally.
- **Batch buffer**: 50 entries or 30 seconds → flush to `certstream_queue` (ON CONFLICT DO NOTHING on root_domain).
- **Score threshold**: `corporateScore >= 60` (from analyzeSubdomain scoring rules) required to qualify.
- **Hourly cron**: `processCertstreamQueue(100)` in index.ts at `0 * * * *`.

## DB tables

- `certstream_queue` — buffer for incoming TR certs; UNIQUE on root_domain; has `processed` flag.
- `certstream_status` — single-row (id=1) stats table; updated probabilistically (1-in-1000 certs) to avoid DB pressure.

## Exports added to crtshScanner.ts

`analyzeSubdomain`, `loadScoringRules`, `extractRootDomain`, `isTurkishDomain`, `isExcluded` — all were internal functions, now exported for reuse.

**Why:** certstreamLeadFilter needs the same scoring logic as crt.sh scanner; exporting avoids duplication.

## Admin UI

`/panel/lead-discovery` → "Certstream" tab (first tab, default view).
Widget: status dot, 6-stat grid, info box, manual "Queue İşimdi İşle" button, 10s auto-refresh.

Routes:
- `GET /api/admin-panel/lead-discovery/certstream/status`
- `POST /api/admin-panel/lead-discovery/certstream/process`
