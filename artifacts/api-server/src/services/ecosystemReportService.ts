/**
 * Türkiye domain ekosisteminin güvenlik durumunu özetleyen haftalık rapor servisi.
 * domain_scans + lead_candidates tabloları üzerinden aggregasyon yapar.
 * Çıktı: JSON rapor objesi (DB'ye yazmak veya dışa aktarmak için hazır).
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface EcosystemReportResult {
  generatedAt: string;
  periodDays: number;
  intake: {
    totalScanned: number;
    bySource: { ctDiscovery: number; shodanFree: number; other: number };
  };
  security: {
    dmarcMissingPct: number;
    spfMissingPct: number;
    sslRiskPct: number;
    blacklistedPct: number;
    criticalCvePct: number;
    averageScore: number;
  };
  pipeline: {
    totalPending: number;
    totalTier1: number;
    totalTier2: number;
    totalTier3: number;
    qualificationRatePct: number;
    contactFoundPct: number;
    needsManualContactCount: number;
  };
}

type ScanStatsRow = {
  total_scanned: string;
  ct_discovery: string;
  shodan_free: string;
  other_sources: string;
  dmarc_missing_pct: string | null;
  spf_missing_pct: string | null;
  ssl_risk_pct: string | null;
  blacklisted_pct: string | null;
  cve_risk_pct: string | null;
  avg_score: string | null;
};

type PipelineStatsRow = {
  total_pending: string;
  tier1: string;
  tier2: string;
  tier3: string;
  total_qualified: string;
  total_scanned_lc: string;
  with_contact: string;
  needs_manual: string;
};

export async function generateEcosystemReport(daysBack = 30): Promise<EcosystemReportResult> {
  logger.info({ daysBack }, "Ekosistem raporu üretiliyor");

  const scanRows = await db.execute<ScanStatsRow>(sql`
    SELECT
      COUNT(*)::text                                                                                          AS total_scanned,
      COUNT(*) FILTER (WHERE lc.source = 'ct_discovery')::text                                              AS ct_discovery,
      COUNT(*) FILTER (WHERE lc.source = 'shodan_free')::text                                               AS shodan_free,
      COUNT(*) FILTER (WHERE lc.source NOT IN ('ct_discovery','shodan_free'))::text                         AS other_sources,
      ROUND(100.0 * COUNT(*) FILTER (WHERE NOT ds.dmarc_pass OR ds.dmarc_record IS NULL)
            / NULLIF(COUNT(*), 0), 1)::text                                                                  AS dmarc_missing_pct,
      ROUND(100.0 * COUNT(*) FILTER (WHERE NOT ds.spf_pass)
            / NULLIF(COUNT(*), 0), 1)::text                                                                  AS spf_missing_pct,
      ROUND(100.0 * COUNT(*) FILTER (WHERE NOT ds.ssl_pass OR ds.ssl_days_until_expiry < 30)
            / NULLIF(COUNT(*), 0), 1)::text                                                                  AS ssl_risk_pct,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ds.blacklisted OR ds.usom_listed)
            / NULLIF(COUNT(*), 0), 1)::text                                                                  AS blacklisted_pct,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ds.shodan_vuln_count > 0)
            / NULLIF(COUNT(*), 0), 1)::text                                                                  AS cve_risk_pct,
      ROUND(AVG(ds.overall_score), 1)::text                                                                  AS avg_score
    FROM lead_candidates lc
    JOIN domain_scans ds ON ds.id = lc.scan_id
    WHERE ds.created_at > NOW() - make_interval(days => ${daysBack})
  `);

  const pipelineRows = await db.execute<PipelineStatsRow>(sql`
    SELECT
      COUNT(*) FILTER (WHERE scan_status = 'pending')::text                                                  AS total_pending,
      COUNT(*) FILTER (WHERE tier = 'tier1')::text                                                           AS tier1,
      COUNT(*) FILTER (WHERE tier = 'tier2')::text                                                           AS tier2,
      COUNT(*) FILTER (WHERE tier = 'tier3' OR tier IS NULL)::text                                          AS tier3,
      COUNT(*) FILTER (WHERE is_qualified = true)::text                                                      AS total_qualified,
      COUNT(*) FILTER (WHERE scan_status = 'scanned')::text                                                  AS total_scanned_lc,
      COUNT(*) FILTER (WHERE is_qualified = true AND contact_email IS NOT NULL)::text                        AS with_contact,
      COUNT(*) FILTER (WHERE needs_manual_contact = true)::text                                              AS needs_manual
    FROM lead_candidates
  `);

  const s = scanRows.rows[0];
  const p = pipelineRows.rows[0];

  if (!s || !p) throw new Error("Ekosistem raporu: sorgu sonucu boş");

  const totalScanned = parseInt(s.total_scanned) || 0;
  const totalQualified = parseInt(p.total_qualified) || 0;
  const totalScannedLc = parseInt(p.total_scanned_lc) || 0;
  const withContact = parseInt(p.with_contact) || 0;

  const report: EcosystemReportResult = {
    generatedAt: new Date().toISOString(),
    periodDays: daysBack,
    intake: {
      totalScanned,
      bySource: {
        ctDiscovery: parseInt(s.ct_discovery) || 0,
        shodanFree: parseInt(s.shodan_free) || 0,
        other: parseInt(s.other_sources) || 0,
      },
    },
    security: {
      dmarcMissingPct: parseFloat(s.dmarc_missing_pct ?? "0") || 0,
      spfMissingPct: parseFloat(s.spf_missing_pct ?? "0") || 0,
      sslRiskPct: parseFloat(s.ssl_risk_pct ?? "0") || 0,
      blacklistedPct: parseFloat(s.blacklisted_pct ?? "0") || 0,
      criticalCvePct: parseFloat(s.cve_risk_pct ?? "0") || 0,
      averageScore: parseFloat(s.avg_score ?? "0") || 0,
    },
    pipeline: {
      totalPending: parseInt(p.total_pending) || 0,
      totalTier1: parseInt(p.tier1) || 0,
      totalTier2: parseInt(p.tier2) || 0,
      totalTier3: parseInt(p.tier3) || 0,
      qualificationRatePct: totalScannedLc > 0
        ? parseFloat((100 * totalQualified / totalScannedLc).toFixed(1))
        : 0,
      contactFoundPct: totalQualified > 0
        ? parseFloat((100 * withContact / totalQualified).toFixed(1))
        : 0,
      needsManualContactCount: parseInt(p.needs_manual) || 0,
    },
  };

  logger.info({
    totalScanned: report.intake.totalScanned,
    dmarcMissingPct: report.security.dmarcMissingPct,
    qualificationRatePct: report.pipeline.qualificationRatePct,
  }, "Ekosistem raporu üretildi");

  return report;
}
