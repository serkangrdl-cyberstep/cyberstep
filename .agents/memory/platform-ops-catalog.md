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

## Eksik Sprintler (henüz uygulanmadı)

**D — Entegrasyon Sihirbazları**
- Fortinet 5-adım, Datadog 4-adım, Azure 3-adım wizard UI (test butonları)
- Slack OAuth flow, Telegram bot token setup

**E — Platform Monitoring**
- /panel/platform-health admin sayfası
- Cron job sağlık metrikleri tablosu (cronJobMetrics)
- SLA takip fonksiyonları (getCustomerSLAMetrics)

**F — E-posta Dizileri**
- Zamanlı e-posta sequence motoru (kayıt×5, değerlendirme×4, SOC×3)

## Önemli Notlar
- useRequireCustomer() → { data: customer, isLoading } (TanStack Query result, `customer/loading` DEĞİL)
- service_catalog orijinal 8 servis (fortinet-fabric, dns-izleme vs.) korundu, yeniler eklendi
- customer_service_subscriptions (Task #59) ve customer_services (plan B) farklı tablolardır, her ikisi aktif
