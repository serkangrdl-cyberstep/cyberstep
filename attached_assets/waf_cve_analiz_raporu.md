# WAF/CVE Çapraz Referans — Mevcut Durum Analizi (Düzeltilmiş)

> **Rapor tarihi:** 19 Haziran 2026  
> **Kapsam:** Production veritabanı (read-only sorgular) + kaynak kod incelemesi  
> **Düzeltme notu:** İlk rapor yalnızca `domain_scans.waf_detected` kolonuna baktı. Asıl WAF sayımı `customer_tech_stack` + `domain_scans` UNION'ından geliyor (Tech Intelligence panelindeki kaynak).

---

## 1. WAF Korumalı Domain Sayımı — Doğru Kaynak

Tech Intelligence panelindeki **"WAF Tespit"** kartı şu sorguyu çalıştırır:

```sql
SELECT COUNT(DISTINCT domain)::int AS cnt FROM (
  SELECT domain FROM customer_tech_stack
  WHERE is_active = true
    AND category IN ('waf', 'cdn', 'Güvenlik / CDN', 'firewall')
  UNION
  SELECT domain FROM domain_scans WHERE waf_detected = true
) sub
```

**Sonuç: 3.268 benzersiz domain WAF/CDN korumalı.**

### Kaynak Katkısı

| Kaynak | Benzersiz Domain | Yöntem |
|---|---|---|
| `customer_tech_stack` (waf/cdn/firewall kategorisi) | **3.265** | Shodan + HTTP header fingerprint |
| `domain_scans` (waf_detected=true) | 5 (union sonrası net ek) | Aktif WAF probe + header imzası |
| **Toplam (UNION)** | **3.268** | — |

### `customer_tech_stack` Vendor/Kategori Dağılımı

| Kategori | Vendor | Benzersiz Domain | Kayıt |
|---|---|---|---|
| Güvenlik / CDN | **Cloudflare** | **3.248** | 3.249 |
| firewall | Fortinet | 18 | 18 |
| cdn | Cloudflare | 7 | 13 |
| waf | Cloudflare | 7 | 7 |
| firewall | MikroTik | 4 | 4 |
| cdn | Imperva | 1 | 1 |
| waf | Imperva | 1 | 1 |

Cloudflare hakimiyeti **%99,4** — 3.265 WAF/CDN domain'in 3.262'si Cloudflare.

---

## 2. WAF Tespit Mekanizması — İki Ayrı Katman

### Katman 1: `customer_tech_stack` (Technographic Fingerprint — 3.265 domain)

`fingerprintEngine.ts` servisi her taramada domain'in HTTP response header'larını, Shodan verilerini ve HTML içeriğini analiz eder; tespit edilen ürünleri category + vendor olarak `customer_tech_stack` tablosuna yazar. Cloudflare `cf-ray` header'ı → kategori `"Güvenlik / CDN"`, vendor `"Cloudflare"`.

### Katman 2: `domain_scans.waf_detected` (Aktif WAF Probe — 16 domain)

`wafDetector.ts` aktif probe gönderir (`/?id=1 OR 1=1&q=<script>`), TLS issuer, cookie imzası, IP CIDR ve DNS PTR'a bakar. Alanlar:

| Alan | Tip |
|---|---|
| `waf_detected` | boolean |
| `waf_provider` | varchar (cloudflare, fortinet…) |
| `waf_confidence` | integer (0–100) |
| `waf_bypass_possible` | boolean |
| `waf_headers_added` | jsonb |

**İki katmanın örtüşmesi:** 16 domain `waf_detected=true`, bunların 11'i zaten `customer_tech_stack`'te mevcut → net ek 5 domain.

---

## 3. `overall_score` Formülünde WAF Etkisi

`calcScore()` fonksiyonu (`domain-scan/index.ts:158`):

```
overall_score = SPF(0–20) + DMARC(0–25) + DKIM(8–20) + MX(0–10) + SSL(0–25) − portDeduction
```

**`waf_detected` bu formüle girmiyor.** WAF'ın dolaylı etkileri:
1. `confidenceScore` — WAF var + bypass yok → 72; bypass var → 55
2. CDN port risk azaltımı — WAF proxy'si arkasındaki portlar `none` riskle işaretleniyor
3. CVE CVSS görsel azaltımı (`riskAdjuster.ts`) — ayrıntı §4'te

### Skor Karşılaştırması (domain_scans eşleşmesi olan WAF domain'leri)

```sql
-- WAF korumalı: customer_tech_stack WAF/CDN ∪ domain_scans waf_detected=true
-- WAF korumasız: kalan domain_scans
```

| Durum | Domain (domain_scans eşleşmesi) | Ort. Skor | Min | Max | Skor < 60 |
|---|---|---|---|---|---|
| **WAF korumalı** | 3.711 | **57,8** | 8,0 | 100,0 | 2.064 (%55,6) |
| **WAF korumasız** | 10.732 | **62,0** | 0,0 | 100,0 | 4.550 (%42,4) |

**WAF korumalı domainlerin ortalama skoru 4,2 puan daha düşük (57,8 vs 62,0).** Bu ilk bakışta sürpriz görünüyor; açıklaması şu: CDN/WAF kullanan domain'ler arasında Cloudflare'e taşınmış ama e-posta güvenliğini (SPF/DMARC/DKIM) configure etmemiş KOBİ'ler çok. Skor formülünün %75'i e-posta güvenliğinden geldiği için WAF varlığı skora yansımıyor, aksine bu segment daha düşük e-posta güvenlik olgunluğuna sahip.

---

## 4. CVE Eşleştirmede WAF Kullanımı

### `riskAdjuster.ts` → `adjustCvesForWAF()` Fonksiyonu

```
WAF yok                          → değişmez
WAF var + bypass mümkün          → azaltma YOK, bypass uyarısı
WAF var + low confidence         → azaltma YOK, "doğrulanamadı" notu
WAF var + medium confidence      → CVSS × 0.80 (critical), × 0.825 (high)
WAF var + high confidence        → CVSS × 0.60 (critical), × 0.65 (high)
Servis WAF-bağımsız (SSL, email) → azaltma YOK, not eklenir
```

**Önemli kısıt:** Bu azaltım yalnızca aktif probe (`waf_detected=true`, 16 domain) bilgisini kullanır. `customer_tech_stack`'teki 3.265 Cloudflare domain'i için `adjustCvesForWAF()` çalışmaz — çünkü `domain_scans.waf_detected` zaten doğrulama sırasında set edilmiyor olabilir veya bu domain'ler henüz tam taranmamış.

### `cve_domain_matches`'te WAF Bilgisi Yok

Tablo şemasında `waf_mitigated`, `waf_adjusted_score` gibi alanlar yok. `adjustedCvssScore` bellekte kalıp tabloya yazılmıyor — veri kaybı bu noktada.

---

## 5. WAF + CVE Kesişimi (Düzeltilmiş)

```sql
-- WAF korumalı 3.268 domain ∩ cve_domain_matches
```

| Metrik | Değer |
|---|---|
| WAF korumalı domain (toplam) | 3.268 |
| CVE eşleşmesi olan WAF domain | **25** |
| Benzersiz CVE | **1** (CVE-2026-11645) |
| Toplam eşleşme kaydı | **34** |
| CVSS skoru | **8,8** (Critical) |
| Exploit mevcut | **25/25** |
| CISA KEV listesinde | **25/25** |
| Yama mevcut | **0/25** |

**İlk raporun "0 kesişim" iddiası yanlıştı** — 25 WAF korumalı domain, aktif exploiti olan bir CISA KEV CVE ile eşleşmiş durumda.

### CVE-2026-11645 Ayrıntısı

| Alan | Değer |
|---|---|
| CVSS | 8.8 (Critical) |
| Exploit | Kamuya açık |
| CISA KEV | Evet |
| Yama | Mevcut değil |
| Eşleşen ürünler | Google Analytics / Tag Manager, Google Fonts, Google reCAPTCHA |
| Etkilenen WAF domain örnekleri | albarakaturk.com.tr, somposigorta.com.tr, aksa.com.tr, euronet.net.tr |

**Kritik Bağlam:** Bu eşleşmeler Cloudflare WAF'ın **doğrudan koruyamadığı** üçüncü taraf JavaScript kaynaklarına (Google CDN'den yüklenen Analytics/Fonts/reCAPTCHA) dayanıyor. WAF, gelen HTTP isteklerini filtreler; ama bu CVE client-side JS supply chain saldırısı senaryosu — WAF azaltımı `adjustCvesForWAF()` bu ürün tipi için `isWafIrrelevant()` kontrolüne takılmasa bile pratikte etkisiz olurdu.

---

## 6. CVSS Attack Vector Dağılımı (tüm CVE stoku)

| Attack Vector | CVE Sayısı | Oran | Ort. CVSS |
|---|---|---|---|
| **Network (AV:N)** | 1.173 | %72,3 | **8,7** |
| Local (AV:L) | 404 | %24,9 | 7,5 |
| Adjacent (AV:A) | 27 | %1,7 | 7,6 |
| Physical (AV:P) | 7 | %0,4 | 5,7 |
| Vektör yok | 12 | %0,7 | — |

`cve_domain_matches` tablosunda CWE ID alanı yok — web katmanı (SQLi/XSS) ile ağ katmanı (RCE via SSH) ayrımı şemada tutulmuyor.

---

## 7. Mimari Boşluklar (Güncellenmiş)

**Boşluk 1 — WAF azaltımı yalnızca 16 domain'e uygulanıyor, 3.268'e değil:**  
`adjustCvesForWAF()` `domain_scans.waf_detected` bilgisini kullanıyor. `customer_tech_stack`'teki 3.265 Cloudflare domain için bu azaltım mekanizması devreye girmiyor. `customer_tech_stack`'te category=waf/cdn olan domain'ler için de WAF-aware CVSS azaltımı yapılması gerekir.

**Boşluk 2 — Azaltım bilgisi persist edilmiyor:**  
`adjustedCvssScore` ve `wafMitigated` değerleri `cve_domain_matches` tablosuna yazılmıyor. `cve_domain_matches`'e `waf_mitigated boolean` + `effective_cvss numeric` eklenmeli; aksi hâlde `is_patched` kararları ve bildirim önceliklendirmesi bu bilgiden yararlanamıyor.

**Boşluk 3 — domain_scans'ta bypass=true tüm WAF kayıtlarını etkiliyor:**  
`domain_scans.waf_detected=true` olan 16 domain'in tamamında `waf_bypass_possible=true` — yani aktif probe WAF'ı tespit etmiş ama doğrudan IP erişimini de doğrulamış. Bu durumda `adjustCvesForWAF()` "bypass mümkün → azaltma yok" dalına düşüyor; fonksiyon fiilen sıfır kez CVSS indirimi uyguluyor. Bypass tespitinin false positive üretip üretmediği kontrol edilmeli.

---

*Kaynak: Production PostgreSQL (read-only) — `customer_tech_stack`, `domain_scans`, `cve_domain_matches`, `cve_tracker` tabloları + `artifacts/api-server/src/routes/admin-panel/tech-stack.ts` + `riskAdjuster.ts`*
