# CyberStep Risk Skoru v2 — Metodoloji

Skor, bir alan adının dışarıdan gözlemlenebilen siber güvenlik durumunu 0–100 arasında özetler (yüksek = daha güvenli). Kurumun iç sistemlerine erişim gerekmez; yalnızca herkese açık DNS, sertifika, port ve itibar verileri kullanılır.

Kod: `artifacts/api-server/src/lib/scoring/scoreV2.ts` · Testler: `pnpm --filter @workspace/api-server run test:score`

## Kategoriler

| Kategori | Azami puan | Ne ölçülür |
|---|---|---|
| Bilinen zafiyetler | 30 | Tespit edilen yazılım sürümlerine ait CVE'ler. CISA KEV (aktif sömürülen) −20, CVSS ≥9 −10, CVSS 7–8.9 −4, CVSS 4–6.9 −1. WAF ile hafifletilen CVE'lerde düzeltilmiş CVSS kullanılır. |
| Ağ maruziyeti | 20 | İnternete açık portlar. Kritik servis (RDP, SMB, veritabanı, Docker vb.) −10, yüksek riskli −5, orta −1. CDN arkasında beklenen portlar ceza almaz. |
| İtibar | 15 | Spam kara listeleri −8, USOM / URLhaus / Google Safe Browsing −15, VirusTotal zararlı işareti −10, AbuseIPDB ≥50 −8 (≥25 −4). |
| E-posta güvenliği | 15 | SPF (−all 5, ~all 3.5, ?all 2), DMARC (reject 6, quarantine 5, none 2), DKIM 3, MX 1. MX kaydı yoksa DKIM/MX tam puan alır. |
| Veri sızıntısı | 10 | Alan adı e-postalarının yer aldığı bilinen sızıntılar (HIBP): 0 → 10, 1 → 6, 2–3 → 3, 4+ → 0. |
| TLS ve web | 10 | SSL geçerliliği (≥30 gün 7, 14–29 gün 5, ≤13 gün 3, geçersiz 0) ve HTTP güvenlik başlıkları (3). |

## Ağır bulgu tavanları

Ortalamanın ağır bir riski gizlemesini önlemek için:

- CISA KEV listesindeki zafiyet → skor en fazla **49**
- Fidye yazılımında kullanılan KEV zafiyeti → en fazla **39**
- USOM / URLhaus / Safe Browsing kaydı → en fazla **39**
- İnternete açık kritik servis → en fazla **59**

## Ölçülmeyen veriler ve kapsama

Bazı kategoriler her taramada ölçülemez. Örneğin otomatik keşif taramalarında sızıntı sorgusu yapılmaz, port verisi her domain için mevcut değildir. Ölçülmeyen kategori **temiz sayılmaz**: skor yalnızca ölçülen kategorilerin azami puanı üzerinden 100'e ölçeklenir ve `coverage` alanında ölçülen ağırlık (%) raporlanır.

## Not ve risk seviyesi

| Skor | Not | Risk |
|---|---|---|
| 85–100 | A | Düşük |
| 70–84 | B | Düşük |
| 55–69 | C | Orta |
| 40–54 | D | Yüksek |
| 0–39 | F | Kritik |

## Sürüm

`scoreVersion: "2.0"`. Eski skor (v1, e-posta + SSL ağırlıklı) API yanıtlarında geçiş dönemi için `legacyScore` alanında döner. Tedarikçi portföyünde v1'den v2'ye geçiş sırasında sahte "skor düştü" uyarısı gönderilmez; trend karşılaştırması yalnızca iki v2 sonucu arasında yapılır.
