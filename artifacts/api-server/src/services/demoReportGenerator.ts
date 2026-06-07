import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { demoReportsTable, demoLeadsTable, domainScansTable } from "@workspace/db";
import { eq, and, between, gte, or, like, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import PDFDocument from "pdfkit";

const DEMO_DOMAIN  = "abc.com.tr";
const DEMO_COMPANY = "Örnek A.Ş.";

// ── Fonts (Unicode-capable, Turkish-safe) ─────────────────────────────────────
const FONT_DIR     = "/usr/share/fonts/truetype/dejavu";
const FONT_REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
const FONT_BOLD    = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

// ── CyberStep brand palette ───────────────────────────────────────────────────
const CS_DARK:  [number, number, number] = [6, 13, 26];
const CS_PANEL: [number, number, number] = [7, 24, 40];
const CS_CARD:  [number, number, number] = [12, 47, 71];
const CS_CYAN:  [number, number, number] = [0, 200, 255];
const CS_TEXT:  [number, number, number] = [232, 237, 245];
const CS_MUTED: [number, number, number] = [123, 143, 175];
const CS_DANGER:[number, number, number] = [255, 69, 96];
const CS_AMBER: [number, number, number] = [245, 166, 35];
const CS_WHITE: [number, number, number] = [255, 255, 255];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDemoDir(): string {
  const dir = path.join(process.cwd(), "public", "demo");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  return domains ? `https://${domains.split(",")[0]?.trim()}` : "http://localhost:80";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}(.*?)`{1,3}/gs, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function demoScoreColor(s: number): [number, number, number] {
  if (s >= 80) return CS_CYAN;
  if (s >= 60) return [0, 200, 170];
  if (s >= 40) return CS_AMBER;
  return CS_DANGER;
}

function demoScoreLabel(s: number): string {
  if (s >= 80) return "İyi";
  if (s >= 60) return "Orta";
  if (s >= 40) return "Zayıf";
  return "Kritik";
}

function badgeStyle(badge: string): { bg: [number, number, number]; text: [number, number, number] } {
  const b = badge.toLowerCase();
  if (/geç|aktif|var|temiz|iyi|ok/.test(b))
    return { bg: [22, 78, 46], text: [134, 239, 172] };
  if (/başarı|eksik|risk|acil|kritik|başa/.test(b))
    return { bg: [127, 29, 29], text: [252, 165, 165] };
  if (/dikkat|uyarı|orta/.test(b))
    return { bg: [120, 53, 15], text: [253, 186, 116] };
  return { bg: CS_CARD, text: CS_CYAN };
}

function anonymizeScan(scan: Record<string, unknown>): Record<string, unknown> {
  return {
    ...scan,
    domain: DEMO_DOMAIN,
    email: "info@abc.com.tr",
    originIp: scan["originIp"] ? String(scan["originIp"]).replace(/(\d+\.\d+)\.\d+\.\d+/, "$1.x.x") : null,
    ctSubdomains: ((scan["ctSubdomains"] as string[]) || []).map((_: string, i: number) => `srv${i + 1}.abc.com.tr`),
    hibpBreaches: ((scan["hibpBreaches"] as Array<Record<string, unknown>>) || []).map((b) => ({
      ...b,
      emails: [],
    })),
  };
}

async function callClaude(
  prompt: string,
  model = "claude-haiku-4-5",
  maxTokens = 400,
): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content[0];
    return block?.type === "text" ? block.text : "";
  } catch (err) {
    logger.warn({ err }, "Demo AI call failed, using fallback");
    return "Bu örnek rapor, gerçek müşteri verilerinden anonimleştirilerek hazırlanmıştır.";
  }
}

// ── PDF Section interface ─────────────────────────────────────────────────────

interface PDFSection {
  title: string;
  content: string;
  badge?: string;
}

// ── Core PDF builder — CyberStep dark brand style ─────────────────────────────

async function buildDemoPDF(params: {
  type: string;
  score: number;
  sections: PDFSection[];
  today: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
      autoFirstPage: false,
    });
    const buffers: Buffer[] = [];
    doc.on("data", (c: Buffer) => buffers.push(c));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const W       = 595;
    const H       = 842;
    const MARGIN  = 48;
    const CW      = W - MARGIN * 2;

    // ── Shield icon (identical to pdf.ts) ──────────────────────────────────
    const drawShield = (x: number, y: number, size: number) => {
      const f = size / 48;
      doc.save();
      doc.translate(x, y);
      doc.scale(f, f);
      doc.fillColor(CS_DARK).strokeColor(CS_CYAN).lineWidth(2)
        .path("M24 3 L42 10 L42 26 C42 35 34 42 24 46 C14 42 6 35 6 26 L6 10 Z")
        .fillAndStroke();
      doc.fillColor(CS_CYAN)
        .path("M17 30 L17 26 L22 26 L22 22 L17 22 L17 18 L31 18 L31 22 L26 22 L26 26 L31 26 L31 30 Z")
        .fill();
      for (const [px, py] of [[17, 18], [31, 18], [17, 30], [31, 30]] as [number, number][]) {
        doc.fillColor(CS_CYAN).circle(px, py, 2).fill();
      }
      doc.restore();
    };

    // ── Per-page header ─────────────────────────────────────────────────────
    let headerActive = false;

    const drawHeader = () => {
      doc.save();
      doc.rect(0, 0, W, 36).fill(CS_DARK);
      drawShield(MARGIN, 7, 22);
      doc.font(FONT_BOLD).fontSize(13);
      const cw = doc.widthOfString("Cyber");
      const sw = doc.widthOfString("Step");
      doc.fillColor(CS_TEXT).text("Cyber", MARGIN + 28, 11, { lineBreak: false, height: 0 });
      doc.fillColor(CS_CYAN).text("Step",  MARGIN + 28 + cw, 11, { lineBreak: false, height: 0 });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8)
        .text(".io", MARGIN + 28 + cw + sw, 13, { lineBreak: false, height: 0 });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8.5)
        .text(params.type, MARGIN, 13, { align: "right", width: CW, lineBreak: false, height: 0 });
      doc.restore();
    };

    doc.on("pageAdded", () => {
      if (!headerActive) return;
      drawHeader();
      doc.y = 52;
    });

    // ── Per-page footer (written at end via bufferedPageRange) ──────────────
    const drawFooter = (pageNum: number, totalPages: number) => {
      const PH = doc.page.height;
      doc.save();
      doc.rect(0, PH - 36, W, 36).fill(CS_DARK);
      drawShield(MARGIN, PH - 29, 18);
      doc.font(FONT_BOLD).fontSize(10);
      const fcw = doc.widthOfString("Cyber");
      const fsw = doc.widthOfString("Step");
      doc.fillColor(CS_TEXT).text("Cyber", MARGIN + 24, PH - 23, { lineBreak: false, height: 0 });
      doc.fillColor(CS_CYAN).text("Step",  MARGIN + 24 + fcw, PH - 23, { lineBreak: false, height: 0 });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7)
        .text(".io", MARGIN + 24 + fcw + fsw, PH - 23, { lineBreak: false, height: 0 });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7.5)
        .text(`DEMO RAPORU  |  ${DEMO_DOMAIN}  |  CyberStep.io`,
          MARGIN, PH - 23, { align: "center", width: CW, lineBreak: false, height: 0 });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7.5)
        .text(`${pageNum} / ${totalPages}`,
          MARGIN, PH - 23, { align: "right", width: CW, lineBreak: false, height: 0 });
      doc.restore();
    };

    // ── Layout helpers ──────────────────────────────────────────────────────
    const checkBreak = (needed: number) => {
      if (doc.y + needed > doc.page.height - 52) doc.addPage();
    };

    const sectionTitle = (title: string) => {
      checkBreak(44);
      doc.rect(MARGIN, doc.y, CW, 1).fill(CS_CYAN);
      doc.y += 7;
      doc.fillColor(CS_TEXT).fontSize(11).font(FONT_BOLD).text(title, MARGIN, doc.y);
      doc.y += 16;
    };

    // ── COVER PAGE ──────────────────────────────────────────────────────────
    doc.addPage();

    // Full dark background + decorative circles
    doc.rect(0, 0, W, H).fill(CS_DARK);
    doc.circle(W + 60,  -60, 310).lineWidth(0.5).strokeColor(CS_CARD).stroke();
    doc.circle(W + 130, 160, 210).lineWidth(0.5).strokeColor(CS_CARD).stroke();

    // Logo
    drawShield(MARGIN, 50, 36);
    doc.font(FONT_BOLD).fontSize(22);
    const cyberW = doc.widthOfString("Cyber");
    const stepW  = doc.widthOfString("Step");
    doc.fillColor(CS_TEXT).text("Cyber", MARGIN + 44, 52, { lineBreak: false });
    doc.fillColor(CS_CYAN).text("Step",  MARGIN + 44 + cyberW, 52, { lineBreak: false });
    doc.font(FONT_REGULAR).fontSize(14).fillColor(CS_MUTED)
      .text(".io", MARGIN + 44 + cyberW + stepW, 58, { lineBreak: false });

    // Report type badge (left) + DEMO badge (right)
    const BADGE_Y = 96;
    doc.rect(MARGIN, BADGE_Y, CW - 76, 18).fill(CS_PANEL);
    doc.fillColor(CS_CYAN).font(FONT_BOLD).fontSize(7.5)
      .text(params.type.toUpperCase(), MARGIN + 10, BADGE_Y + 5.5, { lineBreak: false });
    doc.rect(W - MARGIN - 68, BADGE_Y, 68, 18).fill([127, 29, 29]);
    doc.fillColor([252, 165, 165]).font(FONT_BOLD).fontSize(7.5)
      .text("DEMO RAPORU", W - MARGIN - 68, BADGE_Y + 5.5,
        { width: 68, align: "center", lineBreak: false });

    // Domain + company name
    const DOMAIN_Y = Math.floor(H * 0.36);
    doc.fillColor(CS_TEXT).font(FONT_BOLD).fontSize(26)
      .text(DEMO_DOMAIN, MARGIN, DOMAIN_Y, { width: W - MARGIN * 2 - 130, lineBreak: false });
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(9)
      .text(`${DEMO_COMPANY}  ·  ${params.today}`, MARGIN, DOMAIN_Y + 36);

    // Score gauge ring
    const scoreCol = demoScoreColor(params.score);
    const GX = W - MARGIN - 86;
    const GY = DOMAIN_Y + 52;
    const GR = 42;
    const GLW = 12;
    doc.circle(GX, GY, GR).lineWidth(GLW).strokeColor(CS_CARD).stroke();
    if (params.score > 0) {
      const ang = (Math.min(params.score, 99.9) / 100) * Math.PI * 2;
      (doc as unknown as {
        arc(x: number, y: number, r: number, s: number, e: number, cw?: boolean): typeof doc;
      }).arc(GX, GY, GR, -Math.PI / 2, -Math.PI / 2 + ang, false)
        .lineWidth(GLW).strokeColor(scoreCol).stroke();
    }
    doc.circle(GX, GY, GR - GLW / 2 - 2).fill(CS_DARK);
    const numW = GR * 1.6;
    doc.fillColor(scoreCol).font(FONT_BOLD).fontSize(18)
      .text(`${params.score}`, GX - numW / 2, GY - 12,
        { width: numW, align: "center", lineBreak: false });
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7)
      .text("/100", GX - numW / 2, GY + 7,
        { width: numW, align: "center", lineBreak: false });

    // Score label
    const LVL_Y = DOMAIN_Y + 80;
    doc.fillColor(scoreCol).font(FONT_BOLD).fontSize(16)
      .text(demoScoreLabel(params.score), MARGIN, LVL_Y);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8)
      .text("Örnek risk skoru · Gerçek veriden anonimleştirilmiştir", MARGIN, LVL_Y + 24, { width: 280 });

    // TR average comparison bar
    const BAR_Y = LVL_Y + 56;
    const CBAR_W = 150;
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7).text("TR Ort. 58", MARGIN, BAR_Y);
    doc.rect(MARGIN, BAR_Y + 13, CBAR_W, 4).fill(CS_CARD);
    doc.rect(MARGIN, BAR_Y + 13, CBAR_W * 0.58, 4).fill(CS_PANEL);
    doc.rect(MARGIN, BAR_Y + 13, CBAR_W * (params.score / 100), 4).fill(scoreCol);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7)
      .text(`Siz ${params.score}`, MARGIN + CBAR_W + 8, BAR_Y + 11);

    // Cover bottom line + "GİZLİ" badge
    const CVR_FOOT_Y = H - 50;
    doc.rect(MARGIN, CVR_FOOT_Y, CW, 0.5).fill(CS_CARD);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7.5)
      .text(`${DEMO_DOMAIN}  |  CyberStep.io — Demo Raporu`, MARGIN, CVR_FOOT_Y + 10);
    doc.rect(W - MARGIN - 52, CVR_FOOT_Y + 5, 52, 14).fill(CS_CARD);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(6.5)
      .text("GİZLİ", W - MARGIN - 52, CVR_FOOT_Y + 8.5,
        { width: 52, align: "center", lineBreak: false });

    // ── CONTENT PAGES ───────────────────────────────────────────────────────
    headerActive = true;
    doc.addPage(); // triggers pageAdded → drawHeader() + doc.y = 52

    for (const section of params.sections) {
      sectionTitle(section.title);

      // Badge (top-right of section)
      if (section.badge) {
        const { bg, text: txtColor } = badgeStyle(section.badge);
        const bY = doc.y - 16 - 6; // align with section title
        doc.rect(W - MARGIN - 68, bY + 2, 68, 14).fill(bg);
        doc.fillColor(txtColor).font(FONT_BOLD).fontSize(7)
          .text(section.badge, W - MARGIN - 68, bY + 5.5,
            { width: 68, align: "center", lineBreak: false });
      }

      const text = stripMarkdown(section.content);
      checkBreak(20);
      doc.fillColor(CS_TEXT).fontSize(9).font(FONT_REGULAR)
        .text(text, MARGIN, doc.y, {
          width: CW,
          lineGap: 4,
          paragraphGap: 5,
        });
      doc.y += 18;
    }

    // Disclaimer box
    checkBreak(52);
    doc.rect(MARGIN, doc.y, CW, 0.5).fill(CS_CARD);
    doc.y += 10;
    doc.rect(MARGIN, doc.y, CW, 36).fill(CS_PANEL);
    doc.rect(MARGIN, doc.y, 3, 36).fill(CS_CYAN);
    doc.fillColor(CS_MUTED).fontSize(7.5).font(FONT_REGULAR)
      .text(
        "Bu DEMO rapordur. Veriler gerçek bir taramadan anonimleştirilmiştir. " +
        "Kendi alan adınızı taratmak ve gerçek değerlendirme başlatmak için cyberstep.io adresini ziyaret edin. " +
        "© 2026 CyberStep.io — Tüm hakları saklıdır.",
        MARGIN + 12, doc.y + 8,
        { width: CW - 18, lineGap: 3 },
      );

    // Write footers on all content pages
    const range = doc.bufferedPageRange();
    const contentCount = range.count - 1; // page 0 = cover
    for (let i = 1; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(i, contentCount);
    }

    doc.end();
  });
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function saveDemoReport(params: {
  reportType: string;
  sourceDomain: string;
  sourceScanId: number;
  pdfPath: string;
  originalScore: number;
  displayScore: number;
}): Promise<void> {
  const pdfUrl = `${getBaseUrl()}/api/public/demo/reports/${path.basename(params.pdfPath)}`;
  await db.insert(demoReportsTable).values({
    reportType: params.reportType,
    sourceDomain: params.sourceDomain,
    sourceScanId: params.sourceScanId,
    pdfPath: params.pdfPath,
    pdfUrl,
    originalScore: params.originalScore,
    displayScore: params.displayScore,
    isActive: true,
  }).onConflictDoUpdate({
    target: demoReportsTable.reportType,
    set: {
      pdfPath: params.pdfPath,
      pdfUrl,
      displayScore: params.displayScore,
      generatedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

async function selectDomainForDemo(): Promise<Record<string, unknown> | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(domainScansTable)
    .where(
      and(
        between(domainScansTable.overallScore, 30, 55),
        or(
          like(domainScansTable.domain, "%.com.tr"),
          like(domainScansTable.domain, "%.net.tr"),
          like(domainScansTable.domain, "%.org.tr"),
        ),
        gte(domainScansTable.createdAt, thirtyDaysAgo),
      ),
    )
    .orderBy(desc(domainScansTable.id))
    .limit(5);

  if (rows.length > 0) return rows[0] as Record<string, unknown>;

  const fallback = await db
    .select()
    .from(domainScansTable)
    .where(between(domainScansTable.overallScore, 25, 60))
    .orderBy(desc(domainScansTable.id))
    .limit(1);

  return (fallback[0] as Record<string, unknown>) ?? null;
}

// ── Per-report-type generators ────────────────────────────────────────────────

async function generateEASMDemo(
  scan: Record<string, unknown>,
  original: Record<string, unknown>,
): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const summary = await callClaude(`
EASM degerlendirme raporu icin yonetici ozeti yaz.
Domain: abc.com.tr | Sirket: Ornek A.S. | Risk Skoru: ${score}/100
SSL gun: ${scan["sslDaysUntilExpiry"] ?? "?"} | DMARC: ${scan["dmarcRecord"] ? "Var" : "Yok"}
Kara liste: ${scan["blacklistCount"] ?? 0} | CVE: ${(scan["cveSummary"] as unknown[])?.length ?? 0}
Subdomain: ${scan["ctSubdomainCount"] ?? 0}
2-3 kisa paragraf, CEO dili, Turkce, duz metin (markdown kullanma).
`);

  const sections: PDFSection[] = [
    {
      title: "Yönetici Özeti",
      content: summary,
    },
    {
      title: "SSL Sertifika Durumu",
      content: `Geçerlilik: ${scan["sslDaysUntilExpiry"] ?? "Bilinmiyor"} gün  |  Veren: ${scan["sslIssuer"] ?? "-"}`,
      badge: scan["sslPass"] ? "Aktif" : "Risk",
    },
    {
      title: "E-posta Güvenliği (SPF / DMARC / DKIM)",
      content: `SPF: ${scan["spfPass"] ? "Aktif" : "Eksik"}  |  DMARC: ${scan["dmarcRecord"] ? "Var" : "Yok"}  |  DKIM: ${scan["dkimPass"] ? "Aktif" : "Eksik"}\n\nE-posta kimliği doğrulama kayıtları, alan adınızdan gelen mesajların sahte olmadığını kanıtlar. Eksik kayıtlar phishing saldırılarına zemin hazırlar.`,
      badge: scan["dmarcRecord"] && scan["spfPass"] ? "Geçti" : "Eksik",
    },
    {
      title: "Kara Liste Durumu",
      content: `${scan["blacklistCount"] ?? 0} listede kayıtlı  |  URLhaus: ${scan["urlhausListed"] ? "Evet" : "Hayır"}  |  USOM: ${scan["usomListed"] ? "Evet" : "Hayır"}\n\nKara liste kaydı, alan adının spam veya zararlı içerik yaymak için kullanıldığını gösterir. E-posta teslim edilebilirliğini doğrudan etkiler.`,
      badge: Number(scan["blacklistCount"]) > 0 ? "Dikkat" : "Temiz",
    },
    {
      title: "CVE / Güvenlik Açıkları",
      content: `Tespit edilen CVE: ${(scan["cveSummary"] as unknown[])?.length ?? 0}  |  Shodan açık port: ${(scan["shodanOpenPorts"] as unknown[])?.length ?? 0}\n\nBilinen yazılım güvenlik açıkları, saldırganların sisteme yetkisiz erişim sağlamak için kullandığı yollardır. CVSS skoru 7.0 ve üzeri olanlar öncelikli yamalanmalıdır.`,
    },
    {
      title: "Subdomain Envanteri (CT Log)",
      content: `Toplam subdomain: ${scan["ctSubdomainCount"] ?? 0}  |  Örnek: ${((scan["ctSubdomains"] as string[]) || []).slice(0, 3).join(", ") || "-"}\n\nCertificate Transparency loglarında kayıtlı alt alan adları, saldırganların hedef listesine girer. Kullanılmayan subdomainler kapatılmalıdır.`,
    },
    {
      title: "Öncelikli Aksiyon Önerileri",
      content: "1. DMARC politikasını p=reject moduna alın — sahte e-posta riskini ortadan kaldırır.\n2. SSL sertifika yenileme sürecini otomatize edin (Let's Encrypt Certbot).\n3. Açık portları gözden geçirin; gereksiz servisleri kapatın.\n4. Subdomain envanterini güncelleyin; kullanılmayan kayıtları silin.",
    },
  ];

  const buf      = await buildDemoPDF({ type: "EASM Değerlendirme Raporu", score, sections, today });
  const filename = `demo-easm-${Date.now()}.pdf`;
  const filePath = path.join(getDemoDir(), filename);
  fs.writeFileSync(filePath, buf);

  await saveDemoReport({
    reportType: "easm",
    sourceDomain: String(original["domain"]),
    sourceScanId: Number(original["id"]),
    pdfPath: filePath,
    originalScore: Number(original["overallScore"]),
    displayScore: score,
  });
  logger.info("Demo EASM raporu üretildi");
}

async function generateEmailSecurityDemo(
  scan: Record<string, unknown>,
  original: Record<string, unknown>,
): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const summary = await callClaude(`
E-posta guvenligi raporu icin ozet yaz.
Domain: abc.com.tr | SPF: ${scan["spfPass"] ? "Aktif" : "Eksik"} | DMARC: ${scan["dmarcRecord"] ? "Var" : "Yok"} | DKIM: ${scan["dkimPass"] ? "Aktif" : "Eksik"}
HIBP ihlal: ${scan["hibpBreachCount"] ?? 0} | Kara liste: ${scan["blacklistCount"] ?? 0}
2 kisa paragraf, is odakli, Turkce, duz metin (markdown kullanma).
`);

  const sections: PDFSection[] = [
    {
      title: "Özet",
      content: summary,
    },
    {
      title: "SPF Kaydı (Sender Policy Framework)",
      content: scan["spfPass"]
        ? `Aktif — ${scan["spfRecord"] ?? "Kayıt mevcut"}\n\nSPF kaydı, alan adınız adına e-posta göndermeye yetkili sunucuları tanımlar. Aktif durumda.`
        : "SPF kaydı bulunamadı. Saldırganlar alan adınız üzerinden sahte e-posta gönderebilir.\n\nÖneri: DNS panelinden TXT kaydı olarak SPF politikası ekleyin.",
      badge: scan["spfPass"] ? "Geçti" : "Başarısız",
    },
    {
      title: "DMARC Politikası",
      content: scan["dmarcRecord"]
        ? `Kayıt mevcut: ${String(scan["dmarcRecord"]).substring(0, 100)}\n\nDMARC politikası, SPF/DKIM doğrulaması başarısız olan e-postalar için ne yapılacağını belirler.`
        : "DMARC kaydı yok. Kimlik avı saldırılarına karşı koruma eksik.\n\nÖneri: _dmarc.abc.com.tr TXT kaydı oluşturun, başlangıçta p=none ile izleme modunda başlayın.",
      badge: scan["dmarcRecord"] ? "Var" : "Eksik",
    },
    {
      title: "DKIM İmzalama",
      content: scan["dkimPass"]
        ? "DKIM aktif — e-posta bütünlüğü doğrulanmış. Alıcı sunucular mesajın yolda değiştirilmediğini kanıtlayabilir."
        : "DKIM bulunamadı. E-posta manipülasyon riski mevcut.\n\nÖneri: E-posta servis sağlayıcınızdan DKIM anahtarı alın ve DNS'e ekleyin. 6 ayda bir selector rotasyonu yapın.",
      badge: scan["dkimPass"] ? "Aktif" : "Eksik",
    },
    {
      title: "HIBP Veri İhlali Kontrolü",
      content: `Bilinen ihlal sayısı: ${scan["hibpBreachCount"] ?? 0}\n\n${Number(scan["hibpBreachCount"]) > 0
        ? "Sızdırılmış kimlik bilgileri tespit edildi. Etkilenen çalışanların parolalarını sıfırlatın ve çok faktörlü doğrulama (MFA) zorunlu hale getirin."
        : "Bilinen veri ihlali kaydı bulunmamaktadır. Periyodik kontrol önerilir."}`,
      badge: Number(scan["hibpBreachCount"]) > 0 ? "Dikkat" : "Temiz",
    },
    {
      title: "Kara Liste Kontrolü (15+ liste)",
      content: `${scan["blacklistCount"] ?? 0} listede kayıtlı\n\n${Number(scan["blacklistCount"]) > 0
        ? "E-posta teslim edilebilirliği olumsuz etkilenebilir. Kara listeden çıkma (delist) işlemi için ilgili liste operatörlerine başvurun."
        : "Temiz — hiçbir kara listede kayıt yok. E-postalarınız inbox'a ulaşabilir durumda."}`,
      badge: Number(scan["blacklistCount"]) > 0 ? "Dikkat" : "Temiz",
    },
    {
      title: "Düzeltme Kılavuzu",
      content:
        "1. DMARC policy=reject olarak ayarlayın (önce p=none ile izleyin, ardından p=quarantine, son olarak p=reject).\n" +
        "2. Tüm gönderici subdomain için SPF -all kuralını ekleyin.\n" +
        "3. DKIM selector rotasyonu yapın (6 ayda bir).\n" +
        "4. Çalışanlarınıza phishing farkındalık eğitimi verin.",
    },
  ];

  const buf      = await buildDemoPDF({ type: "E-posta Güvenliği Denetimi", score, sections, today });
  const filename = `demo-email-security-${Date.now()}.pdf`;
  const filePath = path.join(getDemoDir(), filename);
  fs.writeFileSync(filePath, buf);

  await saveDemoReport({
    reportType: "email_security",
    sourceDomain: String(original["domain"]),
    sourceScanId: Number(original["id"]),
    pdfPath: filePath,
    originalScore: Number(original["overallScore"]),
    displayScore: score,
  });
  logger.info("Demo e-posta güvenliği raporu üretildi");
}

async function generateBoardReportDemo(
  scan: Record<string, unknown>,
  original: Record<string, unknown>,
): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const baseRisk      = 8_500_000;
  const mult          = (100 - score) / 100;
  const riskLow       = Math.round(baseRisk * mult * 0.15).toLocaleString("tr-TR");
  const riskHigh      = Math.round(baseRisk * mult * 0.50).toLocaleString("tr-TR");
  const compliance7545 = Math.round(score * 0.8);
  const kvkkPct       = Math.round(score * 0.75);

  const summary = await callClaude(`
Yonetim kurulu guvenlik raporu ozeti yaz.
Sirket: Ornek A.S. | Risk skoru: ${score}/100
7545 Kanunu uyum: %${compliance7545} | KVKK: %${kvkkPct}
Finansal risk: ${riskLow} — ${riskHigh} TL
3 kisa paragraf, CEO/CFO diline uygun, Turkce, duz metin (markdown kullanma).
`, "claude-haiku-4-5", 500);

  const sections: PDFSection[] = [
    {
      title: "Yönetici Özeti",
      content: summary,
    },
    {
      title: "Güvenlik Skoru",
      content: `${score}/100 — ${demoScoreLabel(score)}. Bir önceki dönemden +3 puan artış.\n\nSkor; e-posta güvenliği, SSL altyapısı, açık port durumu, kara liste kontrolü ve veri sızıntısı geçmişi bileşenlerinden hesaplanmaktadır.`,
      badge: demoScoreLabel(score),
    },
    {
      title: "7545 Siber Güvenlik Kanunu Uyumu",
      content: `Uyum oranı: %${compliance7545}\n\nEksik maddeler: Log yönetimi politikası, Olay müdahale planı güncellemesi, Tedarikçi risk değerlendirmesi.\n\nTamamlanması gereken aksiyonlar için Q3 2026 hedefi belirlenmelidir.`,
      badge: compliance7545 >= 70 ? "Geçti" : "Dikkat",
    },
    {
      title: "KVKK Uyumu",
      content: `KVKK uyum skoru: %${kvkkPct}\n\nVeri ihlali bildirim süreci tanımlanmış. Veri envanteri son güncelleme tarihi: 6 ay önce — güncelleme gerekiyor.\n\nKVKK kapsamındaki kişisel veri kategorileri için veri işleme aydınlatma metinleri gözden geçirilmelidir.`,
      badge: kvkkPct >= 70 ? "Geçti" : "Dikkat",
    },
    {
      title: "Tahmini Finansal Risk",
      content: `${riskLow} — ${riskHigh} TL\n\nFidye yazılımı veya veri sızıntısı senaryosunda beklenen maliyet aralığı. Hesaplama; iş duruşu, veri kurtarma, KVKK cezası ve itibar kaybı bileşenlerini içermektedir.\n\nKarşılaştırma: Türkiye'de KOBİ'lerin siber sigorta yıllık prim ortalaması 85.000 TL.`,
    },
    {
      title: "Gelecek Dönem Odak Alanları",
      content:
        "1. Olay müdahale planı tatbikatı yapılması — Q3 2026.\n" +
        "2. Tedarikçi risk değerlendirmesinin tamamlanması — 30 gün içinde.\n" +
        "3. Çalışanlara e-posta güvenliği farkındalık eğitimi — Q2 2026.",
    },
    {
      title: "Yönetim Kararı Gerektiren Konular",
      content:
        "1. KVKK veri envanteri güncelleme bütçesi onayı — tahmini 45.000 TL.\n" +
        "2. SOC hizmeti alım kararı — Q3 2026 için teklif toplama sürecinin başlatılması.\n" +
        "3. Siber sigorta poliçesi değerlendirmesi — mevcut teminat yeterliliği sorgulanmalı.",
    },
  ];

  const buf      = await buildDemoPDF({ type: "Yönetim Kurulu Güvenlik Raporu", score, sections, today });
  const filename = `demo-board-report-${Date.now()}.pdf`;
  const filePath = path.join(getDemoDir(), filename);
  fs.writeFileSync(filePath, buf);

  await saveDemoReport({
    reportType: "board_report",
    sourceDomain: String(original["domain"]),
    sourceScanId: Number(original["id"]),
    pdfPath: filePath,
    originalScore: Number(original["overallScore"]),
    displayScore: score,
  });
  logger.info("Demo yönetim kurulu raporu üretildi");
}

async function generateCVEAlertDemo(
  scan: Record<string, unknown>,
  original: Record<string, unknown>,
): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });
  const cves = (scan["cveSummary"] as Array<{
    service?: string;
    cveId?: string;
    description?: string;
    cvssScore?: number;
  }>) || [];

  const summary = await callClaude(`
CVE alarm raporu icin ozet yaz.
Domain: abc.com.tr | Tespit edilen CVE: ${cves.length}
En yuksek CVSS: ${cves[0]?.cvssScore ?? "Yok"}
2 kisa paragraf, teknik dil, Turkce, duz metin (markdown kullanma).
`);

  const cveListText =
    cves.length > 0
      ? cves
          .slice(0, 5)
          .map(
            (c, i) =>
              `${i + 1}. ${c.cveId ?? "?"} — CVSS: ${c.cvssScore ?? "?"} — ${(c.description ?? "").substring(0, 70)}`,
          )
          .join("\n")
      : "Bu taramada aktif CVE tespit edilmedi.\n\nÖrnek (demo): CVE-2024-21626, CVSS 8.6 — Container escape güvenlik açığı. CISA KEV listesine eklenmiştir.";

  const sections: PDFSection[] = [
    { title: "Özet", content: summary },
    {
      title: "Tespit Edilen CVE Listesi (İlk 5)",
      content: cveListText,
      badge: cves.length > 0 ? "Kritik" : "Temiz",
    },
    {
      title: "EPSS Önceliklendirme",
      content:
        "EPSS (Exploit Prediction Scoring System) skoru 0.5 üzeri olan CVE'ler aktif istismar riski taşır ve kritik önceliklidir.\n\nCISA KEV (Known Exploited Vulnerabilities) listesindeki açıklar federal zorunluluk kapsamında 24 saat içinde yamalanmalıdır.",
    },
    {
      title: "Etkilenen Servisler",
      content:
        (cves.slice(0, 3).map((c) => c.service ?? "Bilinmiyor").join(", ") ||
          "Shodan üzerinden tespit edilen servisler analiz edildi.") +
        "\n\nEtkilenen servislerin sürüm bilgilerini doğrulayın ve üretici güvenlik bültenlerini takip edin.",
    },
    {
      title: "Yama Takvimi",
      content:
        "Kritik (CVSS 9.0+): 24 saat içinde\n" +
        "Yüksek (CVSS 7.0-8.9): 7 gün içinde\n" +
        "Orta (CVSS 4.0-6.9): 30 gün içinde\n" +
        "Düşük (CVSS < 4.0): 90 gün içinde",
    },
    {
      title: "Aksiyon Önerileri",
      content:
        "1. Patch management sürecini otomatize edin — manuel takip insan hatasına açıktır.\n" +
        "2. Üretim ortamına geçmeden önce yamaları test/staging ortamında doğrulayın.\n" +
        "3. Yama uygulanamıyorsa sanal yama (virtual patching) için WAF kuralı oluşturun.",
    },
  ];

  const buf      = await buildDemoPDF({ type: "CVE Güvenlik Açığı Alarmı", score, sections, today });
  const filename = `demo-cve-alert-${Date.now()}.pdf`;
  const filePath = path.join(getDemoDir(), filename);
  fs.writeFileSync(filePath, buf);

  await saveDemoReport({
    reportType: "cve_alert",
    sourceDomain: String(original["domain"]),
    sourceScanId: Number(original["id"]),
    pdfPath: filePath,
    originalScore: Number(original["overallScore"]),
    displayScore: score,
  });
  logger.info("Demo CVE alarm raporu üretildi");
}

async function generateTPRMDemo(
  scan: Record<string, unknown>,
  original: Record<string, unknown>,
): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const suppliers = [
    { name: "Tedarikçi-1 (Yazılım)", domain: "supplier1.com.tr", risk: "B", score: 62 },
    { name: "Tedarikçi-2 (BT Altyapı)", domain: "supplier2.net.tr", risk: "D", score: 38 },
    { name: "Tedarikçi-3 (Lojistik)", domain: "supplier3.com", risk: "C", score: 51 },
  ];

  const sections: PDFSection[] = [
    {
      title: "Özet",
      content:
        `3 tedarikçi analiz edildi. 1 kritik risk (D sınıfı) tespit edildi. ${DEMO_COMPANY} adına BDDK 3. taraf uyum çerçevesinde değerlendirildi.\n\n` +
        "Tedarikçi güvenlik olgunluğu, organizasyonun genel siber güvenlik duruşunu doğrudan etkiler. Zayıf tedarikçi bir saldırı vektörüne dönüşebilir.",
    },
    {
      title: "Tedarikçi Risk Matrisi",
      content: suppliers
        .map((s) => `${s.name}: Risk Sınıfı ${s.risk}  |  Skor ${s.score}/100  |  ${s.domain}`)
        .join("\n"),
    },
    {
      title: "Kritik Bulgular — Tedarikçi-2",
      content:
        "DMARC yok, 3 kara listede kayıtlı, son HIBP ihlali 4 ay önce.\n\n" +
        "BDDK YG/31 çerçevesinde 30 gün içinde düzeltme talep edilmeli. " +
        "Tedarikçi ile düzeltici faaliyet planı (CAP) oluşturularak takip edilmelidir.",
      badge: "Acil",
    },
    {
      title: "HIBP İhlal Özeti",
      content:
        "Tedarikçi-2: 2 ihlal (Ocak 2024, Mart 2024). Etkilenen veri: E-posta adresleri, parola hash'leri.\n\n" +
        "İhlal edilen kimlik bilgilerinin credential stuffing saldırılarında kullanılma riski bulunmaktadır.",
      badge: "Dikkat",
    },
    {
      title: "DMARC / SPF Durumu",
      content:
        "Tedarikçi-1: SPF + DMARC aktif — iyi güvenlik duruşu.\n" +
        "Tedarikçi-2: Her ikisi de eksik — sahte e-posta riski yüksek.\n" +
        "Tedarikçi-3: Yalnızca SPF aktif — DMARC eklenmesi gerekiyor.",
    },
    {
      title: "Aksiyon Önerileri",
      content:
        "1. Tedarikçi-2 ile 30 gün aksiyon planı tablosu oluşturun ve haftalık takip yapın.\n" +
        "2. Tedarikçi-3'ten DMARC enforce taahhüdünü yazılı alın.\n" +
        "3. Çeyreklik yeniden tarama planlayın — tedarikçi güvenlik durumu değişkendir.",
    },
  ];

  const buf      = await buildDemoPDF({ type: "Tedarikçi Risk Yönetimi (TPRM)", score, sections, today });
  const filename = `demo-tprm-${Date.now()}.pdf`;
  const filePath = path.join(getDemoDir(), filename);
  fs.writeFileSync(filePath, buf);

  await saveDemoReport({
    reportType: "tprm",
    sourceDomain: String(original["domain"]),
    sourceScanId: Number(original["id"]),
    pdfPath: filePath,
    originalScore: Number(original["overallScore"]),
    displayScore: score,
  });
  logger.info("Demo TPRM raporu üretildi");
}

async function generateThreatIntelDemo(
  scan: Record<string, unknown>,
  original: Record<string, unknown>,
): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const sections: PDFSection[] = [
    {
      title: "Haftalık IOC Özeti",
      content:
        `Bu hafta 1.247 yeni IP adresi, 89 alan adı ve 23 dosya hash'i tanımlandı. ` +
        `CISA KEV güncellemesi: 4 yeni CVE eklendi. Finans sektörü odaklı kampanya aktivitesi artış gösterdi.`,
    },
    {
      title: "Yüksek Riskli IP Adresleri (Örnek)",
      content:
        "185.x.x.x — Cobalt Strike C2 sunucusu (Feodo Tracker)\n" +
        "91.x.x.x  — Ransomware dağıtım altyapısı (ThreatFox)\n" +
        "45.x.x.x  — Kimlik avı yönlendirme (URLhaus)\n\n" +
        "Bu IP aralıkları ağ güvenlik duvarı kurallarınıza eklenmelidir.",
      badge: "Kritik",
    },
    {
      title: "CISA KEV — Son 7 Gün",
      content:
        "CVE-2024-21626 — runC container escape, EPSS 0.94, CVSS 8.6\n" +
        "CVE-2024-3400  — PAN-OS RCE, EPSS 0.98, CVSS 10.0\n" +
        "CVE-2023-48788 — Fortinet SQLi, EPSS 0.91, CVSS 9.8\n\n" +
        "CISA KEV'deki açıklar aktif istismar altındadır. 24 saat içinde yamalama zorunludur.",
      badge: "Kritik",
    },
    {
      title: "FortiGate Address Object Push",
      content: `Otomatik güncellenen cihaz: 1 adet  |  Son güncelleme: ${today}  |  Yeni eklenen kural: 847\n\nFortiGate entegrasyonu aktif tehditleri otomatik olarak engel listesine ekler.`,
      badge: "Aktif",
    },
    {
      title: "USOM & Türkiye Odaklı Tehditler",
      content:
        "Bu hafta USOM, 14 yeni .tr domain'i kara listesine aldı. " +
        "Finans sektörüne yönelik phishing kampanyası tespit edildi — hedef: internet bankacılığı kullanıcıları.\n\n" +
        "Çalışanlarınıza bu dönem sosyal mühendislik girişimlerine karşı uyarı yapılması önerilir.",
    },
    {
      title: "Sonraki Hafta Odak",
      content:
        "Exchange Server on-premise kurulumlarında yeni RCE zafiyeti raporlandı. " +
        "Sunucu versiyonlarınızı kontrol edin ve Microsoft güvenlik güncellemesini uygulayın.\n\n" +
        "Önerilen izleme: MS-ISAC bülteni, USOM haftalık raporu, CISA KEV feed.",
    },
  ];

  const buf      = await buildDemoPDF({ type: "Tehdit İstihbaratı Özeti", score, sections, today });
  const filename = `demo-threat-intel-${Date.now()}.pdf`;
  const filePath = path.join(getDemoDir(), filename);
  fs.writeFileSync(filePath, buf);

  await saveDemoReport({
    reportType: "threat_intel",
    sourceDomain: String(original["domain"]),
    sourceScanId: Number(original["id"]),
    pdfPath: filePath,
    originalScore: Number(original["overallScore"]),
    displayScore: score,
  });
  logger.info("Demo tehdit istihbaratı raporu üretildi");
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateAllDemoReports(): Promise<void> {
  const sourceScan = await selectDomainForDemo();

  const fakeScan: Record<string, unknown> = {
    id: 0,
    domain: "example.com.tr",
    overallScore: 43,
    spfPass: false,
    dmarcRecord: null,
    dkimPass: false,
    sslPass: true,
    sslDaysUntilExpiry: 45,
    sslIssuer: "Let's Encrypt",
    blacklistCount: 2,
    hibpBreachCount: 3,
    urlhausListed: false,
    usomListed: true,
    cveSummary: [],
    ctSubdomains: [],
    ctSubdomainCount: 4,
    shodanOpenPorts: [],
  };

  const source    = sourceScan ?? fakeScan;
  const anonScan  = anonymizeScan(source);

  if (!sourceScan) {
    logger.warn("Demo üretimi için uygun domain bulunamadı — örnek veri kullanılacak");
  } else {
    logger.info({ source: source["domain"], score: source["overallScore"] }, "Demo rapor üretimi başlıyor");
  }

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
      await gen(anonScan, source);
      await sleep(1200);
    } catch (err) {
      logger.error({ err, gen: gen.name }, "Demo rapor üretim hatası");
    }
  }

  logger.info("Tüm demo raporlar güncellendi");
}

export async function getDemoReportList(): Promise<typeof demoReportsTable.$inferSelect[]> {
  return db
    .select()
    .from(demoReportsTable)
    .where(eq(demoReportsTable.isActive, true))
    .orderBy(demoReportsTable.id);
}

export async function serveDemoPDF(filename: string): Promise<string | null> {
  if (!filename.startsWith("demo-") || !filename.endsWith(".pdf")) return null;
  const filePath = path.join(getDemoDir(), filename);
  return fs.existsSync(filePath) ? filePath : null;
}

export { demoLeadsTable };
