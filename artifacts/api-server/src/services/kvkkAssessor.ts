/**
 * KVKK 12. Madde & BTK Otomatik Bildirim Asistanı
 *
 * SOC case oluşturulduğunda çağrılır. Claude AI'a KVKK uygunluk değerlendirmesi
 * yaptırır; bildirim gerekiyorsa mektup taslağı + 72h deadline oluşturur.
 */

import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { getClaudeAiFn } from "./ai-client";
import { sendMail } from "./email";
import PDFDocument from "pdfkit";

const KVKK_TRIGGER_CATEGORIES = new Set([
  "ransomware", "malware", "data_breach", "unauthorized_access",
  "brute_force", "c2", "exploit", "exfiltration", "phishing",
]);

const KVKK_TRIGGER_SEVERITIES = new Set(["critical", "high", "medium"]);

interface CaseInfo {
  caseId: number;
  caseNumber: string;
  title: string;
  description: string | null;
  attackNarrative: string | null;
  severity: string;
  category: string;
  affectedAssets: string[];
}

interface KvkkAiResult {
  requiresNotification: boolean;
  reason: string;
  affectedDataTypes: string[];
  urgency: "immediate" | "within_24h" | "within_72h" | "not_required";
  letterDraft: string;
}

// ─── KVKK 12. Madde Sistem Prompt ─────────────────────────────────────────────

const KVKK_SYSTEM_CONTEXT = `Sen Türkiye'nin KVKK (Kişisel Verilerin Korunması Kanunu) ve BTK (Bilgi Teknolojileri ve İletişim Kurumu) bildirim yükümlülükleri konusunda uzman bir siber güvenlik hukuk asistanısın.

KVKK 12. Madde kapsamında:
- Kişisel veri ihlali tespit edildiğinde 72 saat içinde KVKK Kurulu'na bildirim zorunludur.
- Veri ihlali; kişisel verilerin yetkisiz erişim, ifşa, değiştirme veya imha riskini içermelidir.
- Sağlık, finansal, kimlik, iletişim verileri özel nitelikli kabul edilir ve acil bildirim gerektirir.

BTK Fidye Yazılımı Bildirimi (2024 Genelgesi):
- Fidye yazılımı saldırısı tespit edildiğinde BTK'ya 24 saat içinde bildirim yapılmalıdır.
- Altyapı kesintisi oluşturan saldırılar acil bildirim kapsamındadır.

Değerlendirme kriterleri:
1. Kişisel veri (ad, TC kimlik, sağlık, finansal, iletişim bilgileri) etkilenmiş mi?
2. Veri şifrelenmiş, çalınmış veya imha edilmiş mi?
3. İhlal kaç kişiyi etkileyebilir?
4. Sektör (sağlık, finans, e-ticaret) veri hassasiyetini artırır mı?

Her zaman JSON formatında yanıt ver.`;

// ─── AI Değerlendirme ──────────────────────────────────────────────────────────

export async function assessKvkkCompliance(
  customerId: number,
  caseInfo: CaseInfo,
  customerSector: string | null,
): Promise<KvkkAiResult> {
  const ai = getClaudeAiFn("kvkk-assess");

  const prompt = `${KVKK_SYSTEM_CONTEXT}

Aşağıdaki SOC vakası için KVKK 12. Madde bildirim yükümlülüğünü değerlendir:

Vaka Numarası: ${caseInfo.caseNumber}
Başlık: ${caseInfo.title}
Açıklama: ${caseInfo.description ?? "Bilgi yok"}
Saldırı Anlatısı: ${caseInfo.attackNarrative ?? "Bilgi yok"}
Önem Seviyesi: ${caseInfo.severity}
Kategori: ${caseInfo.category}
Etkilenen Varlıklar: ${caseInfo.affectedAssets.join(", ") || "Belirtilmemiş"}
Müşteri Sektörü: ${customerSector ?? "Genel"}

Aşağıdaki JSON formatında yanıt ver (başka hiçbir şey yazma):
{
  "requiresNotification": true/false,
  "reason": "Türkçe gerekçe (2-3 cümle)",
  "affectedDataTypes": ["kimlik", "sağlık", "finansal", "iletişim", "diğer"],
  "urgency": "immediate|within_24h|within_72h|not_required",
  "letterDraft": "KVKK Başkanlığına resmi bildirim mektubu Türkçe tam metin (requiresNotification false ise boş string)"
}`;

  const raw = await ai(prompt);

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as KvkkAiResult;
    return {
      requiresNotification: Boolean(parsed.requiresNotification),
      reason: String(parsed.reason ?? ""),
      affectedDataTypes: Array.isArray(parsed.affectedDataTypes) ? parsed.affectedDataTypes : [],
      urgency: parsed.urgency ?? "not_required",
      letterDraft: String(parsed.letterDraft ?? ""),
    };
  } catch {
    logger.error({ raw }, "kvkkAssessor: AI JSON parse failed");
    return {
      requiresNotification: false,
      reason: "AI değerlendirmesi ayrıştırılamadı",
      affectedDataTypes: [],
      urgency: "not_required",
      letterDraft: "",
    };
  }
}

// ─── Ana tetikleyici ───────────────────────────────────────────────────────────

export async function triggerKvkkAssessment(
  customerId: number,
  socCaseId: number,
  caseInfo: CaseInfo,
): Promise<void> {
  // Sadece ilgili kategori ve severity'de tetikle
  if (!KVKK_TRIGGER_CATEGORIES.has(caseInfo.category) && !KVKK_TRIGGER_SEVERITIES.has(caseInfo.severity)) return;
  if (!KVKK_TRIGGER_SEVERITIES.has(caseInfo.severity)) return;

  // Müşteri bilgisi al
  const { rows: custRows } = await pool.query<{ email: string | null; company_name: string | null; sector: string | null }>(
    `SELECT email, company_name, sector FROM customers WHERE id = $1 LIMIT 1`,
    [customerId]
  );
  const customer = custRows[0];

  // Değerlendirme kaydı oluştur (pending)
  const { rows: [assessment] } = await pool.query<{ id: number }>(
    `INSERT INTO kvkk_assessments (soc_case_id, customer_id, status, created_at)
     VALUES ($1, $2, 'pending', NOW())
     RETURNING id`,
    [socCaseId, customerId]
  );
  if (!assessment) return;

  try {
    const result = await assessKvkkCompliance(customerId, caseInfo, customer?.sector ?? null);
    const now = new Date();

    await pool.query(
      `UPDATE kvkk_assessments
       SET requires_notification = $1, ai_reasoning = $2, severity_category = $3,
           affected_data_types = $4, urgency = $5, letter_draft = $6,
           status = 'completed', assessed_at = NOW()
       WHERE id = $7`,
      [
        result.requiresNotification,
        result.reason,
        caseInfo.category,
        JSON.stringify(result.affectedDataTypes),
        result.urgency,
        result.letterDraft,
        assessment.id,
      ]
    );

    if (result.requiresNotification) {
      const deadline72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

      const { rows: [notif] } = await pool.query<{ id: number }>(
        `INSERT INTO kvkk_notifications
           (assessment_id, customer_id, soc_case_id, status, deadline_72h, letter_content, created_at, updated_at)
         VALUES ($1, $2, $3, 'draft', $4, $5, NOW(), NOW())
         RETURNING id`,
        [assessment.id, customerId, socCaseId, deadline72h, result.letterDraft]
      );

      logger.info({ customerId, socCaseId, notifId: notif?.id }, "KVKK bildirim gerekli — taslak oluşturuldu");

      // Müşteriye e-posta bildirimi
      if (customer?.email) {
        const baseUrl = process.env["REPLIT_DOMAINS"]
          ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
          : "http://localhost:80";

        await sendMail({
          to: customer.email,
          subject: `KVKK Bildirimi Gerekli — Vaka ${caseInfo.caseNumber} | 72 Saat Süreniz Var`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:8px;">
              <div style="background:#991b1b;padding:12px 16px;border-radius:6px;margin-bottom:24px;">
                <strong style="color:#fca5a5;">KVKK 12. Madde Bildirimi Gerekli</strong>
              </div>
              <h2 style="color:#f8fafc;margin-top:0;">${caseInfo.title}</h2>
              <p style="color:#94a3b8;">SOC vakası <strong style="color:#60a5fa;">${caseInfo.caseNumber}</strong> incelemesi sonucunda yapay zekamız KVKK 12. Madde kapsamında veri ihlal bildirimi yapılması gerektiğini tespit etti.</p>
              <div style="background:#1e293b;padding:16px;border-radius:6px;margin:20px 0;border-left:4px solid #ef4444;">
                <p style="margin:0;color:#fca5a5;font-weight:bold;">Gerekçe:</p>
                <p style="margin:8px 0 0;color:#e2e8f0;">${result.reason}</p>
              </div>
              <div style="background:#1e293b;padding:16px;border-radius:6px;margin:20px 0;">
                <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">72 Saatlik Süre:</p>
                <p style="margin:0;color:#fbbf24;font-weight:bold;font-size:18px;">${deadline72h.toLocaleString("tr-TR")}'e kadar</p>
              </div>
              <p style="color:#94a3b8;font-size:14px;">Hazır mektup taslağını indirmek ve BTK takip numaranızı girmek için SOC panelinizi ziyaret edin.</p>
              <a href="${baseUrl}/hesabim/soc" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">SOC Paneline Git</a>
            </div>
          `,
        }).catch(err => logger.warn({ err }, "KVKK bildirim e-postası gönderilemedi"));
      }

      // SOC case'e KVKK uyarı notu ekle
      await pool.query(
        `INSERT INTO soc_activity_log (case_id, actor_type, actor_name, action_type, description, created_at)
         VALUES ($1, 'ai', 'KVKK Asistanı', 'note', $2, NOW())`,
        [socCaseId, `KVKK 12. Madde değerlendirmesi: Bildirim gerekli. 72 saat deadline: ${deadline72h.toLocaleString("tr-TR")}. Gerekçe: ${result.reason}`]
      );
    }
  } catch (err) {
    logger.error({ err, assessmentId: assessment.id }, "KVKK assessment failed");
    await pool.query(
      `UPDATE kvkk_assessments SET status = 'failed', assessed_at = NOW() WHERE id = $1`,
      [assessment.id]
    );
  }
}

// ─── 72 Saat Deadline Cron ────────────────────────────────────────────────────

export async function checkKvkkDeadlines(): Promise<void> {
  try {
    // 24 saat kalan ve henüz uyarı gönderilmemiş bildirimleri bul
    const { rows } = await pool.query<{
      id: number; customer_id: number; soc_case_id: number;
      deadline_72h: string; email: string | null; company_name: string | null;
    }>(
      `SELECT kn.id, kn.customer_id, kn.soc_case_id, kn.deadline_72h,
              c.email, c.company_name
       FROM kvkk_notifications kn
       JOIN customers c ON c.id = kn.customer_id
       WHERE kn.status NOT IN ('closed')
         AND kn.deadline_warning_email_at IS NULL
         AND kn.deadline_72h <= NOW() + INTERVAL '24 hours'
         AND kn.deadline_72h > NOW()`
    );

    for (const row of rows) {
      const deadline = new Date(row.deadline_72h);
      const hoursLeft = Math.max(0, Math.round((deadline.getTime() - Date.now()) / (60 * 60 * 1000)));

      if (row.email) {
        const baseUrl = process.env["REPLIT_DOMAINS"]
          ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
          : "http://localhost:80";

        await sendMail({
          to: row.email,
          subject: `KVKK Bildirimi — ${hoursLeft} Saat Kaldı! Hemen Harekete Geçin`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:8px;">
              <div style="background:#7f1d1d;padding:12px 16px;border-radius:6px;margin-bottom:24px;border:1px solid #ef4444;">
                <strong style="color:#fca5a5;">KVKK 72 Saat Süresi Dolmak Üzere</strong>
              </div>
              <h2 style="color:#f8fafc;margin-top:0;">Sadece ${hoursLeft} Saat Kaldı</h2>
              <p style="color:#94a3b8;">KVKK 12. Madde kapsamındaki bildiriminizi henüz tamamlamadınız. Yasal süreniz <strong style="color:#fbbf24;">${deadline.toLocaleString("tr-TR")}</strong> tarihinde sona eriyor.</p>
              <p style="color:#94a3b8;">KVKK Kurulu bildirimi geciktirme her gün için idari para cezasına yol açabilir.</p>
              <a href="${baseUrl}/hesabim/soc" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Bildirimi Tamamla</a>
            </div>
          `,
        }).catch(err => logger.warn({ err, notifId: row.id }, "KVKK deadline warning email failed"));
      }

      await pool.query(
        `UPDATE kvkk_notifications SET deadline_warning_email_at = NOW() WHERE id = $1`,
        [row.id]
      );

      logger.info({ notifId: row.id, customerId: row.customer_id, hoursLeft }, "KVKK deadline uyarısı gönderildi");
    }
  } catch (err) {
    logger.error({ err }, "checkKvkkDeadlines error");
  }
}

// ─── PDF Mektup Üretimi ───────────────────────────────────────────────────────

export async function generateKvkkLetterPdf(
  letterContent: string,
  companyName: string,
  caseNumber: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Başlık
    doc.fontSize(14).font("Helvetica-Bold").text("KİŞİSEL VERİLERİ KORUMA KURUMU BAŞKANLIĞI'NA", { align: "center" });
    doc.moveDown();
    doc.fontSize(11).font("Helvetica-Bold").text("VERİ İHLALİ BİLDİRİM FORMU", { align: "center" });
    doc.moveDown(2);

    // Meta bilgiler
    const today = new Date().toLocaleDateString("tr-TR");
    doc.fontSize(10).font("Helvetica")
      .text(`Tarih: ${today}`)
      .text(`Referans Vaka No: ${caseNumber}`)
      .text(`Bildiren Kuruluş: ${companyName}`)
      .moveDown(1.5);

    // Konu
    doc.fontSize(11).font("Helvetica-Bold").text("Konu: KVKK 12. Madde Kapsamında Veri İhlali Bildirimi");
    doc.moveDown();

    // Mektup içeriği
    doc.fontSize(10).font("Helvetica").text(letterContent, { paragraphGap: 8, lineGap: 4 });
    doc.moveDown(2);

    // İmza alanı
    doc.text("Saygılarımızla,").moveDown(0.5)
      .text(companyName).moveDown(0.5)
      .text(`Tarih: ${today}`);

    doc.moveDown(2);
    doc.fontSize(8).fillColor("#666666")
      .text("Bu belge CyberStep.io KVKK Bildirim Asistanı tarafından oluşturulmuştur. ", { continued: true })
      .text("Göndermeden önce hukuk danışmanınıza onaylatınız.");

    doc.end();
  });
}

// ─── DB tabloları oluştur ─────────────────────────────────────────────────────

export async function ensureKvkkTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kvkk_assessments (
      id                    SERIAL PRIMARY KEY,
      soc_case_id           INTEGER NOT NULL,
      customer_id           INTEGER NOT NULL,
      requires_notification BOOLEAN,
      ai_reasoning          TEXT,
      severity_category     VARCHAR(50),
      affected_data_types   JSONB DEFAULT '[]',
      urgency               VARCHAR(30),
      letter_draft          TEXT,
      status                VARCHAR(20) NOT NULL DEFAULT 'pending',
      assessed_at           TIMESTAMPTZ,
      created_at            TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kvkk_notifications (
      id                        SERIAL PRIMARY KEY,
      assessment_id             INTEGER NOT NULL,
      customer_id               INTEGER NOT NULL,
      soc_case_id               INTEGER NOT NULL,
      status                    VARCHAR(20) NOT NULL DEFAULT 'draft',
      btk_reference_no          VARCHAR(100),
      sent_at                   TIMESTAMPTZ,
      deadline_72h              TIMESTAMPTZ NOT NULL,
      deadline_warning_email_at TIMESTAMPTZ,
      letter_content            TEXT,
      created_at                TIMESTAMPTZ DEFAULT NOW(),
      updated_at                TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS kvkk_assessments_case_idx ON kvkk_assessments (soc_case_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS kvkk_notifications_customer_idx ON kvkk_notifications (customer_id, status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS kvkk_notifications_deadline_idx ON kvkk_notifications (deadline_72h) WHERE status NOT IN ('closed')`);
  logger.info("KVKK tables ready");
}
