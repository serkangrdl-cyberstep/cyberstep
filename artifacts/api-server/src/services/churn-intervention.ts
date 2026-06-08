import { db, customerHealthScoresTable, customersTable, healthInterventionsTable } from "@workspace/db";
import { eq, lt, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

const ADMIN_EMAIL = process.env["ADMIN_EMAIL"] ?? "info@cyberstep.com";
const CHURN_THRESHOLD = 40;

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]?.trim()}`;
  return "https://cyberstep.io";
}

function buildChurnEmail(params: {
  fullName: string;
  companyName: string | null;
  healthScore: number;
  riskFactors: string[];
}): string {
  const baseUrl = getBaseUrl();
  const name = params.companyName ?? params.fullName;
  const factorsHtml = params.riskFactors.slice(0, 3).map(f =>
    `<li style="margin-bottom:6px;color:#A8B8D0">${f}</li>`
  ).join("");

  return `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span><span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span><span style="color:#7B8FAF;font-size:14px">.io</span>
  </div>

  <h2 style="color:#E8EDF5;margin:0 0 8px;font-size:20px">Merhaba ${name},</h2>
  <p style="color:#A8B8D0;line-height:1.7;margin:0 0 24px">
    Platform kullanımınızı takip ediyoruz ve sizinle bazı önemli bilgileri paylaşmak istedik.
    Hesabınızda dikkatimizi çeken birkaç nokta var.
  </p>

  ${params.riskFactors.length > 0 ? `
  <div style="background:rgba(255,176,32,0.07);border:1px solid #FFB020;border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="color:#FFB020;font-weight:bold;margin-bottom:10px">Dikkat Gerektiren Alanlar</div>
    <ul style="list-style:none;padding:0;margin:0">${factorsHtml}</ul>
  </div>` : ""}

  <p style="color:#A8B8D0;line-height:1.7;margin:0 0 24px">
    Size özel bir görüşme ayarlayarak bu konuları birlikte çözebiliriz.
    Uzman ekibimiz mevcut durumunuzu değerlendirip somut aksiyon planı oluşturmaya hazır.
  </p>

  <a href="${baseUrl}/hesabim" style="display:block;background:#00C8FF;color:#060D1A;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:bold;margin-bottom:12px">
    Hesabıma Git
  </a>
  <a href="mailto:destek@cyberstep.io" style="display:block;background:transparent;color:#00C8FF;border:1px solid rgba(0,200,255,0.3);text-align:center;padding:12px;border-radius:8px;text-decoration:none;font-size:14px">
    Destek Talebi Oluştur
  </a>

  <p style="font-size:12px;color:#5A6A80;margin-top:24px;line-height:1.6">
    Bu e-posta CyberStep'in otomatik müşteri başarı sistemi tarafından gönderilmiştir.
  </p>
</div>`.trim();
}

export async function runChurnIntervention(): Promise<number> {
  logger.info("churn_auto_intervention: tarama başladı");

  const latestScores = await db.execute<{
    customer_id: number;
    health_score: number;
    churn_risk_factors: string[];
    intervention_triggered: boolean;
    intervention_sent_at: string | null;
    email: string;
    full_name: string;
    company_name: string | null;
  }>(sql`
    SELECT DISTINCT ON (chs.customer_id)
      chs.customer_id,
      chs.health_score,
      chs.churn_risk_factors,
      chs.intervention_triggered,
      chs.intervention_sent_at,
      c.email,
      c.full_name,
      c.company_name
    FROM customer_health_scores chs
    JOIN customers c ON c.id = chs.customer_id
    WHERE chs.health_score < ${CHURN_THRESHOLD}
      AND chs.intervention_triggered = false
      AND c.subscription_status = 'active'
    ORDER BY chs.customer_id, chs.calculated_at DESC
  `);

  const rows = latestScores.rows;
  if (rows.length === 0) {
    logger.info("churn_auto_intervention: müdahale gerektiren müşteri yok");
    return 0;
  }

  logger.info({ count: rows.length }, "churn_auto_intervention: müşteri bulundu");

  let sent = 0;
  for (const row of rows) {
    try {
      const html = buildChurnEmail({
        fullName: row.full_name,
        companyName: row.company_name,
        healthScore: row.health_score,
        riskFactors: Array.isArray(row.churn_risk_factors) ? row.churn_risk_factors : [],
      });

      await sendMail({
        to: row.email,
        subject: "CyberStep — Hesabınızla ilgili önemli bilgi",
        html,
      });

      await db.execute(sql`
        UPDATE customer_health_scores
        SET intervention_triggered = true,
            intervention_type      = 'churn_email',
            intervention_sent_at   = NOW()
        WHERE customer_id = ${row.customer_id}
          AND calculated_at = (
            SELECT MAX(calculated_at) FROM customer_health_scores WHERE customer_id = ${row.customer_id}
          )
      `);

      await db.insert(healthInterventionsTable).values({
        customerId: row.customer_id,
        interventionType: "churn_email",
        healthScoreAtTrigger: row.health_score,
      });

      sent++;
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      logger.warn({ err, customerId: row.customer_id }, "churn_auto_intervention: e-posta gönderilemedi");
    }
  }

  if (sent > 0) {
    try {
      await sendMail({
        to: ADMIN_EMAIL,
        subject: `CyberStep Churn Uyarı — ${sent} müşteriye müdahale e-postası gönderildi`,
        html: `<div style="font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:24px;border-radius:8px">
<h3 style="color:#ff4560">Churn Müdahale Raporu</h3>
<p>Sağlık skoru ${CHURN_THRESHOLD}'in altında olan <strong>${sent}</strong> aktif müşteriye otomatik müdahale e-postası gönderildi.</p>
<p style="color:#a0a0a0;font-size:13px">Admin panelinden müşteri sağlık durumlarını takip edebilirsiniz: /panel/saglik</p>
</div>`,
      });
    } catch (err) {
      logger.warn({ err }, "churn_auto_intervention: admin bildirimi gönderilemedi");
    }
  }

  logger.info({ sent }, "churn_auto_intervention: tamamlandı");
  return sent;
}
