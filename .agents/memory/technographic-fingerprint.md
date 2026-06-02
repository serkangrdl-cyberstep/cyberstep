---
name: Technographic Fingerprint Engine
description: Domain teknoloji stack tespiti — 5 analyzer, maturity hesaplama, admin sayfası
---

## Tables
- `customer_tech_stack` — UNIQUE(domain, category, vendor, product); onConflictDoUpdate by that composite key
- `customer_security_maturity` — UNIQUE(domain); upsert on conflict

## Analyzers (all in `artifacts/api-server/src/services/technographics/`)
- `headerAnalyzer.ts` — WAF/CDN/server/language/security headers; cast axios h["x"] with `String(h["x"] || "")` and `Array.isArray(rawCookies)` pattern — raw axios header types are `string | number | true | string[] | AxiosHeaders`
- `dnsAnalyzer.ts` — MX/TXT/NS; detects mail providers, SPF, DMARC, DNS hosting
- `htmlAnalyzer.ts` — CMS, ecommerce (TR: İdeasoft/T-Soft/İkas), analytics, support, CRM, payment tools
- `sslAnalyzer.ts` — cert CA, org name, TLS version; uses `(resp.request as any)?.socket` pattern
- `shodanAnalyzer.ts` — open ports (critical: 23/3389/3306/SMB), hosting provider, firewall vendor; requires `SHODAN_API_KEY`

## Maturity Calculation
Email (30%) + Web (35%) + Infra (25%) + Visibility (10%) = overall 0-100
Levels: low/medium/high/enterprise

## Routes
- `GET /api/admin-panel/tech-stack/stats` — unique domains, key vendor counts
- `GET /api/admin-panel/tech-stack/segments` — fortinet/critical-port/enterprise segment lists
- `GET /api/admin-panel/tech-stack/:domain` — full stack + maturity for one domain
- `POST /api/admin-panel/tech-stack/fingerprint` — trigger live scan

## Admin UI
- `/panel/tech-intelligence` in "İstihbarat & Teknografi" NAV section
- Uses `adminFetchJson`, not raw fetch

## TypeScript gotchas
- `req.params["x"]` is typed as `string | string[]` in this project's Express setup → always do `String(req.params["x"])`
- `if (!x) return res.json(...)` inside async route → use `{ res.json(...); return; }` block to avoid TS7030
