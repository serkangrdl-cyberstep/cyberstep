import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { demoReportsTable, demoLeadsTable, domainScansTable } from "@workspace/db";
import { eq, and, between, gte, or, like, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import PDFDocument from "pdfkit";

const DEMO_DOMAIN = "abc.com.tr";
const DEMO_COMPANY = "Örnek A.Ş.";
const PRIMARY_COLOR = "#0F3460";
const ACCENT_COLOR = "#00D4AA";
const RED = "#B71C1C";
const ORANGE = "#F57F17";
const GREEN = "#1B5E20";

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

function scoreColor(s: number): string {
  if (s >= 70) return GREEN;
  if (s >= 50) return ORANGE;
  return RED;
}

function scoreLabel(s: number): string {
  if (s >= 70) return "Iyi Seviye";
  if (s >= 50) return "Orta Risk";
  return "Yuksek Risk";
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

async function callClaude(prompt: string, model: string = "claude-haiku-4-5", maxTokens: number = 400): Promise<string> {
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

interface PDFSection {
  title: string;
  content: string;
  badge?: string;
  badgeColor?: string;
}

async function buildDemoPDF(params: {
  type: string;
  score: number;
  sections: PDFSection[];
  today: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const buffers: Buffer[] = [];
    doc.on("data", (c: Buffer) => buffers.push(c));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const W = 595 - 100;

    // ── DEMO watermark ──
    doc.save();
    doc.opacity(0.06);
    doc.rotate(-35, { origin: [297.5, 421] });
    doc.fontSize(90).fillColor("#FF0000").text("DEMO RAPORU", 50, 350, { width: 500, align: "center" });
    doc.restore();

    // ── Header ──
    doc.rect(50, 50, W, 90).fill(PRIMARY_COLOR);
    doc.fillColor("#FFFFFF").fontSize(20).font("Helvetica-Bold").text("CyberStep", 70, 68, { continued: true });
    doc.fillColor(ACCENT_COLOR).text(".io");
    doc.fillColor("#CCCCCC").fontSize(10).font("Helvetica").text(params.type.toUpperCase(), 70, 92);
    doc.fillColor("#F5A623").fontSize(9).font("Helvetica-Bold")
      .rect(70, 108, 100, 16).fill("#F5A623")
      .fillColor("#000000").text("DEMO - ORNEK VERILER", 72, 111);
    doc.fillColor("#AAAAAA").fontSize(8).font("Helvetica")
      .text(`${params.today}   |   ${DEMO_COMPANY}   |   ${DEMO_DOMAIN}`, 200, 108);

    // ── Score box ──
    const sColor = scoreColor(params.score);
    const sLabel = scoreLabel(params.score);
    doc.rect(50, 158, W, 56).fill("#F8F8F8").stroke("#E0E0E0");
    doc.rect(50, 158, 6, 56).fill(sColor);
    doc.fillColor(PRIMARY_COLOR).fontSize(38).font("Helvetica-Bold").text(String(params.score), 72, 163);
    doc.fillColor("#666666").fontSize(9).font("Helvetica").text("/100   Risk Skoru", 130, 175);
    doc.fillColor(sColor).fontSize(12).font("Helvetica-Bold").text(sLabel, 130, 163);

    // ── Sections ──
    let y = 232;
    for (const section of params.sections) {
      if (y > 740) {
        doc.addPage();
        y = 60;
      }
      const lines = Math.ceil(section.content.length / 80);
      const boxH = Math.max(50, 36 + lines * 14);

      doc.rect(50, y, W, boxH).stroke("#E0E0E0");
      doc.rect(50, y, W, 18).fill("#F5F5F5");
      doc.fillColor(PRIMARY_COLOR).fontSize(8).font("Helvetica-Bold")
        .text(section.title.toUpperCase(), 62, y + 5);
      if (section.badge) {
        doc.rect(W - 10, y + 3, 60, 13).fill(section.badgeColor ?? "#E0E0E0");
        doc.fillColor("#333333").fontSize(7).text(section.badge, W - 8, y + 6);
      }
      doc.fillColor("#333333").fontSize(9).font("Helvetica")
        .text(section.content, 62, y + 24, { width: W - 24, lineGap: 4 });
      y += boxH + 8;
    }

    // ── Footer ──
    doc.fontSize(7).fillColor("#999999").font("Helvetica")
      .text(`Bu DEMO rapordur. Veriler gercek bir taramadan anonimlestirilmistir. | cyberstep.io | © 2026 CyberStep.io`, 50, 800, {
        width: W, align: "center",
      });

    doc.end();
  });
}

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
  const rows = await db.select()
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
      )
    )
    .orderBy(desc(domainScansTable.id))
    .limit(5);

  if (rows.length > 0) return rows[0] as Record<string, unknown>;

  const fallback = await db.select()
    .from(domainScansTable)
    .where(between(domainScansTable.overallScore, 25, 60))
    .orderBy(desc(domainScansTable.id))
    .limit(1);

  return fallback[0] as Record<string, unknown> | null;
}

// ── EASM Demo ──────────────────────────────────────────────────────────────────

async function generateEASMDemo(scan: Record<string, unknown>, original: Record<string, unknown>): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const summary = await callClaude(`
EASM degerlendirme raporu icin yonetici ozeti yaz.
Domain: abc.com.tr | Sirket: Ornek A.S.
Risk Skoru: ${score}/100
SSL gun: ${scan["sslDaysUntilExpiry"] ?? "?"}
DMARC: ${scan["dmarcRecord"] ? "Var" : "Yok"}
Kara liste: ${scan["blacklistCount"] ?? 0}
CVE sayisi: ${(scan["cveSummary"] as unknown[])?.length ?? 0}
Subdomain: ${scan["ctSubdomainCount"] ?? 0}
2-3 paragraf, CEO dili, Turkce.
  `);

  const sections: PDFSection[] = [
    { title: "Yonetici Ozeti", content: summary },
    {
      title: "SSL Sertifika Durumu",
      content: `Gecerlilik: ${scan["sslDaysUntilExpiry"] ?? "Bilinmiyor"} gun | Veren: ${scan["sslIssuer"] ?? "-"}`,
      badge: scan["sslPass"] ? "Aktif" : "Risk",
      badgeColor: scan["sslPass"] ? "#C8E6C9" : "#FFCDD2",
    },
    {
      title: "E-posta Guvenligi (SPF / DMARC / DKIM)",
      content: `SPF: ${scan["spfPass"] ? "Aktif" : "Eksik"} | DMARC: ${scan["dmarcRecord"] ? "Var" : "Yok"} | DKIM: ${scan["dkimPass"] ? "Aktif" : "Eksik"}`,
    },
    {
      title: "Kara Liste Durumu",
      content: `${scan["blacklistCount"] ?? 0} listede kayitli | URLhaus: ${scan["urlhausListed"] ? "Evet" : "Hayir"} | USOM: ${scan["usomListed"] ? "Evet" : "Hayir"}`,
      badge: Number(scan["blacklistCount"]) > 0 ? "Dikkat" : "Temiz",
      badgeColor: Number(scan["blacklistCount"]) > 0 ? "#FFE082" : "#C8E6C9",
    },
    {
      title: "CVE / Guvenlik Aciklari",
      content: `Tespit edilen CVE: ${(scan["cveSummary"] as unknown[])?.length ?? 0} | Shodan acik port: ${(scan["shodanOpenPorts"] as unknown[])?.length ?? 0}`,
    },
    {
      title: "Subdomain Envanteri (CT Log)",
      content: `Toplam subdomain: ${scan["ctSubdomainCount"] ?? 0} | Ornek: ${((scan["ctSubdomains"] as string[]) || []).slice(0, 3).join(", ") || "-"}`,
    },
    {
      title: "Tavsiyeler",
      content: "1. DMARC politikasini enforce moduna alin.\n2. SSL sertifika yenileme surecini otomatize edin.\n3. Acik portlari gozden gecirin ve gereksizleri kapatin.",
    },
  ];

  const buf = await buildDemoPDF({ type: "EASM Degerlendirme Raporu", score, sections, today });
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
  logger.info("Demo EASM raporu uretildi");
}

// ── E-posta Güvenliği Demo ─────────────────────────────────────────────────────

async function generateEmailSecurityDemo(scan: Record<string, unknown>, original: Record<string, unknown>): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const summary = await callClaude(`
E-posta guvenligi raporu icin ozet yaz.
Domain: abc.com.tr | SPF: ${scan["spfPass"] ? "Aktif" : "Eksik"} | DMARC: ${scan["dmarcRecord"] ? "Var" : "Yok"} | DKIM: ${scan["dkimPass"] ? "Aktif" : "Eksik"}
HIBP ihlal: ${scan["hibpBreachCount"] ?? 0} | Kara liste: ${scan["blacklistCount"] ?? 0}
2 paragraf, Turkce, is odakli.
  `);

  const sections: PDFSection[] = [
    { title: "Ozet", content: summary },
    {
      title: "SPF Kaydı",
      content: scan["spfPass"] ? `Aktif — ${scan["spfRecord"] ?? "Kayit mevcut"}` : "SPF kaydi bulunamadi. Sahte e-posta riski yuksek.",
      badge: scan["spfPass"] ? "Gecti" : "Basarisiz",
      badgeColor: scan["spfPass"] ? "#C8E6C9" : "#FFCDD2",
    },
    {
      title: "DMARC Politikasi",
      content: scan["dmarcRecord"] ? `Kayit mevcut: ${String(scan["dmarcRecord"]).substring(0, 80)}` : "DMARC kaydi yok. Kimlik avı saldirılarina karsi koruma eksik.",
      badge: scan["dmarcRecord"] ? "Var" : "Eksik",
      badgeColor: scan["dmarcRecord"] ? "#C8E6C9" : "#FFCDD2",
    },
    {
      title: "DKIM İmzalama",
      content: scan["dkimPass"] ? "DKIM aktif — e-posta butunlugu dogrulanmis." : "DKIM bulunamadi. E-posta manipulasyon riski mevcut.",
      badge: scan["dkimPass"] ? "Aktif" : "Eksik",
      badgeColor: scan["dkimPass"] ? "#C8E6C9" : "#FFCDD2",
    },
    {
      title: "HIBP Veri Ihlali",
      content: `Bilinen ihlal sayisi: ${scan["hibpBreachCount"] ?? 0}. ${Number(scan["hibpBreachCount"]) > 0 ? "Sızdırılmış kimlik bilgileri tespit edildi. Parola sifirlatma onerilir." : "Bilinen ihlal yok."}`,
    },
    {
      title: "Kara Liste Kontrolu (15+ liste)",
      content: `${scan["blacklistCount"] ?? 0} listede kayitli. ${Number(scan["blacklistCount"]) > 0 ? "E-posta teslim edilebilirligi etkilenebilir." : "Temiz — listede kayit yok."}`,
    },
    { title: "Duzeltme Kilavuzu", content: "1. DMARC policy=reject olarak ayarlayin.\n2. Tum gonderici subdomain icin SPF -all kuralini ekleyin.\n3. DKIM selector rotasyonu yapın (6 ayda bir)." },
  ];

  const buf = await buildDemoPDF({ type: "E-posta Guvenligi Denetimi", score, sections, today });
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
  logger.info("Demo e-posta guvenligi raporu uretildi");
}

// ── Yönetim Kurulu Demo ────────────────────────────────────────────────────────

async function generateBoardReportDemo(scan: Record<string, unknown>, original: Record<string, unknown>): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const baseRisk = 8_500_000;
  const mult = (100 - score) / 100;
  const riskLow = Math.round(baseRisk * mult * 0.15).toLocaleString("tr-TR");
  const riskHigh = Math.round(baseRisk * mult * 0.50).toLocaleString("tr-TR");
  const compliance7545 = Math.round(score * 0.8);
  const kvkkPct = Math.round(score * 0.75);

  const summary = await callClaude(`
Yonetim kurulu guvenlik raporu ozeti yaz.
Sirket: Ornek A.S. | Risk skoru: ${score}/100
7545 Kanunu uyum: %${compliance7545} | KVKK: %${kvkkPct}
Finansal risk: ${riskLow} — ${riskHigh} TL
3 paragraf, CEO/CFO diline uygun, Turkce.
  `, "claude-sonnet-4-6", 400);

  const sections: PDFSection[] = [
    { title: "Yonetici Ozeti", content: summary },
    { title: "Guvenlik Skoru", content: `${score}/100 — ${scoreLabel(score)}. Bir onceki aydan +3 puan artis.` },
    { title: "7545 Siber Guvenlik Kanunu Uyumu", content: `Uyum orani: %${compliance7545}. Eksik maddeler: Log yonetimi, Olay mudahale plani, Tedarikci risk degerlendirmesi.` },
    { title: "KVKK Uyumu", content: `KVKK uyum skoru: %${kvkkPct}. Veri ihlali bildirim sureci tanimlanmis, Veri envanteri guncelleme gerekiyor.` },
    { title: "Tahmini Finansal Risk", content: `${riskLow} — ${riskHigh} TL. Fidye yazilimi veya veri sızıntısı senaryosunda beklenen maliyet araligi.` },
    { title: "Gelecek Ay Odak", content: "1. Olay mudahale planı tatbikatı yapilmasi.\n2. Tedarikci risk degerlendirmesinin tamamlanmasi.\n3. Calisanlara e-posta guvenligi egitimi." },
    { title: "Yonetim Karari Gerektiren Konular", content: "1. KVKK veri envanteri guncelleme butcesi onayı (tahmini 45.000 TL).\n2. SOC hizmeti alim karari — Q3 2026." },
  ];

  const buf = await buildDemoPDF({ type: "Yonetim Kurulu Guvenlik Raporu", score, sections, today });
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
  logger.info("Demo yonetim kurulu raporu uretildi");
}

// ── CVE Alarmı Demo ────────────────────────────────────────────────────────────

async function generateCVEAlertDemo(scan: Record<string, unknown>, original: Record<string, unknown>): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const cves = (scan["cveSummary"] as Array<{ service?: string; cveId?: string; description?: string; cvssScore?: number }>) || [];

  const summary = await callClaude(`
CVE alarm raporu icin ozet yaz.
Domain: abc.com.tr | Tespit edilen CVE: ${cves.length}
En yuksek CVSS: ${cves[0]?.cvssScore ?? "N/A"}
2 paragraf, teknik dil, Turkce.
  `);

  const cveListText = cves.length > 0
    ? cves.slice(0, 5).map((c, i) => `${i + 1}. ${c.cveId ?? "?"} — CVSS: ${c.cvssScore ?? "?"} — ${(c.description ?? "").substring(0, 60)}`).join("\n")
    : "Bu taramada aktif CVE tespit edilmedi. (Demo icin ornek: CVE-2024-21626, CVSS 8.6 — Container escape guvenligi acigi)";

  const sections: PDFSection[] = [
    { title: "Ozet", content: summary },
    { title: "Tespit Edilen CVE Listesi (ilk 5)", content: cveListText },
    { title: "EPSS Onceliklendirme", content: "EPSS skoru > 0.5 olan CVE'ler kritik onceliklidir. CISA KEV listesindekiler 24 saat icinde yamalanmalidir." },
    { title: "Etkilenen Servisler", content: cves.slice(0, 3).map((c) => c.service ?? "Bilinmiyor").join(", ") || "Shodan uzerinden tespit edilen servisler analiz edildi." },
    { title: "Cozum Takvimi", content: "Kritik (CVSS >= 9.0): 24 saat\nYuksek (CVSS 7.0-8.9): 7 gun\nOrta (CVSS 4.0-6.9): 30 gun\nDusuk: 90 gun" },
  ];

  const buf = await buildDemoPDF({ type: "CVE Alarm Raporu", score, sections, today });
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
  logger.info("Demo CVE alarm raporu uretildi");
}

// ── TPRM Demo ──────────────────────────────────────────────────────────────────

async function generateTPRMDemo(scan: Record<string, unknown>, original: Record<string, unknown>): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const suppliers = [
    { name: "Tedarikci-1 (Yazilim)", domain: "supplier1.com.tr", risk: "B", score: 62 },
    { name: "Tedarikci-2 (BT Altyapı)", domain: "supplier2.net.tr", risk: "D", score: 38 },
    { name: "Tedarikci-3 (Lojistik)", domain: "supplier3.com", risk: "C", score: 51 },
  ];

  const sections: PDFSection[] = [
    { title: "Ozet", content: `3 tedarikci analiz edildi. 1 kritik risk (D sinifi) tespit edildi. ${DEMO_COMPANY} adina BDDK 3. taraf uyum cercevesinde degerlendirildi.` },
    {
      title: "Tedarikci Risk Matrisi",
      content: suppliers.map((s) => `${s.name}: Risk Sinifi ${s.risk} | Skor ${s.score}/100 | ${s.domain}`).join("\n"),
    },
    {
      title: "Kritik Bulgular — Tedarikci-2",
      content: "DMARC yok, 3 kara listede kayitli, son HIBP ihlali 4 ay once. BDDK YG/31 cercevesinde 30 gun icinde duzeltme talep edilmeli.",
      badge: "Acil",
      badgeColor: "#FFCDD2",
    },
    { title: "HIBP Ihlal Ozeti", content: "Tedarikci-2: 2 ihlal (Ocak 2024, Mart 2024). Etkilenen veri: E-posta, sifre hashleri." },
    { title: "DMARC / SPF Durumu", content: "Tedarikci-1: SPF+DMARC aktif. Tedarikci-2: Her ikisi de eksik. Tedarikci-3: Yalnizca SPF aktif." },
    { title: "Tavsiyeler", content: "1. Tedarikci-2 ile 30 gun aksiyon plani tabelesi olusturun.\n2. Tedarikci-3'ten DMARC enforce taahhudunu alin.\n3. Ceyreklik yeniden tarama planlayın." },
  ];

  const buf = await buildDemoPDF({ type: "Tedarikci Risk Tarama Raporu (TPRM)", score, sections, today });
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
  logger.info("Demo TPRM raporu uretildi");
}

// ── Tehdit İstihbaratı Demo ────────────────────────────────────────────────────

async function generateThreatIntelDemo(scan: Record<string, unknown>, original: Record<string, unknown>): Promise<void> {
  const score = Number(scan["overallScore"]) || 43;
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const sections: PDFSection[] = [
    { title: "Haftalik IOC Ozeti", content: "Bu hafta 1.247 yeni IP, 89 alan adi ve 23 hash tanimlandi. CISA KEV guncellemesi: 4 yeni CVE eklendi." },
    {
      title: "Yuksek Riskli IP Adresleri (ornek)",
      content: "185.x.x.x — Cobalt Strike C2 (Feodo)\n91.x.x.x — Ransomware dagitim (ThreatFox)\n45.x.x.x — Kimlik avi yonlendirme (URLhaus)",
    },
    {
      title: "CISA KEV — Son 7 Gun",
      content: "CVE-2024-21626 (runC container escape) — EPSS 0.94\nCVE-2024-3400 (PAN-OS RCE) — EPSS 0.98\nCVE-2023-48788 (Fortinet SQLi) — EPSS 0.91",
      badge: "Kritik",
      badgeColor: "#FFCDD2",
    },
    {
      title: "FortiGate Address Object Push",
      content: `Otomatik guncellenen cihaz: 1 adet | Son guncelleme: ${today} | Yeni eklenen kural: 847`,
    },
    { title: "USOM & Turkiye Odakli Tehditler", content: "Bu hafta USOM, 14 yeni TR domain kara listesine aldi. Finansal sektore yonelik phishing kampanyasi tespit edildi." },
    { title: "Sonraki Hafta Odak", content: "Exchange Server on-premise kurulumlarinda yeni RCE zafiyeti. Sunucu versiyonlarinizi kontrol edin ve yamalayin." },
  ];

  const buf = await buildDemoPDF({ type: "Tehdit Istihbarat Haftalik Raporu", score, sections, today });
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
  logger.info("Demo tehdit istihbarat raporu uretildi");
}

// ── Ana export ─────────────────────────────────────────────────────────────────

export async function generateAllDemoReports(): Promise<void> {
  const sourceScan = await selectDomainForDemo();
  if (!sourceScan) {
    logger.warn("Demo uretimi icin uygun domain bulunamadi — example data kullanilacak");
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
    const anonFake = anonymizeScan(fakeScan);
    for (const gen of [generateEASMDemo, generateEmailSecurityDemo, generateBoardReportDemo, generateCVEAlertDemo, generateTPRMDemo, generateThreatIntelDemo]) {
      try { await gen(anonFake, fakeScan); await sleep(1500); } catch (err) { logger.error({ err }, `Demo gen hatasi`); }
    }
    return;
  }

  const anonScan = anonymizeScan(sourceScan as Record<string, unknown>);
  logger.info({ source: sourceScan["domain"], score: sourceScan["overallScore"] }, "Demo rapor uretimi baslıyor");

  const generators = [generateEASMDemo, generateEmailSecurityDemo, generateBoardReportDemo, generateCVEAlertDemo, generateTPRMDemo, generateThreatIntelDemo];
  for (const gen of generators) {
    try {
      await gen(anonScan, sourceScan as Record<string, unknown>);
      await sleep(1500);
    } catch (err) {
      logger.error({ err, gen: gen.name }, "Demo rapor uretim hatasi");
    }
  }
  logger.info("Tum demo raporlar guncellendi");
}

export async function getDemoReportList(): Promise<typeof demoReportsTable.$inferSelect[]> {
  return db.select().from(demoReportsTable).where(eq(demoReportsTable.isActive, true)).orderBy(demoReportsTable.id);
}

export async function serveDemoPDF(filename: string): Promise<string | null> {
  if (!filename.startsWith("demo-") || !filename.endsWith(".pdf")) return null;
  const filePath = path.join(getDemoDir(), filename);
  return fs.existsSync(filePath) ? filePath : null;
}

export { demoLeadsTable };
