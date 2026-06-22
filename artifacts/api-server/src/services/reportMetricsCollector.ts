/**
 * Faz 3 — Aylık Metrik Toplama Cron
 *
 * Her ayın 1'inde domain_scans + lead_candidates tablolarından temel güvenlik
 * metriklerini toplar ve report_metrics_snapshot tablosuna yazar.
 * AI içerik üretimi bu veriden beslenecek — bu fazda sadece veri toplansın.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

function getPreviousPeriodLabel(label: string): string {
  const match = label.match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

interface GeneralMetricsRow extends Record<string, unknown> {
  total_scanned: string;
  avg_score: string;
  waf_count: string;
  cdn_count: string;
  total_with_score: string;
  critical_port_count: string;
  spf_pass: string;
  dmarc_pass: string;
  ssl_valid: string;
  total_qualified: string;
}

interface SectorRow extends Record<string, unknown> {
  sector: string;
  count: string;
}

interface SectorScoreRow extends Record<string, unknown> {
  sector: string;
  avg_score: string;
  count: string;
}

interface PrevSnapRow extends Record<string, unknown> {
  metrics: Record<string, unknown>;
}

export async function runReportMetricsCollector(): Promise<{ snapshotsWritten: number }> {
  const now = new Date();
  const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodType = "monthly";
  const prevLabel = getPreviousPeriodLabel(periodLabel);

  logger.info({ periodLabel }, "Metrik toplama başlıyor");

  // ─── Genel metrikler ─────────────────────────────────────────────────────
  const generalResult = await db.execute<GeneralMetricsRow>(sql`
    SELECT
      COUNT(*)::text AS total_scanned,
      ROUND(AVG(overall_score))::text AS avg_score,
      COUNT(*) FILTER (WHERE waf_detected = true)::text AS waf_count,
      COUNT(*) FILTER (WHERE has_cdn = true)::text AS cdn_count,
      COUNT(*) FILTER (WHERE overall_score IS NOT NULL)::text AS total_with_score,
      COUNT(*) FILTER (
        WHERE open_ports::text ~ '(3306|21|3389|23|5900)'
      )::text AS critical_port_count,
      COUNT(*) FILTER (WHERE spf_pass = true)::text AS spf_pass,
      COUNT(*) FILTER (WHERE dmarc_pass = true)::text AS dmarc_pass,
      COUNT(*) FILTER (WHERE ssl_valid = true)::text AS ssl_valid,
      COUNT(*) FILTER (WHERE overall_score >= 60)::text AS total_qualified
    FROM domain_scans
  `);
  const generalMetrics = generalResult.rows[0];

  // ─── Sektör dağılımı (qualified lead_candidates) ──────────────────────
  const sectorResult = await db.execute<SectorRow>(sql`
    SELECT
      COALESCE(sector, 'Bilinmiyor') AS sector,
      COUNT(*)::text AS count
    FROM lead_candidates
    WHERE is_qualified = true
      AND sector IS NOT NULL
    GROUP BY sector
    ORDER BY count DESC
    LIMIT 15
  `);

  // ─── Sektör bazlı ortalama skor ───────────────────────────────────────
  const sectorScoreResult = await db.execute<SectorScoreRow>(sql`
    SELECT
      lc.sector,
      ROUND(AVG(ds.overall_score))::text AS avg_score,
      COUNT(*)::text AS count
    FROM lead_candidates lc
    JOIN domain_scans ds ON ds.domain = lc.domain
    WHERE lc.is_qualified = true
      AND lc.sector IS NOT NULL
      AND ds.overall_score IS NOT NULL
    GROUP BY lc.sector
    ORDER BY avg_score DESC
    LIMIT 15
  `);

  const totalScanned = parseInt(generalMetrics?.total_scanned ?? "0");
  const totalWithScore = parseInt(generalMetrics?.total_with_score ?? "0");
  const wafCount = parseInt(generalMetrics?.waf_count ?? "0");
  const cdnCount = parseInt(generalMetrics?.cdn_count ?? "0");
  const criticalPortCount = parseInt(generalMetrics?.critical_port_count ?? "0");
  const spfPass = parseInt(generalMetrics?.spf_pass ?? "0");
  const dmarcPass = parseInt(generalMetrics?.dmarc_pass ?? "0");
  const sslValid = parseInt(generalMetrics?.ssl_valid ?? "0");

  const metrics = {
    totalScanned,
    avgScore: parseInt(generalMetrics?.avg_score ?? "0"),
    wafRatePct: totalScanned > 0 ? Math.round((wafCount / totalScanned) * 100) : 0,
    cdnRatePct: totalScanned > 0 ? Math.round((cdnCount / totalScanned) * 100) : 0,
    criticalPortRatePct: totalWithScore > 0 ? Math.round((criticalPortCount / totalWithScore) * 100) : 0,
    spfPassRatePct: totalWithScore > 0 ? Math.round((spfPass / totalWithScore) * 100) : 0,
    dmarcPassRatePct: totalWithScore > 0 ? Math.round((dmarcPass / totalWithScore) * 100) : 0,
    sslValidRatePct: totalWithScore > 0 ? Math.round((sslValid / totalWithScore) * 100) : 0,
    totalQualified: parseInt(generalMetrics?.total_qualified ?? "0"),
    sectorDistribution: sectorResult.rows.map((r: SectorRow) => ({
      sector: r.sector,
      count: parseInt(r.count),
    })),
    sectorAvgScores: sectorScoreResult.rows.map((r: SectorScoreRow) => ({
      sector: r.sector,
      avgScore: parseInt(r.avg_score),
      count: parseInt(r.count),
    })),
  };

  // ─── Delta hesapla (önceki dönem snapshot varsa) ───────────────────────
  let deltaVsPrevious: Record<string, number> | null = null;
  if (prevLabel) {
    const prevResult = await db.execute<PrevSnapRow>(sql`
      SELECT metrics FROM report_metrics_snapshot
      WHERE period_type = ${periodType}
        AND period_label = ${prevLabel}
        AND sector IS NULL
      ORDER BY collected_at DESC
      LIMIT 1
    `);
    const prevSnap = prevResult.rows[0];
    if (prevSnap?.metrics) {
      const prev = prevSnap.metrics as Record<string, number>;
      deltaVsPrevious = {
        avgScoreDelta: metrics.avgScore - (prev["avgScore"] ?? 0),
        wafRateDelta: metrics.wafRatePct - (prev["wafRatePct"] ?? 0),
        criticalPortRateDelta: metrics.criticalPortRatePct - (prev["criticalPortRatePct"] ?? 0),
        totalScannedDelta: metrics.totalScanned - (prev["totalScanned"] ?? 0),
        totalQualifiedDelta: metrics.totalQualified - (prev["totalQualified"] ?? 0),
      };
    }
  }

  // ─── Snapshot yaz (upsert by period) ──────────────────────────────────
  await db.execute(sql`
    INSERT INTO report_metrics_snapshot (period_type, period_label, sector, metrics, delta_vs_previous, collected_at)
    VALUES (${periodType}, ${periodLabel}, NULL, ${JSON.stringify(metrics)}::jsonb, ${deltaVsPrevious ? JSON.stringify(deltaVsPrevious) : null}::jsonb, NOW())
    ON CONFLICT DO NOTHING
  `);

  logger.info({ periodLabel, totalScanned, avgScore: metrics.avgScore, deltaVsPrevious }, "Metrik toplama tamamlandı");

  return { snapshotsWritten: 1 };
}
