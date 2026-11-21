/**
 * Tedarikçi Siber Risk Portföy Raporu (PDF).
 * Denetim, yönetim kurulu ve mevzuat (KVKK md. 12, 7545 sayılı Kanun, BDDK destek hizmeti)
 * süreçlerinde destekleyici kanıt olarak kullanılmak üzere.
 *
 * Saf üretici: veriyi parametre olarak alır, Buffer döner (veritabanı erişimi yok).
 */
import { SOURCE_ATTRIBUTIONS } from "./dataSourceLicenses";
import PDFDocument from "pdfkit";
import path from "path";

const FONT_DIR = "/usr/share/fonts/truetype/dejavu";
const FONT = path.join(FONT_DIR, "DejaVuSans.ttf");
const FONT_BOLD = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

const NAVY = "#060D1A";
const CYAN = "#00A6D6";
const TEXT = "#1F2937";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const RISK_COLOR: Record<string, string> = {
  "Düşük": "#16A34A", "Orta": "#D97706", "Yüksek": "#EA580C", "Kritik": "#DC2626",
};

export interface ReportFinding { severity: "critical" | "high" | "medium" | "low"; title: string }

export interface ReportVendor {
  domain: string;
  name: string | null;
  score: number | null;
  grade: string | null;
  risk: string | null;
  sector: string | null;
  sectorPercentile: number | null;
  lastScanAt: Date | null;
  questionnaireStatus: string;
  combinedScore: number | null;
  insufficientData: boolean;
  coverage: number | null;
  findings: ReportFinding[];
  /** Tedarikçi beyanı (anket) — doğrulanmamıştır, skora dahil değildir. */
  selfScore?: number | null;
  contradictions?: number;
  remediation?: { status: string; before: number | null; requestedAt: Date | null; doneAt: Date | null } | null;
  /** Son olaylar (en yeni önce). */
  events?: Array<{ kind: string; at: Date; detail: Record<string, unknown> | null }>;
}

export interface PortfolioReportInput {
  companyName: string;
  generatedAt: Date;
  vendors: ReportVendor[];
  /** true: müşterinin kendi alan adları raporu (anket ve mevzuat bölümleri çıkarılır). */
  own?: boolean;
}

const SEV_TR: Record<ReportFinding["severity"], string> = { critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük" };
const RISK_ORDER = ["Kritik", "Yüksek", "Orta", "Düşük"];

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

export async function generatePortfolioReport(input: PortfolioReportInput): Promise<Buffer> {
  const own = !!input.own;
  const reportTitle = own ? "Kendi Alan Adlarım Siber Risk Raporu" : "Tedarikçi Siber Risk Yönetim Raporu";
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: {
    Title: reportTitle,
    Author: "CyberStep.io",
    Subject: input.companyName,
  } });
  doc.registerFont("r", FONT);
  doc.registerFont("b", FONT_BOLD);

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width - 96; // içerik genişliği
  const scored = input.vendors.filter(v => v.score !== null && !v.insufficientData);
  const counts: Record<string, number> = { Kritik: 0, Yüksek: 0, Orta: 0, Düşük: 0 };
  for (const v of scored) if (v.risk && counts[v.risk] !== undefined) counts[v.risk]!++;
  const pending = input.vendors.filter(v => v.score === null && !v.insufficientData).length;
  const insufficient = input.vendors.filter(v => v.insufficientData).length;
  const avg = scored.length ? Math.round(scored.reduce((a, v) => a + (v.score ?? 0), 0) / scored.length) : null;

  const h2 = (t: string) => {
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(0.6).font("b").fontSize(13).fillColor(NAVY).text(t);
    doc.moveTo(48, doc.y + 3).lineTo(48 + W, doc.y + 3).strokeColor(CYAN).lineWidth(1).stroke();
    doc.moveDown(0.6);
  };
  const para = (t: string, opts: PDFKit.Mixins.TextOptions = {}) =>
    doc.font("r").fontSize(9.5).fillColor(TEXT).text(t, { align: "left", lineGap: 2, ...opts });

  // ── Kapak şeridi ──────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 150).fill(NAVY);
  doc.font("b").fontSize(10).fillColor(CYAN).text("CYBERSTEP.IO", 48, 40);
  doc.font("b").fontSize(22).fillColor("#FFFFFF").text(reportTitle, 48, 60, { width: W });
  doc.font("r").fontSize(10).fillColor("#CBD5E1")
    .text(`${input.companyName}  ·  ${fmtDate(input.generatedAt)}  ·  ${input.vendors.length} ${own ? "alan adı" : "tedarikçi"}`, 48, 112, { width: W });
  doc.y = 175;
  doc.x = 48;

  // ── Yönetici özeti ───────────────────────────────────────────────────────
  h2("1. Yönetici Özeti");
  const boxW = (W - 3 * 10) / 4;
  const boxY = doc.y;
  RISK_ORDER.forEach((r, i) => {
    const x = 48 + i * (boxW + 10);
    doc.roundedRect(x, boxY, boxW, 58, 6).strokeColor(LINE).lineWidth(1).stroke();
    doc.font("b").fontSize(20).fillColor(RISK_COLOR[r]!).text(String(counts[r]), x, boxY + 8, { width: boxW, align: "center" });
    doc.font("r").fontSize(8.5).fillColor(MUTED).text(`${r} risk`, x, boxY + 38, { width: boxW, align: "center" });
  });
  doc.y = boxY + 72;
  doc.x = 48;
  para(
    (own ? `${input.vendors.length} alan adınızın ${scored.length} tanesi skorlandı` : `Portföydeki ${input.vendors.length} tedarikçinin ${scored.length} tanesi skorlandı`) +
    (avg !== null ? `; ortalama Risk Skoru ${avg}/100.` : ".") +
    (pending ? ` ${pending} ${own ? "alan adının" : "tedarikçinin"} taraması sürüyor.` : "") +
    (insufficient ? ` ${insufficient} alan adına ulaşılamadı (veri yetersiz).` : ""),
  );
  const highRisk = scored.filter(v => v.risk === "Kritik" || v.risk === "Yüksek").sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  if (highRisk.length > 0) {
    doc.moveDown(0.4);
    para(`Öncelikli aksiyon gerektiren ${own ? "alan adları" : "tedarikçiler"} (${highRisk.length}): ` +
      highRisk.slice(0, 8).map(v => `${v.name ?? v.domain} (${v.score})`).join(", ") +
      (highRisk.length > 8 ? " ve diğerleri." : "."));
  }

  // ── Tedarikçi tablosu ────────────────────────────────────────────────────
  h2(own ? "2. Alan Adı Listesi" : "2. Tedarikçi Listesi");
  const allCols = [
    { k: own ? "Alan adı" : "Tedarikçi", w: own ? 128 + (W - 420) : 128 }, { k: "Skor", w: 66 }, { k: "Not", w: 28 }, { k: "Risk", w: 48 },
    { k: "Sektör", w: 92 }, { k: "Son tarama", w: 58 }, { k: "Anket (beyan)", w: W - 420 },
  ];
  const cols = own ? allCols.slice(0, 6) : allCols;
  const header = () => {
    const y = doc.y;
    doc.rect(48, y - 2, W, 16).fill("#F3F4F6");
    let x = 48;
    for (const c of cols) { doc.font("b").fontSize(8).fillColor(MUTED).text(c.k, x + 3, y + 2, { width: c.w - 6 }); x += c.w; }
    doc.y = y + 18;
  };
  header();
  const sorted = [...input.vendors].sort((a, b) => {
    const ra = a.risk ? RISK_ORDER.indexOf(a.risk) : 9, rb = b.risk ? RISK_ORDER.indexOf(b.risk) : 9;
    return ra - rb || (a.score ?? 999) - (b.score ?? 999);
  });
  for (const v of sorted) {
    if (doc.y > doc.page.height - 70) { doc.addPage(); header(); }
    const y = doc.y;
    const cells = [
      v.name ? `${v.name}\n${v.domain}` : v.domain,
      v.insufficientData ? "—" : v.score === null ? "…" : `${v.score}${v.coverage !== null && v.coverage < 100 ? `\n(kapsam %${v.coverage})` : ""}`,
      v.grade ?? "—",
      v.insufficientData ? "Veri yok" : v.risk ?? "Bekliyor",
      v.sector ? (v.sectorPercentile !== null ? `${v.sector} (%${v.sectorPercentile})` : v.sector) : "—",
      fmtDate(v.lastScanAt),
      v.questionnaireStatus === "completed" ? `Tamamlandı${v.selfScore != null ? ` (${v.selfScore})` : ""}` : v.questionnaireStatus === "pending" ? "Bekliyor" : "—",
    ];
    let x = 48;
    let rowH = 14;
    cells.slice(0, cols.length).forEach((t, i) => {
      const c = cols[i]!;
      const isRisk = i === 3 && v.risk && RISK_COLOR[v.risk];
      doc.font(i === 0 ? "b" : "r").fontSize(8).fillColor(isRisk ? RISK_COLOR[v.risk!]! : TEXT);
      const h = doc.heightOfString(t, { width: c.w - 6 });
      doc.text(t, x + 3, y, { width: c.w - 6 });
      rowH = Math.max(rowH, h + 4);
      x += c.w;
    });
    doc.moveTo(48, y + rowH).lineTo(48 + W, y + rowH).strokeColor(LINE).lineWidth(0.5).stroke();
    doc.y = y + rowH + 3;
  }
  doc.x = 48;

  if (!own) {
  // ── Anket ve düzeltme durumu ────────────────────────────────────────────
  h2("3. Tedarikçi Beyanı (Anket) ve Düzeltme Durumu");
  para("Beyan puanı tedarikçinin kendi beyanıdır; doğrulanmamıştır ve Risk Skoruna dahil edilmez. Taramayla doğrulanabilen sorularda çelişkiler ayrıca işaretlenir.", { lineGap: 1 });
  doc.moveDown(0.4);
  const withSurvey = sorted.filter(v => v.selfScore != null || (v.remediation && v.remediation.status !== "none"));
  if (withSurvey.length === 0) {
    para("Henüz tamamlanmış tedarikçi anketi yok.");
  } else {
    for (const v of withSurvey) {
      if (doc.y > doc.page.height - 90) doc.addPage();
      const rem = v.remediation;
      const remTxt = !rem || rem.status === "none" ? "" :
        rem.status === "requested" ? "  ·  Düzeltme bildirildi, yeni tarama sürüyor" :
        `  ·  Düzeltme sonrası yeni tarama: ${rem.before ?? "—"} → ${v.score ?? "—"}`;
      doc.font("b").fontSize(9.5).fillColor(NAVY).text(`${v.name ?? v.domain}`, { continued: true })
        .font("r").fillColor(TEXT).text(`  ·  Beyan puanı: ${v.selfScore ?? "—"}/100${v.contradictions ? `  ·  ${v.contradictions} çelişki` : ""}${remTxt}`);
      for (const e of (v.events ?? []).slice(0, 4)) {
        const label: Record<string, string> = { questionnaire_completed: "Anket tamamlandı", report_sent: "Rapor tedarikçiye gönderildi",
          reassess_requested: "Düzeltme bildirildi, yeniden değerlendirme istendi", rescan_done: "Yeni tarama tamamlandı", rescan_failed: "Yeni tarama başarısız",
          fourth_party_changed: "Dördüncü taraf sağlayıcıları değişti", actions_created: "Aksiyon planı oluşturuldu", actions_auto_verified: "Aksiyonlar yeniden taramayla doğrulandı", action_supplier_done: "Tedarikçi bir aksiyonu tamamladı",
          decision_recorded: "Tedarikçi kararı kaydedildi", consent_recorded: "Yazılı onay kaydedildi", consent_revoked: "Yazılı onay iptal edildi" };
        doc.font("r").fontSize(8).fillColor(MUTED).text(`   ${fmtDate(e.at)} — ${label[e.kind] ?? e.kind}`);
      }
      doc.moveDown(0.4);
    }
  }

  }

  // ── Kritik ve yüksek bulgular ─────────────────────────────────────────────
  const withFindings = sorted.filter(v =>
    !v.insufficientData && v.score !== null &&
    v.findings.some(f => f.severity === "critical" || f.severity === "high"));
  h2(own ? "3. Kritik ve Yüksek Bulgular" : "4. Kritik ve Yüksek Bulgular");
  if (withFindings.length === 0) {
    para(own ? "Skorlanan alan adlarınızda kritik veya yüksek seviyede bulgu tespit edilmedi." : "Skorlanan tedarikçilerde kritik veya yüksek seviyede bulgu tespit edilmedi.");
  } else {
    for (const v of withFindings) {
      if (doc.y > doc.page.height - 90) doc.addPage();
      doc.font("b").fontSize(9.5).fillColor(NAVY).text(`${v.name ?? v.domain}  ·  ${v.score}/100 ${v.grade ?? ""}`);
      for (const f of v.findings.filter(f => f.severity === "critical" || f.severity === "high").slice(0, 5)) {
        doc.font("b").fontSize(8.5).fillColor(f.severity === "critical" ? RISK_COLOR["Kritik"]! : RISK_COLOR["Yüksek"]!)
          .text(`${SEV_TR[f.severity]}: `, { continued: true })
          .font("r").fillColor(TEXT).text(f.title);
      }
      doc.moveDown(0.5);
    }
  }

  if (!own) {
  // ── Mevzuat bağlamı ──────────────────────────────────────────────────────
  h2("5. Mevzuat Bağlamı");
  para("KVKK (6698) md. 12: Veri sorumlusu, kişisel verilerin kendi adına başka bir gerçek veya tüzel kişi tarafından işlenmesi halinde, gerekli teknik ve idari tedbirlerin alınması hususunda bu kişilerle birlikte müştereken sorumludur. Bu rapor, veri işleyen konumundaki tedarikçilerin dışarıdan gözlemlenebilen güvenlik durumunun izlendiğine ilişkin destekleyici kanıt olarak kullanılabilir.");
  doc.moveDown(0.4);
  para("7545 sayılı Siber Güvenlik Kanunu: Kanun kapsamındaki kuruluşlara önleyici ve sürekli siber güvenlik yükümlülükleri ile zafiyet ve olay bildirimi yükümlülüğü getirmektedir. Tedarikçilerden kaynaklanan risklerin düzenli olarak ölçülmesi bu yükümlülüklerin yerine getirilmesini destekler.");
  doc.moveDown(0.4);
  para("BDDK destek hizmeti düzenlemeleri: Bankaların destek hizmeti sağlayıcılarına ilişkin risk değerlendirmesi yapması beklenmektedir. Bu raporun sürekli izleme çıktıları söz konusu değerlendirmelere girdi sağlayabilir.");
  doc.moveDown(0.4);
  para("Bu rapor hukuki görüş değildir ve mevzuata uyumun tek başına kanıtı sayılmaz; kurumunuzun uyum değerlendirmesi kapsamında diğer kontrollerle birlikte değerlendirilmelidir.", { oblique: true } as PDFKit.Mixins.TextOptions);

  }

  // ── Metodoloji ───────────────────────────────────────────────────────────
  h2(own ? "4. Metodoloji Özeti" : "6. Metodoloji Özeti");
  para("CyberStep Risk Skoru v2, yalnızca herkese açık ve dışarıdan gözlemlenebilen sinyallerden hesaplanır; tedarikçinin sistemlerine erişilmez ve saldırı testi yapılmaz. Kategoriler ve azami puanlar: bilinen zafiyetler (CVE, CISA KEV, VulnCheck KEV) 30, ağ maruziyeti 20, itibar 15, e-posta güvenliği 15, veri ihlali geçmişi 10 (alan adına ait hizmetin bilinen ihlalleri; çalışan e-postası sızıntısı değildir), TLS ve web 10. Aktif sömürülen zafiyet (skor en fazla 49), ThreatFox IOC (en fazla 49), fidye yazılımında kullanılan zafiyet, botnet C2, USOM veya URLhaus kaydı (en fazla 39) ve internete açık kritik servis (en fazla 59) skoru üstten sınırlar. Risk etiketi skordan türetilir; ancak kritik bulgu varken en az Yüksek, yüksek bulgu varken en az Orta gösterilir. CVE eşleşmeleri yalnızca sürümü kesin tespit edilen yazılımlar için sürüm aralığı doğrulanarak yapılır; açık port banner'ından gelen eşleşmeler dağıtım yamaları nedeniyle doğrulanmamış olabilir. Tarama, alan adının ana IP'si ve sertifika kayıtlarından bulunan alt alan adlarıyla sınırlıdır; tüm varlıkların kapsandığı iddia edilmez. Ölçülemeyen kategoriler temiz sayılmaz; skor ölçülen kategoriler üzerinden hesaplanır. Not eşikleri: A ≥85, B ≥70, C ≥55, D ≥40, F <40. Bilgi amaçlı gösterilen ve skora girmeyen kaynaklar: EPSS, AlienVault OTX, Hudson Rock, Mozilla Observatory. Known Exploited Vulnerabilities verisinin bir kısmı VulnCheck KEV (vulncheck.com) kaynağından alınmıştır. Ayrıntılı metodoloji: cyberstep.io/metodoloji");
  para(SOURCE_ATTRIBUTIONS.join(" "));

  // ── Sayfa altlıkları ─────────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Alt marjın altına yazarken PDFKit'in yeni sayfa açmasını engelle
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("r").fontSize(7.5).fillColor(MUTED).text(
      `CyberStep.io · ${reportTitle} · ${input.companyName} · ${fmtDate(input.generatedAt)} · Sayfa ${i - range.start + 1}/${range.count}`,
      48, doc.page.height - 32, { width: W, align: "center", lineBreak: false },
    );
    doc.page.margins.bottom = bottom;
  }

  doc.end();
  return done;
}
