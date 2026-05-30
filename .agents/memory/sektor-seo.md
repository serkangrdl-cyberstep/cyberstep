---
name: Sector SEO landing pages
description: Dynamic sector pages at /sektor/:slug for SEO targeting specific industries
---

Single dynamic component at `artifacts/cyberstep/src/pages/sektor.tsx`.
Route: `/sektor/:slug` in App.tsx.

Supported sectors (SECTORS object in sektor.tsx):
- saglik — healthcare
- finans — finance/accounting
- perakende — retail/e-commerce
- bilisim — software/IT
- imalat — manufacturing

Each sector has: headline, subheadline, metaTitle, metaDesc, 3 stats, 4 threats, 3 regulations, CTA text.

**Why:** SEO traffic from sector-specific searches ("sağlık KVKK", "muhasebe siber güvenlik") drives high-intent leads who are already aware of their compliance risks.

**How to apply:** To add a new sector, add a new key to the SECTORS object in sektor.tsx. No route change needed — /:slug handles it automatically.
