# CyberStep — Teaser & PDF Raporlarına WAF/Confidence Disclaimer Ekleme

## Replit Agent'a Ver

---

## ÖNCE KONTROL ET — HENÜZ DEĞİŞİKLİK YAPMA

```
Aşağıdakileri kontrol et ve rapor ver, herhangi bir değişiklik yapma:

1. domain_scans tablosunda (veya ilgili scan sonuç tablosunda) şu kolonlar var mı:
   wafDetected, wafProvider, wafConfidence, confidenceScore, confidenceNote
   psql $DATABASE_URL -c "\d domain_scans" ile şemayı göster.

2. src/services/wafDetector.ts ve src/services/osintEnrichment.ts dosyaları
   var mı? Varsa confidenceScore/confidenceNote üretip üretmediklerini göster.

3. src/services/leadTeaserEmail.ts dosyasında, mail body'sinde
   wafDetected/confidenceScore/confidenceNote alanlarına referans var mı?

4. PDF rapor üreten dosyada (örn. src/services/pdfReportGenerator.ts veya
   benzeri) confidence/WAF bilgisi PDF'e basılıyor mu?

Sonuçları özetle, sonra devam talimatını bekle.
```

---

## DURUM A: Alanlar DB'de var ama teaser/PDF'e işlenmemiş

Aşağıdaki adımları uygula.

## DURUM B: Alanlar DB'de de yok

Önce migration ile şu alanları ekle (yoksa):

```sql
ALTER TABLE domain_scans
  ADD COLUMN IF NOT EXISTS waf_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS waf_provider text,
  ADD COLUMN IF NOT EXISTS waf_confidence text,
  ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT 95,
  ADD COLUMN IF NOT EXISTS confidence_note text;
```

Ardından tarama akışında (`runDomainScan` veya orchestrator) bu alanları
hesaplayıp yazan mantığı ekle — daha önce tasarlanan BÖLÜM 3/4 kuralları:

```
confidenceScore hesaplama:
- WAF yok:                              95
- WAF var, confidence=high:             60
- WAF var, confidence=medium:           70
- WAF var, confidence=low:              80
- WAF var + OSINT zenginleştirme ile
  gerçek sunucu tespit edildi:          75
```

---

## BÖLÜM 1 — TEASER MAİL ŞABLONUNA DISCLAIMER EKLE

`src/services/leadTeaserEmail.ts` (veya ilgili template fonksiyonu) içinde,
mail body'sinin EN ALTINA, footer'dan ÖNCE şu bloğu koşullu olarak ekle.

### Koşul: `confidenceScore < 85` (yani WAF tespit edildiyse veya bulgular kısmi güvenilirlikte ise)

```typescript
function buildConfidenceDisclaimer(scan: {
  wafDetected: boolean;
  wafProvider: string | null;
  confidenceScore: number;
  confidenceNote: string | null;
}): string {
  if (!scan.wafDetected || scan.confidenceScore >= 85) {
    return ""; // Disclaimer gerekmiyor, tarama tam görünürlükle yapıldı
  }

  const providerText = scan.wafProvider
    ? `${scan.wafProvider} altyapısı`
    : "bir güvenlik duvarı/CDN";

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️ Önemli Not — Tarama Görünürlüğü Hakkında

Bu domain ${providerText} arkasında çalışıyor. Bu durumda:

✅ E-posta güvenliği (SPF/DKIM/DMARC) ve SSL sertifika bulguları
   her zamanki gibi %100 güvenilirdir — bunlar DNS ve sertifika
   katmanından doğrudan okunur.

⚠️ Web sunucusu/uygulama katmanına dair bulgular (açık portlar,
   sürüm bilgileri, CVE eşleşmeleri) ${providerText} tarafından
   maskelenmiş olabilir. Gerçek altyapınız bu raporda görünenden
   daha güvenli OLABİLİR veya farklı riskler taşıyor OLABİLİR.

Bu rapor, halka açık kaynaklardan (OSINT) elde edilen verilere
dayanır ve genel bir ön değerlendirme niteliğindedir. Kesin ve
eksiksiz bir değerlendirme için iç ağdan yapılan bir tarama
(authenticated/internal scan) önerilir — CyberStep ekibi bu
hizmeti de sunmaktadır.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}
```

Bu fonksiyonu mail body'yi oluşturan ana fonksiyon içinde çağır ve
mevcut "Bu e-posta [domain] domaininin kamuya açık güvenlik taramasına
dayanmaktadır..." cümlesinden ÖNCE ekle.

### HTML versiyon (eğer mail HTML formatındaysa)

Aynı içeriği amber/sarı tonlu bir bilgi kutusu olarak render et
(CyberStep paleti: arka plan `#FFF6E8`, metin `#1A2B45`, ikon rengi
`#F5A623`). Mevcut HTML email template'inin stiline uygun bir
`<div>` bloğu olarak ekle, inline CSS kullan (email client uyumluluğu
için).

---

## BÖLÜM 2 — TEASER'IN GÖRÜNÜR (KİLİTSİZ) KISMINA RİSK SKORU ETİKETİ EKLE

Teaser'da gösterilen Risk Skoru'nun yanına, eğer `confidenceScore < 85`
ise küçük bir etiket ekle:

```
Risk Skoru: 56/100  [Kısmi Görünürlük]
```

Tooltip/açıklama metni: "Bu skor, WAF/CDN nedeniyle kısmi görünürlükle
hesaplanmıştır. Detaylar için aşağıdaki notu okuyun."

`confidenceScore >= 85` ise hiçbir etiket gösterme (normal akış).

---

## BÖLÜM 3 — PDF RAPORUNA AYNI DISCLAIMER'I EKLE

PDF rapor üreten servis dosyasında (rapor genelde 3 sayfa: özet,
bulgular, aksiyon planı), 1. sayfanın (özet) altına veya bulgular
sayfasının başına, aynı mantıkla bir "Tarama Görünürlüğü Notu" kutusu
ekle. PDF'in mevcut tasarım dilini (CyberStep paleti) kullan:

- Arka plan: `#FFF6E8` (amber tint)
- Başlık rengi: `#F5A623`
- Metin rengi: `#1A2B45`
- İkon: ⚠️ veya bilgi ikonu

İçerik aynı `buildConfidenceDisclaimer` metnini kullanabilir, sadece
markdown/PDF formatına uyarlanmış hali (paragraf yapısı korunarak).

`confidenceScore >= 85` ise PDF'te bu kutu hiç render edilmesin.

---

## BÖLÜM 4 — ADMIN PANEL LEAD DETAY MODALINA GÖRÜNÜRLÜK ROZETİ

Lead detay modalında (örn. `lead-discovery.tsx` içindeki domain detay
popup'ı — "ISR AKSİYONLARI" bölümünün üstüne), Risk Skoru'nun yanına
küçük bir rozet ekle:

```tsx
{scan.confidenceScore < 85 && (
  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100
    text-amber-800 border border-amber-300">
    Kısmi Görünürlük ({scan.confidenceScore}/100)
  </span>
)}
```

Bu, ISR ekibinin (veya sen) bu lead'e nasıl yaklaşması gerektiğini
(örn. "bu bulguyu satış konuşmasında kesin gibi sunma") anlamasını
sağlar.

---

## TEST

1. Cloudflare arkasında olduğu bilinen bir domain ile test taraması yap
   (örn. mevcut taranmış domainlerden `wafDetected = true` olan birini
   bul):
   ```sql
   SELECT domain, waf_detected, waf_provider, confidence_score
   FROM domain_scans WHERE waf_detected = true LIMIT 5;
   ```

2. Bu domain için teaser üret, mail body'sinde disclaimer'ın göründüğünü
   doğrula:
   ```sql
   SELECT domain, teaser_subject, teaser_body
   FROM lead_candidates WHERE domain = '<test_domain>';
   ```

3. Aynı domain için PDF üret, disclaimer kutusunun render edildiğini
   görsel olarak kontrol et.

4. `confidence_score >= 85` olan bir domain ile tekrar test et,
   disclaimer'ın HİÇ görünmediğini doğrula (false positive olmamalı).

5. Build:
   ```
   pnpm --filter @workspace/api-server run build
   pnpm --filter @workspace/cyberstep run build
   ```

6. git commit && git push.

---

## NOT — STRATEJİK ÖNEM

Bu disclaimer, hem hukuki/itibar koruması (yanlış teknik iddiada
bulunmamak) hem de güven inşası (şeffaflık → "bu firma dürüst, abartmıyor"
algısı) sağlar. Confidence skoru düşük lead'lerde satış konuşması
"kesin açık var" yerine "bu alanlarda ek doğrulama öneriyoruz" diline
çevrilmeli — ISR scriptlerine de bu nüans eklenmeli (ayrı bir oturumda
ele alınabilir).
