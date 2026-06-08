import { pool } from "@workspace/db";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

const ADMIN_EMAIL = process.env["ADMIN_EMAIL"] ?? "info@cyberstep.com";
const MIN_REPORT_CHARS = 400;
const MAX_ERROR_RATE_PCT = 10;

export async function runAiQualityMonitor(): Promise<number> {
  logger.info("ai_quality_monitor: kalite kontrolü başladı");

  const issues: string[] = [];

  // 1. Son 24s raporlarda kısa/boş aiAnalysis kontrolü
  try {
    const reportCheck = await pool.query<{
      total: string;
      short_count: string;
      empty_count: string;
      avg_len: string;
    }>(`
      SELECT
        COUNT(*)::text                                             AS total,
        COUNT(*) FILTER (WHERE LENGTH(ai_analysis) < $1)::text   AS short_count,
        COUNT(*) FILTER (WHERE ai_analysis = '' OR ai_analysis IS NULL)::text AS empty_count,
        COALESCE(AVG(LENGTH(ai_analysis)), 0)::text              AS avg_len
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `, [MIN_REPORT_CHARS]);

    const r = reportCheck.rows[0];
    if (r) {
      const total = parseInt(r.total, 10);
      const shortCount = parseInt(r.short_count, 10);
      const emptyCount = parseInt(r.empty_count, 10);
      const avgLen = parseFloat(r.avg_len);

      if (total > 0) {
        const shortRate = (shortCount / total) * 100;
        if (emptyCount > 0) {
          issues.push(`RAPOR HATASI: Son 24 saatte ${emptyCount} raporda aiAnalysis tamamen boş`);
        }
        if (shortRate > MAX_ERROR_RATE_PCT) {
          issues.push(`RAPOR KALİTE: Son 24 saatte %${shortRate.toFixed(0)} rapor ${MIN_REPORT_CHARS} karakterden kısa (ort: ${Math.round(avgLen)} karakter)`);
        }
        logger.info({ total, shortCount, emptyCount, avgLen: Math.round(avgLen) }, "ai_quality_monitor: rapor kontrolü tamamlandı");
      }
    }
  } catch (err) {
    logger.warn({ err }, "ai_quality_monitor: rapor kontrolü başarısız");
  }

  // 2. AI maliyet tablosunda hata paterni
  try {
    const costCheck = await pool.query<{
      service: string;
      error_count: string;
      total_count: string;
    }>(`
      SELECT
        service,
        COUNT(*) FILTER (WHERE error IS NOT NULL)::text AS error_count,
        COUNT(*)::text                                  AS total_count
      FROM ai_cost_log
      WHERE recorded_at >= NOW() - INTERVAL '24 hours'
      GROUP BY service
      HAVING COUNT(*) FILTER (WHERE error IS NOT NULL) > 0
    `).catch(() => ({ rows: [] as { service: string; error_count: string; total_count: string }[] }));

    for (const row of costCheck.rows) {
      const errRate = (parseInt(row.error_count, 10) / parseInt(row.total_count, 10)) * 100;
      if (errRate > MAX_ERROR_RATE_PCT) {
        issues.push(`AI HATA: ${row.service} — son 24s %${errRate.toFixed(0)} hata oranı (${row.error_count}/${row.total_count})`);
      }
    }
  } catch (err) {
    logger.warn({ err }, "ai_quality_monitor: cost log kontrolü başarısız");
  }

  // 3. Domain scan AI raporları (attack_scenarios_status = error kontrolü)
  try {
    const scanCheck = await pool.query<{ error_count: string; total_count: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE attack_scenarios_status = 'error')::text AS error_count,
        COUNT(*)::text                                                    AS total_count
      FROM domain_scans
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND attack_scenarios_status IS NOT NULL
        AND attack_scenarios_status != 'none'
    `).catch(() => ({ rows: [] as { error_count: string; total_count: string }[] }));

    const scan = scanCheck.rows[0];
    if (scan) {
      const errCount = parseInt(scan.error_count, 10);
      const total = parseInt(scan.total_count, 10);
      if (total > 0 && errCount > 0) {
        const rate = (errCount / total) * 100;
        if (rate > MAX_ERROR_RATE_PCT) {
          issues.push(`SALDIRI ANALİZİ: Son 24s %${rate.toFixed(0)} taramada AI senaryosu oluşturulamadı (${errCount}/${total})`);
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "ai_quality_monitor: domain scan kontrolü başarısız");
  }

  if (issues.length === 0) {
    logger.info("ai_quality_monitor: kalite sorun yok");
    return 0;
  }

  logger.warn({ issues }, "ai_quality_monitor: kalite sorunları tespit edildi");

  try {
    await sendMail({
      to: ADMIN_EMAIL,
      subject: `CyberStep AI Kalite Uyarı — ${issues.length} sorun tespit edildi`,
      html: `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span><span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span><span style="color:#7B8FAF;font-size:14px">.io</span>
  </div>
  <div style="background:rgba(255,69,96,0.08);border:1px solid #FF4560;border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="color:#FF4560;font-weight:bold;font-size:16px">AI Çıktı Kalite Uyarısı</div>
    <div style="color:#A8B8D0;font-size:13px;margin-top:4px">Son 24 saatte ${issues.length} kalite sorunu tespit edildi</div>
  </div>
  <ul style="list-style:none;padding:0;margin:0">
    ${issues.map(issue => `
    <li style="background:rgba(255,255,255,0.03);border-radius:6px;padding:12px;margin-bottom:8px;color:#A8B8D0;font-size:14px;font-family:monospace">
      ${issue}
    </li>`).join("")}
  </ul>
  <p style="font-size:12px;color:#5A6A80;margin-top:24px">
    Admin panel → Raporlar / Loglar bölümünden detaylı inceleme yapabilirsiniz.
  </p>
</div>`.trim(),
    });
  } catch (err) {
    logger.warn({ err }, "ai_quality_monitor: admin e-postası gönderilemedi");
  }

  return issues.length;
}
