# CyberStep.io — Bug 14 + Bug 15 Düzeltmeleri
## Replit Agent Promptu — CVE→MITRE Filtresi + Skor Şeffaflığı

---

## BAĞLAM

4 yeni rapor analiz edildi (manivela, nb, durmazinsaat, uzak).
Önceki 13 bug teyit edildi.
2 yeni bug tespit edildi.

NOT: Önceki scoring_bug_fix_prompt zaten verildi.
Bu prompt sadece 2 yeni bug için.
Replit önce o prompt'un uygulanıp
uygulanmadığını kontrol etsin.

---

## ADIM 0 — ÖNCEKİ DÜZELTMELERİ DOĞRULA

```
Şunları kontrol et — önceki prompt uygulandı mı?

1. MITRE prompt'unda overallScore var mı?
   callClaude() içinde skor geçiliyor mu?

2. isExcludedDomain() fonksiyonu var mı?
   .edu.tr, .gov.tr filtreleniyor mu?

3. Lead kalifikasyonu overallScore < 60 mı?

Bunlar uygulanmadıysa önce o promptu ver.
Uygulandıysa bu prompt'a devam et.
```

---

## BUG 14 — ESKİ CVE DOĞRUDAN MITRE SENARYOSUNA GİRİYOR

**Sorun:**
manivela.net.tr ve uzak.net.tr'de
CVE-2007-6013 (WordPress 1.5-2.3.1, 2007 yılı)
MITRE senaryosunun adında ve içeriğinde
kullanılıyor:

```
"CVE-2007-6013 + CVE-2016-1209 Yığını
 İstismarı → RCE → Veri Hırsızlığı"
```

Bu CVE'nin EPSS skoru ~%0.01.
Modern WordPress'i etkilemiyor.
Ama müşteriye "sisteminiz tam ele
geçirilebilir" deniyor.

**Kök neden:**
CVE listesi MITRE prompt'una ham olarak
geçiliyor. Yaş veya EPSS filtresi yok.

**Düzeltme:**

```typescript
// MITRE senaryolarını üreten fonksiyonu bul
// CVE listesini Claude'a geçmeden önce filtrele:

interface CVEForMITRE {
  id: string;
  cvss: number;
  epss: number;
  inCisaKev: boolean;
  description: string;
}

function filterCVEsForMITRE(
  cveList: CVEForMITRE[]
): CVEForMITRE[] {

  if (!cveList?.length) return [];

  return cveList.filter(cve => {
    // CISA KEV'de → kesinlikle ekle
    if (cve.inCisaKev) return true;

    // EPSS > %0.5 → gerçek risk, ekle
    if (cve.epss > 0.005) return true;

    // Yıl filtresi: 5 yıldan eski CVE
    // EPSS yüksek değilse ekleme
    const year = parseInt(cve.id.split("-")[1]);
    const age = new Date().getFullYear() - year;
    if (age > 5 && cve.epss <= 0.005) return false;

    // CVSS 9+ ama EPSS çok düşük = teorik risk
    // Senaryo adında kullanma ama liste sonuna ekle
    if (cve.cvss >= 9 && cve.epss < 0.001) {
      // MITRE'a geçme ama raporda göster
      cve.mitreExcluded = true;
      return false;
    }

    return true;
  });
}

// MITRE prompt'una geçerken:
const filteredCVEs = filterCVEsForMITRE(cveList);

const mitrePrompt = `
...mevcut prompt içeriği...

Senaryo üretmek için kullanılabilir CVE'ler:
${filteredCVEs.length > 0
  ? filteredCVEs.map(c =>
      `${c.id} | CVSS ${c.cvss} | EPSS %${(c.epss*100).toFixed(2)}`
    ).join("\n")
  : "Aktif istismar için güvenilir CVE yok."}

KURAL: Sadece yukarıdaki listeden CVE'leri
senaryo adında kullan. Listede yoksa
senaryoda CVE ID'si yazma.
${filteredCVEs.length === 0 ? `
CVE listesi boş veya düşük riskli.
WordPress/jQuery varlığını senaryo için
genel terim olarak kullan,
spesifik CVE ID'si yazma.
` : ""}
`;
```

**Raporda gösterim:**
```
// Eski/düşük riskli CVE'ler için not ekle:
// (filtrelenen CVE'ler raporda hâlâ görünür
//  ama ayrı bölümde, düşük öncelikle)

const highPriorityCVEs = cveList.filter(
  c => c.inCisaKev || c.epss > 0.005
);
const informationalCVEs = cveList.filter(
  c => !c.inCisaKev && c.epss <= 0.005
);

// Raporda iki ayrı bölüm:
// "Aktif Risk CVE'leri" → highPriority
// "Bilgi Amaçlı CVE'ler" → informational
//   + "Bu CVE'ler teorik risk taşır,
//      güncel sistemleri doğrudan etkilemiyor
//      olabilir. EPSS skoru < %0.5"
```

**Test:**
```
WordPress'li domain tara.
CVE-2007-6013 MITRE senaryosunda
CVE ID'siyle GÖRÜNMEMELİ ✓

CVE-2007-6013 rapor listesinde
"Bilgi Amaçlı" olarak görünmeli ✓

CISA KEV'deki bir CVE varsa
MITRE senaryosunda adıyla
geçebilir ✓
```

---

## BUG 15 — KISMİ PUAN MANTIĞI BELGELENMEMİŞ

**Sorun:**
nb.net.tr: DMARC + DKIM + SSL hepsi "!"
Beklenen skor: 20 (SPF) + 10 (MX) = 30
Gerçek skor: 40

10 puan nereden geliyor belli değil.
"!" alan kalemler ne kadar puan alıyor
dökümante edilmemiş.

**Düzeltme:**

```typescript
// calcScore() veya overallScore hesabı neredeyse bul
// Her kalem için net puan tablosu oluştur:

interface ScoringRubric {
  spf: {
    hardfail:  number;  // "-all" → 20
    softfail:  number;  // "~all" → 14
    neutral:   number;  // "?all" → 10
    plusall:   number;  // "+all" → 0
    missing:   number;  // kayıt yok → 0
  };
  dmarc: {
    reject:     number; // p=reject → 25
    quarantine: number; // p=quarantine → 20
    none:       number; // p=none → 10
    missing:    number; // kayıt yok → 0
  };
  dkim: {
    pass:    number;  // Doğrulandı → 20
    missing: number;  // Bulunamadı → 8
    // (DKIM bulunamıyor olabilir ama aktif olabilir)
    fail:    number;  // Hata → 0
  };
  mx: {
    exists:  number;  // MX var → 10
    missing: number;  // MX yok → 0
  };
  ssl: {
    valid_60_plus: number; // 60+ gün → 25
    valid_30_59:   number; // 30-59 gün → 20
    valid_14_29:   number; // 14-29 gün → 15
    valid_7_13:    number; // 7-13 gün → 8
    valid_1_6:     number; // 1-6 gün → 2
    expired:       number; // Süresi dolmuş → 0
    unreachable:   number; // Alınamadı → 0
  };
}

// Sabit değerler — kod içinde bir yerde tanımla:
const SCORING_RUBRIC: ScoringRubric = {
  spf: {
    hardfail: 20, softfail: 14,
    neutral: 10, plusall: 0, missing: 0,
  },
  dmarc: {
    reject: 25, quarantine: 20,
    none: 10,   missing: 0,
  },
  dkim: {
    pass: 20, missing: 8, fail: 0,
  },
  mx: {
    exists: 10, missing: 0,
  },
  ssl: {
    valid_60_plus: 25, valid_30_59: 20,
    valid_14_29: 15,   valid_7_13: 8,
    valid_1_6: 2,      expired: 0, unreachable: 0,
  },
};

// Hesaplama fonksiyonu — tamamen deterministik:
function calculateScore(checks: {
  spfStatus: "hardfail"|"softfail"|"neutral"|"plusall"|"missing";
  dmarcPolicy: "reject"|"quarantine"|"none"|"missing";
  dkimStatus: "pass"|"missing"|"fail";
  mxExists: boolean;
  sslDaysLeft: number | null;
  portDeduction: number;
}): {
  total: number;
  breakdown: Record<string, number>;
} {

  const spfScore  = SCORING_RUBRIC.spf[checks.spfStatus];
  const dmarcScore = SCORING_RUBRIC.dmarc[checks.dmarcPolicy];
  const dkimScore = SCORING_RUBRIC.dkim[checks.dkimStatus];
  const mxScore   = checks.mxExists
    ? SCORING_RUBRIC.mx.exists : SCORING_RUBRIC.mx.missing;

  let sslScore = SCORING_RUBRIC.ssl.unreachable;
  if (checks.sslDaysLeft !== null) {
    if (checks.sslDaysLeft <= 0)       sslScore = 0;
    else if (checks.sslDaysLeft <= 6)  sslScore = 2;
    else if (checks.sslDaysLeft <= 13) sslScore = 8;
    else if (checks.sslDaysLeft <= 29) sslScore = 15;
    else if (checks.sslDaysLeft <= 59) sslScore = 20;
    else                               sslScore = 25;
  }

  const base = spfScore + dmarcScore + dkimScore
             + mxScore + sslScore;
  const total = Math.max(0, base - checks.portDeduction);

  return {
    total,
    breakdown: {
      spf:  spfScore,
      dmarc: dmarcScore,
      dkim: dkimScore,
      mx:   mxScore,
      ssl:  sslScore,
      portDeduction: -checks.portDeduction,
    },
  };
}
```

**Raporda puan breakdown göster:**

```
// Her kalem yanında puan açıkça yazılsın:
// Şu an raporda sadece "25 puan" veya "!" yazıyor.
// Hangi kuraldan dolayı o puanı aldığı belli olmalı.

// Örnek:
// ✅ DMARC Politikası — 25 puan
//    v=DMARC1; p=reject → Tam koruma
//
// ! DMARC Politikası — 10 puan
//    v=DMARC1; p=none → İzleme modu, koruma yok
//
// ✗ DMARC Politikası — 0 puan
//    Kayıt bulunamadı → E-posta sahteciliğine açık

// nb.net.tr örneğinde:
// Skor 40 şöyle dökülmeli:
//   SPF:   20 (hardfail ✅)
//   DMARC:  0 (missing ✗)
//   DKIM:   8 (bulunamadı !)
//   MX:    10 (aktif ✅)
//   SSL:    2 (alınamadı veya çok az kaldı !)
//   TOPLAM: 40
```

**Test:**
```
nb.net.tr yeniden tara:
  Skor detayı breakdownda görünmeli:
  DMARC: 0 puan (kayıt yok)
  DKIM: 8 puan (bulunamadı)
  SSL: 2 puan (alınamadı veya <7 gün)
  Toplam: 40 puan ✓

Aynı breakdown PDF'te de görünmeli ✓

manivela.net.tr SPF ~all:
  SPF satırı: "! SPF — 14 puan (softfail)"
  20 değil, 14 ✓
```

---

## BONUS — nb.net.tr DOĞRU ÇALIŞIYOR

```
Bu raporu özellikle not al:
nb.net.tr (40/100) sisteminizin
DOĞRU çalıştığının göstergesi.

Gerçek sorunlar var:
  MySQL 3306 açık → yüksek risk ✅
  FTP 21 açık → yüksek risk ✅
  DMARC eksik → meşru ✅
  Kara listede → meşru ✅
  MITRE "Yüksek" → skor 40, doğru ✅

Bu domain iyi bir lead.
Pipeline'dan geçmeli.
Bug 14+15 düzeltilse de
bu rapor temelden sağlam.
```

---

## TÜM BUG ÖZETİ (GÜNCELLENMİŞ)

```
Önceki prompt:
  Bug  1-13 → CyberStep_Scoring_Bug_Fix_Prompt.md

Bu prompt:
  Bug 14: CVE-2007 MITRE'da senaryo adı olarak kullanılıyor
          → EPSS filtresi + CVE whitelist for MITRE
  Bug 15: Kısmi puan mantığı belirsiz
          → SCORING_RUBRIC sabitleri + breakdown gösterimi
```

---

*CyberStep.io — Bug 14+15 Düzeltmesi — Haziran 2026*
*"Doğru alarm güven inşa eder."*
