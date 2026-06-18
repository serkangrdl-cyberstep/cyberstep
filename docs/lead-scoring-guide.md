# Lead Discovery & Puanlama Rehberi

> **Önemli:** "Risk Skoru" (Domain Risk Skoru, 0–100) yüksek bir değer tehlikeyi değil **güvenli sistemi** ifade eder.
> Örnek: Risk Skoru 85 = iyi yapılandırılmış sistem. Risk Skoru 20 = ciddi güvenlik açıkları.
> Bu skor satış önceliğini belirlemede **ters orantılıdır** — düşük skor yüksek öncelikli lead demektir.

---

## 1. Domain Risk Skoru (Güvenlik Hijyeni Skoru)

Tarama sırasında hesaplanan bileşik güvenlik skoru. Yüksek = güvenli sistem.
Kaynak: `artifacts/api-server/src/routes/domain-scan/index.ts`, `calcScore` fonksiyonu (satır 158+).

| Bileşen | Ağırlık | Açıklama |
|---------|---------|----------|
| SPF | 20 puan | hardfail=20, softfail=14, neutral=10, yok=0 |
| DMARC | 25 puan | reject=25, quarantine=20, none=10, yok=0 |
| DKIM | 20 puan | pass=20, fail=8 (kısmi kredi) |
| MX | 10 puan | pass=10, fail=0 |
| SSL | 25 puan | >59 gün=25, ≤59=20, ≤29=15, ≤13=8, ≤6=2, ≤0/yok=0 |
| Port cezası | −N | shodan port risk tespitinden düşülür |

Toplam: max 100 (mükemmel yapılandırma, port cezası yok).
`lead_candidates.risk_score`, `domain_scans.overall_score`'un (`discoveryPipeline.ts:311`) doğrudan kopyasıdır — ayrı bir hesaplama yoktur.

**Kalifikasyon eşiği:** Risk Skoru < 60 → Tier 1 (qualified lead)

---

## 2. WAF/CDN Tarama Güvenilirliği

WAF veya CDN tespiti, tarama sonuçlarının güvenilirliğini etkiler. Güçlü WAF arkasında bazı bulgular görünmeyebilir.

| Senaryo | Güvenilirlik Skoru | Açıklama |
|---------|-------------------|----------|
| WAF yok, CDN yok | %95 | Tam görünürlük |
| Sadece CDN (indirect) | %85 | Kısmi görünürlük, WAF tespit edilmedi |
| WAF tespit edildi — düşük güven | %75 | 1 yöntem, skor < 35; doğrulanamadı |
| WAF tespit edildi — orta güven | %74 | 1 yöntem, skor 35–59 |
| WAF tespit edildi — yüksek güven | %72 | 2+ yöntem veya 1 yöntem + skor ≥ 60 |
| Bypass mümkün | %55 | Kaynak sunucuya direkt IP erişimi |
| OSINT bypass riski yüksek | %60 | Üçüncü taraf bypass kanıtı |

> **Monotonluk:** Güven seviyesi arttıkça güvenilirlik skoru azalır — WAF kesin tespit edildiğinde gerçek sunucuya ulaşma olasılığı o oranda düşer.

### WAF Tespit Yöntemleri

- `header_signature` — HTTP header/cookie/body imza eşleşmesi (bestScore ≥ 25)
- `dns_ptr_ip_range` — DNS PTR kaydı veya Cloudflare CIDR aralığı
- `tls_cert` — TLS sertifikası veren kuruluş (Cloudflare/Sucuri)
- `indirect_cdn` — Dolaylı CDN header sinyali (WAF değil, CDN)

---

## 3. WAF Varlığında CVE Risk Ayarlaması

WAF güven seviyesine göre kademeli CVSS azaltma:

| WAF Durumu | CVSS Kritik (≥9.0) Azaltma | CVSS Yüksek (≥7.0) Azaltma |
|-----------|---------------------------|---------------------------|
| WAF yok | — (değişmez) | — (değişmez) |
| WAF low confidence | — (değişmez, not eklenir) | — (değişmez, not eklenir) |
| WAF medium confidence | ×0.80 (−20%) | ×0.825 (−17.5%) |
| WAF high confidence | ×0.60 (−40%) | ×0.65 (−35%) |
| WAF bypass mümkün | — (değişmez) | — (değişmez) |
| Servis WAF-bağımsız (SSL/SMTP) | — (değişmez) | — (değişmez) |

**Örnek:** WAF medium confidence, CVSS 9.8 → 9.8 × 0.80 = 7.8

**Low confidence notu:** Rapora "WAF olası ama doğrulanamadı — CVSS olduğu gibi gösteriliyor" notu eklenir. Sahte güvenlik hissi yaratılmaz.

---

## 4. AI Lead Skoru

Claude tarafından 0–100 arasında hesaplanan satış öncelik skoru.

### Faktörler

| Faktör | Ağırlık | Açıklama |
|--------|---------|----------|
| `risk_score` | 0–20 | Düşük domain risk skoru → yüksek ihtiyaç |
| `critical_count` | 0–20 | Kritik bulgu sayısı |
| `company_size_signal` | 0–15 | Şirket büyüklüğü sinyali |
| `urgency_signal` | 0–20 | Aciliyet (aktif exploit, CISA KEV) |
| `conversion_potential` | 0–25 | Dönüşüm potansiyeli |

### `ai_score_status` Alanı

`lead_scan_queue.ai_score_status` — AI skorlama durumunu takip eder:

| Değer | Anlam | `lead_score` |
|-------|-------|-------------|
| `scored` | Claude başarıyla cevap verdi | Gerçek skor (0–100) |
| `failed` | Claude API genel hata | NULL |
| `timeout` | ETIMEDOUT / bağlantı zaman aşımı | NULL |
| `rate_limited` | HTTP 429 / rate limit | NULL |

> **Önemli:** `ai_score_status IS NOT NULL AND ai_score_status != 'scored'` kayıtlar yeniden puanlama kuyruğundadır. Bunları satış önceliği sıralamasına dahil etme — gerçek puanları henüz bilinmiyor.

### Retry Cron ve Üstel Backoff

`ai_score_retry` cron'u her saat :45'te çalışır. Maksimum 20 kayıt/çalışma.

Bekleme süresi `ai_score_retry_count` değerine göre katlanır:

| retry_count | Minimum Bekleme |
|-------------|----------------|
| 0 | 1 saat |
| 1 | 2 saat |
| 2 | 4 saat |
| 3 | 8 saat |
| 4+ | 16 saat (tavan) |

Sıralama: az retry_count'lu (taze hatalar) önce seçilir. Kalıcı başarısızlıklar 16 saat aralıklarla denenir, kotadan düşmez.

`ai_score_last_retry_at` — son deneme zamanı (backoff hesabında `scanned_at` yerine kullanılır).

### Geriye Dönük Veri Kirliliği

`ai_score_status` kolonu bu özellikten önce yoktu. Mevcut `scan_status='scored' AND lead_score=30` kayıtları ikiye ayrılabilir:
- Gerçek Claude skoru 30 olanlar (nadir)
- Hata sonucu 30 yazılanlar (eski davranış)

Ayırt etmek mümkün değil. Temizlik için seçenekler:
1. Bu kayıtları `ai_score_status=NULL` olarak bırak (retry cron bunlara dokunmaz — sadece failed/timeout/rate_limited yakalar)
2. Eğer bu kayıtları yeniden puanlamak istersen: `UPDATE lead_scan_queue SET ai_score_status='failed' WHERE scan_status='scored' AND lead_score=30 AND ai_score_status IS NULL` çalıştır → retry cron bir sonraki saatte yakalar

---

## 5. Bekleyen Manuel Test

**Yapılması gereken (üretime dokunmadan):** Geliştirme ortamında `ANTHROPIC_API_KEY`'i kasıtlı hatalı bir değerle override edip tek bir domain üzerinde AI lead scoring tetikle. Beklenen davranış:
- `score: null`
- `ai_score_status: 'failed'` (ya da 429 ise `'rate_limited'`, timeout ise `'timeout'`)
- DB'ye `lead_score = NULL` yazılmalı, `lead_score = 30` değil

Bu test Sorun 3 düzeltmesinin gerçek çalışma zamanı kanıtını verir. Typecheck ile doğrulanamaz.

---

## 6. İsimlendirme Notu

`riskScore` / `risk_score` alanı kodda ve DB'de "güvenlik hijyeni skoru"nu ifade eder — yüksek değer güvenli sistem anlamına gelir. "Risk" kelimesi sezgisel anlamın **tersidir**. Gelecekteki yeni alanlarda `securityHygieneScore` tercih edilmeli; mevcut alanlar geriye dönük uyumluluk için korunmaktadır.

---

## 7. Teaser → WAF Enrichment Sıralama Kararı

**Karar:** Teaser üretimi, WAF enrichment'ın bitmesini beklemez. Kalifikasyon olur olmaz teaser tetiklenebilir; WAF enrichment ise ayrı bir cron (her 30 dakika, 50 satır/run) ile çalışır ve 886 lead için toplam ~9 saate kadar sürebilir.

**Gerekçe:** Hız > Kesinlik — yön güvenli. WAF enrichment tamamlandığında `critical_findings` azalabilir (WAF korumalı sunucu = daha az gerçek risk), ama artamaz. Dolayısıyla teaser her zaman gerçek durumdan daha **kötümser** kalır; asla daha iyimser olmaz. Bu, satış sürecinde teaser'ın verdiği "tehlike var" mesajını geçersiz kılmaz, sadece güçlendirir.

**Dipnot garantisi:** `teaserReportService.ts` içinde sabit `SNAPSHOT_NOTE` sabiti her teaser'ın `urgency_note` alanına eklenir (AI çıktısından bağımsız). Bu şekilde kullanıcı her zaman "Bu ön taramadır" uyarısını görür.

**SKIP LOCKED eşzamanlılık testi (17 Haziran 2026):** İki eşzamanlı DB transaction ile doğrulandı. Transaction A: `{1,2,3,4,5,6,7,8,9,12}`, Transaction B (A lockteyken): `{14,15,17,18,21,22,23,24,25,26}` — kesişim boş. `FOR UPDATE SKIP LOCKED` davranışı kanıtlandı.
