import { db } from "@workspace/db";
import { domainScansTable } from "@workspace/db";
import { and, gte, lte, eq, sql } from "drizzle-orm";

export interface IndexStats {
  totalScanned: number;
  qualifyingDomains: number;
  avgScore: number;
  scoreDistribution: Record<string, number>;
  email: {
    dmarcMissing: number;
    dmarcNone: number;
    dmarcQuarantine: number;
    dmarcReject: number;
    spfMissing: number;
    dkimMissing: number;
  };
  ssl: { sslValid: number; sslExpiring: number; sslExpired: number };
  ports: { mysqlExposed: number; ftpExposed: number; rdpExposed: number; anyHighRisk: number };
  cve: { withCVE: number; withCriticalCVE: number };
  tech: { wordpressUsage: number; cdnUsage: number };
  blacklisted: number;
  sectorStats: Array<{ sector: string; count: number; avgScore: number; pct: number }>;
  cityStats: Array<{ city: string; count: number; avgScore: number }>;
  hostingStats: Array<{ provider: string; count: number; pct: number }>;
}

function deriveDmarcPolicy(dmarcRecord: string | null): string | null {
  if (!dmarcRecord) return null;
  const m = dmarcRecord.match(/p=(\w+)/i);
  return m ? m[1]!.toLowerCase() : null;
}

export async function calculateIndexStats(startDate: Date, endDate: Date): Promise<IndexStats> {
  const scans = await db.select().from(domainScansTable).where(
    and(
      gte(domainScansTable.createdAt, startDate),
      lte(domainScansTable.createdAt, endDate),
      eq(domainScansTable.includedInIndex, true),
    )
  );

  if (scans.length === 0) throw new Error("Bu tarih aralığında yeterli veri yok");

  const pct = (n: number) => Math.round((n / scans.length) * 1000) / 10;

  const avgScore = scans.reduce((s, r) => s + (r.overallScore ?? 0), 0) / scans.length;

  const scoreDistribution: Record<string, number> = {
    "0-20":   scans.filter(s => (s.overallScore ?? 0) <= 20).length,
    "21-40":  scans.filter(s => (s.overallScore ?? 0) > 20 && (s.overallScore ?? 0) <= 40).length,
    "41-60":  scans.filter(s => (s.overallScore ?? 0) > 40 && (s.overallScore ?? 0) <= 60).length,
    "61-80":  scans.filter(s => (s.overallScore ?? 0) > 60 && (s.overallScore ?? 0) <= 80).length,
    "81-100": scans.filter(s => (s.overallScore ?? 0) > 80).length,
  };

  const email = {
    dmarcMissing:    pct(scans.filter(s => !s.dmarcRecord).length),
    dmarcNone:       pct(scans.filter(s => deriveDmarcPolicy(s.dmarcRecord) === "none").length),
    dmarcQuarantine: pct(scans.filter(s => deriveDmarcPolicy(s.dmarcRecord) === "quarantine").length),
    dmarcReject:     pct(scans.filter(s => deriveDmarcPolicy(s.dmarcRecord) === "reject").length),
    spfMissing:      pct(scans.filter(s => !s.spfRecord).length),
    dkimMissing:     pct(scans.filter(s => !s.dkimPass).length),
  };

  const openPortsFor = (port: number) =>
    scans.filter(s => (s.shodanOpenPorts as Array<{ port: number }> ?? []).some(p => p.port === port)).length;

  const ssl = {
    sslValid:    pct(scans.filter(s => (s.sslDaysUntilExpiry ?? 0) > 30).length),
    sslExpiring: pct(scans.filter(s => (s.sslDaysUntilExpiry ?? 0) > 0 && (s.sslDaysUntilExpiry ?? 0) <= 30).length),
    sslExpired:  pct(scans.filter(s => s.sslDaysUntilExpiry === null || (s.sslDaysUntilExpiry ?? 0) <= 0).length),
  };

  const ports = {
    mysqlExposed: pct(openPortsFor(3306)),
    ftpExposed:   pct(openPortsFor(21)),
    rdpExposed:   pct(openPortsFor(3389)),
    anyHighRisk:  pct(scans.filter(s => {
      const ops = s.shodanOpenPorts as Array<{ port: number }> ?? [];
      return [3306, 21, 3389, 5900, 1433].some(p => ops.some(o => o.port === p));
    }).length),
  };

  const cve = {
    withCVE:         pct(scans.filter(s => (s.cveSummary as Array<unknown> ?? []).length > 0).length),
    withCriticalCVE: pct(scans.filter(s => s.criticalCveCount > 0).length),
  };

  const tech = {
    wordpressUsage: pct(scans.filter(s => s.isWordpress).length),
    cdnUsage:       pct(scans.filter(s => s.hasCdn).length),
  };

  const blacklisted = pct(scans.filter(s => s.blacklistCount > 0).length);

  // Sektör breakdown
  const sectorMap = new Map<string, number[]>();
  for (const s of scans) {
    const sec = s.sector ?? "diger";
    if (!sectorMap.has(sec)) sectorMap.set(sec, []);
    sectorMap.get(sec)!.push(s.overallScore ?? 0);
  }
  const sectorStats = Array.from(sectorMap.entries())
    .map(([sector, scores]) => ({
      sector,
      count: scores.length,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      pct: pct(scores.length),
    }))
    .sort((a, b) => b.count - a.count);

  // Şehir breakdown
  const cityMap = new Map<string, number[]>();
  for (const s of scans) {
    const city = s.city ?? "Bilinmiyor";
    if (!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city)!.push(s.overallScore ?? 0);
  }
  const cityStats = Array.from(cityMap.entries())
    .filter(([_, scores]) => scores.length >= 3)
    .map(([city, scores]) => ({
      city,
      count: scores.length,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Hosting breakdown
  const hostingMap = new Map<string, number>();
  for (const s of scans) {
    const h = s.hostingProvider ?? "bilinmiyor";
    hostingMap.set(h, (hostingMap.get(h) ?? 0) + 1);
  }
  const hostingStats = Array.from(hostingMap.entries())
    .map(([provider, count]) => ({ provider, count, pct: pct(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalScanned: scans.length,
    qualifyingDomains: scans.length,
    avgScore: Math.round(avgScore * 10) / 10,
    scoreDistribution,
    email, ssl, ports, cve, tech, blacklisted,
    sectorStats, cityStats, hostingStats,
  };
}
