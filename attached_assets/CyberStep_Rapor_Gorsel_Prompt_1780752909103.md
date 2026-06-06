# CyberStep.io — Rapor Görsel Yükseltme + Bug 19+20
## Replit Agent Promptu — Tam Branding Uyumu

---

## BAĞLAM

**A — Bug Düzeltmeleri:**
  Bug 19: WAF notu raporda görünmüyor
  Bug 20: "ORTA [Yüksek]" çelişkili etiket
  HTTP başlık: "3/100" → "3/5 başlık"

**B — Görsel Yükseltme:**
  Mevcut sosyal medya görselleri ve logo'dan
  alınan GERÇEK renk paleti ile 4 sayfalı PDF rapor.

---

## CyberStep BRANDING PALETİ

```
Görseller analiz edildi (/mnt/user-data/outputs/):
  cyberstep_profile_photo.png
  cyberstep_linkedin_cover.png
  cyberstep_og_image.png

ARKAPLAN GRADYANı:
  --bg-deepest:   #060D1A   /* Sayfa zemini */
  --bg-dark:      #071828   /* Panel zemini */
  --bg-card:      #0C2F47   /* Kart zemini */
  --bg-panel:     #0F3460   /* Açık panel */

ANA VURGU:
  --accent-cyan:  #00C8FF   /* "Step" kelimesi, linkler */

VERİ/UYARI:
  --data-amber:   #F5A623   /* Risk skoru sayıları, uyarılar */

METİN:
  --text-primary: #E8EDF5   /* Ana metin (beyaza yakın) */
  --text-muted:   #7B8FAF   /* İkincil metin */
  --text-accent:  #00C8FF   /* Vurgu metin */

LOGO KURALI:
  "Cyber" → beyaz, bold
  "Step"  → #00C8FF, bold
  ".io"   → gri, küçük
  Kalkan ikonu → outline, #00C8FF

KAÇINILACAK:
  Açık arka planlar (beyaz, açık gri)
  Yeşil ana renk olarak kullanmak
  Farklı mavi tonları (#0F3460 yerine #00C8FF kullan)
```

---

## BÖLÜM A — BUG DÜZELTMELERİ

### Bug 20 — Çelişkili Etiket

```typescript
// MITRE senaryo başlığı formatı:
// ESKİ: "ORTA [Yüksek] SSL Sona Erme..."
// YENİ: "ORTA — SSL Sertifikası Sona Erme..."
// Köşeli parantez yok, sadece kendi seviyesi.
```

### HTTP Başlık "3/100" → "3/5"

```typescript
// ESKİ: headers.score / headers.maxScore → "3/100"
// YENİ: headers.present / headers.total → "3/5 başlık"
```

### Bug 19 — WAF Notu

```typescript
// detectWAFEnhanced() → wafResult.note doluysa raporda göster
if (!wafResult.provider && wafResult.note) {
  scanData.wafNote = wafResult.note;
}
// Rapor HTML'de: ${scanData.wafNote ? `ℹ️ ${scanData.wafNote}` : ""}
```

---

## BÖLÜM B — RAPOR HTML ŞABLONu (TAM YENİDEN YAZ)

### CSS — CyberStep Branding'e Tam Uyum

```css
/* ──────────────────────────────────────────
   CyberStep Rapor CSS — Branding v2
   Renk kaynağı: cyberstep_profile_photo.png,
   cyberstep_og_image.png, cyberstep_linkedin_cover.png
   ────────────────────────────────────────── */

:root {
  --bg-deepest: #060D1A;
  --bg-dark:    #071828;
  --bg-card:    #0C2F47;
  --bg-panel:   #0F3460;
  --accent:     #00C8FF;
  --amber:      #F5A623;
  --text-light: #E8EDF5;
  --text-muted: #7B8FAF;
  --border:     rgba(0, 200, 255, 0.15);
  --success:    #00E096;
  --warning:    #F5A623;
  --danger:     #FF4560;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Segoe UI', Arial, sans-serif;
  background: white;
  color: #0A0E17;
  font-size: 10pt;
}

/* ── KAPAK — Koyu tema, branding renkleri ── */
.cover {
  height: 100vh; min-height: 270mm;
  background: linear-gradient(145deg, #071828 0%, #060D1A 60%, #0C2F47 100%);
  display: flex;
  flex-direction: column;
  padding: 56px 60px;
  page-break-after: always;
  position: relative;
  overflow: hidden;
}

/* Arka plan dekoratif daireler */
.cover::before {
  content: '';
  position: absolute;
  width: 500px; height: 500px;
  border-radius: 50%;
  border: 1px solid rgba(0,200,255,0.06);
  right: -80px; top: -80px;
}
.cover::after {
  content: '';
  position: absolute;
  width: 280px; height: 280px;
  border-radius: 50%;
  border: 1px solid rgba(0,200,255,0.04);
  right: 120px; top: 180px;
}

/* Logo — Cyber(beyaz)Step(cyan).io */
.logo {
  display: flex;
  align-items: baseline;
  gap: 0;
}
.logo-cyber {
  font-size: 22pt;
  font-weight: 900;
  color: #E8EDF5;
  letter-spacing: -0.5px;
}
.logo-step {
  font-size: 22pt;
  font-weight: 900;
  color: #00C8FF;
  letter-spacing: -0.5px;
}
.logo-io {
  font-size: 11pt;
  font-weight: 400;
  color: #7B8FAF;
  margin-left: 2px;
}

/* Rapor tipi etiketi */
.cover-badge {
  margin-top: 10px;
  display: inline-block;
  background: rgba(0,200,255,0.1);
  border: 1px solid rgba(0,200,255,0.25);
  color: #00C8FF;
  font-size: 7pt;
  font-weight: 600;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  padding: 4px 14px;
  border-radius: 100px;
  width: fit-content;
}

/* Domain + tarih */
.cover-main { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.cover-domain { font-size: 26pt; font-weight: 900; color: #E8EDF5; margin-bottom: 6px; }
.cover-subtitle { font-size: 10pt; color: #7B8FAF; margin-bottom: 44px; }

/* Gauge */
.gauge-wrap { display: flex; align-items: center; gap: 36px; margin-bottom: 36px; }

.gauge-outer {
  width: 130px; height: 130px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  /* conic-gradient JS tarafından dinamik set edilir */
}
.gauge-inner {
  width: 100px; height: 100px; border-radius: 50%;
  background: #060D1A;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  border: 1px solid rgba(0,200,255,0.1);
}
.gauge-num {
  font-size: 26pt; font-weight: 900;
  /* Renk: skor seviyesine göre atanır */
  line-height: 1;
}
.gauge-sub { font-size: 7.5pt; color: #7B8FAF; }

.score-level { font-size: 17pt; font-weight: 800; margin-bottom: 6px; }
.score-desc  { font-size: 8.5pt; color: #7B8FAF; line-height: 1.5; max-width: 260px; }

/* Sektör karşılaştırma */
.compare-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.compare-bar {
  width: 140px; height: 5px;
  background: rgba(255,255,255,0.08);
  border-radius: 3px; position: relative;
}
.compare-avg {
  position: absolute; height: 100%;
  background: rgba(0,200,255,0.2);
  border-radius: 3px; width: 58%; /* TR ort. 58/100 */
}
.compare-you {
  position: absolute; height: 100%;
  border-radius: 3px;
  /* genişlik ve renk JS'de atanır */
}
.compare-lbl { font-size: 7pt; color: #7B8FAF; }

/* Kapak footer */
.cover-footer {
  display: flex; justify-content: space-between; align-items: flex-end;
}
.cover-meta { font-size: 8pt; color: #7B8FAF; }
.cover-meta strong { color: #A8B8D0; display: block; font-size: 9pt; }
.confidential {
  border: 1px solid rgba(0,200,255,0.2);
  padding: 5px 14px; border-radius: 4px;
  font-size: 7pt; color: #7B8FAF;
  letter-spacing: 2px; text-transform: uppercase;
}

/* ── SAYFA (beyaz arkaplan, koyu metin) ── */
.page {
  padding: 36px 48px;
  page-break-before: always;
  background: white;
}

.sec-eye {
  font-size: 7pt; font-weight: 700;
  letter-spacing: 2.5px; text-transform: uppercase;
  color: #00C8FF; margin-bottom: 8px;
}

.sec-title {
  font-size: 14pt; font-weight: 800; color: #060D1A;
  letter-spacing: -0.5px; margin-bottom: 18px;
  padding-bottom: 10px;
  border-bottom: 2px solid #F0F0F0;
}

/* Yönetici özeti kutusu */
.exec-box {
  background: #F0FBFF;
  border-left: 4px solid #00C8FF;
  padding: 18px 22px; border-radius: 0 8px 8px 0;
  margin-bottom: 22px; font-size: 10pt;
  line-height: 1.75; color: #1A2A3A;
}

/* Puan bar */
.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; }
.bar-label { width: 80px; font-size: 8.5pt; font-weight: 600; color: #333; flex-shrink: 0; }
.bar-bg { flex: 1; height: 7px; background: #EAEFF5; border-radius: 4px; position: relative; }
.bar-fill { height: 100%; border-radius: 4px; }
.bar-val  { width: 52px; font-size: 8pt; font-weight: 700; color: #060D1A; text-align: right; flex-shrink: 0; }

/* Bar renkleri — skor seviyesine göre */
.bar-full    { background: #00C8FF; }  /* 80-100% */
.bar-good    { background: #00C8AA; }  /* 60-79% */
.bar-medium  { background: #F5A623; }  /* 40-59% */
.bar-low     { background: #FF4560; }  /* <40% */

/* Takvim uyarı kutusu */
.cal-alert {
  background: #FFF8E7; border: 1.5px solid #F5A623;
  border-radius: 10px; padding: 14px 18px;
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 12px;
}
.cal-icon { font-size: 20pt; flex-shrink: 0; }
.cal-title { font-size: 9pt; font-weight: 700; color: #7B4500; margin-bottom: 2px; }
.cal-desc  { font-size: 8pt; color: #8B5200; line-height: 1.4; }
.cal-days  { margin-left: auto; flex-shrink: 0; text-align: center; }
.cal-days-num { font-size: 20pt; font-weight: 900; color: #F5A623; line-height: 1; }
.cal-days-lbl { font-size: 6.5pt; color: #8B5200; text-transform: uppercase; letter-spacing: 1px; }

/* MITRE kart */
.mitre-card { border: 1px solid #E0E8F0; border-radius: 10px; margin-bottom: 14px; overflow: hidden; }

.mitre-hdr { padding: 11px 15px; display: flex; align-items: center; gap: 10px; }
/* Seviye arkaplanları — CyberStep koyu tema ile uyumlu açık tonlar */
.mitre-hdr.critical { background: #FFF0F0; border-bottom: 1px solid #FFD0D0; }
.mitre-hdr.high     { background: #FFF5E0; border-bottom: 1px solid #FFE0A0; }
.mitre-hdr.medium   { background: #E8F8FF; border-bottom: 1px solid #B0E8FF; }
.mitre-hdr.low      { background: #F0FFF8; border-bottom: 1px solid #A0EECE; }

.mitre-badge {
  font-size: 6.5pt; font-weight: 800; letter-spacing: 1.5px;
  text-transform: uppercase; padding: 3px 9px; border-radius: 100px;
}
.critical .mitre-badge { background: #FFD0D0; color: #B00000; }
.high     .mitre-badge { background: #FFE0A0; color: #7A4000; }
.medium   .mitre-badge { background: #B0E8FF; color: #005080; }
.low      .mitre-badge { background: #A0EECE; color: #004030; }

.mitre-ttl { font-size: 9.5pt; font-weight: 700; color: #0A0E17; }
.mitre-body { padding: 12px 15px; background: #FAFCFF; }

.chain { display: flex; flex-direction: column; gap: 5px; margin: 8px 0; }
.chain-step { display: flex; align-items: flex-start; gap: 8px; font-size: 8pt; color: #334; line-height: 1.5; }
.chain-n {
  width: 18px; height: 18px; border-radius: 50%;
  background: #060D1A; color: #00C8FF;
  font-size: 7pt; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin-top: 1px;
}

.mitre-codes { margin-top: 8px; }
.mcode {
  display: inline-block; background: #EEF2F8;
  padding: 2px 7px; border-radius: 3px;
  margin-right: 4px; font-family: monospace;
  font-size: 7pt; color: #334;
}

/* KVKK kutusu */
.kvkk-box {
  background: #EEF5FF; border: 1px solid #C0D8FF;
  border-left: 3px solid #00C8FF;
  border-radius: 0 8px 8px 0; padding: 14px 18px; margin-top: 10px;
}
.kvkk-ttl { font-size: 8.5pt; font-weight: 700; color: #003060; margin-bottom: 5px; }
.kvkk-txt { font-size: 8pt; color: #224; line-height: 1.55; }

/* Aksiyon listesi */
.action-row { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid #F0F4F8; }
.action-num {
  width: 26px; height: 26px; border-radius: 50%;
  background: #060D1A; color: #00C8FF;
  font-weight: 800; font-size: 9pt;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.action-ttl { font-size: 9.5pt; font-weight: 700; color: #060D1A; margin-bottom: 3px; }
.action-dsc { font-size: 8.5pt; color: #445; line-height: 1.55; }
.urgency {
  font-size: 6.5pt; font-weight: 700; letter-spacing: 1px;
  text-transform: uppercase; margin-top: 5px;
  display: inline-block; padding: 2px 8px; border-radius: 100px;
}
.urgency-immediate { background: #FFE8E8; color: #B00000; }
.urgency-soon      { background: #FFF0CC; color: #7A4000; }
.urgency-monitor   { background: #E0F8EE; color: #005030; }

/* Footer */
.pg-footer {
  margin-top: 20px; padding-top: 10px;
  border-top: 1px solid #EEF2F8;
  display: flex; justify-content: space-between;
  font-size: 7pt; color: #AAB;
}
.pg-footer .logo-mark {
  font-weight: 700; color: #888;
}
.pg-footer .logo-mark span { color: #00C8FF; }
```

---

### Rapor Üretim Fonksiyonu

```typescript
// Mevcut buildReportHTML() veya generateScanReportPDF() içinde
// CSS'i yukarıdakiyle değiştir
// Aşağıdaki HTML yapısını kullan:

function buildReportHTML(scan: ScanData): string {

  // Skor renk sistemi — CyberStep palette
  function scoreColor(score: number): string {
    if (score >= 80) return "#00C8FF";  // Cyan — iyi
    if (score >= 60) return "#00C8AA";  // Teal — orta
    if (score >= 40) return "#F5A623";  // Amber — zayıf
    return "#FF4560";                   // Kırmızı — kritik
  }

  function scoreLevel(score: number): string {
    if (score >= 80) return "İyi";
    if (score >= 60) return "Orta";
    if (score >= 40) return "Zayıf";
    return "Kritik";
  }

  function scoreDesc(score: number): string {
    if (score >= 80) return "Temel güvenlik önlemleri büyük ölçüde yerinde. Birkaç iyileştirme ile tam koruma sağlanabilir.";
    if (score >= 60) return "Önemli güvenlik eksiklikleri mevcut. Aksiyon alınmazsa risk artacak.";
    if (score >= 40) return "Kritik güvenlik açıkları tespit edildi. Acil müdahale gerekiyor.";
    return "Şirketiniz ciddi siber risk altında. Hemen aksiyon alın.";
  }

  function barClass(pct: number): string {
    if (pct >= 80) return "bar-full";
    if (pct >= 60) return "bar-good";
    if (pct >= 40) return "bar-medium";
    return "bar-low";
  }

  const color = scoreColor(scan.overallScore);
  const level = scoreLevel(scan.overallScore);
  const pct   = scan.overallScore;
  const date  = new Date().toLocaleDateString("tr-TR",
    { day:"numeric", month:"long", year:"numeric" });

  // Puan dökümü
  const breakdown = [
    { label: "SPF",   score: scan.spfScore,   max: 20 },
    { label: "DMARC", score: scan.dmarcScore, max: 25 },
    { label: "DKIM",  score: scan.dkimScore,  max: 20 },
    { label: "MX",    score: scan.mxScore,    max: 10 },
    { label: "SSL",   score: scan.sslScore,   max: 25 },
  ];

  // Takvim uyarıları
  const calerts: string[] = [];
  if (scan.sslDaysLeft !== null && scan.sslDaysLeft <= 30) {
    const dl = new Date();
    dl.setDate(dl.getDate() + scan.sslDaysLeft);
    calerts.push(`
    <div class="cal-alert">
      <div class="cal-icon">🔒</div>
      <div>
        <div class="cal-title">SSL Sertifikası Yenilenmeli</div>
        <div class="cal-desc">
          ${scan.sslIssuer || "Sertifikanız"} ${scan.sslDaysLeft} gün
          içinde sona eriyor.
        </div>
      </div>
      <div class="cal-days">
        <div class="cal-days-num">${scan.sslDaysLeft}</div>
        <div class="cal-days-lbl">Gün</div>
        <div style="font-size:7pt;color:#8B5200;margin-top:2px">
          ${dl.toLocaleDateString("tr-TR",{day:"numeric",month:"long"})}
        </div>
      </div>
    </div>`);
  }

  const threatLevel =
    scan.overallScore >= 80 ? "Düşük"  :
    scan.overallScore >= 60 ? "Orta"   :
    scan.overallScore >= 40 ? "Yüksek" : "Kritik";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
${REPORT_CSS}
/* REPORT_CSS yerine yukarıdaki CSS bloğunu buraya yapıştır */
</style>
</head>
<body>

<!-- ══ SAYFA 1: KAPAK ══ -->
<div class="cover">
  <div>
    <div class="logo">
      <span class="logo-cyber">Cyber</span>
      <span class="logo-step">Step</span>
      <span class="logo-io">.io</span>
    </div>
    <div class="cover-badge">Alan Adı Güvenlik Tarama Raporu</div>
  </div>

  <div class="cover-main">
    <div class="cover-domain">${scan.domain}</div>
    <div class="cover-subtitle">
      ${date} &nbsp;·&nbsp; Rapor #${scan.reportNo}
    </div>

    <div class="gauge-wrap">
      <div class="gauge-outer" style="background: conic-gradient(
        ${color} ${pct}%, rgba(0,200,255,0.08) 0%)">
        <div class="gauge-inner">
          <div class="gauge-num" style="color:${color}">
            ${scan.overallScore}
          </div>
          <div class="gauge-sub">/100</div>
        </div>
      </div>
      <div>
        <div class="score-level" style="color:${color}">
          ${level}
        </div>
        <div class="score-desc">
          ${scoreDesc(scan.overallScore)}
        </div>
        <div class="compare-row">
          <span class="compare-lbl">TR Ort. 58</span>
          <div class="compare-bar">
            <div class="compare-avg"></div>
            <div class="compare-you"
              style="width:${pct}%; background:${color}">
            </div>
          </div>
          <span class="compare-lbl">Siz ${scan.overallScore}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div class="cover-meta">
      <strong>${scan.companyName || scan.domain}</strong>
      Hazırlayan: CyberStep.io
    </div>
    <div class="confidential">Gizli</div>
  </div>
</div>

<!-- ══ SAYFA 2: ÖZET + PUAN ══ -->
<div class="page">
  <div class="sec-eye">Yönetici Özeti</div>
  <div class="sec-title">Genel Değerlendirme</div>

  <div class="exec-box">${scan.executiveSummary}</div>

  ${calerts.join("")}

  <div class="sec-eye" style="margin-top:20px">Puan Dökümü</div>
  ${breakdown.map(b => {
    const bpct = (b.score / b.max) * 100;
    return `<div class="bar-row">
      <div class="bar-label">${b.label}</div>
      <div class="bar-bg">
        <div class="bar-fill ${barClass(bpct)}"
          style="width:${bpct}%">
        </div>
      </div>
      <div class="bar-val">${b.score}/${b.max}</div>
    </div>`;
  }).join("")}

  ${scan.headersPresent !== undefined ? `
  <div class="bar-row" style="margin-top:6px">
    <div class="bar-label">HTTP Başlık</div>
    <div class="bar-bg">
      <div class="bar-fill ${barClass((scan.headersPresent/5)*100)}"
        style="width:${(scan.headersPresent/5)*100}%">
      </div>
    </div>
    <div class="bar-val">${scan.headersPresent}/5 başlık</div>
  </div>` : ""}

  ${scan.wafNote ? `
  <p style="margin-top:12px;font-size:8.5pt;color:#557;
    background:#F0FBFF;border-left:3px solid #00C8FF;
    padding:8px 12px;border-radius:0 4px 4px 0">
    ℹ️ ${scan.wafNote}
  </p>` : ""}

  <div class="pg-footer">
    <span>${scan.domain} · ${date}</span>
    <span class="logo-mark">
      Cyber<span>Step</span>.io · Rapor #${scan.reportNo}
    </span>
  </div>
</div>

<!-- ══ SAYFA 3: MİTRE ══ -->
<div class="page">
  <div class="sec-eye">Risk Analizi</div>
  <div class="sec-title">MITRE ATT&amp;CK Saldırı Senaryoları</div>

  <p style="font-size:8.5pt;color:#557;margin-bottom:16px">
    Genel Tehdit Seviyesi:&nbsp;
    <strong style="color:${color}">${threatLevel}</strong>
  </p>

  ${(scan.mitreScenarios || []).map(s => `
  <div class="mitre-card">
    <div class="mitre-hdr ${s.level}">
      <span class="mitre-badge">${s.levelLabel}</span>
      <span class="mitre-ttl">${s.title}</span>
    </div>
    <div class="mitre-body">
      <p style="font-size:8pt;color:#445;margin-bottom:6px">
        <strong>Giriş Noktası:</strong> ${s.entryPoint}
      </p>
      <div class="chain">
        ${(s.attackChain||[]).map((step: string, i: number) => `
        <div class="chain-step">
          <div class="chain-n">${i+1}</div>
          <div>${step}</div>
        </div>`).join("")}
      </div>
      <p style="font-size:8pt;color:#223;margin-top:8px">
        <strong>Etki:</strong> ${s.impact}
      </p>
      ${s.kvkkNote ? `
      <div class="kvkk-box">
        <div class="kvkk-ttl">⚖️ KVKK Uyum Notu</div>
        <div class="kvkk-txt">${s.kvkkNote}</div>
      </div>` : ""}
      <div class="mitre-codes" style="margin-top:8px">
        ${(s.codes||[]).map((c: string) =>
          `<span class="mcode">${c}</span>`).join("")}
      </div>
    </div>
  </div>`).join("")}

  <div class="pg-footer">
    <span>${scan.domain} · ${date}</span>
    <span class="logo-mark">Cyber<span>Step</span>.io</span>
  </div>
</div>

<!-- ══ SAYFA 4: AKSİYON ══ -->
<div class="page">
  <div class="sec-eye">Aksiyon Planı</div>
  <div class="sec-title">Öncelikli Adımlar</div>

  ${(scan.actions||[]).map((a: any, i: number) => `
  <div class="action-row">
    <div class="action-num">${i+1}</div>
    <div>
      <div class="action-ttl">${a.title}</div>
      <div class="action-dsc">${a.description}</div>
      <span class="urgency urgency-${a.urgency}">
        ${a.urgencyLabel}
      </span>
    </div>
  </div>`).join("")}

  <div class="kvkk-box" style="margin-top:24px">
    <div class="kvkk-ttl">⚖️ KVKK Madde 12 Hatırlatması</div>
    <div class="kvkk-txt">
      6698 Sayılı KVKK kapsamında veri sorumlularının kişisel
      verilerin güvenliğini sağlamak için gerekli teknik tedbirleri
      alması zorunludur. Bu rapordaki bulgular teknik tedbir
      yükümlülüğünüzü doğrudan ilgilendirmektedir.
    </div>
  </div>

  <div class="pg-footer" style="margin-top:28px">
    <span>cyberstep.io</span>
    <span class="logo-mark">
      Cyber<span>Step</span>.io · ${date}
    </span>
  </div>
</div>

</body>
</html>`;
}
```

---

## TEST

```
netsys.com.tr (84/100) tara:

□ Kapak: Koyu #060D1A arka plan ✓
□ Logo: "Cyber" beyaz + "Step" #00C8FF ✓
□ Gauge: Cyan (#00C8FF) dolgu ✓
□ "Gizli" badge sağ altta ✓
□ Sektör karşılaştırma barı ✓

□ Sayfa 2: SSL takvim kutusu amber (#F5A623) ✓
□ Bar renkleri: cyan/teal/amber/red ✓
□ HTTP başlık: "3/5 başlık" (3/100 değil) ✓
□ WAF notu: "ℹ️ IP Fransa'da..." ✓

□ Sayfa 3: MITRE seviye "ORTA —" (köşeli parantez yok) ✓
□ Chain numaraları: koyu arka plan + cyan numara ✓
□ KVKK kutusu: cyan sol bordür ✓

□ Sayfa 4: Aksiyon numaraları: koyu + cyan ✓
□ Genel KVKK kutusu altta ✓
□ Footer logo: "Cyber" gri + "Step" cyan ✓
```

---

*CyberStep.io — Branding Uyumlu Rapor Şablonu — Haziran 2026*
*Renk kaynağı: cyberstep_profile_photo.png + cyberstep_og_image.png*
