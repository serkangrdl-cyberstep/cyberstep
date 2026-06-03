# CyberStep — WAF Farkındalıklı Tarama
## Replit Agent Promptu

---

## SORUN

Bir müşteri adayının CTO'su raporumuza itiraz etti:

"CVSS 9.8 kritik diyorsunuz ama biz trafiği
WAF üzerinden geçiriyoruz. Bu açık bize karşı
kullanılamaz."

CTO kısmen haklı. Mevcut tarama motoru WAF'ı
görmüyor. WAF olan sitede CVSS 9.8 ile WAF
olmayan sitede CVSS 9.8 aynı şekilde raporlanıyor.
Bu güven kaybı yaratıyor ve satışı zorlaştırıyor.

Ama CTO tam haklı da değil:
- SSL bitişi WAF'la ilgisiz, risk değişmez
- Dark web sızıntısı WAF'la düzelmez
- DMARC eksikliği WAF'la düzelmez
- Direkt IP'ye erişim mümkünse WAF bypass edilebilir

Çözüm: Tarama motoru WAF'ı tespit etsin,
hangi bulguların riskini azalttığını bilsin,
hangilerini etkilemediğini bilsin, buna göre
rapor üretsin.

---

## YAPILACAK DEĞİŞİKLİKLER

---

### DEĞİŞİKLİK 1 — VERİTABANI
**Dosya:** Mevcut migration dosyası veya yeni migration oluştur

`domain_scans` tablosuna şu kolonları ekle:
```sql
ALTER TABLE domain_scans
  ADD COLUMN IF NOT EXISTS waf_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS waf_provider varchar(50),
  ADD COLUMN IF NOT EXISTS waf_bypass_possible boolean,
  ADD COLUMN IF NOT EXISTS origin_ip varchar(50),
  ADD COLUMN IF NOT EXISTS waf_headers_added text[],
  ADD COLUMN IF NOT EXISTS waf_confidence integer;
```

`domain_scan_findings` tablosuna şu kolonları ekle:
```sql
ALTER TABLE domain_scan_findings
  ADD COLUMN IF NOT EXISTS waf_mitigated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS waf_mitigation_note text,
  ADD COLUMN IF NOT EXISTS original_cvss decimal(3,1),
  ADD COLUMN IF NOT EXISTS adjusted_cvss decimal(3,1),
  ADD COLUMN IF NOT EXISTS original_severity varchar(20),
  ADD COLUMN IF NOT EXISTS adjusted_severity varchar(20);
```

---

### DEĞİŞİKLİK 2 — YENİ DOSYA: WAF TESPİTİ
**Dosya:** `src/scanner/wafDetector.ts` (yeni oluştur)

Bu dosya şunu yapar: Taranan domain'e HTTP isteği
gönderir, response header'larından ve cookie'lerden
hangi WAF kullanıldığını anlar. Sonra kasıtlı kötü
bir istek gönderir (SQLi pattern) — WAF devreye girerse
kendini belli eder.

```typescript
const WAF_SIGNATURES = {
  cloudflare: {
    headers: ['cf-ray', 'cf-cache-status'],
    cookies: ['__cfduid', 'cf_clearance'],
    body: ['cloudflare', '__cf_bm'],
  },
  f5: {
    headers: ['x-wa-info'],
    cookies: ['BIGipServer', 'TS'],
    body: ['F5 Networks', 'The requested URL was rejected'],
  },
  akamai: {
    headers: ['x-akamai-transformed', 'akamai-grn'],
    cookies: ['ak_bmsc'],
    body: ['Reference #', 'Access Denied - Akamai'],
  },
  imperva: {
    headers: ['x-iinfo'],
    cookies: ['incap_ses', 'visid_incap'],
    body: ['Incapsula incident'],
  },
  sucuri: {
    headers: ['x-sucuri-id'],
    cookies: [],
    body: ['Sucuri WebSite Firewall'],
  },
  aws_waf: {
    headers: ['x-amzn-requestid'],
    cookies: ['aws-waf-token'],
    body: ['AWS WAF'],
  },
};

export async function detectWAF(domain: string): Promise<{
  detected: boolean;
  provider: string | null;
  confidence: number;
  headersAddedByWAF: string[];
}> {
  // 1. Normal GET isteği
  const normal = await axios.get(`https://${domain}`, {
    timeout: 8000, validateStatus: null,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  // 2. Saldırı benzeri istek — WAF tepkisini gör
  let attack: any = null;
  try {
    attack = await axios.get(
      `https://${domain}/?id=1 OR 1=1&q=<script>alert(1)</script>`,
      { timeout: 5000, validateStatus: null,
        headers: { 'User-Agent': 'sqlmap/1.0' } }
    );
  } catch {}

  const headers = normal.headers;
  const body = (normal.data || '').toString().toLowerCase();
  const attackBody = (attack?.data || '').toString().toLowerCase();
  const cookies = (headers['set-cookie'] || []).join(' ').toLowerCase();

  let bestMatch = { provider: null as string | null, score: 0 };

  for (const [waf, sigs] of Object.entries(WAF_SIGNATURES)) {
    let score = 0;
    for (const h of sigs.headers) if (headers[h]) score += 35;
    for (const c of sigs.cookies) if (cookies.includes(c.toLowerCase())) score += 25;
    for (const b of sigs.body)
      if (body.includes(b.toLowerCase()) || attackBody.includes(b.toLowerCase()))
        score += 20;
    if (score > bestMatch.score) bestMatch = { provider: waf, score };
  }

  // WAF'ın genellikle eklediği başlıklar
  const WAF_ADDS: Record<string, string[]> = {
    cloudflare: ['x-content-type-options', 'x-frame-options'],
    sucuri: ['x-content-type-options', 'x-frame-options'],
    akamai: ['strict-transport-security'],
  };

  return {
    detected: bestMatch.score >= 25,
    provider: bestMatch.score >= 25 ? bestMatch.provider : null,
    confidence: bestMatch.score,
    headersAddedByWAF: bestMatch.provider
      ? (WAF_ADDS[bestMatch.provider] || []) : [],
  };
}
```

---

### DEĞİŞİKLİK 3 — YENİ DOSYA: DİREKT IP TESTİ
**Dosya:** `src/scanner/wafBypassChecker.ts` (yeni oluştur)

Bu dosya şunu yapar: WAF tespit edildikten sonra,
domain'in arkasındaki gerçek sunucu IP'sine direkt
bağlanmayı dener. Bağlanabilirse WAF bypass mümkün
demektir ve risk azaltımı uygulanmaz.

```typescript
import dns from 'dns';
import https from 'https';

export async function checkDirectIPAccess(
  domain: string
): Promise<{
  originIp: string | null;
  bypassPossible: boolean;
}> {
  try {
    const ips = await dns.promises.resolve4(domain);
    if (!ips?.length) return { originIp: null, bypassPossible: false };

    const ip = ips[0];

    // HTTPS ile direkt IP'ye bağlan
    try {
      const r = await axios.get(`https://${ip}`, {
        timeout: 6000, validateStatus: null,
        headers: { Host: domain },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      });
      if (r.status < 500) return { originIp: ip, bypassPossible: true };
    } catch {}

    // HTTP ile dene
    try {
      const r = await axios.get(`http://${ip}`, {
        timeout: 5000, validateStatus: null,
        headers: { Host: domain },
      });
      if (r.status < 500) return { originIp: ip, bypassPossible: true };
    } catch {}

    return { originIp: ip, bypassPossible: false };
  } catch {
    return { originIp: null, bypassPossible: false };
  }
}
```

---

### DEĞİŞİKLİK 4 — YENİ DOSYA: RİSK AYARLAMA
**Dosya:** `src/scanner/riskAdjuster.ts` (yeni oluştur)

Bu dosya şunu yapar: Her bulgu tipini inceler,
WAF'ın o bulgu üzerindeki etkisini belirler,
CVSS skorunu ve ciddiyet seviyesini buna göre ayarlar.

```typescript
// WAF'ın azalttığı bulgu tipleri ve azaltma oranı
const WAF_REDUCES: Record<string, { by: number; note: string }> = {
  'cve_critical':   { by: 0.40, note: 'WAF imzaları CVE istismarını kısmen engeller' },
  'cve_high':       { by: 0.35, note: 'WAF imzaları CVE istismarını kısmen engeller' },
  'cve_wordpress':  { by: 0.40, note: 'WordPress CVE\'leri WAF tarafından kısmen bloklanır' },
  'cve_plugin':     { by: 0.35, note: 'Plugin açıkları WAF tarafından kısmen engellenir' },
  'sqli':           { by: 0.50, note: 'SQL injection WAF\'ta büyük ölçüde filtrelenir' },
  'xss':            { by: 0.45, note: 'XSS saldırıları WAF\'ta filtrelenir' },
  'lfi':            { by: 0.40, note: 'LFI girişimleri WAF tarafından engellenir' },
};

// WAF'ın HİÇ ETKİLEMEDİĞİ bulgu tipleri
// Bu tipler her zaman orijinal CVSS ile raporlanır
const WAF_CANNOT_HELP = new Set([
  'ssl_expiring',          // SSL bitmesi WAF'la ilgisiz
  'ssl_expired',
  'ssl_invalid',
  'data_breach',           // Dark web sızıntısı WAF'la düzelmez
  'leaked_credentials',
  'blacklisted',           // Kara liste WAF'la düzelmez
  'no_dmarc',              // E-posta güvenliği WAF alanı değil
  'no_spf',
  'no_dkim',
  'subdomain_takeover',    // Subdomain ele geçirme WAF'la korunmaz
  'missing_csp',           // CSP kaynak kodda olmalı, WAF eklemez
  'missing_referrer_policy',
  'missing_permissions_policy',
]);

export function adjustFindingsForWAF(params: {
  findings: ScanFinding[];
  wafProvider: string | null;
  wafDetected: boolean;
  bypassPossible: boolean;
  headersAddedByWAF: string[];
}): AdjustedFinding[] {

  const { findings, wafDetected, wafProvider,
          bypassPossible, headersAddedByWAF } = params;

  return findings.map(f => {
    const result = {
      ...f,
      originalCvss: f.cvssScore,
      adjustedCvss: f.cvssScore,
      originalSeverity: f.severity,
      adjustedSeverity: f.severity,
      wafMitigated: false,
      wafMitigationNote: null as string | null,
    };

    // WAF yok — hiçbir şey değişmez
    if (!wafDetected || !wafProvider) return result;

    // WAF'ın eklediği başlıklar raporda "eksik" görünmesin
    // Örn: Cloudflare x-content-type-options ekliyor,
    // tarama "eksik" bulmuş olsa da raporda not düş
    if (headersAddedByWAF.includes(f.type)) {
      result.wafMitigated = true;
      result.wafMitigationNote =
        `${wafProvider} WAF bu başlığı ekliyor — ` +
        `uygulama katmanında da yapılandırmanız önerilir.`;
      result.adjustedSeverity = 'low';
      return result;
    }

    // WAF etkisiz listesindeyse — değişmez, ek not ekle
    if (WAF_CANNOT_HELP.has(f.type)) {
      result.wafMitigationNote =
        `${wafProvider} WAF bu bulguyu etkilemez — ` +
        `bağımsız düzeltme zorunludur.`;
      return result;
    }

    // Bypass mümkünse — WAF etkisi sayılmaz
    if (bypassPossible) {
      result.wafMitigationNote =
        `${wafProvider} WAF aktif ancak kaynak sunucuya ` +
        `direkt IP erişimi mümkün — WAF bypass riski yüksek. ` +
        `Risk azaltımı uygulanmadı.`;
      return result;
    }

    // WAF azaltıyor — CVSS düşür
    const reduction = WAF_REDUCES[f.type];
    if (reduction) {
      const original = f.cvssScore || 7.0;
      const adjusted = parseFloat((original * (1 - reduction.by)).toFixed(1));
      result.wafMitigated = true;
      result.adjustedCvss = adjusted;
      result.adjustedSeverity = scoreToCriticality(adjusted);
      result.wafMitigationNote =
        `${wafProvider} WAF aktif — ${reduction.note}. ` +
        `Pratik risk: CVSS ${original} → ${adjusted}. ` +
        `Kaynak açık yamalanmadan WAF güvenilir değildir.`;
    }

    return result;
  });
}

function scoreToCriticality(score: number): string {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  return 'low';
}
```

---

### DEĞİŞİKLİK 5 — MEVCUT DOSYA: TARAMA MOTORU
**Dosya:** Domain taramasını yürüten ana dosya
(runDomainScan, performScan veya benzer isimli fonksiyon)

**Nereye:** Bulgular toplandıktan sonra,
veritabanına kaydedilmeden hemen önce.

**Ne eklenecek:** Şu 5 satır:
```typescript
// YENİ — WAF tespit ve risk ayarlama
import { detectWAF } from './wafDetector';
import { checkDirectIPAccess } from './wafBypassChecker';
import { adjustFindingsForWAF } from './riskAdjuster';

const waf = await detectWAF(domain);
const bypass = waf.detected
  ? await checkDirectIPAccess(domain)
  : { originIp: null, bypassPossible: false };

// findings → adjustedFindings
const adjustedFindings = adjustFindingsForWAF({
  findings,          // mevcut bulgu dizisi
  wafDetected: waf.detected,
  wafProvider: waf.provider,
  bypassPossible: bypass.bypassPossible,
  headersAddedByWAF: waf.headersAddedByWAF,
});

// domain_scans tablosunu güncelle
await db.update(domainScans).set({
  wafDetected: waf.detected,
  wafProvider: waf.provider,
  wafBypassPossible: bypass.bypassPossible,
  originIp: bypass.originIp,
  wafHeadersAdded: waf.headersAddedByWAF,
  wafConfidence: waf.confidence,
}).where(eq(domainScans.id, scanId));

// findings yerine adjustedFindings'i kaydet
// saveFindings(scanId, findings)  ← ESKİ
// saveFindings(scanId, adjustedFindings)  ← YENİ
```

---

### DEĞİŞİKLİK 6 — MEVCUT DOSYA: RAPOR ÜRETME
**Dosya:** Tarama raporu görünümünü veya
PDF raporunu oluşturan dosya

**Nereye 1:** Raporun en üstüne, bulgular listesinden önce

**Ne eklenecek:** WAF durumu özet banner'ı:
```typescript
// scan.wafDetected true ise şu banner'ı göster:

if (scan.wafDetected) {
  const providerDisplay = {
    cloudflare: 'Cloudflare', f5: 'F5 BIG-IP',
    akamai: 'Akamai', imperva: 'Imperva',
    sucuri: 'Sucuri', aws_waf: 'AWS WAF',
  }[scan.wafProvider] || scan.wafProvider;

  if (scan.wafBypassPossible) {
    // Kırmızı uyarı banner
    // "⚠️ {provider} WAF Tespit Edildi — Bypass Riski
    //  Kaynak sunucuya direkt IP erişimi mümkün.
    //  Tüm bulgular tam riskiyle geçerlidir."
  } else {
    // Mavi bilgi banner
    // "🛡️ {provider} WAF Aktif — CVE Riskleri Kısmen Azaltılmış
    //  SSL, e-posta ve sızıntı bulguları WAF'tan bağımsızdır."
  }
}
```

**Nereye 2:** Her bulgu kartında

**Ne eklenecek:** Bulgunun `wafMitigationNote` alanı doluysa
bulgu kartının altına küçük gri not olarak ekle:
```
📋 Cloudflare WAF aktif — bu CVE sınıfını kısmen bloklar.
   Pratik risk: CVSS 9.8 → 5.9
   Yama yine de önerilir — WAF bypass teknikleri mevcuttur.
```

---

### DEĞİŞİKLİK 7 — MEVCUT DOSYA: CLAUDE RAPOR PROMPT'U
**Dosya:** Claude'a rapor yazdıran prompt string'ini bul

**Nereye:** Prompt'un sonuna, DOMAIN BİLGİSİ bölümüne ekle

**Ne eklenecek:**
```
WAF DURUMU:
${scan.wafDetected
  ? `${scan.wafProvider} WAF tespit edildi.
     Bypass mümkün: ${scan.wafBypassPossible ? 'EVET — tam risk geçerli' : 'Hayır'}
     CVE bulgularında risk azaltıldı: ${!scan.wafBypassPossible ? 'Evet' : 'Hayır'}
     WAF etkilemeyen bulgular: SSL, e-posta, sızıntı — bunları tam kritik yaz.`
  : 'WAF tespit edilmedi. Tüm bulgular tam riskiyle raporla.'}
```

---

## BEKLENEN SONUÇ

Bu değişiklikler tamamlandıktan sonra şu test yapılmalı:

**Test 1 — Cloudflare kullanan bir domain tara:**

Beklenen sonuç:
```
Rapor üstü: 🛡️ Cloudflare WAF Aktif

WordPress CVSS 9.8 bulgusu:
  Önceki: Kritik — CVSS 9.8
  Sonraki: Yüksek — CVSS 5.9
  Not: "Cloudflare WAF aktif — pratik risk azaltılmış:
        CVSS 9.8 → 5.9. Yama yine de önerilir."

SSL 27 gün bulgusu:
  Değişmez — Kritik kalmaya devam eder
  Not: "Cloudflare WAF bu bulguyu etkilemez."

DMARC eksik bulgusu:
  Değişmez — Kritik kalmaya devam eder
  Not: "Cloudflare WAF bu bulguyu etkilemez."
```

**Test 2 — WAF'ı olan ama direkt IP erişimi açık domain:**

Beklenen sonuç:
```
Rapor üstü: ⚠️ Cloudflare WAF Tespit Edildi — Bypass Riski

WordPress CVSS 9.8 bulgusu:
  Değişmez — Kritik 9.8 kalır
  Not: "WAF aktif ancak kaynak sunucuya direkt erişim
        mümkün — WAF bypass riski. Risk azaltımı uygulanmadı."
```

**Test 3 — WAF'sız domain:**

Beklenen sonuç:
```
Rapor üstü: Banner yok

Tüm bulgular orijinal CVSS değerleriyle
hiçbir değişiklik olmadan raporlanır.
```

---

## ÖNEMLİ

Mevcut tarama akışını bozma.
Sadece belirtilen yerlere ekle.
WAF tespiti başarısız olursa
(timeout, bağlantı hatası vb.)
tarama normal devam etsin, sadece
waf_detected = false olarak kaydetsin.
Hata taramayı durdurmasın.

---

*CyberStep.io — WAF Farkındalıklı Tarama — 2026*
