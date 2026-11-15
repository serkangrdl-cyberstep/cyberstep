# Arşiv — TPRM odaklı yeniden yapılanma (Kasım 2026)

CyberStep, Kasım 2026'da tedarikçi siber risk skorlamasına (TPRM) odaklandı. Bu süreçte bazı bölümler sitede gizlendi. **Hiçbir kod silinmedi.**

## Tam yedek

Değişiklik öncesi sitenin ve uygulamanın tamamı GitHub'da şu branch'te duruyor:

- Branch: `arsiv/oncesi-tprm-2026-11` (commit `b90a523`, 23 Ekim 2026 yayını)

Eski bir dosyaya bakmak için:

```bash
git fetch origin arsiv/oncesi-tprm-2026-11
git show origin/arsiv/oncesi-tprm-2026-11:artifacts/cyberstep/src/pages/home.tsx
```

## Gizlenen bölümler ve geri açma

Gizlenen sayfaların listesi tek bir dosyada: `artifacts/cyberstep/src/lib/archived-routes.ts`

- `ARCHIVED_PUBLIC`: ziyaretçi ana sayfaya yönlenir.
- `ARCHIVED_PORTAL`: müşteri `/hesabim`'e yönlenir.

Bir bölümü geri açmak için ilgili satırı listeden silmek yeterli. Route'lar `App.tsx`'te, sayfa bileşenleri `pages/` altında yerinde duruyor. Menü ve footer bağlantıları `isArchived()` ile süzülür; listeden çıkan bölümün bağlantısı da kendiliğinden geri gelir. Ancak menüden kaldırılan grup başlıkları (ör. "AI Güvenlik") ayrıca `components/layout.tsx`'e eklenmelidir.

Gizlenen başlıca bölümler:

| Grup | Sayfalar |
|---|---|
| Servis kataloğu | `/hizmetler`, `/servisler/*`, `/satin-al/*`, portalda `/hesabim/servislerim`, `/hesabim/sepet` |
| AI güvenlik paketi | `/ai-guvenlik*`, `/ai-phishing-simulasyonu`, `/ai-arac-izleme`, `/ai-politika`, `/ai-red-team`, `/eu-ai-act`, `/ciso-asistan-paketi`, `/vciso-erken-erisim`, portalda `/hesabim/ciso-asistan` |
| Deepfake / sahte doküman | `/deepfake-analizi`, `/sahte-dokuman` |
| Phishing / pentest / BAS | `/phishing-sim`, `/pentest-lite`, `/bas-lite`, `/saldiri-simulasyonu` |
| ERP / M365 | `/erp-tarama`, `/erp-entegrasyonu`, `/m365-denetim` |
| SOC / NOC / tehdit istihbaratı | `/tehdit-istihbarati`, `/zero-day-uyari`, portalda `/hesabim/soc`, `/hesabim/noc*`, `/hesabim/ioc-*`, `/hesabim/whitelist`, `/hesabim/cloud-guvenlik`, `/hesabim/ic-tarama` |
| Diğer | `/github-tarama`, `/tarayici-eklentisi`, `/on-premise`, `/technology-discovery`, `/sigorta-pazaryeri` |

2. tur (TPRM dışı): `/dora-bddk-uyum`, `/siber-sigorta`, `/marka-koruma`, `/rakip-karsilastirma`, `/roi-hesaplayici`, `/finansal-kayip`, `/kvkk-ceza-sim`, `/kvkk-verbis`, `/kvkk-dpa-olustur`, `/kep-rehberi`, `/compliance-calendar`, `/veri-sizintisi`, `/sizinti-izleyici`, `/sektorel-kiyaslama`, `/siber-panik`, `/is-ortakligi`, `/araclar/kvkk-ceza-hesaplayici`, `/araclar/siber-risk-roi`, `/araclar/dark-web-sorgulama`, `/araclar/WAF-bypass-tarayıcı`.

Açık kalanlar: TPRM çekirdeği, ücretsiz domain tarama, KOBİ değerlendirmesi, KVKK araçları, `/araclar` altındaki tüm ücretsiz araçlar, blog/CVE/bülten ve yasal sayfalar.

## Arşivlenen sayfa sürümleri

Yeniden yazılan sayfaların eski hâlleri kod içinde duruyor; route'a bağlı değiller:

- `artifacts/cyberstep/src/pages/archive/home-legacy.tsx`: eski ana sayfa (KOBİ / EASM konumlandırması)
- `artifacts/cyberstep/src/pages/archive/pricing-legacy.tsx`: eski fiyat sayfası (servis kataloğu)
- `artifacts/cyberstep/src/pages/archive/hakkimizda-legacy.tsx`: eski Hakkımızda (KOBİ / AI güvenlik / CEM anlatısı)
- `artifacts/cyberstep/src/pages/archive/neden-cyberstep-legacy.tsx`: eski "Neden CyberStep?" (isim hikayesi, zaman çizelgesi, ekip ve kariyer formu). `/neden-cyberstep` artık `/hakkimizda`'ya yönlenir (`ARCHIVED_REDIRECT_TO`). İsim hikayesi ve ekip bölümü yeni Hakkımızda sayfasına kısaltılarak taşındı.

Üst menü ve footer da sadeleştirildi (`components/layout.tsx`, `components/footer.tsx`): ayrı "Araçlar" menüsü tek "Ücretsiz Araçlar" menüsünde birleşti; Haberler, Neden CyberStep ve İletişim üst menüden footer'a taşındı.

## Yönetim paneli ve Marketing paneli (Kasım 2026)

**Yönetim paneli** (`/panel`) menüsü 83 öğeden 40'a indi (`components/admin-layout.tsx`). Kaldırılan 43 ekran `ARCHIVED_ADMIN` listesinde (`lib/archived-routes.ts`); adresleri `/panel`'e yönlenir, kodları yerinde durur. Gruplar:

- Servis kataloğu ve eski paketler (servis fiyatları, kataloğu, yönetimi, müşteri servisleri, muhasebe, iş paketleri, eski paket planları)
- Müşteri başarı (sağlık, NPS, onboarding, referral, rozet avantajları, exposure skorları, iç tarama)
- İstihbarat / teknografi (tech intelligence, technology discovery, intelligence, CTI, reputation, marka koruma, veri sızıntısı, executive dashboard)
- SOC / NOC / entegrasyonlar (SOC, NOC, observability, Fortinet, M365, ServiceNow, IOC, kod güvenliği, remediation, DNS izleme, CT log izleme, KVKK bildirim)
- Ortaklık yan ürünleri (danışmanlık, teknoloji ortakları, white label, kariyer)
- Marketing paneline taşınanlar (özel günler, sosyal medya, demo raporlar, rozetler, marka kılavuzu); bu ekranlar Marketing panelinde (`/digest/`) mevcut

Bir ekranı geri açmak için: `ARCHIVED_ADMIN`'den satırı silin ve `admin-layout.tsx` içindeki `NAV_SECTIONS`'a menü öğesini geri ekleyin (eski menü için `arsiv/oncesi-tprm-2026-11` branch'ine bakın).

**Marketing paneli** (`artifacts/digest-admin`): Referral programı arşivlendi (`/referrallar` panoya yönlenir, `pages/Referrallar.tsx` duruyor). Menü başlıkları Türkçe karakterlerle düzeltildi. Panoya "İçerik sağlığı" kutusu eklendi (son blog / haber / digest ve içerik cron'larının son başarılı çalışması).

## Arka uç

API route'ları ve cron'lar **kapatılmadı**: SOC, NOC, AI vb. backend modülleri çalışmaya devam ediyor. Yalnızca site ve menülerden erişim kaldırıldı. `sitemap.xml`'den arşivlenen sayfalar çıkarıldı. Bu modüllerin cron'larını kapatmak ayrı bir karar olarak bırakıldı.

## Eski fiyatlı sayfalar (15 Kasım 2026)

TPRM fiyatlandırmasıyla (Başlangıç 59.000, Profesyonel 149.000, Kurumsal 600.000 TL'den) çelişen eski tek seferlik paket fiyatlarını gösteren sayfalar arşive alındı: `/sanal-ciso`, `/ma-due-diligence`, `/sektor` (ve `/sektor/:slug`). Kod yerinde; geri açmak için `archived-routes.ts` listesinden satırları silmek yeterli.
