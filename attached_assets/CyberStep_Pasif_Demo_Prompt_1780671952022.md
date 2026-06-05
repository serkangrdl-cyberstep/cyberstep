# CyberStep.io — Pasif Servisler + Demo Rapor Sistemi
## Replit Agent Promptu

---

## BAĞLAM

İki iş bu promptta:

**1. Pasif Servis Sistemi:**
8 servis public'ten kaldırılır ama
sistemden silinmez. Admin panelde
"Pasif Servisler" bölümünde görünür.
İleride tek tıkla aktif edilir.

**2. Demo Rapor Sistemi:**
Gece pipeline'ından düşük skorlu
domain seçilir. Domain adı "abc.com.tr"
yapılır, IP'ler kısmen gizlenir.
6 farklı servis için PDF demo rapor
üretilir. /demo sayfasında indirilebilir.

---

## ADIM 0 — ÖNCE MEVCUT KODU OKU

```
Şunları kontrol et:

services tablosu veya
servis tanımlarının tutulduğu yer
→ Servisler DB'de mi yoksa hardcode mu?
→ is_active veya status kolonu var mı?

src/routes/ içinde fiyatlandırma route
→ Pricing sayfası veriyi nereden alıyor?

PDF üretim altyapısı
→ Mevcut PDF üretimi var mı?
→ Hangi kütüphane? (puppeteer, react-pdf vb.)
→ Board raporu PDF'i nasıl üretiliyor?

Mevcut yapıyı anladıktan sonra
aşağıdaki sistemi o yapıyla uyumlu yaz.
```

---

## BÖLÜM 1: PASSİF SERVİS SİSTEMİ

### 1.1 Veritabanı

```sql
-- Mevcut services tablosuna kolonlar ekle
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS visibility varchar(20) DEFAULT 'public',
  -- 'public' | 'passive' | 'coming_soon'
  ADD COLUMN IF NOT EXISTS passive_reason text,
  ADD COLUMN IF NOT EXISTS passive_since timestamp,
  ADD COLUMN IF NOT EXISTS roadmap_quarter varchar(10);
  -- 'Q3 2026', 'Q1 2027'

-- Pasif yapılacak 8 servis:
-- (service_key alanına göre uyarla)

UPDATE services SET
  is_active = false, visibility = 'passive',
  passive_reason = 'FortiSIEM/FortiAnalyzer entegrasyonu yok. Sadece FortiGate push aktif.',
  passive_since = now(), roadmap_quarter = 'Q4 2026'
WHERE service_key = 'fortinet_security_fabric';

UPDATE services SET
  is_active = false, visibility = 'passive',
  passive_reason = 'Gerçek SOC analist ekibi gerektirir. Tamamen AI altyapı mevcut.',
  passive_since = now(), roadmap_quarter = 'Q2 2027'
WHERE service_key = 'soc_operasyon_merkezi';

UPDATE services SET
  is_active = false, visibility = 'passive',
  passive_reason = 'Kriz yönetimi insan müdahalesi gerektiriyor. Yeniden tanımlanacak.',
  passive_since = now(), roadmap_quarter = 'Q1 2027'
WHERE service_key = 'ai_noc_pro';

UPDATE services SET
  is_active = false, visibility = 'passive',
  passive_reason = 'Uzman doğrulaması için MSSP partneri gerekiyor.',
  passive_since = now(), roadmap_quarter = 'Q3 2026'
WHERE service_key = 'tam_guvenlik_degerlendirmesi';

UPDATE services SET
  is_active = false, visibility = 'passive',
  passive_reason = 'Deepfake risk metodolojisi netleştirilecek.',
  passive_since = now(), roadmap_quarter = 'Q4 2026'
WHERE service_key = 'deepfake_ses_analizi';

UPDATE services SET
  is_active = false, visibility = 'passive',
  passive_reason = 'Kredi sistemi kurulunca aktif edilecek. 49 TL/işlem modeli için Iyzico one-time gerekli.',
  passive_since = now(), roadmap_quarter = 'Q3 2026'
WHERE service_key = 'sahte_dokuman_tespiti';

UPDATE services SET
  is_active = false, visibility = 'passive',
  passive_reason = 'CISO Asistan Paketi içine dahil edildi. Ayrı satış kaldırıldı.',
  passive_since = now(), roadmap_quarter = NULL
WHERE service_key = 'ai_politika_otoguncelleme';

UPDATE services SET
  is_active = false, visibility = 'passive',
  passive_reason = 'SIEM düzeyinde log yönetimi altyapısı gerekiyor.',
  passive_since = now(), roadmap_quarter = 'Q4 2026'
WHERE service_key = 'gozlemlenebilirlik_izleme';
```

### 1.2 Pricing Sayfası Filtresi

```typescript
// Fiyatlandırma verisini dönen route'a ekle:

// ESKİ:
const services = await db.select().from(servicesTable);

// YENİ — sadece aktif ve public:
const services = await db.select()
  .from(servicesTable)
  .where(
    and(
      eq(servicesTable.isActive, true),
      eq(servicesTable.visibility, "public")
    )
  )
  .orderBy(asc(servicesTable.sortOrder));
```

### 1.3 Admin Panel Rotalar

```typescript
// GET /api/admin/services/passive
router.get("/services/passive", requireAdmin,
  async (req, res) => {
  const list = await db.select()
    .from(servicesTable)
    .where(eq(servicesTable.visibility, "passive"))
    .orderBy(asc(servicesTable.roadmapQuarter));
  res.json({ services: list });
});

// POST /api/admin/services/:key/activate
router.post("/services/:key/activate",
  requireAdmin, async (req, res) => {
  await db.update(servicesTable).set({
    isActive:      true,
    visibility:    "public",
    passiveReason: null,
  }).where(eq(servicesTable.serviceKey, req.params.key));
  res.json({ success: true });
});

// POST /api/admin/services/:key/deactivate
router.post("/services/:key/deactivate",
  requireAdmin, async (req, res) => {
  const { reason, roadmapQuarter } = req.body;
  await db.update(servicesTable).set({
    isActive:        false,
    visibility:      "passive",
    passiveReason:   reason,
    passiveSince:    new Date(),
    roadmapQuarter,
  }).where(eq(servicesTable.serviceKey, req.params.key));
  res.json({ success: true });
});
```

```
Admin Panel — /admin-panel/services

─── AKTİF SERVİSLER (38) ───────────────────────────────
Normal liste

─── PASİF SERVİSLER (8) ─────────────────────────────────
SOC Operasyon Merkezi   Q2 2027  [Aktif Et] [Düzenle]
  Not: Gerçek SOC analist ekibi gerektirir.

AI NOC Pro              Q1 2027  [Aktif Et] [Düzenle]
  Not: Kriz yönetimi yeniden tanımlanacak.

Fortinet Security Fabric Q4 2026 [Aktif Et] [Düzenle]
  Not: FortiSIEM entegrasyonu henüz yok.

Tam Güvenlik Değerlend. Q3 2026  [Aktif Et] [Düzenle]
  Not: Uzman doğrulaması MSSP gerektirir.

Deepfake Ses Analizi    Q4 2026  [Aktif Et] [Düzenle]
  Not: Metodoloji netleştirilecek.

Sahte Doküman Tespiti   Q3 2026  [Aktif Et] [Düzenle]
  Not: Kredi sistemi kurulunca aktif.

AI Politika Otogüncell. -        [Aktif Et] [Düzenle]
  Not: CISO Asistan'a dahil edildi.

Gözlemlenebilirlik      Q4 2026  [Aktif Et] [Düzenle]
  Not: SIEM altyapısı gerekiyor.
```

---

## BÖLÜM 2: DEMO RAPOR SİSTEMİ

### 2.1 Veritabanı

```sql
CREATE TABLE IF NOT EXISTS demo_reports (
  id serial PRIMARY KEY,
  report_type varchar(50) UNIQUE NOT NULL,
  -- 'easm' | 'email_security' | 'cve_alert'
  -- 'board_report' | 'tprm' | 'threat_intel'

  -- Kaynak (gizli)
  source_domain varchar(255),
  source_scan_id integer,

  -- Demo veriler
  demo_domain varchar(50) DEFAULT 'abc.com.tr',
  demo_company varchar(100) DEFAULT 'Örnek A.Ş.',
  demo_sector varchar(100) DEFAULT 'Teknoloji',

  -- PDF
  pdf_path varchar(500),
  pdf_url varchar(500),

  -- Metrik
  original_score integer,
  display_score integer,
  is_active boolean DEFAULT true,
  download_count integer DEFAULT 0,
  lead_captures integer DEFAULT 0,

  generated_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo_leads (
  id serial PRIMARY KEY,
  report_type varchar(50),
  report_id integer REFERENCES demo_reports(id),
  email varchar(255) NOT NULL,
  name varchar(255),
  company varchar(255),
  phone varchar(50),
  source varchar(100) DEFAULT 'demo_page',
  welcomed_email_sent boolean DEFAULT false,
  added_to_isr boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);
```

### 2.2 Anonymizer Fonksiyonu

```typescript
// src/services/demoReportGenerator.ts
// YENİ DOSYA

function anonymizeScanData(scan: any): any {
  return {
    ...scan,
    domain:    "abc.com.tr",
    company:   "Örnek A.Ş.",

    // IP kısmen gizle: 185.23.45.67 → 185.x.x.x
    ipAddress: scan.ipAddress
      ? scan.ipAddress.replace(
          /(\d+\.\d+)\.\d+\.\d+/, "$1.x.x"
        )
      : null,

    // Subdomainler
    subdomains: (scan.subdomains || []).map(
      (_: string, i: number) =>
        `sub${i + 1}.abc.com.tr`
    ),

    // HIBP emaillerini gizle
    hibpBreaches: (scan.hibpBreaches || []).map(
      (b: any) => ({
        ...b,
        emails: (b.emails || []).map(
          () => "****@abc.com.tr"
        ),
      })
    ),
  };
}

// Pipeline'dan demo için uygun domain seç
export async function selectDomainForDemo(): Promise<any> {
  const candidates = await db.select()
    .from(domainScansTable)
    .where(
      and(
        // Skor 30-55: hem sorunlu hem ilginç
        between(domainScansTable.overallScore, 30, 55),
        // TR domain
        or(
          like(domainScansTable.domain, "%.com.tr"),
          like(domainScansTable.domain, "%.net.tr"),
          like(domainScansTable.domain, "%.org.tr")
        ),
        // Son 30 gün
        gte(domainScansTable.createdAt,
          subDays(new Date(), 30)),
        // En az 3 farklı bulgu
        gte(domainScansTable.findingsCount, 3)
      )
    )
    .orderBy(desc(domainScansTable.findingsCount))
    .limit(5);

  return candidates[0] || null;
}

// Tüm demo raporları üret
export async function generateAllDemoReports(): Promise<void> {

  const sourceScan = await selectDomainForDemo();
  if (!sourceScan) {
    logger.warn("Demo için uygun domain bulunamadı");
    return;
  }

  const anonScan = anonymizeScanData(sourceScan);
  logger.info(
    { source: sourceScan.domain, score: sourceScan.overallScore },
    "Demo rapor üretimi başlıyor"
  );

  // Her rapor tipini sırayla üret
  // (paralel değil — PDF üretimi memory yoğun)
  const generators = [
    generateEASMDemo,
    generateEmailSecurityDemo,
    generateBoardReportDemo,
    generateCVEAlertDemo,
    generateTPRMDemo,
    generateThreatIntelDemo,
  ];

  for (const gen of generators) {
    try {
      await gen(anonScan, sourceScan);
      await sleep(2000);
    } catch (err) {
      logger.error({ err, gen: gen.name },
        "Demo rapor üretim hatası");
    }
  }

  logger.info("Tüm demo raporlar güncellendi");
}

// ─── EASM Demo ────────────────────────────────────────
async function generateEASMDemo(
  scan: any, original: any
): Promise<void> {

  const execSummary = await callClaude(`
EASM değerlendirme raporu için yönetici özeti yaz.
Domain: abc.com.tr | Şirket: Örnek A.Ş.
Risk Skoru: ${scan.overallScore}/100
Bulgular:
  SSL: ${scan.sslDaysLeft} gün kaldı
  DMARC: ${scan.dmarcPolicy || "Yok"}
  Açık port: ${scan.openPortsCount || 0}
  CVE: ${scan.cveCount || 0}
  Kara liste: ${scan.blacklistCount || 0}
2-3 paragraf, CEO dili, Türkçe.
  `, { model: "claude-haiku-4-5", maxTokens: 300 });

  // Mevcut PDF üretim sistemiyle oluştur
  // buildEASMReportHTML() fonksiyonu mevcut mu kontrol et
  // Yoksa board raporu HTML şablonuna benzer şekilde yaz
  const html = await buildDemoReportHTML({
    type: "EASM Değerlendirme Raporu",
    scan, execSummary,
    sections: [
      { title: "Yönetici Özeti", content: execSummary },
      { title: "Genel Risk Skoru",
        content: `${scan.overallScore}/100` },
      { title: "SSL Sertifika Durumu",
        content: `${scan.sslDaysLeft} gün geçerli` },
      { title: "E-posta Güvenliği",
        content: `DMARC: ${scan.dmarcPolicy || "Yok"} | SPF: ${scan.spfPass ? "Aktif" : "Eksik"}` },
      { title: "CVE Güvenlik Açıkları",
        content: `${scan.cveCount || 0} açık tespit edildi` },
      { title: "Kara Liste Durumu",
        content: `${scan.blacklistCount || 0} listede` },
    ],
    isDemo: true,
  });

  const pdfPath = await generatePDFFromHTML(
    html, `demo-easm-${Date.now()}.pdf`
  );

  await saveDemoReport({
    reportType: "easm",
    sourceDomain: original.domain,
    sourceScanId: original.id,
    pdfPath,
    originalScore: original.overallScore,
    displayScore: scan.overallScore,
  });
}

// ─── Board Report Demo ─────────────────────────────────
async function generateBoardReportDemo(
  scan: any, original: any
): Promise<void> {

  const baseRisk = 8_500_000;
  const multiplier = (100 - scan.overallScore) / 100;
  const riskLow = Math.round(baseRisk * multiplier * 0.15);
  const riskHigh = Math.round(baseRisk * multiplier * 0.50);

  const summary = await callClaude(`
Yönetim kurulu güvenlik raporu özeti.
Şirket: Örnek A.Ş. | Risk: ${scan.overallScore}/100
7545 Uyum: %${Math.round(scan.overallScore * 0.8)}
KVKK: %${Math.round(scan.overallScore * 0.75)}
Finansal risk: ${riskLow.toLocaleString("tr-TR")} — ${riskHigh.toLocaleString("tr-TR")} TL
3 paragraf, CEO dili, Türkçe.
  `, { model: "claude-sonnet-4-6", maxTokens: 350 });

  const html = await buildDemoReportHTML({
    type: "Yönetim Kurulu Güvenlik Raporu",
    scan,
    execSummary: summary,
    sections: [
      { title: "Yönetici Özeti", content: summary },
      { title: "Risk Skoru",
        content: `${scan.overallScore}/100` },
      { title: "7545 Kanunu Uyumu",
        content: `%${Math.round(scan.overallScore * 0.8)}` },
      { title: "KVKK Uyumu",
        content: `%${Math.round(scan.overallScore * 0.75)}` },
      { title: "Tahmini Finansal Risk",
        content: `${riskLow.toLocaleString("tr-TR")} — ${riskHigh.toLocaleString("tr-TR")} TL` },
    ],
    isDemo: true,
  });

  const pdfPath = await generatePDFFromHTML(
    html, `demo-board-${Date.now()}.pdf`
  );

  await saveDemoReport({
    reportType:    "board_report",
    sourceDomain:  original.domain,
    sourceScanId:  original.id,
    pdfPath,
    originalScore: original.overallScore,
    displayScore:  scan.overallScore,
  });
}

// Diğer 4 rapor tipi için benzer pattern uygula:
// generateEmailSecurityDemo → E-posta güvenlik bölümleri
// generateCVEAlertDemo → CVE listesi + EPSS skorları
// generateTPRMDemo → 3 örnek tedarikçi risk özeti
// generateThreatIntelDemo → Haftalık IOC listesi özeti

// ─── Demo HTML Şablonu ────────────────────────────────
async function buildDemoReportHTML(params: {
  type: string;
  scan: any;
  execSummary: string;
  sections: { title: string; content: string }[];
  isDemo: boolean;
}): Promise<string> {

  const today = new Date().toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric"
  });

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  * { font-family: Arial, sans-serif; box-sizing: border-box; }
  body { margin: 0; padding: 40px; color: #0A0E17; }

  /* DEMO watermark */
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%,-50%) rotate(-35deg);
    font-size: 80px; font-weight: 900;
    color: rgba(255,0,0,0.07);
    white-space: nowrap; z-index: 1000;
    pointer-events: none;
  }

  .header {
    background: #0F3460; color: white;
    padding: 32px; margin-bottom: 24px;
    border-radius: 8px;
  }
  .logo { font-size: 22px; font-weight: 900; }
  .logo span { color: #00D4AA; }
  .report-type {
    font-size: 14px; opacity: 0.7;
    margin-top: 4px; letter-spacing: 1px;
    text-transform: uppercase;
  }
  .demo-badge {
    display: inline-block;
    background: #F5A623; color: #000;
    font-size: 11px; font-weight: 700;
    padding: 3px 10px; border-radius: 4px;
    margin-top: 8px; letter-spacing: 1px;
    text-transform: uppercase;
  }
  .meta {
    margin-top: 16px; font-size: 13px;
    opacity: 0.8; display: flex; gap: 24px;
  }

  .score-box {
    background: ${params.scan.overallScore >= 70 ? '#E8F5E9' :
                  params.scan.overallScore >= 50 ? '#FFF9C4' :
                  '#FFEBEE'};
    border-left: 4px solid ${
                  params.scan.overallScore >= 70 ? '#1B5E20' :
                  params.scan.overallScore >= 50 ? '#F57F17' :
                  '#B71C1C'};
    padding: 20px 24px; margin-bottom: 24px;
    border-radius: 0 8px 8px 0;
  }
  .score-num {
    font-size: 48px; font-weight: 900;
    color: #0F3460; line-height: 1;
  }
  .score-label {
    font-size: 13px; color: #666; margin-top: 4px;
  }

  .section {
    margin-bottom: 20px; padding: 20px 24px;
    border: 1px solid #E0E0E0; border-radius: 8px;
  }
  .section-title {
    font-size: 13px; font-weight: 700;
    color: #0F3460; text-transform: uppercase;
    letter-spacing: 1px; margin-bottom: 8px;
  }
  .section-content {
    font-size: 14px; line-height: 1.6;
    color: #333;
  }

  .footer {
    margin-top: 40px; padding-top: 20px;
    border-top: 1px solid #EEE;
    font-size: 11px; color: #999;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="watermark">DEMO RAPORU</div>

  <div class="header">
    <div class="logo">Cyber<span>Step</span>.io</div>
    <div class="report-type">${params.type}</div>
    <div class="demo-badge">Demo — Örnek Veriler</div>
    <div class="meta">
      <span>📅 ${today}</span>
      <span>🏢 Örnek A.Ş.</span>
      <span>🌐 abc.com.tr</span>
    </div>
  </div>

  <div class="score-box">
    <div class="score-num">${params.scan.overallScore}/100</div>
    <div class="score-label">
      ${params.scan.overallScore >= 70 ? '✅ İyi Seviye' :
        params.scan.overallScore >= 50 ? '⚠️ Orta Risk' :
        '🔴 Yüksek Risk'} — Güvenlik Skoru
    </div>
  </div>

  ${params.sections.map(s => `
  <div class="section">
    <div class="section-title">${s.title}</div>
    <div class="section-content">${s.content}</div>
  </div>`).join('')}

  <div class="footer">
    Bu DEMO rapordur. Gerçek veriler anonimleştirilmiştir.<br>
    cyberstep.io — Kendi domain'iniz için ücretsiz tarama yapın.<br>
    © 2026 CyberStep.io — Kuzey Digital Ventures Ltd. Şti.
  </div>
</body>
</html>`;
}

// PDF üretim yardımcısı
async function generatePDFFromHTML(
  html: string,
  filename: string
): Promise<string> {

  // Mevcut PDF üretim fonksiyonunu kullan
  // Yoksa puppeteer ile:
  const puppeteer = await import("puppeteer-core");
  const chromium = await import("@sparticuz/chromium");

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const outputDir = path.join(process.cwd(), "public", "demo");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, filename);
  await page.pdf({
    path: filePath,
    format: "A4",
    margin: { top: "20mm", bottom: "20mm",
               left: "15mm", right: "15mm" },
    printBackground: true,
  });

  await browser.close();
  return filePath;
}

// DB kayıt yardımcısı
async function saveDemoReport(params: {
  reportType: string;
  sourceDomain: string;
  sourceScanId: number;
  pdfPath: string;
  originalScore: number;
  displayScore: number;
}): Promise<void> {

  const pdfUrl = `${process.env["BASE_URL"]}/demo/reports/${
    path.basename(params.pdfPath)
  }`;

  await db.insert(demoReportsTable).values({
    reportType:    params.reportType,
    sourceDomain:  params.sourceDomain,
    sourceScanId:  params.sourceScanId,
    pdfPath:       params.pdfPath,
    pdfUrl,
    originalScore: params.originalScore,
    displayScore:  params.displayScore,
    isActive:      true,
  }).onConflictDoUpdate({
    target: demoReportsTable.reportType,
    set: {
      pdfPath:  params.pdfPath,
      pdfUrl,
      displayScore: params.displayScore,
      generatedAt:  new Date(),
      updatedAt:    new Date(),
    },
  });
}
```

### 2.3 Public API Rotalar

```typescript
// src/routes/public/demo.ts

// GET /api/public/demo/reports — Liste (PDF URL yok)
router.get("/reports", async (req, res) => {
  const reports = await db.select({
    reportType:    demoReportsTable.reportType,
    demoSector:    demoReportsTable.demoSector,
    displayScore:  demoReportsTable.displayScore,
    downloadCount: demoReportsTable.downloadCount,
  })
  .from(demoReportsTable)
  .where(eq(demoReportsTable.isActive, true));
  res.json({ reports });
});

// POST /api/public/demo/download — Lead + PDF URL
router.post("/download",
  rateLimit({ windowMs: 3600000, limit: 10 }),
  async (req, res) => {

  const { reportType, email, name, company } = req.body;

  if (!email || !reportType) {
    res.status(400).json({ error: "Email zorunlu" });
    return;
  }

  const [report] = await db.select()
    .from(demoReportsTable)
    .where(
      and(
        eq(demoReportsTable.reportType, reportType),
        eq(demoReportsTable.isActive, true)
      )
    ).limit(1);

  if (!report) {
    res.status(404).json({ error: "Rapor bulunamadı" });
    return;
  }

  // Lead kaydet
  await db.insert(demoLeadsTable).values({
    reportType, reportId: report.id,
    email, name, company,
  }).onConflictDoNothing();

  // Sayaç artır
  await db.update(demoReportsTable).set({
    downloadCount: sql`download_count + 1`,
  }).where(eq(demoReportsTable.reportType, reportType));

  // Email + ISR (arka planda)
  setImmediate(() => {
    void sendEmail({
      to: email,
      subject: "Demo raporunuz hazır — CyberStep.io",
      html: `
        <p>Merhaba${name ? ` ${name.split(" ")[0]}` : ""},</p>
        <p>Demo raporunuzu indirmek için
        <a href="${report.pdfUrl}">tıklayın</a>.</p>
        <p>Kendi domain'inizi ücretsiz taramak için:
        <a href="${process.env["BASE_URL"]}/araclar/domain-guvenlik-taramasi">
        Ücretsiz Tarama →</a></p>
        <p>CyberStep.io</p>
      `,
      from: "demo@cyberstep.io",
    });

    if (company) {
      void addToISRQueue({
        email, name, company,
        source: `demo_download_${reportType}`,
        score: 72,
      });
    }
  });

  res.json({ success: true, pdfUrl: report.pdfUrl });
});

// GET /demo/reports/:filename — PDF dosya servis
router.get("/reports/:filename", async (req, res) => {
  const { filename } = req.params;

  // Güvenlik: sadece demo- ile başlayanlar
  if (!filename.startsWith("demo-") ||
      !filename.endsWith(".pdf")) {
    res.status(404).end();
    return;
  }

  const filePath = path.join(
    process.cwd(), "public", "demo", filename
  );
  if (!fs.existsSync(filePath)) {
    res.status(404).end();
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(filePath).pipe(res);
});
```

### 2.4 Demo Sayfası Görünümü (/demo)

```
cyberstep.io/demo

─── ÖRNEK RAPORLAR ─────────────────────────────────────
Gerçek bir taramadan hazırlanmış örnek raporlar.
Alan adı anonimleştirilmiştir.

┌────────────────────────────────────────────────────┐
│ 📊 EASM Değerlendirme Raporu                       │
│ abc.com.tr · 43/100 🔴 Yüksek Risk                │
│ 8 sayfa · Türkçe PDF                               │
│ 1.247 kez indirildi                                │
│ [📥 Demo'yu İndir]                                 │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 📋 Yönetim Kurulu Güvenlik Raporu                  │
│ abc.com.tr · CEO/CFO için hazır format             │
│ [📥 Demo'yu İndir]                                 │
└────────────────────────────────────────────────────┘

[+ 4 rapor daha]

─── İndirme Formu (Modal) ──────────────────────────────
Ad Soyad:  [                    ]
E-posta:   [                    ] *
Şirket:    [                    ]

[İndir ve Email'e Gönder →]

Spam göndermeyiz. KVKK kapsamında.
```

---

## BÖLÜM 3: CRON + ADMIN

```typescript
// Ayda 1 kez yenile
cron.schedule("0 10 1 * *",
  wrapCron("demo_refresh", "0 10 1 * *", async () => {
    const { generateAllDemoReports } = await import(
      "./services/demoReportGenerator"
    );
    await generateAllDemoReports();
  }),
  { timezone: "Europe/Istanbul" }
);
```

```
Admin Panel — /admin-panel/demo-reports

─── DEMO RAPORLAR ───────────────────────────────────────
Son güncelleme: 1 Haziran 2026

Rapor              Skor  İndirme  Lead  Aksiyon
EASM               43    1.247    89    [Yenile] [Kapat]
Board Raporu       43      612    44    [Yenile] [Kapat]
E-posta Güvenlik   38      834    61    [Yenile] [Kapat]
CVE Alarmı         43      445    31    [Yenile] [Kapat]
TPRM               43      289    19    [Yenile] [Kapat]
Tehdit İstihbarat  43      178    12    [Yenile] [Kapat]

[Tümünü Yenile]

─── DEMO LEAD'LERİ ──────────────────────────────────────
Son 30 gün: 256 lead | Şirketi olan: 189
[CSV İndir]
```

---

## TEST SENARYOLARI

```
1. Pasif servis testi:
   GET /api/portal/pricing
   → SOC Operasyon Merkezi görünmüyor ✓
   GET /api/admin/services/passive
   → 8 servis listede ✓
   POST /api/admin/services/soc_operasyon_merkezi/activate
   → Pricing'de göründü ✓

2. Demo üretim testi:
   generateAllDemoReports() çalıştır
   → 6 PDF oluştu ✓
   → Dosyalar public/demo/'da ✓
   → Domain "abc.com.tr" ✓
   → IP'ler "185.x.x.x" ✓
   → Watermark görünüyor ✓

3. Download lead capture:
   POST /api/public/demo/download
   { reportType: "easm", email: "test@t.com",
     company: "Test Ltd." }
   → demo_leads tablosunda kayıt ✓
   → download_count arttı ✓
   → pdfUrl döndü ✓
   → Email gönderildi ✓
   → ISR kuyruğuna eklendi ✓

4. Rate limit testi:
   Aynı IP'den 11 kez istek at
   → 11. istekte 429 hatası ✓
```

---

*CyberStep.io — Pasif Servisler + Demo Rapor Sistemi — Haziran 2026*
*"Görmeden almaz, gördükten sonra almadan edemez."*
