---
name: Platform Operasyon Kataloğu
description: Master plan uygulama durumu — service_catalog şeması, yeni tablolar, portal, eksik sprintler
---

## Uygulanan (Sprint 1-3)

**A — Servis Kataloğu**
- service_catalog tablosuna eklenen kolonlar: service_type, price_tl, price_tl_annual, usage_unit, setup_time_hours, delivery_time_hours, sla_response_minutes, requirements, target_audience, is_self_service, requires_admin_approval
- lib/db/src/schema/service-catalog.ts Drizzle şeması güncellendi (varchar import eklendi)
- 27 toplam servis (8 orijinal entegrasyon paketi + 19 plan servisi); 23 aktif
- GET /api/public/service-catalog — auth gerektirmez, herkese açık

**B — Tablolar**
- customer_onboarding (customer_id UNIQUE FK, 10 boolean step + timestamplar)
- customer_services (customer_id + service_catalog_id FK, renewal_attempt_count, last_renewal_failed_at)
- lib/db/src/schema/customer-onboarding.ts + customer-services.ts oluşturuldu

**C — Ödeme**
- coupons tablosu: discount_type (percent/fixed_tl), max_uses, valid_from/until, applicable_services[]
- POST /api/coupons/validate (public) + CRUD (admin-only)
- artifacts/api-server/src/services/subscription-renewal.ts: startRenewalCron() 09:00 Istanbul, 3-deneme retry, e-posta bildirimi
- GET /api/customer/service-subscriptions + POST /api/customer/service-subscriptions/:id/cancel (IDOR korumalı)

**G — Portal**
- /hesabim/servislerim sayfası: aktif servisler + entegrasyon durumu + satın alınabilecekler
- Route App.tsx'e eklendi

## Sprint D — Entegrasyon (TAMAMLANDI)
- Slack OAuth: slack_integrations tablosu; GET/DELETE/POST /api/integrations/slack/*; SlackSection bileşeni
- Adım bazlı kurulum kılavuzu UI entegrasyonlarim'a eklendi
- SLACK_CLIENT_ID + SLACK_CLIENT_SECRET + SLACK_REDIRECT_URI env var'ları gerekli

## Sprint E — Platform Monitoring (TAMAMLANDI)
- cron_job_metrics tablosu + Drizzle şeması; recordCronRun() heartbeat helper
- /api/admin/platform-health (servis sağlığı), /crons (job metrikleri), /email-queue (kuyruk)
- /panel/platform-saglik admin sayfası (3 tab: Servis Sağlığı, Cron Joblar, E-posta Kuyruğu)
- admin-layout NAV_SECTIONS'a "Platform Sağlığı" eklendi

## Sprint F — E-posta Dizileri (TAMAMLANDI)
- email_sequence_queue tablosu + Drizzle şeması
- enqueueSequence() + processEmailQueue() servisleri
- Diziler: registration (5 adım: D0/D2/D5/D10/D14), full_assessment_purchased (4), soc_activated (3)
- Her 30 dk cron (index.ts'e eklendi)

## Önemli Notlar
- useRequireCustomer() → { data: customer, isLoading } (TanStack Query result, `customer/loading` DEĞİL)
- service_catalog orijinal 8 servis (fortinet-fabric, dns-izleme vs.) korundu, yeniler eklendi
- customer_service_subscriptions (Task #59) ve customer_services (plan B) farklı tablolardır, her ikisi aktif
