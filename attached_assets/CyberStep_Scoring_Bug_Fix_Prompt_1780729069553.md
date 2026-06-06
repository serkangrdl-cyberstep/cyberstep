# CyberStep.io — Kapsamlı Tarama & Pipeline Bug Düzeltmeleri
## Replit Agent Promptu — 13 Bug, 4 Rapor, Tek Prompt

---

## BAĞLAM

4 gerçek tarama raporu analiz edildi:
  #51 erkunttraktor.com.tr — 95/100 → "Yüksek Tehdit" (yanlış)
  #52 tobb.org.tr — kamu kurumu pipeline'a girdi
  #53 guzel.net.tr — 75/100 → "Kritik Tehdit" + 2007 CVE
  #54 sinop.edu.tr — .edu.tr, SSL bilgisi eksik

13 bug tespit edildi. Hepsi bu promptta.

---

## ADIM 0 — ÖNCE MEVCUT KODU OKU

```
Şu dosyaları bul ve oku:

1. MITRE ATT&CK senaryolarını üreten
   Claude çağrısı — "MITRE", "saldiri",
   "attack scenario" içeren callClaude()

2. calcScore() veya overallScore hesabı
   SPF/DMARC/DKIM/SSL nasıl toplanıyor?
   Puan-gösterge (! ve ✅) nasıl belirleniyor?

3. Lead kalifikasyon mantığı
   "isLead", "qualify", "lead_candidate"

4. CVE eşleştirme — Shodan CVE'leri nasıl
   işleniyor? EPSS var mı?

5. Domain eleme / certstreamLeadFilter.ts
```

---

## BUG 1+8+10+11 — MITRE SKORA BAKMIYOR

**Kök neden:** MITRE prompt'una overallScore
gönderilmiyor. Generic senaryo üretiyor.
Genel tehdit = max senaryo seviyesi (yanlış).

```typescript
// MITRE Claude prompt'unu bul ve şöyle güncelle:

const mitrePrompt = `
${domain} için MITRE ATT&CK senaryoları üret.

ZORUNLU BAĞLAM:
Güvenlik skoru: ${overallScore}/100
SSL: ${sslDaysLeft !== null ? sslDaysLeft + " gün" : "tespit edilemedi"}
CDN/WAF: ${wafProvider || "yok"}
DMARC: ${dmarcPolicy || "yok"}
DKIM: ${dkimPass ? "aktif" : "eksik"}
Açık port: ${openPortCount || 0}

GENEL TEHDİT SEVİYESİ — SADECE SKORA GÖRE:
  85-100 → "Düşük"
  65-84  → "Orta"
  40-64  → "Yüksek"
  0-39   → "Kritik"

Senaryo seviyelerinden bağımsız.
Bu kuralı kesinlikle uygula.

SENARYO KURALLARI:
  CDN bypass → SADECE wafProvider boş ise
  SSL saldırı → SADECE sslDaysLeft < 30 ise
  E-posta sahteciliği → SADECE dmarcPolicy
    "none" veya null ise

${overallScore >= 80 ? `
NOT: Skor ${overallScore}/100.
Genel seviye DÜŞÜK olmalı.
Sadece gerçek küçük açıkları belirt.
` : ""}
`;
```

---

## BUG 2 — CLOUDFLARE VARKEN CDN BYPASS SENARYOSU

Bug 1 düzeltmesiyle çözülüyor (SENARYO KURALLARI).
Ek olarak wafProvider'ın MITRE prompt'una
doğru aktarıldığını doğrula:

```typescript
// wafDetector.ts veya portRiskClassifier.ts'den
const wafProvider = detectWAF(httpHeaders, shodanData);
// "cloudflare" | "akamai" | "fortinet" | null

// Bu değeri MITRE çağrısına geçir
// wafProvider doluysa CDN bypass üretilmeyecek
```

---

## BUG 3 — LEAD KALİFİKASYONU MITRE'A BAKIYOR

```typescript
// Lead karar noktasını bul

// ESKİ (yanlış):
const isLead = mitreLevel === "Yüksek" ||
               mitreLevel === "Kritik";

// YENİ (doğru):
const isLead =
  overallScore < 60 &&
  !isExcludedDomain(domain, shodanOrg) &&
  overallScore > 0;
```

---

## BUG 4 — KAMU/DEVLET/EĞİTİM FİLTRESİ YOK

```typescript
// certstreamLeadFilter.ts veya leadScoringService.ts'e ekle

const EXCLUDED_TLDS = [
  ".gov.tr", ".edu.tr", ".k12.tr",
  ".mil.tr", ".bel.tr", ".pol.tr", ".tsk.tr",
];

const EXCLUDED_EXACT_DOMAINS = [
  "tobb.org.tr", "tesk.org.tr", "tusiad.org",
  "ziraatbank.com.tr", "halkbank.com.tr",
  "vakifbank.com.tr", "isbank.com.tr",
  "garanti.com.tr", "akbank.com",
];

const EXCLUDED_ORG_KEYWORDS = [
  "odalar ve borsalar", "belediye", "bakanligi",
  "bakanlık", "üniversite", "universite", "university",
  "hükümeti", "devlet", "kamu", "municipality",
];

export function isExcludedDomain(
  domain: string,
  shodanOrg?: string | null
): { excluded: boolean; reason: string } {

  const d = domain.toLowerCase();

  for (const tld of EXCLUDED_TLDS) {
    if (d.endsWith(tld))
      return { excluded: true, reason: `TLD: ${tld}` };
  }

  if (EXCLUDED_EXACT_DOMAINS.includes(d))
    return { excluded: true, reason: "Hariç kurum" };

  if (shodanOrg) {
    const org = shodanOrg.toLowerCase();
    for (const kw of EXCLUDED_ORG_KEYWORDS) {
      if (org.includes(kw))
        return { excluded: true, reason: `Org: ${kw}` };
    }
  }

  return { excluded: false, reason: "" };
}
```

---

## BUG 5 — CVE DETAY YOK (144 → KRİTİK/YÜKSEK/BİLGİ)

```typescript
interface CVESummary {
  total: number;
  critical: number;   // CISA KEV veya EPSS > %5
  high: number;       // EPSS %1-5
  medium: number;     // EPSS %0.1-1
  informational: number; // EPSS < %0.1
  cisaKevCount: number;
}

async function summarizeCVEs(
  cveIds: string[]
): Promise<CVESummary> {

  if (!cveIds?.length) return {
    total: 0, critical: 0, high: 0,
    medium: 0, informational: 0, cisaKevCount: 0
  };

  const details = await db.select()
    .from(vulncheckKevTable)
    .where(inArray(vulncheckKevTable.cveId, cveIds));

  const map = new Map(details.map(d => [d.cveId, d]));
  let c = 0, h = 0, m = 0, info = 0, kev = 0;

  for (const id of cveIds) {
    const d = map.get(id);
    const epss = d?.epssScore ? Number(d.epssScore) : 0;
    if (d?.inCisaKev) kev++;
    if (d?.inCisaKev || epss > 0.05) c++;
    else if (epss > 0.01) h++;
    else if (epss > 0.001) m++;
    else info++;
  }

  return {
    total: cveIds.length,
    critical: c, high: h,
    medium: m, informational: info,
    cisaKevCount: kev,
  };
}

// Raporda:
// Toplam: 144 CVE
//   🔴 Kritik (CISA KEV / EPSS>%5): 2
//   🟠 Yüksek (EPSS %1-5): 8
//   🟡 Orta: 31
//   ℹ️  Bilgi Amaçlı: 103
```

---

## BUG 6 — CVE VERSİYON EŞLEŞTİRMESİ YANLIŞ

**WordPress varsa 2007'lik CVE eşleşiyor.**

```typescript
// CVE eşleştirmesinde yaş filtresi:

function filterCVEsByAge(
  cveIds: string[],
  detectedVersion: string | null
): string[] {

  if (detectedVersion && detectedVersion !== "unknown") {
    // Versiyon biliniyorsa versiyona göre filtrele
    // (NVD API ile versiyon kontrolü — mevcut varsa kullan)
    return cveIds;
  }

  // Versiyon bilinmiyorsa son 3 yıl filtresi uygula
  const cutoffYear = new Date().getFullYear() - 3;
  return cveIds.filter(id => {
    const year = parseInt(id.split("-")[1]);
    return !isNaN(year) && year >= cutoffYear;
  });
}

// Raporda not ekle:
// Eğer eski CVE'ler çıkarıldıysa:
// "Not: Versiyonu tespit edilemeyen teknolojiler için
//  3 yıldan eski CVE'ler gösterilmemiştir."
```

---

## BUG 7 — EPSS SKORU CVE SATIRINDA YOK

```typescript
// Her CVE satırı için format:

function formatCVERow(
  cveId: string,
  cvssScore: number,
  epssScore: number | null,
  inCisaKev: boolean,
  description: string
): string {

  const priority =
    inCisaKev                ? "🔴 Aktif İstismar" :
    (epssScore || 0) > 0.05  ? "🟠 Yüksek Risk"   :
    (epssScore || 0) > 0.01  ? "🟡 Orta Risk"      :
    "ℹ️  Bilgi Amaçlı";

  const epssText = epssScore !== null
    ? `EPSS: %${(epssScore * 100).toFixed(2)}`
    : "EPSS: hesaplanıyor";

  return `${priority} | ${cveId} | CVSS ${cvssScore} | ${epssText}\n${description}`;
}
```

---

## BUG 9 — SPF PUAN-GÖSTERGE TUTARSIZLIĞI

```typescript
// checkSPF() veya spfCheck() içinde:

function evaluateSPF(record: string | null): {
  score: number;
  indicator: "ok" | "warning" | "error";
  note: string | null;
} {
  if (!record)
    return { score: 0, indicator: "error",
             note: "SPF kaydı yok." };

  if (record.includes("+all"))
    return { score: 0, indicator: "error",
             note: "SPF +all: Kritik sorun." };

  if (record.includes("~all"))
    return { score: 14, indicator: "warning",
             note: "SPF softfail (~all). -all önerilir." };

  if (record.includes("?all"))
    return { score: 10, indicator: "warning",
             note: "SPF neutral. Zayıf yapılandırma." };

  // -all veya hardfail → tam puan
  return { score: 20, indicator: "ok", note: null };
}

// KURAL: indicator "warning" ise score 20 OLMAZ.
// Bu iki değer her zaman tutarlı olmalı.
```

---

## BUG 11 — TUTARLILIK KONTROLÜ (SON GEÇİŞ)

```typescript
// Rapor PDF/JSON üretilmeden önce çağır:

function validateAndFixReport(report: any): any {

  // 1. Skor → MITRE tutarlılığı
  if (report.overallScore >= 85 &&
      ["Yüksek","Kritik"].includes(report.mitreTheatLevel)) {
    report.mitreTheatLevel = "Düşük";
    logger.warn({ domain: report.domain },
      "MITRE düzeltildi: yüksek skor + yüksek tehdit");
  }
  if (report.overallScore >= 65 &&
      report.mitreTheatLevel === "Kritik") {
    report.mitreTheatLevel = "Orta";
  }

  // 2. SPF indicator-score tutarlılığı
  if (report.spf?.indicator === "warning" &&
      report.spf?.score === 20) {
    report.spf.score = 14;
    logger.warn({ domain: report.domain },
      "SPF skoru düzeltildi: warning + 20 → 14");
  }

  // 3. Toplam skoru yeniden hesapla
  report.overallScore = Math.max(0, Math.min(100,
    (report.spf?.score    || 0) +
    (report.dmarc?.score  || 0) +
    (report.dkim?.score   || 0) +
    (report.mx?.score     || 0) +
    (report.ssl?.score    || 0) -
    (report.shodan?.portRiskSummary?.scoreDeduction || 0)
  ));

  return report;
}
```

---

## BUG 12 — SSL BİLGİSİ EKSİK

```typescript
// SSL fetch başarısız olunca:

if (!cert) {
  return {
    score: 0,
    indicator: "error",
    issuer: null,
    daysLeft: null,
    note:
      "SSL sertifikası alınamadı. " +
      "Alan adı HTTPS üzerinden erişilemiyor " +
      "veya geçersiz sertifika kullanıyor olabilir.",
  };
}
// Raporda boş bırakma, her zaman note yaz.
```

---

## BUG 13 — CT LOG SUBDOMAIN "!" YANLIŞ

```typescript
// crt.sh subdomain tespiti için:

function evaluateCTLog(count: number): {
  indicator: "ok" | "info" | "warning";
  note: string;
} {
  if (count === 0)
    return { indicator: "ok",
             note: "Subdomain tespit edilmedi." };

  if (count > 50)
    return { indicator: "warning",
             note: `${count} subdomain tespit edildi. ` +
                   "Fazla subdomain saldırı yüzeyini artırır." };

  // Normal → bilgi, uyarı değil
  return {
    indicator: "info",   // ! değil ℹ️
    note: `${count} subdomain tespit edildi. ` +
          "Tümünün güncel ve gerekli olduğunu doğrulayın.",
  };
}
```

---

## TEST SENARYOLARI

```
1. 95 puan domain → MITRE: "Düşük" ✓
2. Cloudflare domain → CDN bypass senaryosu YOK ✓
3. 95 puan → lead listesine GİRMEDİ ✓
4. sinop.edu.tr → excluded: true ✓
5. tobb.org.tr → excluded: true ✓
6. 40 puan domain → lead listesine GİRDİ ✓
7. 144 CVE → Kritik:2 / Yüksek:8 / Bilgi:103 ✓
8. CVE-2007-6013 → filtrelendi ✓
9. Her CVE satırında EPSS var ✓
10. SPF ~all → score:14, indicator:warning ✓
11. SSL alınamadı → açıklayıcı not ✓
12. 15 subdomain → ℹ️ (! değil) ✓
13. validateAndFixReport() çalıştır
    → 95 puan + Yüksek → otomatik Düşük ✓
```

---

## ÖZET

```
Bug  1: MITRE skora bakmıyor       → Prompt'a skor+kural
Bug  2: CDN bypass Cloudflare'de   → Bug 1 ile çözüldü
Bug  3: Lead MITRE'a bakıyor       → overallScore < 60
Bug  4: Kamu TLD filtresiz         → TLD+ASN+exact liste
Bug  5: CVE detay yok              → K/Y/O/Bilgi ayrımı
Bug  6: CVE versiyon yanlış        → 3 yıl yaş filtresi
Bug  7: EPSS gösterilmiyor         → Her satıra EPSS
Bug  8: Skor 75 → Kritik MITRE     → Bug 1 ile çözüldü
Bug  9: SPF uyarı ama 20 puan      → Kısmi puan sistemi
Bug 10: Genel = max senaryo        → Bug 1 ile çözüldü
Bug 11: Tutarlılık kontrolü yok    → validateAndFixReport()
Bug 12: SSL bilgisi eksik          → Detaylı hata mesajı
Bug 13: CT log subdomain → !       → "info" indicator
```

---

*CyberStep.io — 13 Bug Düzeltmesi — Haziran 2026*
*"Yanlış alarm güven öldürür. Doğru alarm güven inşa eder."*
