import PDFDocument from "pdfkit";
import path from "path";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getClaudeAiFn } from "../ai-client";
import { logger } from "../../lib/logger";
import { getRiskLevel } from "./riskScoreCalculator";
import type { ExecutiveReportData } from "./reportDataCollector";

const FONT_DIR     = "/usr/share/fonts/truetype/dejavu";
const FONT_REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
const FONT_BOLD    = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

const CS_DARK:   [number,number,number] = [6,  13,  26 ];
const CS_PANEL:  [number,number,number] = [7,  24,  40 ];
const CS_CARD:   [number,number,number] = [12, 47,  71 ];
const CS_CYAN:   [number,number,number] = [0,  200, 255];
const CS_AMBER:  [number,number,number] = [245,166, 35 ];
const CS_GREEN:  [number,number,number] = [22, 163, 74 ];
const CS_ORANGE: [number,number,number] = [234, 88, 12 ];
const CS_DANGER: [number,number,number] = [255, 69,  96];
const CS_TEXT:   [number,number,number] = [232,237, 245];
const CS_MUTED:  [number,number,number] = [123,143, 175];

function riskColor(score: number): [number,number,number] {
  if (score >= 80) return CS_GREEN;
  if (score >= 60) return CS_AMBER;
  if (score >= 40) return CS_ORANGE;
  return CS_DANGER;
}

function trMonth(isoMonth: string): string {
  const [y, m] = isoMonth.split("-");
  const months = ["", "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
                  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  return `${months[parseInt(m ?? "1", 10)] ?? m} ${y}`;
}

async function claudeSummary(data: ExecutiveReportData): Promise<string> {
  try {
    const prompt =
      `Şu verilere göre bir CISO'ya yönelik 3 cümlelik Türkçe yönetici özeti yaz. ` +
      `Teknik jargon kullanma, iş riski ve aksiyon odaklı ol. Veriler: ` +
      `risk_score: ${data.riskScoreCurrent}, critical_cve: ${data.criticalCveCount}, ` +
      `brand_threats: ${data.brandSuspiciousCount}, ssl_expiring: ${data.sslExpiringCount}, ` +
      `blacklisted: ${data.blacklistedCount}. Max 80 kelime.`;
    const text = await getClaudeAiFn("security-report")(prompt);
    return text.trim().slice(0, 600);
  } catch (err) {
    logger.warn({ err }, "executive PDF: Claude summary failed, using fallback");
    const rl = getRiskLevel(data.riskScoreCurrent);
    return (
      `${data.companyName ?? "Şirketiniz"} için bu aydaki siber güvenlik risk skoru ${data.riskScoreCurrent}/100 olup ` +
      `"${rl.label}" kategorisindedir. ` +
      (data.criticalCveCount > 0
        ? `${data.criticalCveCount} kritik güvenlik açığı tespit edilmiş olup acil aksiyon gerekmektedir. `
        : "Kritik güvenlik açığı tespit edilmemiştir. ") +
      `Marka koruma taramasında ${data.brandSuspiciousCount} şüpheli domain bulunmuştur.`
    );
  }
}

async function claudeActions(data: ExecutiveReportData): Promise<string[]> {
  try {
    const prompt =
      `Şu güvenlik verilerine göre 3 somut, öncelikli aksiyon öner. ` +
      `Her aksiyon: "Aksiyon N: [başlık] — [1 cümle açıklama]" formatında. ` +
      `Türkçe, iş dili. Veriler: risk_score=${data.riskScoreCurrent}, ` +
      `critical_cve=${data.criticalCveCount}, high_cve=${data.highCveCount}, ` +
      `brand_suspicious=${data.brandSuspiciousCount}, ssl_expiring=${data.sslExpiringCount}, ` +
      `blacklisted=${data.blacklistedCount}, high_risk_ports=${data.highRiskPortsCount}.`;
    const text = await getClaudeAiFn("security-report")(prompt);
    const lines = text.split("\n").filter(l => l.trim().startsWith("Aksiyon"));
    if (lines.length >= 2) return lines.slice(0, 3).map(l => l.trim());
  } catch (err) {
    logger.warn({ err }, "executive PDF: Claude actions failed, using fallback");
  }
  // Fallback
  const actions: string[] = [];
  if (data.criticalCveCount > 0) actions.push(`Aksiyon 1: Kritik CVE Kapatma — ${data.criticalCveCount} kritik açık için yama takvimi oluşturun ve 2 hafta içinde kapatın.`);
  if (data.brandSuspiciousCount > 0) actions.push(`Aksiyon ${actions.length+1}: Marka Tehdidi — ${data.brandSuspiciousCount} şüpheli taklit domain için hukuki süreç başlatın.`);
  if (data.sslExpiringCount > 0) actions.push(`Aksiyon ${actions.length+1}: SSL Yenileme — ${data.sslExpiringCount} sertifika süresi dolmak üzere, yenileme işlemini başlatın.`);
  if (actions.length === 0) actions.push("Aksiyon 1: Periyodik Tarama — Aylık domain taraması planı oluşturun ve bulgularla risk skorunu izleyin.");
  if (actions.length < 2) actions.push("Aksiyon 2: Çalışan Farkındalık — Phishing simülasyonu ile çalışan farkındalığını ölçün ve eğitim düzenleyin.");
  if (actions.length < 3) actions.push("Aksiyon 3: Fortinet WAF — Web uygulama güvenlik duvarı yapılandırmasını gözden geçirin (Netsys destekli).");
  return actions.slice(0, 3);
}

async function getPrevMonths(customerId: number): Promise<Array<{ month: string; score: number }>> {
  const rows = await db.execute(sql`
    SELECT report_month, risk_score_current
    FROM executive_reports
    WHERE customer_id = ${customerId}
      AND risk_score_current IS NOT NULL
    ORDER BY report_month DESC
    LIMIT 5
  `);
  return (rows.rows as Array<{ report_month: string; risk_score_current: number }>)
    .reverse()
    .map(r => ({ month: r.report_month, score: r.risk_score_current }));
}

export async function generateExecutivePdf(
  data: ExecutiveReportData,
  reportMonth: string,
): Promise<Buffer> {
  const [summary, actions, prevMonths] = await Promise.all([
    claudeSummary(data),
    claudeActions(data),
    getPrevMonths(data.customerId),
  ]);

  const chartData = [
    ...prevMonths,
    { month: reportMonth, score: data.riskScoreCurrent },
  ].slice(-6);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
      autoFirstPage: false,
    });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  ()          => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W       = 595.28;
    const H       = 841.89;
    const MARGIN  = 48;
    const CONTENT = W - MARGIN * 2;

    // ─── Shield icon helper ───────────────────────────────────────────────────
    const drawShield = (x: number, y: number, size: number) => {
      const f = size / 48;
      doc.save().translate(x, y).scale(f, f);
      doc.fillColor(CS_DARK).strokeColor(CS_CYAN).lineWidth(2)
        .path("M24 3 L42 10 L42 26 C42 35 34 42 24 46 C14 42 6 35 6 26 L6 10 Z")
        .fillAndStroke();
      doc.fillColor(CS_CYAN)
        .path("M17 30 L17 26 L22 26 L22 22 L17 22 L17 18 L31 18 L31 22 L26 22 L26 26 L31 26 L31 30 Z")
        .fill();
      doc.restore();
    };

    // ─── Header / footer helpers ──────────────────────────────────────────────
    const drawHeader = (title: string) => {
      doc.rect(0, 0, W, 36).fill(CS_DARK);
      drawShield(MARGIN, 7, 22);
      doc.font(FONT_BOLD).fontSize(12);
      const cw = doc.widthOfString("Cyber");
      doc.fillColor(CS_TEXT).text("Cyber",   MARGIN + 28, 11, { lineBreak: false, height: 0 });
      doc.fillColor(CS_CYAN).text("Step",    MARGIN + 28 + cw, 11, { lineBreak: false, height: 0 });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7)
        .text(".io", MARGIN + 28 + cw + doc.widthOfString("Step"), 13, { lineBreak: false, height: 0 });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8)
        .text(title, MARGIN, 12, { align: "right", width: CONTENT, lineBreak: false, height: 0 });
    };

    const drawFooter = (pageNum: number, total: number) => {
      doc.rect(0, H - 28, W, 28).fill(CS_DARK);
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7)
        .text(
          `Sayfa ${pageNum} / ${total}  |  CyberStep.io  |  Gizli — Yalnızca Yöneticiye`,
          MARGIN, H - 18, { align: "center", width: CONTENT, lineBreak: false, height: 0 }
        );
    };

    const rl = getRiskLevel(data.riskScoreCurrent);
    const scoreColor = riskColor(data.riskScoreCurrent);
    const domainLabel = data.primaryDomain ?? data.customerEmail;
    const monthLabel  = trMonth(reportMonth);

    // ══════════════════════════════════════════════════════════════════════════
    // SAYFA 1 — KAPAK
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    doc.rect(0, 0, W, H).fill(CS_DARK);

    // Logo büyük
    drawShield(W / 2 - 40, 110, 80);
    doc.font(FONT_BOLD).fontSize(28);
    const cw = doc.widthOfString("Cyber");
    doc.fillColor(CS_TEXT).text("Cyber", W / 2 - (cw + doc.widthOfString("Step")) / 2, 205, { lineBreak: false, height: 0 });
    doc.fillColor(CS_CYAN).text("Step",  W / 2 - (cw + doc.widthOfString("Step")) / 2 + cw, 205, { lineBreak: false, height: 0 });
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(12)
      .text(".io", W / 2 + cw + doc.widthOfString("Step") / 2 - 10, 210, { lineBreak: false, height: 0 });

    // Divider
    doc.moveTo(MARGIN, 250).lineTo(W - MARGIN, 250).lineWidth(1).strokeColor(CS_CYAN).stroke();

    // Rapor başlığı
    doc.fillColor(CS_TEXT).font(FONT_BOLD).fontSize(20)
      .text("Aylık Siber Güvenlik Durum Raporu", MARGIN, 270, { align: "center", width: CONTENT });
    doc.fillColor(CS_CYAN).font(FONT_BOLD).fontSize(14)
      .text(monthLabel, MARGIN, 300, { align: "center", width: CONTENT });

    // Müşteri bilgisi kutusu
    const custBoxY = 350;
    doc.rect(MARGIN, custBoxY, CONTENT, 80).fill(CS_PANEL);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(9)
      .text("Hazırlanan Şirket", MARGIN + 20, custBoxY + 12);
    doc.fillColor(CS_TEXT).font(FONT_BOLD).fontSize(14)
      .text(data.companyName ?? data.customerEmail, MARGIN + 20, custBoxY + 26);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(9)
      .text(domainLabel, MARGIN + 20, custBoxY + 50);

    // Risk skoru önizleme
    const riskBoxY = 460;
    doc.rect(MARGIN, riskBoxY, CONTENT, 100).fill(CS_PANEL);
    doc.fillColor(scoreColor).font(FONT_BOLD).fontSize(52)
      .text(`${data.riskScoreCurrent}`, MARGIN + 20, riskBoxY + 18, { lineBreak: false, height: 0 });
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(11)
      .text("/ 100", MARGIN + 90, riskBoxY + 48, { lineBreak: false, height: 0 });
    doc.fillColor(scoreColor).font(FONT_BOLD).fontSize(14)
      .text(rl.label, MARGIN + 130, riskBoxY + 28, { lineBreak: false, height: 0 });
    if (data.riskScoreChange !== null) {
      const sign   = data.riskScoreChange > 0 ? "+" : "";
      const chColor: [number,number,number] = data.riskScoreChange > 0 ? CS_DANGER : CS_GREEN;
      doc.fillColor(chColor).font(FONT_REGULAR).fontSize(10)
        .text(`${sign}${data.riskScoreChange} önceki aya göre`, MARGIN + 130, riskBoxY + 58);
    }

    // Tarih
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8)
      .text(`Oluşturulma: ${new Date().toLocaleDateString("tr-TR")}`, MARGIN, H - 60, { align: "center", width: CONTENT });

    // ══════════════════════════════════════════════════════════════════════════
    // SAYFA 2 — YÖNETİCİ ÖZETİ
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    doc.rect(0, 0, W, H).fill(CS_DARK);
    drawHeader("Yönetici Özeti");

    let y = 56;

    // Risk skoru büyük kutu
    const rsBoxH = 100;
    doc.rect(MARGIN, y, CONTENT, rsBoxH).fill(CS_PANEL);
    doc.fillColor(scoreColor).font(FONT_BOLD).fontSize(48)
      .text(`${data.riskScoreCurrent}`, MARGIN + 16, y + 12, { lineBreak: false, height: 0 });
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(10)
      .text("/ 100", MARGIN + 80, y + 42, { lineBreak: false, height: 0 });
    doc.fillColor(scoreColor).font(FONT_BOLD).fontSize(16)
      .text(rl.label, MARGIN + 120, y + 26, { lineBreak: false, height: 0 });
    if (data.riskScoreChange !== null) {
      const sign   = data.riskScoreChange > 0 ? "+" : "";
      const chColor: [number,number,number] = data.riskScoreChange > 0 ? CS_DANGER : CS_GREEN;
      doc.fillColor(chColor).font(FONT_BOLD).fontSize(11)
        .text(`${sign}${data.riskScoreChange} puan`, MARGIN + 120, y + 50);
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(9)
        .text("önceki aya göre", MARGIN + 120, y + 66);
    }
    y += rsBoxH + 12;

    // 4 KPI kutusu (2x2)
    const kpiW = (CONTENT - 8) / 2;
    const kpiH = 64;
    const kpis = [
      { label: "Kritik Açık",    value: data.criticalCveCount,   color: CS_DANGER },
      { label: "İzlenen Alan",   value: data.totalDomainsMonitored, color: CS_CYAN  },
      { label: "Marka Tehdidi",  value: data.brandSuspiciousCount, color: CS_AMBER  },
      { label: "SSL Uyarısı",    value: data.sslExpiringCount,   color: CS_AMBER  },
    ];
    for (let i = 0; i < kpis.length; i++) {
      const kpi = kpis[i]!;
      const kx = MARGIN + (i % 2) * (kpiW + 8);
      const ky = y + Math.floor(i / 2) * (kpiH + 8);
      doc.rect(kx, ky, kpiW, kpiH).fill(CS_PANEL);
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8)
        .text(kpi.label, kx + 14, ky + 10);
      doc.fillColor(kpi.color).font(FONT_BOLD).fontSize(28)
        .text(`${kpi.value}`, kx + 14, ky + 24);
    }
    y += 2 * kpiH + 8 + 16;

    // Yönetici özeti paragrafı
    doc.fillColor(CS_CYAN).font(FONT_BOLD).fontSize(11)
      .text("Yönetici Özeti", MARGIN, y);
    y += 18;
    doc.rect(MARGIN, y, CONTENT, 1).fill(CS_PANEL);
    y += 8;
    doc.fillColor(CS_TEXT).font(FONT_REGULAR).fontSize(9.5)
      .text(summary, MARGIN, y, { width: CONTENT, lineGap: 3 });
    y = doc.y + 20;

    // Detay satırları
    const rows: Array<{ label: string; value: string; sub: string }> = [
      { label: "Güvenlik Açıkları", value: `${data.criticalCveCount} kritik / ${data.highCveCount} yüksek CVE`, sub: "CVE tespit sayısı" },
      { label: "Kara Liste",        value: `${data.blacklistedCount} domain`, sub: "Kara listede görünen domain" },
      { label: "Mail Güvenlik",     value: `${data.mailIssuesCount} sorunlu`, sub: "SPF/DMARC/DKIM eksik" },
      { label: "Yüksek Riskli Port",value: `${data.highRiskPortsCount} açık port`, sub: "SSH/RDP/Telnet/VNC" },
    ];
    for (const r of rows) {
      if (y > H - 80) break;
      doc.rect(MARGIN, y, CONTENT, 28).fill(CS_PANEL);
      doc.fillColor(CS_TEXT).font(FONT_BOLD).fontSize(9)
        .text(r.label, MARGIN + 12, y + 8, { lineBreak: false, height: 0 });
      doc.fillColor(CS_CYAN).font(FONT_BOLD).fontSize(9)
        .text(r.value, MARGIN + 12, y + 8, { align: "right", width: CONTENT - 24, lineBreak: false, height: 0 });
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7.5)
        .text(r.sub, MARGIN + 12, y + 18);
      y += 36;
    }

    drawFooter(2, 4);

    // ══════════════════════════════════════════════════════════════════════════
    // SAYFA 3 — RİSK TRENDİ
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    doc.rect(0, 0, W, H).fill(CS_DARK);
    drawHeader("Risk Trendi");

    y = 56;
    doc.fillColor(CS_TEXT).font(FONT_BOLD).fontSize(13)
      .text("Risk Skoru Trendi", MARGIN, y);
    y += 22;

    // Bar chart
    const barAreaH = 140;
    const barAreaW = CONTENT;
    const barCount = chartData.length;
    const barW     = barCount > 0 ? Math.floor(barAreaW / barCount) - 6 : 40;
    const maxScore = 100;

    if (barCount > 0) {
      // Y axis baseline
      doc.moveTo(MARGIN, y + barAreaH).lineTo(MARGIN + barAreaW, y + barAreaH)
        .lineWidth(0.5).strokeColor(CS_PANEL).stroke();

      for (let i = 0; i < barCount; i++) {
        const bar = chartData[i]!;
        const bx  = MARGIN + i * (barW + 6);
        const bh  = Math.max(4, Math.round((bar.score / maxScore) * (barAreaH - 20)));
        const by  = y + barAreaH - bh;
        const bc  = riskColor(bar.score);

        doc.rect(bx, by, barW, bh).fill(bc);

        // Skor label
        doc.fillColor(CS_TEXT).font(FONT_BOLD).fontSize(8)
          .text(`${bar.score}`, bx, by - 14, { width: barW, align: "center" });

        // Ay label
        const [, m] = bar.month.split("-");
        const monthNames = ["","Oc","Şb","Mr","Ns","My","Hz","Tm","Ag","El","Ek","Ks","Ar"];
        doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(7)
          .text(monthNames[parseInt(m ?? "1", 10)] ?? m ?? "", bx, y + barAreaH + 4, { width: barW, align: "center" });
      }
    }

    y += barAreaH + 30;

    // Top riskler
    doc.fillColor(CS_TEXT).font(FONT_BOLD).fontSize(13)
      .text("Bu Ay Öne Çıkan Riskler", MARGIN, y);
    y += 20;

    const topRisks: Array<{ title: string; desc: string; color: [number,number,number] }> = [];
    if (data.criticalCveCount > 0) topRisks.push({
      title: `${data.criticalCveCount} Kritik CVE Güvenlik Açığı`,
      desc: "Sistemlerde kritik güvenlik açığı tespit edildi. Saldırganlar bu açıkları uzaktan istismar edebilir.",
      color: CS_DANGER,
    });
    if (data.brandSuspiciousCount > 0) topRisks.push({
      title: `${data.brandSuspiciousCount} Şüpheli Taklit Domain`,
      desc: "Markanızı taklit eden ve aktif içerik barındıran şüpheli domainler tespit edildi.",
      color: CS_AMBER,
    });
    if (data.blacklistedCount > 0) topRisks.push({
      title: `${data.blacklistedCount} Domain Kara Listede`,
      desc: "Bu domainler spam veya tehdit kaynaklarında listelenmiş; itibar ve e-posta iletim sorunu yaratabilir.",
      color: CS_ORANGE,
    });
    if (topRisks.length === 0) topRisks.push({
      title: "Kritik Risk Tespit Edilmedi",
      desc: "Bu dönemde öne çıkan kritik risk bulgusu bulunmamaktadır. Periyodik izleme devam etmektedir.",
      color: CS_GREEN,
    });

    for (let i = 0; i < Math.min(topRisks.length, 3); i++) {
      const r = topRisks[i]!;
      doc.rect(MARGIN, y, CONTENT, 48).fill(CS_PANEL);
      doc.rect(MARGIN, y, 4, 48).fill(r.color);
      doc.fillColor(CS_TEXT).font(FONT_BOLD).fontSize(10)
        .text(`${i + 1}. ${r.title}`, MARGIN + 14, y + 8);
      doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8.5)
        .text(r.desc, MARGIN + 14, y + 24, { width: CONTENT - 24 });
      y += 56;
    }

    drawFooter(3, 4);

    // ══════════════════════════════════════════════════════════════════════════
    // SAYFA 4 — SONRAKI ADIMLAR
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    doc.rect(0, 0, W, H).fill(CS_DARK);
    drawHeader("Detay & Önerilen Aksiyonlar");

    y = 56;

    // Bölüm 1 — CVE
    doc.fillColor(CS_CYAN).font(FONT_BOLD).fontSize(11).text("Güvenlik Açıkları", MARGIN, y); y += 16;
    doc.rect(MARGIN, y, CONTENT, 1).fill(CS_PANEL); y += 8;

    const cveRows: Array<[string, string]> = [
      ["Kritik Güvenlik Açığı (CVSSv3 ≥ 9.0)", `${data.criticalCveCount} adet`],
      ["Yüksek Güvenlik Açığı (CVSSv3 7.0–8.9)", `${data.highCveCount} adet`],
      ["Fortinet WAF ile kapatılabilir açık", "Netsys değerlendirmesi önerilir"],
    ];
    for (const [label, val] of cveRows) {
      doc.rect(MARGIN, y, CONTENT, 24).fill(CS_PANEL);
      doc.fillColor(CS_TEXT).font(FONT_REGULAR).fontSize(8.5)
        .text(label, MARGIN + 12, y + 7, { lineBreak: false, height: 0 });
      doc.fillColor(CS_CYAN).font(FONT_BOLD).fontSize(8.5)
        .text(val, MARGIN + 12, y + 7, { align: "right", width: CONTENT - 24, lineBreak: false, height: 0 });
      y += 30;
    }
    y += 8;

    // Bölüm 2 — Marka
    doc.fillColor(CS_CYAN).font(FONT_BOLD).fontSize(11).text("Marka Koruma", MARGIN, y); y += 16;
    doc.rect(MARGIN, y, CONTENT, 1).fill(CS_PANEL); y += 8;
    const bmRows: Array<[string, string]> = [
      ["Aktif Taklit Domain",   `${data.brandVariantsActive} adet`],
      ["Şüpheli Domain",        `${data.brandSuspiciousCount} adet`],
    ];
    for (const [label, val] of bmRows) {
      doc.rect(MARGIN, y, CONTENT, 24).fill(CS_PANEL);
      doc.fillColor(CS_TEXT).font(FONT_REGULAR).fontSize(8.5)
        .text(label, MARGIN + 12, y + 7, { lineBreak: false, height: 0 });
      const vColor: [number,number,number] = parseInt(val) > 0 ? CS_AMBER : CS_GREEN;
      doc.fillColor(vColor).font(FONT_BOLD).fontSize(8.5)
        .text(val, MARGIN + 12, y + 7, { align: "right", width: CONTENT - 24, lineBreak: false, height: 0 });
      y += 30;
    }
    y += 8;

    // Bölüm 3 — Altyapı
    doc.fillColor(CS_CYAN).font(FONT_BOLD).fontSize(11).text("Altyapı Sağlığı", MARGIN, y); y += 16;
    doc.rect(MARGIN, y, CONTENT, 1).fill(CS_PANEL); y += 8;
    const infraRows: Array<[string, string]> = [
      ["SSL Sertifika Durumu",  data.sslExpiringCount > 0 ? `${data.sslExpiringCount} sertifika yakında sona eriyor` : "Normal"],
      ["Mail Güvenlik",         data.mailIssuesCount > 0  ? `${data.mailIssuesCount} alanda SPF/DMARC/DKIM eksik`    : "Tam geçer"],
      ["Kara Liste",            data.blacklistedCount > 0 ? `${data.blacklistedCount} domain listede`                : "Temiz"],
    ];
    for (const [label, val] of infraRows) {
      doc.rect(MARGIN, y, CONTENT, 24).fill(CS_PANEL);
      doc.fillColor(CS_TEXT).font(FONT_REGULAR).fontSize(8.5)
        .text(label, MARGIN + 12, y + 7, { lineBreak: false, height: 0 });
      doc.fillColor(CS_TEXT).font(FONT_BOLD).fontSize(8.5)
        .text(val, MARGIN + 12, y + 7, { align: "right", width: CONTENT - 24, lineBreak: false, height: 0 });
      y += 30;
    }
    y += 12;

    // Önerilen Aksiyonlar
    doc.fillColor(CS_CYAN).font(FONT_BOLD).fontSize(13).text("Önerilen Aksiyonlar", MARGIN, y); y += 20;

    for (const [i, action] of actions.entries()) {
      const [titlePart, descPart] = action.split(" — ");
      const boxH = 52;
      doc.rect(MARGIN, y, CONTENT, boxH).fill(CS_PANEL);
      doc.rect(MARGIN, y, 4, boxH).fill(CS_CYAN);
      doc.fillColor(CS_TEXT).font(FONT_BOLD).fontSize(9.5)
        .text(titlePart ?? action, MARGIN + 14, y + 10);
      if (descPart) {
        doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8.5)
          .text(descPart, MARGIN + 14, y + 26, { width: CONTENT - 24 });
      }
      y += boxH + 8;
      if (i >= 2) break;
    }

    // CyberStep contact
    y = Math.max(y + 12, H - 140);
    doc.rect(MARGIN, y, CONTENT, 70).fill(CS_PANEL);
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT, y).lineWidth(1).strokeColor(CS_CYAN).stroke();
    doc.fillColor(CS_CYAN).font(FONT_BOLD).fontSize(9)
      .text("CyberStep.io — Türkiye'nin KOBİ Siber Güvenlik Platformu", MARGIN + 16, y + 12);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8)
      .text("cyberstep.io  |  Netsys iş birliği", MARGIN + 16, y + 28);

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    doc.fillColor(CS_MUTED).font(FONT_REGULAR).fontSize(8)
      .text(
        `Bir sonraki rapor: ${nextMonth.toLocaleDateString("tr-TR", { year: "numeric", month: "long" })}`,
        MARGIN + 16, y + 44
      );

    drawFooter(4, 4);

    doc.end();
  });
}
