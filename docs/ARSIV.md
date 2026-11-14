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

Açık kalanlar: TPRM çekirdeği, ücretsiz domain tarama, KOBİ değerlendirmesi, KVKK araçları, `/araclar` altındaki tüm ücretsiz araçlar, blog/CVE/bülten ve yasal sayfalar.

## Arşivlenen sayfa sürümleri

Yeniden yazılan sayfaların eski hâlleri kod içinde duruyor; route'a bağlı değiller:

- `artifacts/cyberstep/src/pages/archive/home-legacy.tsx`: eski ana sayfa (KOBİ / EASM konumlandırması)
- `artifacts/cyberstep/src/pages/archive/pricing-legacy.tsx`: eski fiyat sayfası (servis kataloğu)
- `artifacts/cyberstep/src/pages/archive/hakkimizda-legacy.tsx`: eski Hakkımızda (KOBİ / AI güvenlik / CEM anlatısı)
- `artifacts/cyberstep/src/pages/archive/neden-cyberstep-legacy.tsx`: eski "Neden CyberStep?" (isim hikayesi, zaman çizelgesi, ekip ve kariyer formu). `/neden-cyberstep` artık `/hakkimizda`'ya yönlenir (`ARCHIVED_REDIRECT_TO`). İsim hikayesi ve ekip bölümü yeni Hakkımızda sayfasına kısaltılarak taşındı.

Üst menü ve footer da sadeleştirildi (`components/layout.tsx`, `components/footer.tsx`): ayrı "Araçlar" menüsü tek "Ücretsiz Araçlar" menüsünde birleşti; Haberler, Neden CyberStep ve İletişim üst menüden footer'a taşındı.

## Arka uç

API route'ları ve cron'lar **kapatılmadı**: SOC, NOC, AI vb. backend modülleri çalışmaya devam ediyor. Yalnızca site ve menülerden erişim kaldırıldı. `sitemap.xml`'den arşivlenen sayfalar çıkarıldı. Bu modüllerin cron'larını kapatmak ayrı bir karar olarak bırakıldı.
