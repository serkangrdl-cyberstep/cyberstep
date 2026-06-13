# CyberStep — "Türkiye Siber Risk Endeksi" Otorite Raporu Sistemi

## Replit Agent'a Ver

---

## ÖNCE KONTROL ET — HENÜZ DEĞİŞİKLİK YAPMA

```
Aşağıdakileri kontrol et ve bana rapor ver, HENÜZ DEĞİŞİKLİK YAPMA:

1. Tüm tarama sonuçlarının (risk skoru, asset_classification, CVE
   eşleşmeleri, WAF tespiti vb.) tutulduğu ana tablo(lar) hangileri?
   Toplam kaç domain/şirket için veri var (yaklaşık sayı)?

2. Domain'lerin sektör/sektör kodu bilgisi tutuluyor mu? (örn. NACE
   kodu, "tekstil", "e-ticaret" gibi bir alan var mı?) Yoksa, şirket
   adı/domain'den sektör tahmini yapan bir mekanizma var mı?

3. Şehir/bölge bilgisi (IP geolocation, whois, veya başka bir kaynaktan)
   tutuluyor mu?

4. Mevcut raporlama/PDF üretim altyapısı (pdfReportGenerator.ts veya
   benzeri) hangi kütüphaneyi kullanıyor? Bu altyapı, tek bir müşteri
   raporu dışında "toplu/agregre" bir rapor üretebilir mi (örn. birden
   fazla domain'in verisini özetleyen bir doküman)?

5. KVKK/gizlilik politikasında, toplanan verinin anonim/agregre
   istatistiksel raporlama amacıyla kullanılabileceğine dair bir
   madde var mı? (Yoksa bu prompt'ta eklenecek rapor için hukuki
   çerçeve netleştirilmeli — agregre/anonim istatistik KVKK'da
   genelde sorunsuzdur ama mevcut metni kontrol et.)

6. Cron job'ların listesi (83 cron, 9 kategori) — bunlardan hangisi
   "haftalık/aylık özet" tipi bir job'a en yakın? Yeni bir kategori
   eklenmeli mi yoksa mevcut bir kategoriye mi sığar?

Bu bilgileri özetle, ardından devam talimatını bekle.
```

---

## GENEL KURALLAR

- Bu özellik **agregre/anonim** veri kullanır — rapor hiçbir zaman
  belirli bir şirketin adını, domain'ini veya tanımlayıcı bilgisini
  içermez. Sadece "taranan X domain'in %Y'si Z özelliğine sahip"
  formatında istatistik.
- Mevcut tarama/scoring/cron altyapısını BOZMA — bu, var olan veri
  üzerinde salt-okunur bir agregasyon katmanıdır.
- Migration'lar additive olsun.
- Marka paletini kullan: #060D1A, #00C8FF, #F5A623, #E8EDF5.

---

## BÖLÜM 1 — AGREGASYON SORGUSU VE VERİ MODELİ

### Amaç
Mevcut tarama verisinden, çeyreklik bazda yayınlanabilecek istatistikler
üret. Örnek metrikler (mevcut veri yapına göre uyarla):

- Taranan domain'lerin risk skoru dağılımı (0-39 / 40-59 / 60-79 / 80-100
  aralıkları, mevcut MITRE eşiklerinle uyumlu)
- En yaygın 5 zafiyet kategorisi (CVE bazlı, en sık görülen CWE/zafiyet
  tipi)
- WAF kullanım oranı (taranan domain'lerin kaçında WAF tespit edildi)
- DMARC/SPF/SSL yapılandırma oranları (mevcut scoring rubric'indeki
  kriterlerden)
- Asset classification dağılımı (kaçı web app, API, ölü sayfa vb. —
  son uygulanan Detectify-inspired özellikten)
- Sektör bazlı kırılım (eğer sektör verisi mevcutsa — yoksa bu metrik
  atlanır)

### Veri Modeli

```sql
CREATE TABLE IF NOT EXISTS authority_report_snapshots (
  id SERIAL PRIMARY KEY,
  report_period text NOT NULL,        -- '2026-Q2' formatında
  generated_at timestamp DEFAULT now(),
  total_domains_analyzed integer,
  metrics jsonb NOT NULL,             -- tüm agregre metrikleri JSON olarak sakla
  status text DEFAULT 'draft'         -- 'draft' | 'reviewed' | 'published'
);
```

`metrics` alanı içinde örnek yapı:

```json
{
  "score_distribution": { "0-39": 12, "40-59": 34, "60-79": 41, "80-100": 13 },
  "top_vulnerability_categories": [
    { "category": "Eski TLS Sürümü", "percentage": 38 },
    { "category": "Açık Yönetim Paneli", "percentage": 22 }
  ],
  "waf_adoption_rate": 27,
  "dmarc_reject_rate": 14,
  "asset_classification_summary": { "web_app": 412, "api": 88, "dead_pages": 156 },
  "sector_breakdown": { "e-ticaret": 23, "uretim": 18, "lojistik": 9 }
}
```

Sektör verisi yoksa `sector_breakdown` alanını boş bırak/atla — bu
metrik opsiyonel.

### Agregasyon Fonksiyonu

Yeni bir cron job ekle (mevcut wrapCron pattern'ini kullan, "Reporting"
veya en yakın mevcut kategoriye ekle):

```typescript
async function generateAuthorityReportSnapshot(period: string) {
  // Son 90 günde taranan tüm domain'lerden agregre metrikleri hesapla.
  // ÖNEMLİ: Sorgular sadece istatistiksel toplamlar döndürmeli — tek bir
  // domain'i tanımlayacak şekilde gruplama YAPMA (örn. "en az 10 domain"
  // içermeyen bir kırılım yayınlanmamalı, k-anonymity prensibi).

  const metrics = {
    score_distribution: await getScoreDistribution(),
    top_vulnerability_categories: await getTopVulnerabilityCategories(5),
    waf_adoption_rate: await getWafAdoptionRate(),
    dmarc_reject_rate: await getDmarcRejectRate(),
    asset_classification_summary: await getAssetClassificationSummary(),
    sector_breakdown: await getSectorBreakdown(), // varsa
  };

  await db.insert(authorityReportSnapshots).values({
    reportPeriod: period,
    totalDomainsAnalyzed: await getTotalDomainCount(),
    metrics,
    status: 'draft',
  });
}
```

**k-anonymity kuralı**: Herhangi bir kırılım (örn. sektör bazlı), o
kırılımda en az 10 domain yoksa raporda gösterilmesin (örn. "kozmetik
sektöründe 3 domain" gibi küçük gruplar dışlanır — hem gizlilik hem
istatistiksel anlamlılık için).

---

## BÖLÜM 2 — ADMİN PANEL: TASLAK İNCELEME

### Amaç
`status = 'draft'` olan snapshot'ları admin panelde gösteren bir sayfa
— ISR ekibi sayıları gözden geçirip, gerekirse manuel not/yorum ekleyip
`status = 'reviewed'` yapabilir.

### UI

Yeni bir admin sayfası: `/admin/authority-reports` (veya mevcut admin
route yapısına uygun):

```
TÜRKİYE SİBER RİSK ENDEKSİ — TASLAKLAR

┌────────────────────────────────────────────┐
│ 2026-Q2 (Taslak)          Oluşturuldu: ...  │
│                                              │
│ Toplam analiz edilen domain: 487            │
│                                              │
│ Risk Skoru Dağılımı:                        │
│  0-39:   12 (%2.5)                          │
│  40-59:  134 (%27.5)                        │
│  60-79:  241 (%49.5)                        │
│  80-100: 100 (%20.5)                        │
│                                              │
│ En Yaygın Zafiyetler:                       │
│  1. Eski TLS Sürümü — %38                   │
│  2. Açık Yönetim Paneli — %22               │
│  ...                                        │
│                                              │
│ [İncelendi olarak işaretle] [PDF Önizle]    │
└────────────────────────────────────────────┘
```

---

## BÖLÜM 3 — PDF/YAYINLANABİLİR RAPOR ÜRETİMİ

### Amaç
`status = 'reviewed'` bir snapshot'tan, paylaşılabilir bir PDF/rapor
üret — bu rapor LinkedIn'de, basın bültenlerinde, web sitesinde
yayınlanabilir.

### İçerik Yapısı (mevcut PDF altyapısını kullan)

```
SAYFA 1 — KAPAK
- "Türkiye Siber Risk Endeksi — 2026 Q2"
- CyberStep logosu, marka paleti
- "X domain'in analiz edildiği [tarih aralığı] dönemine ait bulgular"

SAYFA 2 — GENEL DURUM
- Risk skoru dağılımı (bar chart)
- "KOBİ'lerin %X'i 'kritik' risk seviyesinde" gibi 1-2 öne çıkan bulgu

SAYFA 3 — EN YAYGIN ZAFİYETLER
- Top 5 zafiyet kategorisi, kısa açıklamalarla
- Her biri için "ne anlama geliyor, nasıl düzeltilir" 1-2 cümle

SAYFA 4 — SEKTÖR GÖRÜNÜMÜ (varsa)
- Sektör bazlı risk skoru karşılaştırması

SAYFA 5 — METODOLOJİ VE İLETİŞİM
- "Bu rapor, CyberStep'in [tarih] döneminde gerçekleştirdiği X taramanın
  anonim/agregre analizidir. Hiçbir şirket adı veya tanımlayıcı bilgi
  içermez."
- KVKK uyum notu
- CyberStep iletişim/web sitesi
```

Marka paleti: #060D1A koyu zemin, #00C8FF/#F5A623 vurgular, #E8EDF5 metin
— mevcut PDF şablonlarındaki stil ile tutarlı.

### Çıktı

PDF, `/admin/authority-reports` sayfasından "PDF İndir" butonuyla
üretilsin, ayrıca public web sitesinde `/raporlar` veya `/insights`
gibi bir route'ta (varsa mevcut blog/içerik yapısına uygun) listelenmek
üzere bir kayıt oluşturulsun:

```sql
ALTER TABLE authority_report_snapshots
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS published_at timestamp;
```

---

## BÖLÜM 4 — TEASER/PAZARLAMA İÇERİĞİ ÜRETİMİ (Opsiyonel)

Mevcut AI içerik üretim servisini (Claude tabanlı, "Adım" markalı —
önceki prompttan) kullanarak, yayınlanan her rapordan otomatik olarak:

- 1 LinkedIn gönderisi taslağı (öne çıkan 1 istatistik + rapora link)
- 1 kısa basın bülteni taslağı

üret ve admin panelde "İncele ve Yayınla" kuyruğuna ekle (mevcut sosyal
medya otomasyon kuyruğuna benzer şekilde — eğer böyle bir kuyruk varsa
onu kullan).

---

## TEST

1. Build:
   ```
   pnpm --filter @workspace/api-server run build
   ```

2. Agregasyon cron'unu manuel tetikle, sonucu kontrol et:
   ```sql
   SELECT report_period, total_domains_analyzed, metrics
   FROM authority_report_snapshots ORDER BY generated_at DESC LIMIT 1;
   ```
   - `metrics` JSON'u mantıklı sayılar içeriyor mu?
   - k-anonymity kuralı uygulanmış mı (10'dan az domain içeren kırılımlar
     yok mu)?

3. `/admin/authority-reports` sayfasını aç, taslağı görüntüle, "İncelendi"
   olarak işaretle.

4. PDF üret, içeriği kontrol et — hiçbir yerde domain adı/şirket adı
   geçiyor mu? (GEÇMEMELİ)

5. Eğer Bölüm 4 uygulandıysa, üretilen LinkedIn/basın bülteni taslağını
   incele — agregre veriye dayalı, doğru Türkçe, marka tonuna uygun mu?

6. git commit && git push.

---

## NOT — İLK YAYIN İÇİN MİNİMUM VERİ EŞİĞİ

Eğer toplam taranan domain sayısı 30'un altındaysa, raporu yayınlamadan
önce ISR ekibine bir uyarı göster: "Örneklem küçük (N=X), istatistiksel
güvenilirlik düşük olabilir — yayın öncesi bu durumu raporda belirtmeyi
veya yayını ertelemeyi düşünün." Bu, ilk çeyrekte küçük örneklemle
yayınlanan bir raporun güvenilirlik algısını zedelememesi için.
