import { db, domainScansTable, cveTrackerTable, leadCandidatesTable } from "@workspace/db";
import { and, gte, lte, like, desc, sql, count, avg, isNotNull, eq, lt } from "drizzle-orm";
import { logger } from "../../lib/logger";

export interface WeeklyData {
  totalScans: number;
  newCriticalCVEs: Array<{
    cveId: string;
    cvssScore: string | null;
    trAffectedDomains: number | null;
    affectedProducts: unknown;
    patchAvailable: boolean | null;
    cisaKev: boolean | null;
  }>;
  topCVE: WeeklyData["newCriticalCVEs"][0] | null;
  topFindingType: string;
  topFindingCount: number;
  topSector: string | null;
  topSectorAvgScore: number | null;
  weeklyRiskChange: number;
  avgRiskScore: number;
  weekStart: Date;
  weekEnd: Date;
}

async function getAvgScore(from: Date, to: Date): Promise<number> {
  const [row] = await db.select({ avg: avg(domainScansTable.overallScore) })
    .from(domainScansTable)
    .where(and(
      gte(domainScansTable.createdAt, from),
      lte(domainScansTable.createdAt, to),
      like(domainScansTable.domain, "%.tr"),
    ));
  return Number(row?.avg ?? 0);
}

export async function collectWeeklyData(weekStart: Date, weekEnd: Date): Promise<WeeklyData> {
  // Total scans this week (.tr domains)
  const [scanCount] = await db.select({ count: count() })
    .from(domainScansTable)
    .where(and(
      gte(domainScansTable.createdAt, weekStart),
      lte(domainScansTable.createdAt, weekEnd),
      like(domainScansTable.domain, "%.tr"),
    ));

  // New critical CVEs this week with TR impact
  const newCriticalCVEs = await db.select({
    cveId: cveTrackerTable.cveId,
    cvssScore: cveTrackerTable.cvssScore,
    trAffectedDomains: cveTrackerTable.trAffectedDomains,
    affectedProducts: cveTrackerTable.affectedProducts,
    patchAvailable: cveTrackerTable.patchAvailable,
    cisaKev: cveTrackerTable.cisaKev,
  }).from(cveTrackerTable)
    .where(and(
      gte(cveTrackerTable.detectedAt, weekStart),
      lte(cveTrackerTable.detectedAt, weekEnd),
      eq(cveTrackerTable.severity, "critical"),
      gte(cveTrackerTable.trAffectedDomains, 20),
    ))
    .orderBy(desc(cveTrackerTable.trAffectedDomains))
    .limit(5);

  // Derive "top finding type" from scan boolean columns
  const scansThisWeek = await db.select({
    dmarcPass: domainScansTable.dmarcPass,
    spfPass: domainScansTable.spfPass,
    sslPass: domainScansTable.sslPass,
    sslDaysUntilExpiry: domainScansTable.sslDaysUntilExpiry,
    hibpBreachCount: domainScansTable.hibpBreachCount,
    blacklisted: domainScansTable.blacklisted,
  }).from(domainScansTable)
    .where(and(
      gte(domainScansTable.createdAt, weekStart),
      lte(domainScansTable.createdAt, weekEnd),
      like(domainScansTable.domain, "%.tr"),
    ));

  const findingCounts: Record<string, number> = {
    no_dmarc: 0,
    no_spf: 0,
    ssl_issue: 0,
    ssl_expiring: 0,
    data_breach: 0,
    blacklisted: 0,
  };

  for (const s of scansThisWeek) {
    if (!s.dmarcPass) findingCounts["no_dmarc"]!++;
    if (!s.spfPass) findingCounts["no_spf"]!++;
    if (!s.sslPass) findingCounts["ssl_issue"]!++;
    if (s.sslDaysUntilExpiry !== null && s.sslDaysUntilExpiry < 30) findingCounts["ssl_expiring"]!++;
    if ((s.hibpBreachCount ?? 0) > 0) findingCounts["data_breach"]!++;
    if (s.blacklisted) findingCounts["blacklisted"]!++;
  }

  const topFindingType = Object.entries(findingCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "no_dmarc";
  const topFindingCount = findingCounts[topFindingType] ?? 0;

  // Top sector by average risk this week
  const sectorScores = await db.select({
    sector: leadCandidatesTable.sector,
    avgScore: avg(domainScansTable.overallScore),
  }).from(domainScansTable)
    .leftJoin(leadCandidatesTable, eq(domainScansTable.domain, leadCandidatesTable.domain))
    .where(and(
      gte(domainScansTable.createdAt, weekStart),
      lte(domainScansTable.createdAt, weekEnd),
      isNotNull(leadCandidatesTable.sector),
    ))
    .groupBy(leadCandidatesTable.sector)
    .orderBy(desc(avg(domainScansTable.overallScore)))
    .limit(1);

  // Weekly risk change
  const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 3600 * 1000);
  const prevWeekEnd = new Date(weekEnd.getTime() - 7 * 24 * 3600 * 1000);
  const [thisAvg, prevAvg] = await Promise.all([
    getAvgScore(weekStart, weekEnd),
    getAvgScore(prevWeekStart, prevWeekEnd),
  ]);

  logger.info({
    totalScans: scanCount?.count,
    newCVEs: newCriticalCVEs.length,
    topFinding: topFindingType,
    avgScore: thisAvg,
  }, "Haftalık bülten verisi toplandı");

  return {
    totalScans: Number(scanCount?.count ?? 0),
    newCriticalCVEs,
    topCVE: newCriticalCVEs[0] ?? null,
    topFindingType,
    topFindingCount,
    topSector: sectorScores[0]?.sector ?? null,
    topSectorAvgScore: sectorScores[0]?.avgScore ? Number(sectorScores[0].avgScore) : null,
    weeklyRiskChange: thisAvg - prevAvg,
    avgRiskScore: thisAvg,
    weekStart,
    weekEnd,
  };
}
