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
