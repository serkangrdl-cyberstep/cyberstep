import PDFDocument from "pdfkit";
import path from "path";

const FONT_DIR = "/usr/share/fonts/truetype/dejavu";
const FONT_REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
const FONT_BOLD    = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

interface ReportData {
  assessmentId: number;
  companyName: string;
  contactName: string;
  sector: string;
  employeeCount: string;
  riskLevel: string;
  scorePercent: number;
  totalScore: number;
  maxScore: number;
  redAlarmCount: number;
  aiAnalysis: string;
  recommendations: string[];
  domainScores: Array<{ domain: string; score: number; maxScore: number; percent: number }>;
  adminNotes: string | null;
  createdAt?: string;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}(.*?)`{1,3}/gs, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const RISK_COLORS: Record<string, [number, number, number]> = {
  "Kritik": [220, 38, 38],
  "Yüksek": [234, 88, 12],
  "Orta":   [217, 119, 6],
  "Düşük":  [22, 163, 74],
};

const PRIMARY: [number, number, number] = [16, 185, 129];
const DARK:    [number, number, number] = [15, 23, 42];
const GRAY:    [number, number, number] = [100, 116, 139];
const LIGHT:   [number, number, number] = [241, 245, 249];
const WHITE:   [number, number, number] = [255, 255, 255];

export function generateReportPDF(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 0, bottom: 40, left: 0, right: 0 },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const MARGIN = 48;
    const CONTENT_W = W - MARGIN * 2;

    // ─── HEADER ──────────────────────────────────────────
    doc.rect(0, 0, W, 90).fill(DARK);
    doc.fillColor(WHITE).fontSize(20).font(FONT_BOLD)
      .text("CyberStep.io", MARGIN, 28, { lineBreak: false });
    doc.fillColor([148, 163, 184]).fontSize(10).font(FONT_REGULAR)
      .text("Siber Güvenlik Risk Değerlendirme Raporu", MARGIN, 56);

    const dateStr = data.createdAt
      ? new Date(data.createdAt).toLocaleDateString("tr-TR")
      : new Date().toLocaleDateString("tr-TR");
    doc.fillColor([148, 163, 184]).fontSize(9)
      .text(`#${data.assessmentId}  ·  ${dateStr}`, MARGIN, 56, { align: "right", width: CONTENT_W });

    doc.y = 110;

    // ─── COMPANY INFO BOX ────────────────────────────────
    const infoBoxTop = doc.y;
    doc.rect(MARGIN, infoBoxTop, CONTENT_W, 64).fillAndStroke(LIGHT, [226, 232, 240]);
    doc.fillColor(DARK).fontSize(13).font(FONT_BOLD)
      .text(data.companyName, MARGIN + 16, infoBoxTop + 12, { width: CONTENT_W - 32 });
    doc.fillColor(GRAY).fontSize(9).font(FONT_REGULAR)
      .text(`${data.contactName}   ·   ${data.sector}   ·   ${data.employeeCount} çalışan`, MARGIN + 16, infoBoxTop + 32, { width: CONTENT_W - 32 });
    doc.y = infoBoxTop + 80;

    // ─── SCORE + RISK ROW ────────────────────────────────
    const riskColor = RISK_COLORS[data.riskLevel] ?? PRIMARY;
    const scoreBoxW = (CONTENT_W - 12) / 2;

    // Score box
    doc.rect(MARGIN, doc.y, scoreBoxW, 72).fillAndStroke(LIGHT, [226, 232, 240]);
    doc.fillColor(PRIMARY).fontSize(32).font(FONT_BOLD)
      .text(`%${data.scorePercent}`, MARGIN, doc.y + 10, { width: scoreBoxW, align: "center" });
    doc.fillColor(GRAY).fontSize(9).font(FONT_REGULAR)
      .text(`${data.totalScore} / ${data.maxScore} puan`, MARGIN, doc.y + 52, { width: scoreBoxW, align: "center" });

    const riskBoxX = MARGIN + scoreBoxW + 12;
    const riskBoxY = doc.y - 62;
    doc.rect(riskBoxX, riskBoxY, scoreBoxW, 72).fillAndStroke(LIGHT, [226, 232, 240]);
    doc.fillColor(riskColor).fontSize(20).font(FONT_BOLD)
      .text(data.riskLevel, riskBoxX, riskBoxY + 16, { width: scoreBoxW, align: "center" });
    doc.fillColor(GRAY).fontSize(9).font(FONT_REGULAR)
      .text(`${data.redAlarmCount} kırmızı alarm`, riskBoxX, riskBoxY + 44, { width: scoreBoxW, align: "center" });

    doc.y = riskBoxY + 88;

    // ─── DOMAIN SCORES ────────────────────────────────────
    sectionTitle(doc, "Alan Bazlı Puan Dağılımı", MARGIN, CONTENT_W);
    const colW = (CONTENT_W - 8 * 4) / 5;
    const domTop = doc.y;
    data.domainScores.forEach((d, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = MARGIN + col * (colW + 8);
      const y = domTop + row * 56;
      const domColor: [number, number, number] = d.percent >= 70 ? [22, 163, 74] : d.percent >= 40 ? [217, 119, 6] : [220, 38, 38];
      doc.rect(x, y, colW, 48).fillAndStroke(LIGHT, [226, 232, 240]);
      doc.fillColor(domColor).fontSize(14).font(FONT_BOLD)
        .text(`%${d.percent}`, x, y + 6, { width: colW, align: "center" });
      doc.fillColor(GRAY).fontSize(6.5).font(FONT_REGULAR)
        .text(d.domain, x + 2, y + 30, { width: colW - 4, align: "center" });
    });
    const domRows = Math.ceil(data.domainScores.length / 5);
    doc.y = domTop + domRows * 56 + 16;

    // ─── AI ANALİZ ────────────────────────────────────────
    sectionTitle(doc, "Uzman Analizi", MARGIN, CONTENT_W);
    const cleanAnalysis = stripMarkdown(data.aiAnalysis);
    doc.fillColor(DARK).fontSize(10).font(FONT_REGULAR)
      .text(cleanAnalysis, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3, paragraphGap: 6 });
    doc.y += 16;

    // ─── AKSİYON ÖNERİLERİ ───────────────────────────────
    if (data.recommendations.length > 0) {
      sectionTitle(doc, "Öncelikli Aksiyon Planı", MARGIN, CONTENT_W);
      data.recommendations.forEach((rec, i) => {
        const recY = doc.y;
        // Number badge
        doc.circle(MARGIN + 8, recY + 8, 8).fill(PRIMARY);
        doc.fillColor(WHITE).fontSize(8).font(FONT_BOLD)
          .text(`${i + 1}`, MARGIN + 4, recY + 4, { width: 10, align: "center" });
        doc.fillColor(DARK).fontSize(10).font(FONT_REGULAR)
          .text(stripMarkdown(rec), MARGIN + 22, recY + 1, { width: CONTENT_W - 22, lineGap: 2 });
        doc.y += 6;
      });
      doc.y += 8;
    }

    // ─── UZMAN NOTU ───────────────────────────────────────
    if (data.adminNotes && data.adminNotes.trim()) {
      checkPageBreak(doc, 80);
      sectionTitle(doc, "Uzman Notu", MARGIN, CONTENT_W);
      const noteY = doc.y;
      doc.rect(MARGIN, noteY, 4, 999).fill([59, 130, 246]);
      doc.rect(MARGIN + 4, noteY, CONTENT_W - 4, 999).fill([239, 246, 255]);
      const noteText = stripMarkdown(data.adminNotes);
      doc.fillColor([30, 64, 175]).fontSize(10).font(FONT_REGULAR)
        .text(noteText, MARGIN + 16, noteY + 10, { width: CONTENT_W - 28, lineGap: 3 });
      const noteH = doc.y - noteY + 16;
      // Redraw note bg with correct height
      doc.rect(MARGIN, noteY, 4, noteH).fill([59, 130, 246]);
      doc.rect(MARGIN + 4, noteY, CONTENT_W - 4, noteH).fill([239, 246, 255]);
      doc.fillColor([30, 64, 175]).fontSize(10).font(FONT_REGULAR)
        .text(noteText, MARGIN + 16, noteY + 10, { width: CONTENT_W - 28, lineGap: 3 });
      doc.y = noteY + noteH + 16;
    }

    // ─── FOOTER ──────────────────────────────────────────
    checkPageBreak(doc, 60);
    const footerY = doc.page.height - 50;
    doc.rect(0, footerY, W, 50).fill(DARK);
    doc.fillColor([148, 163, 184]).fontSize(8).font(FONT_REGULAR)
      .text(
        `CyberStep.io  ·  Bu rapor uzman incelemesinden geçmiştir  ·  Değerlendirme #${data.assessmentId}`,
        MARGIN, footerY + 18, { width: CONTENT_W, align: "center" }
      );

    doc.end();
  });
}

// ─── Domain Scan PDF ─────────────────────────────────────────────────────────

interface DomainScanData {
  id: number;
  domain: string;
  overallScore: number;
  spfPass: boolean; spfRecord: string | null;
  dmarcPass: boolean; dmarcRecord: string | null;
  dkimPass: boolean; dkimSelectors: string[];
  mxPass: boolean; mxRecords: Array<{ exchange: string; priority: number }>;
  sslPass: boolean; sslExpiry: string | null; sslIssuer: string | null; sslDaysUntilExpiry: number | null;
  hibpBreachCount: number;
  blacklisted: boolean; blacklistCount: number;
  shadowItServices: Array<{ name: string; category: string; risk: string }>;
  httpHeadersScore: number;
  httpHeadersDetails: { hsts: boolean; xFrameOptions: boolean; xContentTypeOptions: boolean; csp: boolean; referrerPolicy: boolean } | null;
  urlhausListed: boolean; urlhausThreat: string | null;
  usomListed: boolean;
  ctSubdomainCount: number;
  cveSummary: Array<{ service: string; cveId: string; description: string; cvssScore: number }>;
  shodanOpenPorts: Array<{ port: number; protocol: string; service: string; product: string; version: string }> | null;
  shodanVulnCount: number;
  shodanCountry: string | null;
  shodanIsp: string | null;
  virusTotalReputation: number | null;
  virusTotalMalicious: number;
  virusTotalSuspicious: number;
  abuseIpdbScore: number | null;
  abuseIpdbTotalReports: number;
  abuseIpdbCountry: string | null;
  abuseIpdbIsp: string | null;
  createdAt: string;
  attackScenarios?: {
    genel_tehdit_seviyesi: string;
    senaryolar: Array<{
      baslik: string;
      olasilik: string;
      etki: string;
      teknikler?: Array<{ adi: string; tactic: string }>;
    }>;
  } | null;
}

export function generateDomainScanPDF(data: DomainScanData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margins: { top: 0, bottom: 40, left: 0, right: 0 } });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const MARGIN = 48;
    const CONTENT_W = W - MARGIN * 2;

    const intelRow = (label: string, value: string, ok: boolean) => {
      checkPageBreak(doc, 28);
      const iy = doc.y;
      const ic: [number, number, number] = ok ? [22, 163, 74] : [220, 38, 38];
      doc.circle(MARGIN + 7, iy + 8, 7).fill(ic);
      doc.fillColor(WHITE).fontSize(8).font(FONT_BOLD).text(ok ? "+" : "!", MARGIN + 4, iy + 5, { width: 7, align: "center" });
      doc.fillColor(DARK).fontSize(10).font(FONT_BOLD).text(label, MARGIN + 20, iy + 2, { lineBreak: false, width: 200 });
      doc.fillColor(GRAY).fontSize(8).font(FONT_REGULAR).text(value, MARGIN + 20, iy + 16, { width: CONTENT_W - 20 });
      doc.y = iy + 32;
    };

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, W, 90).fill(DARK);
    doc.fillColor(WHITE).fontSize(20).font(FONT_BOLD).text("CyberStep.io", MARGIN, 28, { lineBreak: false });
    doc.fillColor([148, 163, 184]).fontSize(10).font(FONT_REGULAR).text("Alan Adi Guvenlik Tarama Raporu", MARGIN, 56);
    doc.fillColor([148, 163, 184]).fontSize(9).text(
      `#${data.id}  |  ${new Date(data.createdAt).toLocaleDateString("tr-TR")}`,
      MARGIN, 56, { align: "right", width: CONTENT_W }
    );
    doc.y = 110;

    // ── Domain + Score ────────────────────────────────────────────────────────
    const scoreColor: [number, number, number] = data.overallScore >= 80 ? [22, 163, 74] : data.overallScore >= 60 ? [217, 119, 6] : data.overallScore >= 40 ? [234, 88, 12] : [220, 38, 38];
    const scoreLabel = data.overallScore >= 80 ? "Iyi" : data.overallScore >= 60 ? "Orta" : data.overallScore >= 40 ? "Zayif" : "Kritik";
    const boxTop = doc.y;
    doc.rect(MARGIN, boxTop, CONTENT_W, 64).fillAndStroke(LIGHT, [226, 232, 240]);
    doc.fillColor(DARK).fontSize(15).font(FONT_BOLD).text(data.domain, MARGIN + 16, boxTop + 10, { width: CONTENT_W - 120 });
    doc.fillColor(scoreColor).fontSize(28).font(FONT_BOLD).text(`${data.overallScore}`, W - MARGIN - 80, boxTop + 6, { width: 60, align: "right" });
    doc.fillColor(GRAY).fontSize(9).font(FONT_REGULAR).text("/ 100 puan", W - MARGIN - 80, boxTop + 38, { width: 60, align: "right" });
    doc.fillColor(scoreColor).fontSize(10).font(FONT_BOLD).text(scoreLabel, MARGIN + 16, boxTop + 36, { width: 80 });
    doc.y = boxTop + 80;

    // ── E-posta ve SSL Kontrolleri ─────────────────────────────────────────────
    sectionTitle(doc, "E-posta ve SSL Guvenlik Kontrolleri", MARGIN, CONTENT_W);
    const checks = [
      { label: "SPF Kaydi", pass: data.spfPass, detail: data.spfRecord, weight: "20 puan" },
      { label: "DMARC Politikasi", pass: data.dmarcPass, detail: data.dmarcRecord, weight: "25 puan" },
      { label: "DKIM Imzasi", pass: data.dkimPass, detail: data.dkimSelectors.join(", ") || null, weight: "20 puan" },
      { label: "MX Kayitlari", pass: data.mxPass, detail: data.mxRecords[0]?.exchange ?? null, weight: "10 puan" },
      { label: "SSL/TLS Sertifikasi", pass: data.sslPass, detail: data.sslDaysUntilExpiry !== null ? `${data.sslIssuer ?? ""} - ${data.sslDaysUntilExpiry} gun gecerli` : null, weight: "25 puan" },
    ];
    for (const chk of checks) {
      checkPageBreak(doc, 34);
      const cy = doc.y;
      const passColor: [number, number, number] = chk.pass ? [22, 163, 74] : [220, 38, 38];
      doc.circle(MARGIN + 7, cy + 9, 7).fill(passColor);
      doc.fillColor(WHITE).fontSize(8).font(FONT_BOLD).text(chk.pass ? "+" : "!", MARGIN + 4, cy + 6, { width: 7, align: "center" });
      doc.fillColor(DARK).fontSize(10).font(FONT_BOLD).text(chk.label, MARGIN + 20, cy + 3, { width: 200, lineBreak: false });
      doc.fillColor(GRAY).fontSize(8).font(FONT_REGULAR).text(chk.weight, MARGIN + 20, cy + 3, { width: CONTENT_W - 20, align: "right" });
      if (chk.detail) {
        doc.fillColor(GRAY).fontSize(8).font(FONT_REGULAR).text(chk.detail.substring(0, 90), MARGIN + 20, cy + 17, { width: CONTENT_W - 20 });
        doc.y = cy + 32;
      } else {
        doc.y = cy + 22;
      }
    }
    doc.y += 8;

    // ── Web Guvenlik Basliklari ────────────────────────────────────────────────
    sectionTitle(doc, "Web Sunucu Guvenlik Basliklari", MARGIN, CONTENT_W);
    checkPageBreak(doc, 12);
    const scoreC: [number, number, number] = data.httpHeadersScore >= 4 ? [22, 163, 74] : data.httpHeadersScore >= 2 ? [217, 119, 6] : [220, 38, 38];
    doc.fillColor(scoreC).fontSize(9).font(FONT_BOLD).text(`Toplam skor: ${data.httpHeadersScore}/5 baslik`, MARGIN, doc.y);
    doc.y += 10;
    const hd = data.httpHeadersDetails;
    const headerItems = [
      { label: "HSTS (Strict-Transport-Security)", ok: hd?.hsts ?? false },
      { label: "X-Frame-Options (clickjacking korumasi)", ok: hd?.xFrameOptions ?? false },
      { label: "X-Content-Type-Options", ok: hd?.xContentTypeOptions ?? false },
      { label: "Content-Security-Policy (CSP)", ok: hd?.csp ?? false },
      { label: "Referrer-Policy", ok: hd?.referrerPolicy ?? false },
    ];
    for (const hi of headerItems) {
      checkPageBreak(doc, 16);
      const hiy = doc.y;
      const hic: [number, number, number] = hi.ok ? [22, 163, 74] : [220, 38, 38];
      doc.fillColor(hic).fontSize(8).font(FONT_BOLD).text(hi.ok ? "+" : "-", MARGIN + 4, hiy, { lineBreak: false, width: 10 });
      doc.fillColor(DARK).fontSize(8).font(FONT_REGULAR).text(hi.label, MARGIN + 16, hiy, { width: CONTENT_W - 16 });
      doc.y = hiy + 13;
    }
    doc.y += 10;

    // ── Risk Istihbarati ──────────────────────────────────────────────────────
    sectionTitle(doc, "Risk Istihbarati", MARGIN, CONTENT_W);
    intelRow(
      "Veri Sizintisi (HIBP)",
      data.hibpBreachCount === 0 ? "Temiz — sizinti kaydi yok" : `${data.hibpBreachCount} sizinti kaydi bulundu`,
      data.hibpBreachCount === 0
    );
    intelRow(
      "Kara Liste (DNSBL)",
      data.blacklisted ? `${data.blacklistCount} spam listesinde kayitli` : "Temiz — hicbir kara listede yok",
      !data.blacklisted
    );
    intelRow(
      "URLhaus Zararli URL",
      data.urlhausListed ? `Zararli isaretlendi${data.urlhausThreat ? `: ${data.urlhausThreat}` : ""}` : "Temiz — zararli URL listesinde yok",
      !data.urlhausListed
    );
    intelRow(
      "USOM Ulusal Kara Liste",
      data.usomListed ? "USOM zararli domain listesinde kayitli" : "Temiz — USOM listesinde yok",
      !data.usomListed
    );

    // Shadow IT
    const highRisk = data.shadowItServices.filter(s => s.risk === "Yuksek");
    intelRow(
      "Golge BT Tespiti (Shadow IT)",
      data.shadowItServices.length === 0
        ? "Ucuncu parti servis tespit edilmedi"
        : `${data.shadowItServices.length} servis — ${highRisk.length} yuksek riskli${data.shadowItServices.length > 0 ? ` (${data.shadowItServices.slice(0, 4).map(s => s.name).join(", ")}${data.shadowItServices.length > 4 ? "..." : ""})` : ""}`,
      highRisk.length === 0
    );

    // Subdomains
    if (data.ctSubdomainCount > 0) {
      intelRow(
        "Sertifika Seffafligi (crt.sh)",
        `${data.ctSubdomainCount} alt alan adi SSL sertifika gecmisinde tespit edildi`,
        data.ctSubdomainCount < 5
      );
    }
    doc.y += 4;

    // ── CVE Guvenlik Aciklari ──────────────────────────────────────────────────
    if (data.cveSummary.length > 0) {
      sectionTitle(doc, "Tespit Edilen CVE Guvenlik Aciklari", MARGIN, CONTENT_W);
      for (const cve of data.cveSummary.slice(0, 6)) {
        checkPageBreak(doc, 38);
        const cy = doc.y;
        const cvssColor: [number, number, number] = cve.cvssScore >= 9 ? [220, 38, 38] : cve.cvssScore >= 7 ? [234, 88, 12] : [217, 119, 6];
        doc.rect(MARGIN, cy, CONTENT_W, 30).fillAndStroke([254, 242, 242], [254, 202, 202]);
        doc.fillColor(cvssColor).fontSize(8).font(FONT_BOLD).text(`CVSS ${cve.cvssScore}`, MARGIN + 6, cy + 4, { width: 55, lineBreak: false });
        doc.fillColor(DARK).fontSize(8).font(FONT_BOLD).text(cve.cveId, MARGIN + 64, cy + 4, { lineBreak: false, width: 110 });
        doc.fillColor(GRAY).fontSize(7.5).font(FONT_REGULAR).text(
          `${cve.service}: ${cve.description.substring(0, 110)}`,
          MARGIN + 6, cy + 18, { width: CONTENT_W - 12 }
        );
        doc.y = cy + 38;
      }
      doc.y += 4;
    }

    // ── Katman 1 Tehdit Istihbarati ────────────────────────────────────────────
    const hasK1 = data.virusTotalReputation !== null || data.abuseIpdbScore !== null || data.shodanOpenPorts !== null;
    if (hasK1) {
      sectionTitle(doc, "Katman 1 Tehdit Istihbarati", MARGIN, CONTENT_W);

      if (data.virusTotalReputation !== null) {
        const vtOk = data.virusTotalMalicious === 0;
        intelRow(
          "VirusTotal Domain Reputation",
          vtOk
            ? `Temiz — 70+ motor zararli isaretlemedi. Reputation skoru: ${data.virusTotalReputation}`
            : `${data.virusTotalMalicious} motor zararli isaretledi, ${data.virusTotalSuspicious} supheli. Reputation: ${data.virusTotalReputation}`,
          vtOk
        );
      }

      if (data.abuseIpdbScore !== null) {
        const aOk = data.abuseIpdbScore < 25;
        intelRow(
          "IP Kotuye Kullanim Gecmisi",
          `Guven skoru: %${data.abuseIpdbScore} — son 90 gunde ${data.abuseIpdbTotalReports} rapor${data.abuseIpdbCountry ? `. Konum: ${data.abuseIpdbCountry}` : ""}${data.abuseIpdbIsp ? `, ${data.abuseIpdbIsp}` : ""}`,
          aOk
        );
      }

      if (data.shodanOpenPorts !== null) {
        const sOk = data.shodanOpenPorts.length === 0 && data.shodanVulnCount === 0;
        const portStr = data.shodanOpenPorts.length === 0
          ? "Acik port tespit edilmedi"
          : `${data.shodanOpenPorts.length} acik port tespit edildi${data.shodanCountry ? ` (${data.shodanCountry})` : ""}${data.shodanIsp ? ` — ${data.shodanIsp}` : ""}. Port detaylari tam raporda yer almaktadir.`;
        intelRow(
          "Internet Maruziyeti Analizi",
          `${portStr}${data.shodanVulnCount > 0 ? ` ${data.shodanVulnCount} bilinen guvenlik acigi mevcut.` : ""}`,
          sOk
        );
      }
      doc.y += 4;
    }

    // ── MITRE ATT&CK Saldiri Senaryolari ────────────────────────────────────
    if (data.attackScenarios && data.attackScenarios.senaryolar.length > 0) {
      sectionTitle(doc, "MITRE ATT&CK Saldin Senaryolari", MARGIN, CONTENT_W);

      const levelColor: [number, number, number] =
        data.attackScenarios.genel_tehdit_seviyesi === "Kritik" ? [220, 38, 38] :
        data.attackScenarios.genel_tehdit_seviyesi === "Yüksek" ? [234, 88, 12] :
        data.attackScenarios.genel_tehdit_seviyesi === "Orta" ? [217, 119, 6] : [22, 163, 74];

      checkPageBreak(doc, 28);
      doc.fillColor(levelColor).fontSize(10).font(FONT_BOLD)
        .text(`Genel Tehdit Seviyesi: ${data.attackScenarios.genel_tehdit_seviyesi}`, MARGIN, doc.y, { width: CONTENT_W });
      doc.y += 10;

      for (const s of data.attackScenarios.senaryolar.slice(0, 5)) {
        checkPageBreak(doc, 50);
        const sy = doc.y;
        const sColor: [number, number, number] =
          s.olasilik === "Yüksek" ? [220, 38, 38] :
          s.olasilik === "Orta" ? [217, 119, 6] : [22, 163, 74];

        doc.rect(MARGIN, sy, CONTENT_W, 42).fillAndStroke([254, 249, 245], [253, 186, 116]);
        doc.fillColor(sColor).fontSize(8).font(FONT_BOLD)
          .text(s.olasilik.toUpperCase(), MARGIN + 6, sy + 5, { width: 55, lineBreak: false });
        doc.fillColor(DARK).fontSize(9).font(FONT_BOLD)
          .text(s.baslik, MARGIN + 64, sy + 4, { width: CONTENT_W - 70, lineBreak: false });
        doc.fillColor(GRAY).fontSize(7.5).font(FONT_REGULAR)
          .text(s.etki.substring(0, 130), MARGIN + 6, sy + 20, { width: CONTENT_W - 12 });
        doc.y = sy + 50;
      }
      doc.y += 4;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    checkPageBreak(doc, 60);
    const footerY = doc.page.height - 50;
    doc.rect(0, footerY, W, 50).fill(DARK);
    doc.fillColor([148, 163, 184]).fontSize(8).font(FONT_REGULAR)
      .text(`CyberStep.io  |  Alan Adi Guvenlik Taramasi  |  Tarama #${data.id}`, MARGIN, footerY + 18, { width: CONTENT_W, align: "center" });
    doc.end();
  });
}

interface PassportData {
  id: number;
  domain: string;
  overallScore: number;
  spfPass: boolean;
  dmarcPass: boolean;
  dkimPass: boolean;
  sslPass: boolean;
  blacklisted: boolean;
  hibpBreachCount: number;
  createdAt: string | Date;
}

function scoreToGrade(score: number): { grade: string; color: [number, number, number] } {
  if (score >= 80) return { grade: "A", color: [22, 163, 74] };
  if (score >= 65) return { grade: "B", color: [34, 197, 94] };
  if (score >= 50) return { grade: "C", color: [217, 119, 6] };
  if (score >= 35) return { grade: "D", color: [234, 88, 12] };
  return { grade: "F", color: [220, 38, 38] };
}

export function generateDomainScanPassport(data: PassportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: [841, 595],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const { grade, color: gradeColor } = scoreToGrade(data.overallScore);
    const issueDate = new Date(data.createdAt);
    const expiryDate = new Date(issueDate);
    expiryDate.setDate(expiryDate.getDate() + 30);
    const fmt = (d: Date) => d.toLocaleDateString("tr-TR");

    // Background
    doc.rect(0, 0, W, H).fill([248, 250, 252]);

    // Left accent bar
    doc.rect(0, 0, 10, H).fill(PRIMARY);

    // Header
    doc.rect(10, 0, W - 10, 80).fill(DARK);
    doc.fillColor(WHITE).fontSize(22).font(FONT_BOLD)
      .text("CyberStep.io", 36, 20, { lineBreak: false });
    doc.fillColor([148, 163, 184]).fontSize(11).font(FONT_REGULAR)
      .text("Dijital Guvenlik Pasaportu", 36, 50, { lineBreak: false });

    // Grade badge
    const badgeW = 110;
    const badgeX = W - badgeW - 24;
    doc.roundedRect(badgeX, 8, badgeW, 64, 10).fill(gradeColor);
    doc.fillColor(WHITE).fontSize(42).font(FONT_BOLD)
      .text(grade, badgeX, 10, { width: badgeW, align: "center", lineBreak: false });
    doc.fillColor(WHITE).fontSize(9).font(FONT_REGULAR)
      .text(`${data.overallScore}/100 puan`, badgeX, 55, { width: badgeW, align: "center", lineBreak: false });

    // Domain section
    doc.fillColor(DARK).fontSize(26).font(FONT_BOLD)
      .text(data.domain, 36, 106);
    doc.fillColor(GRAY).fontSize(9).font(FONT_REGULAR)
      .text(`Tarama #${data.id}   Duzenleme tarihi: ${fmt(issueDate)}   Gecerlilik suresi: ${fmt(expiryDate)}`, 36, 142);

    // Divider
    doc.rect(36, 162, W - 72, 1).fill([226, 232, 240]);

    // Checks grid (3x2)
    const checks = [
      { label: "SPF Kaydi — Sahte E-posta Korumasi", pass: data.spfPass },
      { label: "SSL/TLS Sertifikasi", pass: data.sslPass },
      { label: "DMARC Politikasi — E-posta Kimlik Dogrulamasi", pass: data.dmarcPass },
      { label: "Kara Liste Temizligi", pass: !data.blacklisted },
      { label: "DKIM Imzalamasi — E-posta Butunlugu", pass: data.dkimPass },
      { label: "Veri Ihlali Gecmisi Temiz", pass: data.hibpBreachCount === 0 },
    ];

    const colW = (W - 72) / 2;
    let col1Y = 180;
    let col2Y = 180;
    checks.forEach((c, i) => {
      const col = i % 2;
      const x = col === 0 ? 36 : 36 + colW + 16;
      const y = col === 0 ? col1Y : col2Y;
      const dotColor: [number, number, number] = c.pass ? [22, 163, 74] : [220, 38, 38];
      doc.circle(x + 6, y + 7, 5).fill(dotColor);
      doc.fillColor(c.pass ? DARK : [153, 27, 27]).fontSize(10).font(c.pass ? FONT_REGULAR : FONT_BOLD)
        .text(c.label, x + 18, y, { lineBreak: false });
      const statusLabel = c.pass ? "Gecti" : "Basarisiz";
      doc.fillColor(c.pass ? [22, 163, 74] : [220, 38, 38]).fontSize(8).font(FONT_BOLD)
        .text(statusLabel, x + 18, y + 16, { lineBreak: false });
      if (col === 0) col1Y += 52;
      else col2Y += 52;
    });

    // Divider
    const divY = Math.max(col1Y, col2Y) + 10;
    doc.rect(36, divY, W - 72, 1).fill([226, 232, 240]);

    // Footer
    const footerY = H - 52;
    doc.rect(10, footerY, W - 10, 52).fill([241, 245, 249]);
    doc.rect(10, footerY, W - 10, 1).fill([226, 232, 240]);
    doc.fillColor(GRAY).fontSize(8).font(FONT_REGULAR)
      .text("Bu belge CyberStep.io otomatik alan adi taramasina dayanmaktadir ve profesyonel guvenlik denetiminin yerini tutmaz.", 36, footerY + 10, { width: W - 180, lineBreak: false });
    doc.fillColor(PRIMARY).fontSize(10).font(FONT_BOLD)
      .text("cyberstep.io", W - 130, footerY + 20, { width: 100, align: "right", lineBreak: false });

    doc.end();
  });
}

// ─── Siber Sigorta Hazırlık Raporu ───────────────────────────────────────────
export interface InsuranceReportData {
  companyName: string;
  sector: string;
  employeeCount: string;
  score: number;
  insuranceReadinessPercent: number | null;
  insuranceGaps: string[];
  kvkkRiskLevel: string | null;
  recommendations: string[];
  createdAt: string;
  assessmentId: number;
}

export function generateInsuranceReport(data: InsuranceReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 50, left: 50, right: 50 } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const L = 50, W = 495, DARK = "#111827", PRIMARY = "#6d28d9", MUTED = "#6b7280";

      // Header
      doc.rect(0, 0, 595, 80).fill(PRIMARY);
      doc.fillColor("#fff").fontSize(20).font(FONT_BOLD).text("Siber Sigorta Hazirlik Raporu", L, 24, { width: W });
      doc.fontSize(10).font(FONT_REGULAR).text("CyberStep.io | " + new Date(data.createdAt).toLocaleDateString("tr-TR"), L, 52, { width: W });
      doc.y = 100;

      // Company info block
      doc.fillColor(PRIMARY).fontSize(13).font(FONT_BOLD).text("Firma Bilgileri", L, doc.y);
      doc.y += 16;
      const info = [
        ["Firma Adi", data.companyName],
        ["Sektor", data.sector],
        ["Calisan Sayisi", data.employeeCount],
        ["Degerlendirme Tarihi", new Date(data.createdAt).toLocaleDateString("tr-TR")],
        ["Degerlendirme No", `#${data.assessmentId}`],
      ];
      info.forEach(([label, value]) => {
        doc.fillColor(MUTED).fontSize(9).font(FONT_REGULAR).text(label + ": ", L, doc.y, { continued: true });
        doc.fillColor(DARK).font(FONT_BOLD).text(value);
        doc.y += 4;
      });
      doc.y += 14;

      // Readiness score
      const pct = data.insuranceReadinessPercent ?? 0;
      const readColor = pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";
      const readLabel = pct >= 70 ? "Sigortaya Hazir" : pct >= 40 ? "Kismi Hazir" : "Eksikler Var";
      doc.rect(L, doc.y, W, 60).fill("#f8f9fa").stroke("#e5e7eb");
      doc.fillColor(readColor).fontSize(28).font(FONT_BOLD).text(`%${pct}`, L + 12, doc.y + 10, { width: 70, align: "center" });
      doc.fillColor(DARK).fontSize(14).font(FONT_BOLD).text("Sigorta Hazirlik Puani", L + 90, doc.y - 28);
      doc.fillColor(readColor).fontSize(10).font(FONT_REGULAR).text(readLabel, L + 90, doc.y - 10);
      doc.fillColor(MUTED).fontSize(9).text("Bu puan, Allianz, AXA, Zurich ve diger lider sigorta sirketlerinin", L + 90, doc.y + 4);
      doc.text("KOBIler icin uyguladigi siber sigorta kriterlerine gore hesaplanmistir.", L + 90, doc.y + 4);
      doc.y += 24;

      // Sigorta Skoru bar
      doc.y += 8;
      doc.rect(L, doc.y, W, 10).fill("#e5e7eb");
      if (pct > 0) doc.rect(L, doc.y, (W * pct) / 100, 10).fill(readColor);
      doc.y += 22;

      // Gaps
      if (data.insuranceGaps.length > 0) {
        doc.fillColor(PRIMARY).fontSize(12).font(FONT_BOLD).text("Sigorta Kapsamini Etkileyen Eksikler", L, doc.y);
        doc.y += 14;
        data.insuranceGaps.forEach((gap, i) => {
          checkPageBreak(doc, 22);
          doc.rect(L, doc.y, 6, 16).fill("#dc2626");
          doc.fillColor(DARK).fontSize(10).font(FONT_REGULAR).text(`${i + 1}. ${gap}`, L + 12, doc.y + 2, { width: W - 12 });
          doc.y += 22;
        });
        doc.y += 8;
      }

      // Genel Skor
      doc.fillColor(PRIMARY).fontSize(12).font(FONT_BOLD).text("Genel Siber Guvenlik Skoru", L, doc.y);
      doc.y += 10;
      const scoreColor = data.score >= 80 ? "#16a34a" : data.score >= 60 ? "#d97706" : "#dc2626";
      doc.fillColor(scoreColor).fontSize(22).font(FONT_BOLD).text(`${data.score}/100`, L, doc.y);
      doc.y += 28;

      // Recommendations
      if (data.recommendations.length > 0) {
        checkPageBreak(doc, 30);
        doc.fillColor(PRIMARY).fontSize(12).font(FONT_BOLD).text("Once Yapilmasi Gerekenler", L, doc.y);
        doc.y += 14;
        data.recommendations.slice(0, 5).forEach((rec, i) => {
          checkPageBreak(doc, 24);
          doc.rect(L, doc.y, W, 20).fill(i % 2 === 0 ? "#f5f3ff" : "#fff");
          doc.rect(L, doc.y, 3, 20).fill(PRIMARY);
          doc.fillColor(DARK).fontSize(9).font(FONT_REGULAR).text(rec, L + 10, doc.y + 5, { width: W - 14 });
          doc.y += 24;
        });
        doc.y += 8;
      }

      // Footer
      const footerY = 780;
      doc.rect(0, footerY, 595, 1).fill("#e5e7eb");
      doc.fillColor(MUTED).fontSize(8).font(FONT_REGULAR)
        .text("Bu rapor, cyberstep.io tarafindan otomatik olarak olusturulmustur. Kesin sigorta poliçesi kosullari icin bir sigorta brokeri ile gorusunuz.", L, footerY + 8, { width: W, align: "center" });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function sectionTitle(doc: InstanceType<typeof PDFDocument>, title: string, x: number, w: number) {
  checkPageBreak(doc, 40);
  doc.rect(x, doc.y, w, 1).fill(PRIMARY);
  doc.y += 6;
  doc.fillColor(DARK).fontSize(12).font(FONT_BOLD)
    .text(title, x, doc.y);
  doc.y += 12;
}

function checkPageBreak(doc: InstanceType<typeof PDFDocument>, needed: number) {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
    doc.y = 40;
  }
}
