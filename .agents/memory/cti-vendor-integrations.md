---
name: Admin integrations page is a display-only catalog
description: How /panel/entegrasyonlar lists integrations and the rules for extending it
---

The admin integrations page (`artifacts/cyberstep/src/pages/admin-panel/entegrasyonlar.tsx`) is a **pure-frontend catalog** — a static `INTEGRATIONS: IntegrationDef[]`. Adding an integration = appending an entry; no DB/API needed for display.

**Rule — adding a new category requires THREE edits in lockstep** or it silently won't render/filter:
1. the entry's `category` string
2. register it in `SECURITY_CATEGORIES` or `PLATFORM_CATEGORIES` (controls render order + filter chips)
3. register it in `CATEGORY_ICONS` (lucide component; falls back to Shield if missing)

**Active-status nuance:** the frontend `isActive` only checks a single `envKey` against `/api/admin-panel/settings/apikeys`. That endpoint ONLY returns keys in the backend `CONFIGURABLE_API_KEYS` whitelist (settings.ts, ~7 keys). Any integration whose envKey is NOT whitelisted (iyzico, e-fatura, all CTI vendor feeds) therefore always shows "API Anahtarı Gerekli" until the key is set via Replit Secrets — it can never falsely show "Aktif". This is the established pattern; multi-key services (Censys ID+SECRET, MISP URL+KEY) intentionally only track the primary key.
