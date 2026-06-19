# WAF/CVE Çapraz Referans — Mevcut Durum Analizi

> **Rapor tarihi:** 18 Haziran 2026  
> **Kapsam:** Production veritabanı (read-only sorgular) + kaynak kod incelemesi  
> **Amaç:** WAF arkasındaki CVE eşleşmelerinin doğruluk sorununu değerlendirmek

---

## 1. WAF Tespit Mekanizması

### Sinyal Kaynakları (`artifacts/api-server/src/services/wafDetector.ts`)

Tespit çok katmanlıdır; şu sinyallerin kombinasyonu kullanılır:

| Sinyal | Örnekler |
|---|---|
| **HTTP header imzaları** | `cf-ray` (Cloudflare), `x-wa-info` (F5 BIG-IP), `x-akamai-transformed`, `x-fortigate`, `x-fortiwaf-rule-id` |
| **Cookie imzaları** | `__cfduid`, `bigipserver`, `ak_bmsc`, `FORTIWAFSID`, `aws-waf-token` |
| **Yanıt gövdesi** | "sucuri website firewall", "the requested url was rejected", "fortigate-challenge" |
| **Davranışsal probe** | `/?id=1%20OR%201%3D1&q=<script>alert(1)</script>` isteği gönderilir; WAF blok sayfası aranır |
| **IP altyapısı** | Cloudflare CIDR aralıklarıyla eşleşme; DNS PTR kaydında `cloudfront.net`, `akamaiedge` |
| **TLS sertifikası** | Issuer'da "Cloudflare Inc", "Sucuri" varlığı |

Desteklenen provider'lar: `cloudflare`, `f5`, `akamai`, `imperva`, `sucuri`, `aws_waf`, `fortinet`

### `domain_scans` Tablosundaki WAF Alanları

```sql
waf_detected        boolean           -- tespit var/yok
waf_provider        character varying -- hangi ürün (cloudflare, fortinet…)
waf_confidence      integer           -- 0-100 güven skoru
waf_bypass_possible boolean           -- kaynak IP'ye direkt erişim mümkün mü
waf_headers_added   jsonb             -- ham header kanıtları
```

### Doluluk Oranı (Production DB, 18.06.2026)

```sql
SELECT waf_detected, COUNT(*) FROM domain_scans GROUP BY waf_detected;
```

| `waf_detected` | Adet | Oran |
|---|---|---|
| `false` | 14.408 | %99,89 |
| `true` | **16** | %0,11 |
| `NULL` | 0 | — |
| **Toplam** | **14.424** | %100 dolu |

**WAF tespit edilen 16 domain'in tamamı Cloudflare, ortalama güven skoru: 90 (yüksek).**  
**Kritik bulgu: `waf_bypass_possible = true` olan domain sayısı da 16 — yani WAF tespit edilen her domain için bypass kanalı da tespit edilmiş.**

---

## 2. CVE Eşleştirmede WAF Kullanımı

### `riskAdjuster.ts` → `adjustCvesForWAF()` Fonksiyonu

Fonksiyon mevcuttur ve güven seviyesine göre kademeli CVSS azaltımı uygular:

```
WAF yok                          → değişmez
WAF var + bypass mümkün          → azaltma YOK, bypass uyarısı
WAF var + low confidence         → azaltma YOK, "doğrulanamadı" notu
WAF var + medium confidence      → CVSS × 0.80 (critical), × 0.825 (high)
WAF var + high confidence        → CVSS × 0.60 (critical), × 0.65 (high)
Servis WAF-bağımsız (SSL, email) → azaltma YOK, not eklenir
```

Fonksiyon çağrısı (`domain-scan/index.ts:1475`):

```typescript
const cveSummary = adjustCvesForWAF({
  cveSummary: cveSummaryRaw,
  wafDetected: wafResult.detected,
  wafProvider: wafResult.provider,
  bypassPossible: bypassResult.bypassPossible,
  wafConfidenceLevel: wafResult.confidenceLevel,
});
```

### Kritik Bulgu: Azaltım Pratikte Hiç Uygulanmıyor

Production'da WAF tespit edilen **16 domain'in tamamında `waf_bypass_possible = true`** olduğundan, `adjustCvesForWAF()` her zaman "bypass mümkün → azaltma yok" dalına düşüyor. Yüksek güven skoru (90) fonksiyon içinde bypass kontrolünden **sonra** değerlendiriliyor:

```typescript
if (bypassPossible) {
  return { ...cve, wafMitigated: false,
    wafMitigationNote: "WAF bypass riski yüksek. Risk azaltımı uygulanmadı." };
}
```

Dolayısıyla mevcut veride **WAF azaltımı fiilen sıfır kez devreye girmiş.**

### `cve_domain_matches` Tablosunda WAF Bilgisi Yok

```sql
-- cve_domain_matches kolonları (WAF ile ilgili ALAN YOK):
id, cve_id, domain, customer_id, lead_candidate_id,
matched_product, matched_version, confidence,
is_patched, patched_at, notification_sent, ...
```

`adjustedCvssScore` ve `wafMitigated` değerleri hesaplanıyor ama **tabloya yazılmıyor** — bellekte kalıp atılıyor. Sorgu bazlı anlık azaltım yapılabilir, ancak kalıcı kayıt yok.

### `overall_score` Formülünde WAF Etkisi

`calcScore()` fonksiyonu (`domain-scan/index.ts:158`):

```
overall_score = SPF(0-20) + DMARC(0-25) + DKIM(8-20) + MX(0-10) + SSL(0-25) - portDeduction
```

**`waf_detected` bu formüle girmiyor.** WAF'ın dolaylı etkileri:

1. `confidenceScore` hesabında kullanılıyor (WAF var + bypass yok → 72 puan; bypass var → 55 puan)
2. CDN portu risk hesabında (`waf_bypass_possible` false ise bazı portlar `none` riskle işaretleniyor)
3. CVE görsel azaltımında (yukarıda açıklandığı üzere pratikte devreye girmiyor)

---

## 3. CVE Kategori Dağılımı (Web Katmanı vs Ağ Katmanı)

### CVSS Attack Vector Analizi (cve_tracker, n=1.623)

```sql
SELECT attack_vector, COUNT(*) AS cve_sayisi, ROUND(AVG(cvss_score), 1) AS ort_cvss
FROM cve_tracker GROUP BY attack_vector;
```

| Attack Vector | CVE Sayısı | Oran | Ort. CVSS |
|---|---|---|---|
| **Network (AV:N)** | 1.173 | %72,3 | **8.7** |
| **Local (AV:L)** | 404 | %24,9 | 7.5 |
| Adjacent (AV:A) | 27 | %1,7 | 7.6 |
| Physical (AV:P) | 7 | %0,4 | 5.7 |
| Vektör yok | 12 | %0,7 | — |

**AV:N (Network) = 1.173 CVE, CVSS ort. 8.7** — bunlar HTTP/HTTPS üzerinden istismar edilebilir, teorik olarak WAF'ın kapsama alanına girer.  
**AV:L + AV:A (Local/Adjacent) = 431 CVE** — SSH, RDP, doğrudan TCP servisleri; WAF'ın kapsamı dışında.

### CWE Ayrımı

`cve_domain_matches` tablosunda **CWE ID alanı yok** — sadece `cve_id`, `matched_product`, `matched_version` var. `cve_tracker`'da da CWE ID saklanmıyor. Web katmanı (SQLi, XSS, path traversal) ile ağ katmanı (buffer overflow, RCE via SSH) ayrımı mevcut veride **yapılamıyor**.

---

## 4. Skor Dağılımı Karşılaştırması

```sql
SELECT waf_detected, COUNT(*), ROUND(AVG(overall_score),1) AS ort,
       ROUND(MIN(overall_score),1) AS min, ROUND(MAX(overall_score),1) AS max,
       COUNT(*) FILTER (WHERE overall_score < 60) AS dusuk_skorlu
FROM domain_scans WHERE overall_score IS NOT NULL
GROUP BY waf_detected;
```

| `waf_detected` | Domain | Ort. Skor | Min | Max | Skor < 60 |
|---|---|---|---|---|---|
| `false` | 14.408 | **60,9** | 0,0 | 100,0 | 6.603 (%45,8) |
| `true` | **16** | **81,8** | 28,0 | 100,0 | 1 (%6,3) |

**WAF tespit edilen domainlerin ortalama skoru 21 puan daha yüksek (81,8 vs 60,9).** Ancak bu fark WAF'ın formüle etkisinden değil; Cloudflare gibi büyük CDN kullanan şirketlerin genellikle daha olgun IT yönetimine (iyi SPF/DMARC/DKIM konfigürasyonu) sahip olmasından kaynaklanıyor. 16 domainlik örneklem istatistiksel olarak da kırılgan.

---

## 5. Etkilenen Domain Ölçeği

```sql
SELECT COUNT(DISTINCT ds.id), COUNT(DISTINCT cdm.id), COUNT(cdm.id)
FROM domain_scans ds
LEFT JOIN cve_domain_matches cdm ON cdm.domain = ds.domain
WHERE ds.waf_detected = true;
```

| Metrik | Değer |
|---|---|
| WAF tespit edilen toplam domain | 16 |
| CVE eşleşmesi olan WAF domain | **0** |
| Toplam eşleşme sayısı | **0** |

**Mevcut veride kesişim sıfır.** Bağlam için `cve_domain_matches` toplam durumu:

```sql
SELECT COUNT(*), COUNT(DISTINCT cve_id), COUNT(DISTINCT domain), COUNT(*) FILTER (WHERE is_patched)
FROM cve_domain_matches;
```

| Toplam eşleşme | Benzersiz CVE | Benzersiz domain | Yamalanmış |
|---|---|---|---|
| 1.886 | 453 | 88 | **0** |

Kesişimin sıfır çıkması iki nedenle açıklanabilir: (1) WAF kullanan 16 domain muhtemelen büyük/kurumsal kuruluşlar — eski/yamasız yazılım çalıştırmıyor olabilirler; (2) WAF penetrasyonu %0,11 ile son derece düşük, rastlantısal boşluk normal.

---

## 6. Mevcut Kullanıcı Arayüzü/Rapor Yansıması

`riskAdjuster.ts`'in ürettiği `wafMitigationNote` ve `adjustedCvssScore` değerleri tarama raporu UI'ında CVE kartlarına yansıtılıyor (**var**). Ancak:

- `cve_domain_matches` tablosuna **yazılmıyor** — sorgu sırasında hesaplanıp bellekte tutuluyor
- PDF raporlarında CVE yanında "WAF arkasında — azaltılmış risk" gibi kalıcı bir bağlamsal bölüm **yok**
- `is_patched` alanı WAF varlığıyla ilişkilendirilmiyor; tüm 1.886 eşleşmede `is_patched = false`

---

## Genel Değerlendirme

Sorun **teorik olarak gerçek, pratik ölçeği şu an sıfır.** Mevcut veride WAF tespit edilen 16 domain'de CVE eşleşmesi bulunmuyor; dolayısıyla yanlış önceliklendirme bugün yaşanmıyor. Bununla birlikte iki mimari boşluk tespit edildi:

**Boşluk 1 — Bypass her zaman aktif:** `waf_bypass_possible = true` olan domain sayısı WAF tespit edilen domain sayısına eşit (16/16). Bu durum `adjustCvesForWAF()` fonksiyonunun WAF azaltımını hiçbir zaman uygulamadığı anlamına geliyor; bypass tespitinin false positive üretip üretmediği kontrol edilmeli.

**Boşluk 2 — Azaltım bilgisi persist edilmiyor:** `adjustedCvssScore` ve `wafMitigated` değerleri `cve_domain_matches` tablosuna yazılmıyor. WAF azaltımının etkin olduğu bir senaryoda bu eksiklik, `is_patched` kararları, önceliklendirme ve müşteri bildirim mantığını etkiler. Düzeltmek için `cve_domain_matches` tablosuna `waf_mitigated boolean` + `effective_cvss numeric` kolonları eklenmesi, `riskAdjuster.ts`'in döndürdüğü değerlerin `domain-scan/index.ts:1484` sonrasında bu tabloya yazılması gerekir.

---

*Kaynak: Production PostgreSQL (read-only), `artifacts/api-server/src/services/riskAdjuster.ts`, `wafDetector.ts`, `domain-scan/index.ts`*
