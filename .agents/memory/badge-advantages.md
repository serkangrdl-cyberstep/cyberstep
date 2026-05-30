---
name: Badge advantages feature
description: Timed verification badges + partner perks CRUD system for CyberStep
---

## What was built

- **DB**: `badge_advantages` table (id, title, partner_name, description, discount_percent, badge_text, logo_url, is_active, sort_order, created_at) — startup migration in `api-server/src/index.ts`
- **DB**: `reports` table gained 3 columns: `verified_at`, `verification_expires_at`, `verification_duration_years` — startup migration in `api-server/src/index.ts`
- **Admin CRUD**: `GET/POST/PUT/DELETE /api/admin-panel/badge-advantages` in `analytics.ts`
- **Public endpoint**: `GET /api/badge-advantages` (active only, ordered by sort_order) in `assessments/index.ts`
- **Issue-verification endpoint**: now accepts `durationYears` (1 or 2) in body, sets `verifiedAt` + `verificationExpiresAt`; revoke clears all three columns
- **Verify page**: handles 410 (expired) with dedicated "Süresi Doldu" UI; shows expiry date when valid
- **Assessment report**: shows `verifiedAt` + `verificationExpiresAt` on badge card; `BadgeAdvantagesSection` shows partner perks (hidden if empty)
- **Home page**: `BadgeAdvantagesSection` marketing section before Pricing (hidden if no active advantages)
- **Admin UI**: `/panel/rozet-avantajlari` page; admin assessments dialog now has 1/2 year duration selector

**Why:**
CyberStep verification badges needed time-bounded validity to give them annual renewal value + partner perks create a tangible incentive for customers to seek the badge.

**How to apply:**
- The badge section on home/report only renders when the public endpoint returns ≥1 active advantage
- Expired badges return HTTP 410 from verify route — frontend checks `error.message === "expired"`
- `stats/summary` MUST stay before `/:id` in Express (existing rule)
