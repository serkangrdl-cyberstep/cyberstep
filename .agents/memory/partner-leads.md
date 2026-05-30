---
name: Partner leads & business model pages
description: 4 new revenue model pages with lead capture, shared partner_leads DB table, and POST /api/public/partner-lead endpoint
---

## What was built

4 iş modeli sayfası + ortak lead altyapısı:

- `/erp-entegrasyonu` — ERP widget ortaklık programı (Logo/Mikro/Netsis/Luca)
- `/sigorta-pazaryeri` — Siber sigorta pazaryeri, Tabs ile çift taraflı form (KOBİ / sigortacı)
- `/tehdit-istihbarati` — 3 veri ürünü (yıllık rapor, IoC API, aktüeryal veri)
- `/skor-api` — API ürün sayfası, kod örneği + 3 kademeli fiyatlandırma

## DB

`partner_leads` tablosu — lead_type alanıyla hepsi aynı endpoint'e gider.
- `lead_type` değerleri: `erp` | `insurance` | `threat-intel` | `score-api`
- Schema: `lib/db/src/schema/partner-leads.ts`

## API

`POST /api/public/partner-lead` — public router'da, auth yok, rate limit saatte 5 istek.

**Why:** Tek endpoint birden fazla lead tipini handle eder; leadType ile backend ve admin tarafında ayrım yapılır. Yeni lead tipi eklemek için sadece frontend form + leadType string yeterli.
