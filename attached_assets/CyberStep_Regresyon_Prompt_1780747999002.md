# CyberStep.io — Regresyon + Eksik Düzeltmeleri
## Replit Agent Promptu — Bug 2+6+14 Regresyon, Bug 16+19 Eksik

---

## BAĞLAM

3 taramadan tespit edilenler (manivela #69, guzel #70, netsys #68):

✅ Puan dökümü raporda görünüyor (Bug 15 tamam)
✅ Bug 1, 13, 17, 18 tamam
❌ Regresyon: Bug 2, 6, 14 geri döndü
⚠️ Eksik: Bug 16 kısmen, Bug 19 çalışmıyor

---

## ADIM 0 — ÖNCE MEVCUT KODU OKU

```
Şunları bul ve oku:

1. MITRE prompt'u — tüm kurallar hâlâ var mı?
   filterCVEsForMITRE() çağrılıyor mu?

2. WAF detection — detectWAFEnhanced() yazıldı mı?
   wafResult.note rapor verisine aktarılıyor mu?

3. Rapor template'i — wafNote gösteriliyor mu?

Okuduktan sonra aşağıdaki düzeltmeleri uygula.
```

---

## REGRESYON 1 — BUG 2: CLOUDFLARE BYPASS

**Sorun (guzel.net.tr #70):**
Cloudflare tespit edildi ama
"Cloudflare WAF Bypass ve Kaynak Sunucu İstismarı"
MITRE senaryosunda yazıyor.

**Düzeltme:**

```typescript
// MITRE prompt'unda CDN kuralını güçlendir.
// Şu anki kural yeterince güçlü değil —
// Claude bazen görmezden geliyor.
// Prompt'un EN BAŞINA koy:

const cdnBlock = wafProvider
  ? `⛔⛔⛔ ZORUNLU KURAL:
     WAF/CDN TESPİT EDİLDİ: ${wafProvider.toUpperCase()}
     
     - "bypass" kelimesi KESİNLİKLE KULLANMA
     - "kaynak sunucu" ifadesi KULLANMA
     - "${wafProvider}" adını senaryo içinde KULLANMA
     - CDN bypass senaryosu YAZMA
     
     Bu kural diğer tüm kurallardan önce gelir.`
  : `✓ CDN/WAF yok — bypass senaryosu üretilebilir.`;

// Bu bloğu prompt'un ilk satırlarına yerleştir.
```

---

## REGRESYON 2 — BUG 6+14: CVE-2007 TEKRAR DÖNDÜ

**Sorun (manivela.net.tr #69):**
CVE-2007-6013 ve CVE-2016-1209 raporda tekrar çıktı.
"RPC/POP3 Üzerinden CVE-2007-6013 İstismarı" MITRE'da.

**Düzeltme — Adım 1: filterCVEsForMITRE kontrolü:**

```typescript
// CVE listesi MITRE'a geçmeden önce
// filterCVEsForMITRE() çağrıldığını doğrula.

// Fonksiyon yoksa veya çağrılmıyorsa ekle:
function filterCVEsForMITRE(
  cveList: Array<{
    id: string;
    epss?: number | null;
    inCisaKev?: boolean;
  }>
): typeof cveList {

  if (!cveList?.length) return [];

  return cveList.filter(cve => {
    if (cve.inCisaKev) return true;
    if ((cve.epss || 0) > 0.005) return true;
    const year = parseInt(cve.id.split("-")[1] || "0");
    const age = new Date().getFullYear() - year;
    if (age > 5) return false;
    return false;
  });
}

// Kullanım — MITRE prompt'u oluşturulmadan önce:
const filteredCVEs = filterCVEsForMITRE(allCVEs);
```

**Düzeltme — Adım 2: MITRE prompt'una güçlü kural:**

```typescript
const cveRule = `
SENARYO İÇİN KULLANILABİLİR CVE'LER:
${filteredCVEs.length > 0
  ? filteredCVEs.map(c =>
      `  ${c.id} | EPSS %${((c.epss || 0) * 100).toFixed(2)}`
    ).join("\n")
  : "  YOK"}

⛔ ZORUNLU KURAL:
   Listede olmayan CVE ID'sini senaryo adında KULLANMA.
   "CVE-2007-6013" listede yoksa bu CVE'yi YAZMA.
   "CVE-2016-1209" listede yoksa bu CVE'yi YAZMA.
   Liste boşsa hiçbir CVE ID'si içeren senaryo YAZMA.
`;
```

**Düzeltme — Adım 3: Rapor CVE bölümü:**

```typescript
// Raporda gösterilen CVE'leri de filtrele:
const activeCVEs = allCVEs.filter(c => {
  if (c.inCisaKev) return true;
  if ((c.epss || 0) > 0.001) return true;
  const year = parseInt(c.id.split("-")[1] || "0");
  return (new Date().getFullYear() - year) <= 5;
});

const infoOnlyCount = allCVEs.length - activeCVEs.length;

// Raporda:
// "Tespit Edilen CVE'ler: X aktif"
// activeCVEs → listele
// infoOnlyCount > 0 ise:
// "Bilgi Amaçlı (5+ yıllık, EPSS<%0.1): Y adet
//  güncel sisteminizi etkilemiyor olabilir"
```

---

## EKSİK — BUG 16: SPF SOFTFAIL + DMARC QUARANTINE

**Sorun (guzel.net.tr #70):**
SPF softfail + DMARC quarantine
→ email senaryo "YÜKSEK" ❌
→ olması gereken "Orta"

**Düzeltme:**

```typescript
// MITRE prompt'undaki email kuralını güncelle:

const emailRule = `
E-POSTA GÜVENLİK DURUMU:
  SPF: ${spfStatus}
  DMARC: ${dmarcPolicy || "yok"}

E-POSTA SENARYOSU KURALI:
  DMARC reject                     → Senaryo YAZMA
  DMARC quarantine (herhangi SPF)  → "Orta" seviye
  DMARC none (herhangi SPF)        → "Yüksek" seviye
  DMARC yok (herhangi SPF)         → "Yüksek" seviye

⛔ KURAL: DMARC quarantine varsa
   e-posta senaryosu "Yüksek" OLAMAZ.
   Maksimum "Orta" seviye.
`;
```

---

## EKSİK — BUG 19: WAF NOTU RAPORDA GÖRÜNMEKİR

**Sorun (netsys.com.tr #68):**
IP Fransa'da ama raporda "CDN olabilir" notu yok.

**Düzeltme:**

```typescript
// detectWAFEnhanced() çağrısı yapılıyor mu kontrol et.
// wafResult.note alanı doluysa rapor verisine aktar:

// Tarama sonucu oluştururken:
const wafResult = await detectWAFEnhanced(
  domain, httpHeaders, shodanData
);

const scanResult = {
  // ... diğer alanlar
  wafProvider:   wafResult.provider,
  wafConfidence: wafResult.confidence,
  wafNote:       wafResult.note,
  // Örnek: "WAF header'ları tespit edilemedi.
  //         Sunucu FR'de — CDN olabilir."
};

// Rapor şablonunda "İnternet Maruziyeti" bölümüne ekle:
// ${scanResult.wafNote
//     ? `ℹ️ ${scanResult.wafNote}`
//     : ""}
```

---

## TEST — PROMPT SONRASI TARANACAK 3 DOMAIN

**manivela.net.tr:**
```
□ CVE-2007 bölümde YOK (veya "Bilgi Amaçlı")
□ MITRE'da "CVE-2007-6013" adı YOK
□ DMARC reject → email senaryo YOK
□ Genel: "Düşük" (skor 92)
```

**guzel.net.tr:**
```
□ "Cloudflare WAF Bypass" senaryosu YOK
□ SPF softfail + DMARC quarantine → "Orta" max
□ Genel: "Düşük" (skor 84)
```

**netsys.com.tr:**
```
□ MitM senaryosu yok (SSL 21 gün)
□ "CDN kullanılıyor olabilir" notu görünüyor
□ Genel: "Düşük" (skor 84)
```

---

## BUG MATRİSİ — GÜNCEL

```
Bug  1: ✅ Kapalı (eşik 80)
Bug  2: ❌ Regresyon → bu prompt
Bug  3: ✅ Kapalı
Bug  4: ✅ Pipeline'da çalışıyor
Bug  5: ✅ Kapalı
Bug  6: ❌ Regresyon → bu prompt
Bug  7: ✅ Kapalı
Bug  8: ✅ Kapalı
Bug  9: ✅ Kapalı
Bug 10: ✅ Kapalı
Bug 11: ✅ Kapalı
Bug 12: ✅ Kapalı
Bug 13: ✅ Kapalı
Bug 14: ❌ Regresyon → bu prompt
Bug 15: ✅ Kapalı (puan dökümü raporda görünüyor)
Bug 16: ⚠️ Kısmen → bu prompt
Bug 17: ✅ Kapalı
Bug 18: ✅ Kapalı
Bug 19: ⚠️ Eksik → bu prompt
```

---

*CyberStep.io — Regresyon + Eksik — Haziran 2026*
*5 madde kapanınca 19/19 bug kapalı.*
