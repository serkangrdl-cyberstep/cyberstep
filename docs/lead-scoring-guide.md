# Lead Discovery & Puanlama Rehberi

> **Önemli:** "Risk Skoru" (Domain Risk Skoru, 0–100) yüksek bir değer tehlikeyi değil **güvenli sistemi** ifade eder.
> Örnek: Risk Skoru 85 = iyi yapılandırılmış sistem. Risk Skoru 20 = ciddi güvenlik açıkları.
> Bu skor satış önceliğini belirlemede **ters orantılıdır** — düşük skor yüksek öncelikli lead demektir.

---

## 1. Domain Risk Skoru (Güvenlik Hijyeni Skoru)

Tarama sırasında hesaplanan bileşik güvenlik skoru. Yüksek = güvenli sistem.

| Bileşen | Ağırlık | Açıklama |
|---------|---------|----------|
| SPF | 25 puan | E-posta spoofing koruması |
| DMARC | 30 puan | E-posta kimlik doğrulama politikası |
| MX | 10 puan | Mail sunucusu yapılandırması |
| SSL | 35 puan | HTTPS sertifikası geçerliliği |

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

### Retry Cron

`ai_score_retry` cron'u her saat :45'te çalışır. `ai_score_status IN ('failed','timeout','rate_limited')` ve `scanned_at < NOW() - 1 saat` olan kayıtları seçer, maksimum 20 kayıt/çalışma, üstel backoff yerine saatlik periyot.

### Geriye Dönük Veri Kirliliği

`ai_score_status` kolonu bu özellikten önce yoktu. Mevcut `scan_status='scored' AND lead_score=30` kayıtları ikiye ayrılabilir:
- Gerçek Claude skoru 30 olanlar (nadir)
- Hata sonucu 30 yazılanlar (eski davranış)

Ayırt etmek mümkün değil. Temizlik için seçenekler:
1. Bu kayıtları `ai_score_status=NULL` olarak bırak (retry cron bunlara dokunmaz — sadece failed/timeout/rate_limited yakalar)
2. Eğer bu kayıtları yeniden puanlamak istersen: `UPDATE lead_scan_queue SET ai_score_status='failed' WHERE scan_status='scored' AND lead_score=30 AND ai_score_status IS NULL` çalıştır → retry cron bir sonraki saatte yakalar

---

## 5. İsimlendirme Notu

`riskScore` / `risk_score` alanı kodda ve DB'de "güvenlik hijyeni skoru"nu ifade eder — yüksek değer güvenli sistem anlamına gelir. "Risk" kelimesi sezgisel anlamın **tersidir**. Gelecekteki yeni alanlarda `securityHygieneScore` tercih edilmeli; mevcut alanlar geriye dönük uyumluluk için korunmaktadır.
