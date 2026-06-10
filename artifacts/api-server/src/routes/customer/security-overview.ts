import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  domainScansTable,
  assessmentsTable,
  customersTable,
} from "@workspace/db";
import { eq, desc, sql, and, isNotNull, avg, count } from "drizzle-orm";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

type CreditGrade = "A+" | "A" | "B+" | "B" | "C" | "D" | "F";

function computeCreditGrade(score: number): CreditGrade {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function computeCreditScore(opts: {
  domainScore: number | null;
  assessmentRisk: string | null;
  breachCount: number;
  criticalCveCount: number;
}): number {
  let score = opts.domainScore ?? 50;
  // Assessment risk penalty
  if (opts.assessmentRisk === "Kritik") score -= 20;
  else if (opts.assessmentRisk === "Yüksek") score -= 10;
  else if (opts.assessmentRisk === "Orta") score -= 5;
  // Breach penalty
  if (opts.breachCount >= 10) score -= 10;
  else if (opts.breachCount >= 3) score -= 5;
  else if (opts.breachCount >= 1) score -= 2;
  // CVE penalty
  if (opts.criticalCveCount >= 5) score -= 10;
  else if (opts.criticalCveCount >= 2) score -= 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

type RansomwareBand = "Yüksek" | "Orta" | "Düşük";

function computeRansomwareScore(opts: {
  openPorts: Array<{ port: number }>;
  spfPass: boolean;
  dmarcPass: boolean;
  sslPass: boolean;
  breachCount: number;
  kevCveCount: number;
  blacklisted: boolean;
}): { score: number; band: RansomwareBand; factors: string[] } {
  let score = 0;
  const factors: string[] = [];
  const ports = opts.openPorts.map(p => p.port);

  if (ports.includes(3389)) { score += 25; factors.push("RDP portu (3389) açık"); }
  if (ports.includes(445)) { score += 20; factors.push("SMB/NetBIOS portu (445) açık"); }
  if (ports.includes(23)) { score += 15; factors.push("Telnet portu (23) açık"); }
  if (ports.includes(5900) || ports.includes(5901)) { score += 15; factors.push("VNC portu açık"); }
  if (!opts.dmarcPass) { score += 20; factors.push("DMARC koruması yok (phishing riski)"); }
  if (!opts.spfPass) { score += 15; factors.push("SPF kaydı eksik"); }
  if (opts.breachCount > 0) { score += 10; factors.push(`${opts.breachCount} e-posta sızıntısı`); }
  if (opts.kevCveCount > 0) { score += 15; factors.push(`${opts.kevCveCount} aktif istismar edilen CVE`); }
  if (!opts.sslPass) { score += 10; factors.push("SSL sertifikası geçersiz/süresi dolmuş"); }
  if (opts.blacklisted) { score += 10; factors.push("Kara listede kayıtlı"); }

  score = Math.min(100, score);
  const band: RansomwareBand = score >= 61 ? "Yüksek" : score >= 31 ? "Orta" : "Düşük";
  return { score, band, factors };
}

function computeDomainHijackScore(opts: {
  spfPass: boolean;
  dkimPass: boolean;
  dmarcPass: boolean;
  sslPass: boolean;
  blacklisted: boolean;
}): number {
  let score = 0;
  if (opts.spfPass) score += 20;
  if (opts.dkimPass) score += 20;
  if (opts.dmarcPass) score += 25;
  if (opts.sslPass) score += 20;
  if (!opts.blacklisted) score += 15;
  return score;
}

// ─── GET /api/customer/security-overview ─────────────────────────────────────
router.get("/customer/security-overview", requireCustomer, async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req) as number;

    // 1. Get customer email
    const [customer] = await db
      .select({ email: customersTable.email })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));

    if (!customer) { res.status(404).json({ error: "Müşteri bulunamadı" }); return; }

    // 2. Latest domain scan
    const [latestScan] = await db
      .select()
      .from(domainScansTable)
      .where(sql`${domainScansTable.email} = ${customer.email}`)
      .orderBy(desc(domainScansTable.createdAt))
      .limit(1);

    // 3. Last 6 scans for trend
    const trendScans = await db
      .select({
        id: domainScansTable.id,
        overallScore: domainScansTable.overallScore,
        createdAt: domainScansTable.createdAt,
      })
      .from(domainScansTable)
      .where(sql`${domainScansTable.email} = ${customer.email}`)
      .orderBy(desc(domainScansTable.createdAt))
      .limit(6);

    // 4. Latest assessment
    const [latestAssessment] = await db
      .select({
        riskLevel: assessmentsTable.riskLevel,
        sector: assessmentsTable.sector,
      })
      .from(assessmentsTable)
      .where(and(eq(assessmentsTable.email, customer.email), isNotNull(assessmentsTable.riskLevel)))
      .orderBy(desc(assessmentsTable.createdAt))
      .limit(1);

    // 5. Sector benchmark — avg score of same-sector customers
    let sectorBenchmark: { sector: string; avgScore: number; percentile: number } | null = null;
    if (latestAssessment?.sector) {
      const sectorAvgResult = await db.execute<{ avg_score: string; total: string }>(
        sql`
          SELECT
            AVG(ds.overall_score)::numeric(5,1) AS avg_score,
            COUNT(DISTINCT a.email) AS total
          FROM assessments a
          JOIN domain_scans ds ON ds.email = a.email
          WHERE a.sector = ${latestAssessment.sector}
            AND ds.overall_score IS NOT NULL
          LIMIT 1
        `
      );
      const sectorAvg = parseFloat(sectorAvgResult.rows[0]?.avg_score ?? "0");
      const myScore = latestScan?.overallScore ?? 50;
      // Percentile: how many in sector have score <= mine
      const percentileResult = await db.execute<{ pct: string }>(
        sql`
          SELECT
            ROUND(100.0 * SUM(CASE WHEN ds.overall_score <= ${myScore} THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) AS pct
          FROM assessments a
          JOIN domain_scans ds ON ds.email = a.email
          WHERE a.sector = ${latestAssessment.sector}
            AND ds.overall_score IS NOT NULL
        `
      );
      sectorBenchmark = {
        sector: latestAssessment.sector,
        avgScore: Math.round(sectorAvg),
        percentile: parseInt(percentileResult.rows[0]?.pct ?? "50"),
      };
    }

    // ─── Score calculations ───────────────────────────────────────────────────

    const breachCount = latestScan?.hibpBreachCount ?? 0;
    const cveList = (latestScan?.cveSummary ?? []) as Array<{ cvssScore: number; adjustedCvssScore?: number }>;
    const criticalCveCount = cveList.filter(c => (c.adjustedCvssScore ?? c.cvssScore) >= 9).length;
    const openPorts = (latestScan?.shodanOpenPorts ?? []) as Array<{ port: number }>;
    const orphanedAssets = (latestScan?.orphanedAssets ?? []) as Array<{ risk: string }>;

    const creditScore = computeCreditScore({
      domainScore: latestScan?.overallScore ?? null,
      assessmentRisk: latestAssessment?.riskLevel ?? null,
      breachCount,
      criticalCveCount,
    });
    const creditGrade = computeCreditGrade(creditScore);

    const ransomware = computeRansomwareScore({
      openPorts,
      spfPass: latestScan?.spfPass ?? false,
      dmarcPass: latestScan?.dmarcPass ?? false,
      sslPass: latestScan?.sslPass ?? false,
      breachCount,
      kevCveCount: criticalCveCount, // approximation
      blacklisted: latestScan?.blacklisted ?? false,
    });

    const domainHijackScore = latestScan
      ? computeDomainHijackScore({
          spfPass: latestScan.spfPass,
          dkimPass: latestScan.dkimPass,
          dmarcPass: latestScan.dmarcPass,
          sslPass: latestScan.sslPass,
          blacklisted: latestScan.blacklisted,
        })
      : null;

    const trend = trendScans
      .map(s => ({
        date: s.createdAt.toISOString().slice(0, 10),
        score: s.overallScore,
        grade: computeCreditGrade(computeCreditScore({
          domainScore: s.overallScore,
          assessmentRisk: latestAssessment?.riskLevel ?? null,
          breachCount,
          criticalCveCount,
        })),
      }))
      .reverse();

    res.json({
      creditGrade,
      creditScore,
      domain: latestScan?.domain ?? null,
      domainScore: latestScan?.overallScore ?? null,
      lastScanAt: latestScan?.createdAt ?? null,
      ransomwareScore: ransomware.score,
      ransomwareBand: ransomware.band,
      ransomwareFactors: ransomware.factors,
      domainHijackScore,
      trend,
      sectorBenchmark,
      signals: {
        breachCount,
        criticalCveCount,
        orphanedAssets: orphanedAssets.filter(a => a.risk === "high").length,
        openHighRiskPorts: openPorts
          .filter(p => [3389, 445, 23, 5900, 5901, 1433, 3306].includes(p.port))
          .map(p => String(p.port)),
        assessmentRisk: latestAssessment?.riskLevel ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, "security-overview: hesaplama hatası");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
