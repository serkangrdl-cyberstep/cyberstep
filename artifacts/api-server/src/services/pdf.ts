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

// ─── CyberStep Brand Palette (domain scan) ───────────────────────────────────
const CS_DARK:   [number, number, number] = [6, 13, 26];
const CS_PANEL:  [number, number, number] = [7, 24, 40];
const CS_CARD:   [number, number, number] = [12, 47, 71];
const CS_CYAN:   [number, number, number] = [0, 200, 255];
const CS_AMBER:  [number, number, number] = [245, 166, 35];
const CS_TEXT:   [number, number, number] = [232, 237, 245];
const CS_MUTED:  [number, number, number] = [123, 143, 175];
const CS_DANGER: [number, number, number] = [255, 69, 96];
const CS_OFF:    [number, number, number] = [10, 14, 23];

function dsScoreColor(score: number): [number, number, number] {
  if (score >= 80) return CS_CYAN;
  if (score >= 60) return [0, 200, 170];
  if (score >= 40) return CS_AMBER;
  return CS_DANGER;
}

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
  shodanOpenPorts: Array<{ port: number; protocol: string; service: string; product: string; version: string; riskLevel?: string; riskContext?: string; isCdnExpected?: boolean }> | null;
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
  wafNote?: string | null;
  attackScenarios?: {
    genel_tehdit_seviyesi: string;
    risk_ozet?: string;
    senaryolar: Array<{
      baslik: string;
      olasilik: string;
      acillik?: string;
      giris_noktasi?: string;
      saldiri_zinciri?: string[];
      etki: string;
      kvkk_etkisi?: string;
      mitre_teknikler?: Array<{ kod: string; isim: string }>;
    }>;
    once_kapat?: Array<{ oncelik: number; aksiyon: string; neden: string }>;
  } | null;
  scoreBreakdown?: {
    spf: number; dmarc: number; dkim: number; mx: number; ssl: number;
    portDeduction: number; total: number;
  } | null;
  isFreeReport?: boolean;
}

export function generateDomainScanPDF(data: DomainScanData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margins: { top: 0, bottom: 40, left: 0, right: 0 }, bufferPages: true });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const MARGIN = 48;
    const CONTENT_W = W - MARGIN * 2;

    let _pgNum = 1; // içerik sayfası sayacı (kapak hariç)

    // Gerçek CyberStep kalkan ikonunu PDFKit vektör primitifleriyle çizer
    // x,y: sol-üst köşe, size: PDF point cinsinden boyut (orijinal SVG = 48×48)
    const _drawShieldIcon = (x: number, y: number, size: number) => {
      const factor = size / 48;
      doc.save();
      doc.translate(x, y);
      doc.scale(factor, factor);
      // Kalkan gövdesi: koyu dolgu + cyan kontur
      doc.fillColor(CS_DARK)
        .strokeColor(CS_CYAN)
        .lineWidth(2)
        .path("M24 3 L42 10 L42 26 C42 35 34 42 24 46 C14 42 6 35 6 26 L6 10 Z")
        .fillAndStroke();
      // İç devre H şekli (gradient yerine düz cyan)
      doc.fillColor(CS_CYAN)
        .path("M17 30 L17 26 L22 26 L22 22 L17 22 L17 18 L31 18 L31 22 L26 22 L26 26 L31 26 L31 30 Z")
        .fill();
      // Köşe siyanür noktaları
      for (const [px, py] of [[17, 18], [31, 18], [17, 30], [31, 30]] as [number, number][]) {
        doc.fillColor(CS_CYAN).circle(px, py, 2).fill();
      }
      doc.restore();
    };

    // Header: her içerik sayfasının tepesine çizilir
    const _drawHeader = () => {
      doc.rect(0, 0, W, 36).fill(CS_DARK);
      // CyberStep kalkan ikonu
      _drawShieldIcon(MARGIN, 7, 22);
      // Logo yazısı
      doc.font(FONT_BOLD).fontSize(13);
      const hcw = doc.widthOfString("Cyber");
      const hsw = doc.widthOfString("Step");
      doc.fillColor(CS_TEXT).text("Cyber", MARGIN + 28, 11, { lineBreak: false });
      doc.fillColor(CS_CYAN).text("Step",  MARGIN + 28 + hcw, 11, { lineBreak: false });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8)
        .text(".io", MARGIN + 28 + hcw + hsw, 13, { lineBreak: false });
      doc.fillColor([148, 163, 184]).font(FONT_REGULAR).fontSize(9)
        .text(`${data.domain}  |  Tarama #${data.id}`, MARGIN, 11, { align: "right", width: CONTENT_W });
    };

    // Footer: her içerik sayfasının altına çizilir
    const _drawFooter = () => {
      const PH = doc.page.height;
      const sy = doc.y;

      // Sayfa akışını dondur — otomatik sayfa geçişini engelle
      doc.switchToPage(doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1);

      doc.rect(0, PH - 36, W, 36).fill(CS_DARK);
      _drawShieldIcon(MARGIN, PH - 29, 18);
      doc.font(FONT_BOLD).fontSize(10);
      const fcw = doc.widthOfString("Cyber");
      const fsw = doc.widthOfString("Step");
      doc.fillColor(CS_TEXT) .text("Cyber", MARGIN + 24, PH - 23, { lineBreak: false });
      doc.fillColor(CS_CYAN) .text("Step",  MARGIN + 24 + fcw, PH - 23, { lineBreak: false });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7)
        .text(".io", MARGIN + 24 + fcw + fsw, PH - 23, { lineBreak: false });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7.5)
        .text(`${data.domain}  |  Alan Adı Güvenlik Taraması`, MARGIN, PH - 23, { align: "center", width: CONTENT_W });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7.5)
        .text(`Sayfa ${_pgNum}`, MARGIN, PH - 23, { align: "right", width: CONTENT_W });

      doc.y = sy;
    };

    // Yerel checkPageBreak: global fonksiyonu gölgeler; footer+header otomatik yönetir
    const checkPageBreak = (doc_: typeof doc, needed: number) => {
      if (doc_.y + needed > doc_.page.height - 52) {
        _drawFooter();
        _pgNum++;
        doc_.addPage();
        // Yeni sayfada header'ı switchToPage ile çiz — cursor karışmasın
        const newPageIdx = doc_.bufferedPageRange().start + doc_.bufferedPageRange().count - 1;
        doc_.switchToPage(newPageIdx);
        _drawHeader();
        doc_.y = 52;
      }
    };

    // Yerel sectionTitle: global fonksiyonu gölgeler; Türkçe + yerel checkPageBreak
    const sectionTitle = (title: string) => {
      checkPageBreak(doc, 40);
      doc.rect(MARGIN, doc.y, CONTENT_W, 1).fill(PRIMARY);
      doc.y += 6;
      doc.fillColor(DARK).fontSize(12).font(FONT_BOLD).text(title, MARGIN, doc.y);
      doc.y += 12;
    };

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

    // ══ SAYFA 1: KAPAK (CyberStep koyu tema) ══════════════════════════════════
    const H = doc.page.height;
    const scoreCol = dsScoreColor(data.overallScore);
    const scoreLabel = data.overallScore >= 80 ? "İyi" : data.overallScore >= 60 ? "Orta" : data.overallScore >= 40 ? "Zayıf" : "Kritik";
    const scoreDesc = data.overallScore >= 80
      ? "Temel güvenlik önlemleri büyük ölçüde yerinde."
      : data.overallScore >= 60 ? "Önemli güvenlik eksiklikleri mevcut."
      : data.overallScore >= 40 ? "Kritik güvenlik açıkları tespit edildi."
      : "Ciddi siber risk altındasınız.";

    // Tüm sayfa koyu zemin
    doc.rect(0, 0, W, H).fill(CS_DARK);
    // Dekoratif çember (sağ üst)
    doc.circle(W + 60, -60, 310).lineWidth(0.5).strokeColor(CS_CARD).stroke();
    doc.circle(W + 130, 160, 210).lineWidth(0.5).strokeColor(CS_CARD).stroke();

    // Logo: CS ikon + Cyber(beyaz) Step(cyan) .io(gri)
    const LOGO_Y = 52;
    // CyberStep kalkan ikonu (kapak büyük versiyonu)
    _drawShieldIcon(MARGIN, LOGO_Y - 2, 36);
    // Wordmark
    doc.font(FONT_BOLD).fontSize(22);
    const cyberW = doc.widthOfString("Cyber");
    const stepW  = doc.widthOfString("Step");
    doc.fillColor(CS_TEXT).text("Cyber", MARGIN + 40, LOGO_Y, { lineBreak: false });
    doc.fillColor(CS_CYAN).text("Step",  MARGIN + 40 + cyberW, LOGO_Y, { lineBreak: false });
    doc.font(FONT_REGULAR).fontSize(14).fillColor(CS_MUTED)
      .text(".io", MARGIN + 40 + cyberW + stepW, LOGO_Y + 6, { lineBreak: false });

    // Rozet
    const BADGE_Y = LOGO_Y + 34;
    doc.rect(MARGIN, BADGE_Y, 228, 16).fill(CS_CARD);
    doc.fillColor(CS_CYAN).font(FONT_BOLD).fontSize(7)
      .text("ALAN ADI GÜVENLİK TARAMA RAPORU", MARGIN + 10, BADGE_Y + 4.5, { width: 208, lineBreak: false });

    // Alan adı + tarih
    const DOMAIN_Y = Math.floor(H * 0.36);
    doc.fillColor(CS_TEXT).font(FONT_BOLD).fontSize(22)
      .text(data.domain, MARGIN, DOMAIN_Y, { width: W - MARGIN * 2 - 160, lineBreak: false });
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8.5)
      .text(`${new Date(data.createdAt).toLocaleDateString("tr-TR")}  |  Rapor #${data.id}`,
        MARGIN, DOMAIN_Y + 34);

    // ── Dairesel gösterge (gauge ring) ───────────────────────────────────────
    const GX = W - MARGIN - 86;
    const GY = DOMAIN_Y + 50;
    const GR = 42;
    const GLW = 12;
    // Arka plan halkası
    doc.circle(GX, GY, GR).lineWidth(GLW).strokeColor(CS_CARD).stroke();
    // Skor yayı
    if (data.overallScore > 0) {
      const ang = (Math.min(data.overallScore, 99.9) / 100) * Math.PI * 2;
      (doc as unknown as { arc(x: number, y: number, r: number, s: number, e: number, cw?: boolean): typeof doc })
        .arc(GX, GY, GR, -Math.PI / 2, -Math.PI / 2 + ang, false)
        .lineWidth(GLW).strokeColor(scoreCol).stroke();
    }
    // Merkez doldur (halka efekti)
    doc.circle(GX, GY, GR - GLW / 2 - 2).fill(CS_DARK);
    // Skor sayısı
    const numW2 = GR * 1.6;
    doc.fillColor(scoreCol).font(FONT_BOLD).fontSize(18)
      .text(`${data.overallScore}`, GX - numW2 / 2, GY - 12,
        { width: numW2, align: "center", lineBreak: false });
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7)
      .text("/100", GX - numW2 / 2, GY + 7,
        { width: numW2, align: "center", lineBreak: false });

    // Skor seviyesi + açıklama
    const LVL_Y = DOMAIN_Y + 78;
    doc.fillColor(scoreCol).font(FONT_BOLD).fontSize(16).text(scoreLabel, MARGIN, LVL_Y);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8)
      .text(scoreDesc, MARGIN, LVL_Y + 23, { width: 270 });

    // TR sektör karşılaştırma barı
    const BAR_Y = LVL_Y + 72;
    const CBAR_W = 144;
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7).text("TR Ort. 58", MARGIN, BAR_Y);
    doc.rect(MARGIN, BAR_Y + 13, CBAR_W, 4).fill(CS_CARD);
    doc.rect(MARGIN, BAR_Y + 13, CBAR_W * 0.58, 4).fill(CS_PANEL);
    doc.rect(MARGIN, BAR_Y + 13, CBAR_W * (data.overallScore / 100), 4).fill(scoreCol);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7)
      .text(`Siz ${data.overallScore}`, MARGIN + CBAR_W + 8, BAR_Y + 11);

    // Kapak alt bilgi çizgisi
    const CVR_FOOT_Y = H - 50;
    doc.rect(MARGIN, CVR_FOOT_Y, CONTENT_W, 0.5).fill(CS_CARD);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7.5)
      .text(`${data.domain}  |  CyberStep.io`, MARGIN, CVR_FOOT_Y + 10);
    // "Gizli" rozeti (sağ alt)
    doc.rect(W - MARGIN - 52, CVR_FOOT_Y + 5, 52, 14).fill(CS_CARD);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(6.5)
      .text("GİZLİ", W - MARGIN - 52, CVR_FOOT_Y + 8.5,
        { width: 52, align: "center", lineBreak: false });

    // ══ İÇERİK SAYFASI ════════════════════════════════════════════════════════
    doc.addPage();
    const firstContentPageIdx = doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1;
    doc.switchToPage(firstContentPageIdx);
    _drawHeader();
    doc.y = 52;

    // ── Puan Dökümü ───────────────────────────────────────────────────────────
    if (data.scoreBreakdown) {
      sectionTitle("Puan Dökümü");
      checkPageBreak(doc, 48);
      const bd = data.scoreBreakdown;
      const cols: Array<{ label: string; val: number; max: number }> = [
        { label: "SPF",   val: bd.spf,   max: 20 },
        { label: "DMARC", val: bd.dmarc, max: 25 },
        { label: "DKIM",  val: bd.dkim,  max: 20 },
        { label: "MX",    val: bd.mx,    max: 10 },
        { label: "SSL",   val: bd.ssl,   max: 25 },
      ];
      const cellW = (CONTENT_W - (cols.length - 1) * 6) / cols.length;
      const rowY = doc.y;
      cols.forEach((col, i) => {
        const cx = MARGIN + i * (cellW + 6);
        const pct = col.max > 0 ? col.val / col.max : 0;
        const cellColor: [number, number, number] =
          pct >= 1 ? [22, 163, 74] : pct >= 0.5 ? [217, 119, 6] : [220, 38, 38];
        doc.rect(cx, rowY, cellW, 38).fillAndStroke(LIGHT, [226, 232, 240]);
        doc.fillColor(GRAY).fontSize(7).font(FONT_REGULAR).text(col.label, cx, rowY + 5, { width: cellW, align: "center" });
        doc.fillColor(cellColor).fontSize(13).font(FONT_BOLD).text(`${col.val}`, cx, rowY + 16, { width: cellW - 20, align: "right" });
        doc.fillColor(GRAY).fontSize(8).font(FONT_REGULAR).text(`/${col.max}`, cx + cellW - 18, rowY + 20, { width: 18 });
      });
      doc.y = rowY + 44;
      if (bd.portDeduction > 0) {
        checkPageBreak(doc, 16);
        doc.fillColor([220, 38, 38]).fontSize(8).font(FONT_BOLD)
          .text(`Port kesintisi: -${bd.portDeduction} puan`, MARGIN, doc.y);
        doc.y += 14;
      }
      doc.y += 4;
    }

    // ── E-posta ve SSL Kontrolleri ─────────────────────────────────────────────
    sectionTitle("E-posta ve SSL Güvenlik Kontrolleri");
    const checks = [
      { label: "SPF Kaydı", pass: data.spfPass, detail: data.spfRecord, weight: "20 puan" },
      { label: "DMARC Politikası", pass: data.dmarcPass, detail: data.dmarcRecord, weight: "25 puan" },
      { label: "DKIM İmzası", pass: data.dkimPass, detail: data.dkimSelectors.join(", ") || null, weight: "20 puan" },
      { label: "MX Kayıtları", pass: data.mxPass, detail: data.mxRecords[0]?.exchange ?? null, weight: "10 puan" },
      { label: "SSL/TLS Sertifikası", pass: data.sslPass, detail: data.sslDaysUntilExpiry !== null ? `${data.sslIssuer ?? ""} - ${data.sslDaysUntilExpiry} gün geçerli` : null, weight: "25 puan" },
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
    sectionTitle("Web Sunucu Güvenlik Başlıkları");
    checkPageBreak(doc, 12);
    const scoreC: [number, number, number] = data.httpHeadersScore >= 4 ? [22, 163, 74] : data.httpHeadersScore >= 2 ? [217, 119, 6] : [220, 38, 38];
    doc.fillColor(scoreC).fontSize(9).font(FONT_BOLD).text(`Toplam skor: ${data.httpHeadersScore}/5 başlık`, MARGIN, doc.y);
    doc.y += 10;
    const hd = data.httpHeadersDetails;
    const headerItems = [
      { label: "HSTS (Strict-Transport-Security)", ok: hd?.hsts ?? false },
      { label: "X-Frame-Options (clickjacking koruması)", ok: hd?.xFrameOptions ?? false },
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

    // ── WAF/CDN Dolaylı Tespit Notu (Bug 19) ──────────────────────────────────
    if (data.wafNote) {
      checkPageBreak(doc, 36);
      const wny = doc.y;
      doc.rect(MARGIN, wny, CONTENT_W, 30).fill([240, 251, 255]);
      doc.rect(MARGIN, wny, 3, 30).fill(CS_CYAN);
      doc.fillColor([68, 102, 102]).fontSize(8.5).font(FONT_REGULAR)
        .text(`i  ${data.wafNote}`, MARGIN + 12, wny + 8, { width: CONTENT_W - 18 });
      doc.y = wny + 38;
    }

    // ── Risk Istihbarati ──────────────────────────────────────────────────────
    sectionTitle("Risk İstihbaratı");
    intelRow(
      "Veri Sızıntısı (HIBP)",
      data.hibpBreachCount === 0 ? "Temiz — sızıntı kaydı yok" : `${data.hibpBreachCount} sızıntı kaydı bulundu`,
      data.hibpBreachCount === 0
    );
    intelRow(
      "Kara Liste (DNSBL)",
      data.blacklisted ? `${data.blacklistCount} spam listesinde kayıtlı` : "Temiz — hiçbir kara listede yok",
      !data.blacklisted
    );
    intelRow(
      "URLhaus Zararlı URL",
      data.urlhausListed ? `Zararlı işaretlendi${data.urlhausThreat ? `: ${data.urlhausThreat}` : ""}` : "Temiz — zararlı URL listesinde yok",
      !data.urlhausListed
    );
    intelRow(
      "USOM Ulusal Kara Liste",
      data.usomListed ? "USOM zararlı domain listesinde kayıtlı" : "Temiz — USOM listesinde yok",
      !data.usomListed
    );

    // Shadow IT
    const highRisk = data.shadowItServices.filter(s => s.risk === "Yuksek");
    intelRow(
      "Gölge BT Tespiti (Shadow IT)",
      data.shadowItServices.length === 0
        ? "Üçüncü parti servis tespit edilmedi"
        : `${data.shadowItServices.length} servis — ${highRisk.length} yüksek riskli${data.shadowItServices.length > 0 ? ` (${data.shadowItServices.slice(0, 4).map(s => s.name).join(", ")}${data.shadowItServices.length > 4 ? "..." : ""})` : ""}`,
      highRisk.length === 0
    );

    // Subdomains — 1-50: bilgi (ok=true), >50: uyarı (ok=false)
    if (data.ctSubdomainCount > 0) {
      intelRow(
        "Sertifika Seffafligi (crt.sh)",
        data.ctSubdomainCount <= 50
          ? `${data.ctSubdomainCount} alt alan adı tespit edildi — güncelliği doğrulayın`
          : `${data.ctSubdomainCount} alt alan adı — çok sayıda subdomain saldırı yüzeyini artırabilir`,
        data.ctSubdomainCount <= 50
      );
    }
    doc.y += 4;

    // ── CVE Guvenlik Aciklari (sadece ucretli) ─────────────────────────────────
    if (!data.isFreeReport && data.cveSummary.length > 0) {
      sectionTitle("Tespit Edilen CVE Güvenlik Açıkları");
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

    // ── Katman 1 Tehdit Istihbarati (sadece ucretli) ──────────────────────────
    const hasK1 = data.virusTotalReputation !== null || data.abuseIpdbScore !== null || data.shodanOpenPorts !== null;
    if (!data.isFreeReport && hasK1) {
      sectionTitle("Katman 1 Tehdit İstihbaratı");

      if (data.virusTotalReputation !== null) {
        const vtOk = data.virusTotalMalicious === 0;
        intelRow(
          "VirusTotal Domain Reputation",
          vtOk
            ? `Temiz — 70+ motor zararlı işaretlemedi. Reputation skoru: ${data.virusTotalReputation}`
            : `${data.virusTotalMalicious} motor zararlı işaretledi, ${data.virusTotalSuspicious} şüpheli. Reputation: ${data.virusTotalReputation}`,
          vtOk
        );
      }

      if (data.abuseIpdbScore !== null) {
        const aOk = data.abuseIpdbScore < 25;
        intelRow(
          "IP Kotuye Kullanim Gecmisi",
          `Güven skoru: %${data.abuseIpdbScore} — son 90 günde ${data.abuseIpdbTotalReports} rapor${data.abuseIpdbCountry ? `. Konum: ${data.abuseIpdbCountry}` : ""}${data.abuseIpdbIsp ? `, ${data.abuseIpdbIsp}` : ""}`,
          aOk
        );
      }

      if (data.shodanOpenPorts !== null) {
        const ports = data.shodanOpenPorts;
        const criticalPorts = ports.filter(p => p.riskLevel === "critical" || p.riskLevel === "high");
        const cdnPorts = ports.filter(p => p.isCdnExpected);
        const mediumPorts = ports.filter(p => p.riskLevel === "medium");
        const sOk = criticalPorts.length === 0 && data.shodanVulnCount === 0;
        let portStr: string;
        if (ports.length === 0) {
          portStr = "Acik port tespit edilmedi";
        } else if (cdnPorts.length === ports.length) {
          portStr = `${ports.length} port tespit edildi — tamamı CDN/proxy altyapısına ait (${data.shodanIsp ?? "bilinmiyor"}), gerçek sunucu riski yok`;
        } else {
          const parts: string[] = [];
          if (criticalPorts.length > 0) parts.push(`${criticalPorts.length} yüksek riskli port (${criticalPorts.map(p => `${p.port}/${p.protocol}`).join(", ")})`);
          if (mediumPorts.length > 0) parts.push(`${mediumPorts.length} orta riskli port`);
          if (cdnPorts.length > 0) parts.push(`${cdnPorts.length} CDN beklentisi`);
          portStr = parts.join("; ") || `${ports.length} port tespit edildi`;
          if (data.shodanCountry || data.shodanIsp) portStr += ` (${[data.shodanCountry, data.shodanIsp].filter(Boolean).join(", ")})`;
        }
        intelRow(
          "Internet Maruziyeti Analizi",
          `${portStr}${data.shodanVulnCount > 0 ? ` ${data.shodanVulnCount} bilinen güvenlik açığı mevcut.` : ""}`,
          sOk
        );
      }
      doc.y += 4;
    }

    // ── MITRE ATT&CK Saldiri Senaryolari ────────────────────────────────────
    if (data.attackScenarios && data.attackScenarios.senaryolar.length > 0) {
      sectionTitle("MITRE ATT&CK Saldırı Senaryoları");

      const levelColor: [number, number, number] =
        data.attackScenarios.genel_tehdit_seviyesi === "Kritik" ? [220, 38, 38] :
        data.attackScenarios.genel_tehdit_seviyesi === "Yüksek" ? [234, 88, 12] :
        data.attackScenarios.genel_tehdit_seviyesi === "Orta" ? [217, 119, 6] : [22, 163, 74];

      checkPageBreak(doc, 28);
      doc.fillColor(levelColor).fontSize(10).font(FONT_BOLD)
        .text(`Genel Tehdit Seviyesi: ${data.attackScenarios.genel_tehdit_seviyesi}`, MARGIN, doc.y, { width: CONTENT_W });
      doc.y += 10;

      // risk_ozet özet satırı
      if (data.attackScenarios.risk_ozet) {
        checkPageBreak(doc, 24);
        doc.fillColor(GRAY).fontSize(8.5).font(FONT_REGULAR)
          .text(data.attackScenarios.risk_ozet, MARGIN, doc.y, { width: CONTENT_W });
        doc.y += 10;
      }

      for (const s of data.attackScenarios.senaryolar.slice(0, 3)) {
        checkPageBreak(doc, 120);
        const sy = doc.y;
        const sColor: [number, number, number] =
          s.olasilik === "Yüksek" ? [220, 38, 38] :
          s.olasilik === "Orta" ? [217, 119, 6] : [22, 163, 74];

        // Başlık satırı
        doc.rect(MARGIN, sy, CONTENT_W, 22).fill([253, 246, 236]);
        doc.fillColor(sColor).fontSize(7.5).font(FONT_BOLD)
          .text(s.olasilik.toUpperCase(), MARGIN + 6, sy + 6, { width: 48, lineBreak: false });
        doc.fillColor(DARK).fontSize(9).font(FONT_BOLD)
          .text(s.baslik, MARGIN + 60, sy + 5, { width: CONTENT_W - 66, lineBreak: false });
        doc.y = sy + 28;

        // Giriş noktası
        if (s.giris_noktasi) {
          doc.fillColor([37, 99, 235]).fontSize(7.5).font(FONT_BOLD)
            .text("Giris Noktasi:", MARGIN + 8, doc.y, { width: 70, lineBreak: false });
          doc.fillColor(GRAY).fontSize(7.5).font(FONT_REGULAR)
            .text(s.giris_noktasi.substring(0, 160), MARGIN + 82, doc.y - 10, { width: CONTENT_W - 88 });
          doc.y += 4;
        }

        // Saldırı zinciri
        if (s.saldiri_zinciri && s.saldiri_zinciri.length > 0) {
          checkPageBreak(doc, 14);
          doc.fillColor([37, 99, 235]).fontSize(7.5).font(FONT_BOLD)
            .text("Saldiri Zinciri:", MARGIN + 8, doc.y, { width: CONTENT_W - 16 });
          doc.y += 2;
          for (const step of s.saldiri_zinciri.slice(0, 4)) {
            checkPageBreak(doc, 12);
            doc.fillColor(GRAY).fontSize(7).font(FONT_REGULAR)
              .text(`  ${step.substring(0, 140)}`, MARGIN + 16, doc.y, { width: CONTENT_W - 24 });
            doc.y += 2;
          }
          doc.y += 2;
        }

        // Etki
        checkPageBreak(doc, 14);
        doc.fillColor([37, 99, 235]).fontSize(7.5).font(FONT_BOLD)
          .text("Etki:", MARGIN + 8, doc.y, { width: 30, lineBreak: false });
        doc.fillColor(GRAY).fontSize(7.5).font(FONT_REGULAR)
          .text(s.etki.substring(0, 200), MARGIN + 42, doc.y - 10, { width: CONTENT_W - 48 });
        doc.y += 4;

        // KVKK
        if (s.kvkk_etkisi) {
          checkPageBreak(doc, 14);
          doc.fillColor([37, 99, 235]).fontSize(7.5).font(FONT_BOLD)
            .text("KVKK:", MARGIN + 8, doc.y, { width: 34, lineBreak: false });
          doc.fillColor(GRAY).fontSize(7).font(FONT_REGULAR)
            .text(s.kvkk_etkisi.substring(0, 160), MARGIN + 46, doc.y - 10, { width: CONTENT_W - 52 });
          doc.y += 4;
        }

        // MITRE teknikler
        if (s.mitre_teknikler && s.mitre_teknikler.length > 0) {
          checkPageBreak(doc, 12);
          const mitreTags = s.mitre_teknikler.slice(0, 3).map(t => `${t.kod} ${t.isim}`).join("  |  ");
          doc.fillColor([100, 116, 139]).fontSize(6.5).font(FONT_REGULAR)
            .text(`MITRE: ${mitreTags}`, MARGIN + 8, doc.y, { width: CONTENT_W - 16 });
          doc.y += 4;
        }

        doc.y += 8;
        // ince ayırıcı çizgi
        doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y).strokeColor([226, 232, 240]).lineWidth(0.5).stroke();
        doc.y += 10;
      }

      // ── Oncelikli Aksiyon Listesi ──────────────────────────────────────────
      const onceKapat = data.attackScenarios.once_kapat ?? [];
      if (onceKapat.length > 0) {
        sectionTitle("Öncelikli Aksiyon Listesi");
        for (const item of onceKapat) {
          checkPageBreak(doc, 60);
          const ay = doc.y;
          // Sol kenar çizgisi (sabit yükseklik yerine dinamik)
          doc.fillColor(DARK).fontSize(9).font(FONT_BOLD)
            .text(`${item.oncelik}.  ${item.aksiyon}`, MARGIN + 20, ay, { width: CONTENT_W - 24 });
          const afterTitle = doc.y + 3;
          doc.fillColor(GRAY).fontSize(7.5).font(FONT_REGULAR)
            .text(item.neden.substring(0, 220), MARGIN + 20, afterTitle, { width: CONTENT_W - 24 });
          const blockEnd = doc.y + 10;
          // Sol kırmızı çizgi
          doc.moveTo(MARGIN + 8, ay - 2).lineTo(MARGIN + 8, blockEnd - 4).strokeColor([220, 38, 38]).lineWidth(2).stroke();
          doc.y = blockEnd;
        }
        doc.y += 4;
      }
    }

    // ── Ucretsiz rapor kilitleme kutusu ───────────────────────────────────────
    if (data.isFreeReport) {
      checkPageBreak(doc, 100);
      const lockY = doc.y + 8;
      doc.rect(MARGIN, lockY, CONTENT_W, 80).fillAndStroke([239, 246, 255], [147, 197, 253]);
      doc.fillColor([37, 99, 235]).fontSize(11).font(FONT_BOLD)
        .text("Tam Rapor — Ücretsiz Hesap ile Sınırlıdır", MARGIN + 16, lockY + 12, { width: CONTENT_W - 32 });
      doc.fillColor(GRAY).fontSize(9).font(FONT_REGULAR)
        .text(
          "Bu rapor özet bilgileri içermektedir. Hesap oluşturarak CVE güvenlik açıkları, MITRE ATT&CK saldırı senaryoları, AI destekli tehdit analizi ve öncelikli aksiyon planını içeren tam raporu ücretsiz indirin.",
          MARGIN + 16, lockY + 30, { width: CONTENT_W - 32 }
        );
      doc.fillColor([37, 99, 235]).fontSize(8).font(FONT_BOLD)
        .text("cyberstep.io/kayit", MARGIN + 16, lockY + 62, { width: CONTENT_W - 32 });
      doc.y = lockY + 88;
    }

    // ── Son sayfaya footer çiz, belgeyi kapat ─────────────────────────────────
    _drawFooter();
    doc.flushPages();
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
