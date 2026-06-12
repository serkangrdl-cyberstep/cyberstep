# CyberStep — WAF/CDN Tespit ve Confidence Scoring Prompt
## Replit Agent'a Ver — Önce Mevcut Durumu Kontrol Ettir

---

## ÖNCE KONTROL ET

Bu özellik daha önce tasarlanmış ama Replit'e uygulatılıp uygulatılmadığı teyit edilmemiş olabilir. Replit Agent'a önce şu kontrolü yaptır:

```
Aşağıdaki dosya/alanların mevcut olup olmadığını kontrol et ve bana rapor ver,
HENÜZ HİÇBİR DEĞİŞİKLİK YAPMA:

1. src/services/wafDetector.ts dosyası var mı? Varsa içeriğini göster.
2. src/services/osintEnrichment.ts dosyası var mı? Varsa içeriğini göster.
3. Domain scan sonuç şemasında (schema dosyalarını tara) şu kolonlar var mı:
   - wafDetected, wafProvider, wafConfidence, confidenceScore, confidenceNote
4. Scoring fonksiyonunda (calculateOverallScore veya benzeri) WAF durumuna göre
   dinamik ağırlık tablosu (SCORING_WEIGHTS / noWaf / wafDetected) var mı?
5. Domain scan orchestrator'ında (runDomainScan veya benzeri) detectWafAndCdn
   ve enrichWithOsint çağrıları var mı?
6. PDF rapor ve frontend UI'da confidenceNote / "Bu domain WAF arkasında..."
   gibi bir uyarı metni gösteriliyor mu?

Her madde için VAR / YOK / KISMEN VAR (ne kadarı var, ne eksik) yaz.
```

Rapor geldikten sonra:
- Hepsi **VAR** ise → bu prompt'a gerek yok, sadece eksik kalan kısımları (varsa) tamamlat.
- **KISMEN VAR** ise → aşağıdaki prompttan sadece eksik bölümleri (BÖLÜM 1-5) uygulatır, mevcut kodu bozmadan entegre et.
- Hepsi **YOK** ise → aşağıdaki prompt'un tamamını uygulat.

---

## UYGULAMA PROMPTU

```
ÖNEMLI: Bu prompt'taki tablo ve kolon isimleri örnek amaçlıdır.
Önce mevcut schema'yı incele (lib/db/src/schema/ altındaki tüm dosyalar),
gerçek tablo ve kolon isimlerini tespit et, değişiklikleri ona göre uygula.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BÖLÜM 1 — WAF/CDN TESPİT SERVİSİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/services/wafDetector.ts dosyası oluştur:

export interface WafDetectionResult {
  hasWaf: boolean;
  hasCdn: boolean;
  provider: string | null;
  // "cloudflare" | "akamai" | "fastly" | "cloudfront" | "fortiweb" |
  // "imperva" | "azure_fd" | "sucuri" | null
  confidence: "high" | "medium" | "low";
  detectionMethod: string[];
  // Hangi yöntemlerle tespit edildi (log için)
}

export async function detectWafAndCdn(domain: string): Promise<WafDetectionResult>

Şu sırayla tespit yap (Promise.all ile paralel):

1. HTTP Header analizi (GET https://domain, timeout 8sn):
   Cloudflare:   "cf-ray", "cf-cache-status", Server="cloudflare"
   Akamai:       "x-check-cacheable", "akamai-origin-hop", "x-akamai-request-id"
   Fastly:       "x-served-by" içinde "cache-", "fastly-restarts"
   CloudFront:   "via" içinde "CloudFront", "x-amz-cf-id"
   FortiWeb:     cookie'de "FORTIWAFSID", "x-powered-by"="FortiWeb"
   Imperva:      "x-cdn"="Imperva", "x-iinfo"
   Azure FD:     "x-azure-ref", "x-fd-healthprobe"
   Sucuri:       "x-sucuri-id", "x-sucuri-cache"

2. DNS/IP analizi:
   Cloudflare IP aralıkları: 103.21.244.0/22, 103.22.200.0/22,
     103.31.4.0/22, 104.16.0.0/13, 104.24.0.0/14,
     108.162.192.0/18, 131.0.72.0/22, 141.101.64.0/18,
     162.158.0.0/15, 172.64.0.0/13, 173.245.48.0/20,
     188.114.96.0/20, 190.93.240.0/20, 197.234.240.0/22,
     198.41.128.0/17
   Akamai: reverse DNS'te "akamai" veya "akamaiedge" geçiyor mu?
   CloudFront: reverse DNS'te "cloudfront.net" var mı?

3. TLS sertifika analizi:
   Cloudflare sertifikası: issuer içinde "Cloudflare" var mı?
   Sucuri: issuer içinde "Sucuri" var mı?

Sonuç kuralları:
- 2+ method aynı provider'ı gösteriyorsa: confidence = "high"
- 1 method gösteriyorsa: confidence = "medium"
- Sadece IP aralığı eşleşiyorsa: confidence = "low"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BÖLÜM 2 — OSINT ZENGİNLEŞTİRME (WAF ARKASI İÇİN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/services/osintEnrichment.ts dosyası oluştur:

export interface OsintEnrichmentResult {
  historicalIps: string[];
  realServerHints: string[];
  // WAF öncesi sunucu ipuçları
  technologyHints: string[];
  // Pasif kaynaklardan teknoloji tespiti
  sources: string[];
  // Hangi kaynaklardan veri geldi
}

export async function enrichWithOsint(
  domain: string
): Promise<OsintEnrichmentResult>

Şu kaynakları paralel sorgula (her biri try/catch ile, biri başarısız olursa diğerleri devam eder):

1. Wayback Machine CDX API (ücretsiz, key gerektirmez):
   GET https://web.archive.org/cdx/search/cdx?url={domain}&output=json
     &fl=statuscode,mimetype,timestamp,original&limit=5&filter=statuscode:200
   → En eski kayıtlardaki Server header'ı çek
   → nginx/Apache/IIS/LiteSpeed ipucu ara

2. crt.sh geçmiş sertifika kayıtları:
   GET https://crt.sh/?q={domain}&output=json
   → İlk sertifika tarihine bak (WAF'tan önce mi?)
   → Farklı IP'ler var mı SAN'larda?

3. Shodan InternetDB (ücretsiz, key gerektirmez):
   GET https://internetdb.shodan.io/{ip}
   → domain'in A kaydındaki IP'yi sorgula
   → Açık portlar, banner bilgisi çek
   → Eğer gerçek IP değil CDN IP'si ise "CDN arkasında" olarak işaretle

4. BuiltWith free API (BUILTWITH_API_KEY varsa):
   GET https://api.builtwith.com/free1/api.json?KEY={key}&LOOKUP={domain}
   → Teknoloji listesi çek

Sonuç:
- realServerHints: ["nginx/1.18", "PHP/8.1"] gibi ipuçları
- technologyHints: ["WordPress", "WooCommerce"] gibi
- sources: hangi kaynaklardan ne bulundu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BÖLÜM 3 — DİNAMİK SKOR AĞIRLIK SİSTEMİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mevcut domain scan scoring fonksiyonunu bul
(calculateOverallScore veya benzeri isimde).

WAF durumuna göre dinamik ağırlık tablosu ekle:

const SCORING_WEIGHTS = {
  noWaf: {
    emailSecurity: 0.30,   // SPF+DMARC+DKIM
    ssl:           0.20,
    httpHeaders:   0.15,
    cve:           0.20,
    blacklist:     0.15,
  },
  wafDetected: {
    emailSecurity: 0.45,   // WAF etkilemez, güvenilir
    ssl:           0.30,   // TLS handshake WAF önünde, güvenilir
    httpHeaders:   0.05,   // WAF'ın başlıkları, güvenilmez
    cve:           0.05,   // Versiyon gizli, güvenilmez
    blacklist:     0.15,   // IP/domain reputasyon, güvenilir
  },
};

WAF tespit edildiyse wafDetected ağırlıklarını kullan,
yoksa noWaf ağırlıklarını kullan.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BÖLÜM 4 — CONFIDENCE SCORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Domain scan sonuç nesnesine şu alanları ekle
(migration gerekiyorsa yap):

wafDetected:       boolean
wafProvider:       text | null       -- "cloudflare", "akamai" vb.
wafConfidence:     text | null       -- "high" | "medium" | "low"
confidenceScore:   integer           -- 0-100 genel güvenilirlik
confidenceNote:    text | null       -- kullanıcıya gösterilecek açıklama

confidenceScore hesaplama:
- WAF yok:                        95
- WAF var, confidence=high:       60
- WAF var, confidence=medium:     70
- WAF var, confidence=low:        80
- WAF var + OSINT zenginleştirme
  gerçek sunucu bulundu:          75

confidenceNote örnekleri:

WAF yok:
  "Tarama tam doğrulukta gerçekleştirildi."

Cloudflare yüksek güven:
  "Bu domain Cloudflare WAF/CDN arkasında çalışıyor (yüksek güven).
   E-posta güvenliği ve SSL sonuçları %100 güvenilir.
   Web uygulama katmanı bulguları kısmi doğrulukta olabilir.
   Kesin sonuç için iç ağ taraması önerilir."

Genel WAF (orta güven):
  "Bu domain bir WAF/CDN arkasında çalışıyor olabilir.
   DNS ve SSL tabanlı bulgular güvenilirdir.
   Uygulama katmanı bulguları doğrulanmalıdır."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BÖLÜM 5 — DOMAIN SCAN AKIŞINA ENTEGRASYON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mevcut domain scan orchestrator'ını bul
(runDomainScan veya benzeri fonksiyon).

Tarama başında şu adımları ekle:

// 1. WAF tespiti (taramanın ilk adımı)
const wafResult = await detectWafAndCdn(domain);

// 2. WAF varsa OSINT zenginleştirme
let osintResult = null;
if (wafResult.hasWaf || wafResult.hasCdn) {
  osintResult = await enrichWithOsint(domain);
}

// 3. Sonuçları scan sonucuna yaz
//    wafDetected, wafProvider, wafConfidence alanlarını wafResult'tan doldur
//    confidenceScore ve confidenceNote'u Bölüm 4 kurallarına göre hesapla
//    osintResult varsa realServerHints/technologyHints'i ham veri olarak
//    scan sonucuna ekle (debug/log amaçlı, kullanıcıya gösterilmesi opsiyonel)

// 4. Scoring fonksiyonuna wafDetected bilgisini geçir,
//    Bölüm 3'teki dinamik ağırlıkları uygula

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BÖLÜM 6 — RAPORLAMA (PDF + FRONTEND)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PDF rapor ve frontend scan sonuç ekranında:

- confidenceScore'u küçük bir "Güvenilirlik" göstergesi olarak ekle
  (95-100: yeşil, 70-94: sarı, <70: turuncu)
- confidenceNote'u WAF tespit edildiğinde görünür bir bilgi kutusu
  içinde göster (mevcut brand renklerini kullan: arka plan #060D1A,
  cyan #00C8FF, amber #F5A623)
- WAF tespit edilen domainlerde CVE/HTTP header bulgularının yanına
  küçük bir "ⓘ WAF arkasında — doğrulanmalı" etiketi ekle

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENEL KURAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ne bildiğini söyle, ne bilmediğini daha yüksek sesle söyle.
WAF/CDN arkasındaki domainlerde uygulama katmanı bulgularını
(eski CVE, header tabanlı versiyon tespiti) kesin gibi sunma —
her zaman confidenceNote ile birlikte göster.
```

---

*CyberStep.io — WAF/CDN Tespit ve Confidence Scoring — Tekrar Gönderim 2026*
