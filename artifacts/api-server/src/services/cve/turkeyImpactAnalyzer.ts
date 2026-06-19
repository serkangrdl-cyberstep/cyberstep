import { db, cveTrackerTable, cveDomainMatchesTable, customerTechStackTable, domainScansTable } from "@workspace/db";
import { eq, or, ilike, like, and, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import type { CVEEntry } from "./cveFeedReader";

export interface TurkeyImpactResult {
  totalAffected: number;
  criticalAffected: number;
  sectorBreakdown: Record<string, number>;
  cityBreakdown: Record<string, number>;
  topDomains: Array<{ domain: string; matchedProduct: string; confidence: number }>;
}

/** Simple version comparison without semver — returns true if currentVersion falls in [start, end) */
function isVersionVulnerable(
  currentVersion: string,
  startInclusive?: string,
  endExclusive?: string,
): boolean {
  if (!startInclusive && !endExclusive) return true;
  try {
    const parse = (v: string) => v.split(".").map(p => parseInt(p.replace(/[^0-9]/g, "")) || 0);
    const cmp = (a: number[], b: number[]): number => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    };
    const curr = parse(currentVersion);
    if (startInclusive && cmp(curr, parse(startInclusive)) < 0) return false;
    if (endExclusive && cmp(curr, parse(endExclusive)) >= 0) return false;
    return true;
  } catch {
    return true;
  }
}

export async function analyzeTurkeyImpact(cve: CVEEntry): Promise<TurkeyImpactResult> {
  await db.update(cveTrackerTable).set({
    status: "scanning",
    trScanStartedAt: new Date(),
  }).where(eq(cveTrackerTable.cveId, cve.cveId));

  const matchMap = new Map<string, {
    domain: string;
    customerId: number | null;
    leadCandidateId: number | null;
    matchedProduct: string;
    matchedVersion: string | null;
    confidence: number;
  }>();

  for (const product of cve.affectedProducts) {
    if (!product.vendor && !product.product) continue;

    const conditions = [];
    if (product.vendor) conditions.push(ilike(customerTechStackTable.vendor, `%${product.vendor.replace(/_/g, " ")}%`));
    if (product.product) conditions.push(ilike(customerTechStackTable.product, `%${product.product.replace(/_/g, " ")}%`));

    const rows = await db.select({
      domain: customerTechStackTable.domain,
      customerId: customerTechStackTable.customerId,
      leadCandidateId: customerTechStackTable.leadCandidateId,
      vendor: customerTechStackTable.vendor,
      product: customerTechStackTable.product,
      version: customerTechStackTable.version,
      confidence: customerTechStackTable.confidence,
    }).from(customerTechStackTable).where(
      and(
        or(...conditions),
        // .tr filtresi YOK — sistemde kayıtlı her domain kapsanır
        // (leadCandidateId veya customerId varsa Türkiye için keşfedilmiştir)
        or(
          sql`${customerTechStackTable.leadCandidateId} IS NOT NULL`,
          sql`${customerTechStackTable.customerId} IS NOT NULL`,
        ),
      )
    );

    for (const row of rows) {
      if (product.versionEndExcluding && row.version) {
        if (!isVersionVulnerable(row.version, product.versionStartIncluding, product.versionEndExcluding)) continue;
      }

      const existing = matchMap.get(row.domain);
      const conf = row.confidence ?? 50;
      if (!existing || conf > existing.confidence) {
        matchMap.set(row.domain, {
          domain: row.domain,
          customerId: row.customerId ?? null,
          leadCandidateId: row.leadCandidateId ?? null,
          matchedProduct: `${row.vendor ?? ""} ${row.product ?? ""}`.trim(),
          matchedVersion: row.version ?? null,
          confidence: conf,
        });
      }
    }
  }

  // ── domain_scans.shadow_it_services'ten ek eşleşme ────────────────────────
  // customer_tech_stack'e girmeyen (manuel taranmış) domain'leri de kapsar.
  {
    // domain_scans tablosundaki tüm kayıtlar sistemde kayıtlı domainlerdir —
    // .tr filtresi olmadan alıyoruz; .net, .com, .io gibi uzantılar da kapsar.
    const trDomains = await db.select({
      domain: domainScansTable.domain,
      shadowItServices: domainScansTable.shadowItServices,
    }).from(domainScansTable);

    for (const scan of trDomains) {
      if (!scan.domain || matchMap.has(scan.domain)) continue; // zaten eşleşmiş
      const services = (scan.shadowItServices ?? []) as Array<{ name: string; category: string; version?: string }>;
      if (services.length === 0) continue;

      for (const product of cve.affectedProducts) {
        const pLower = (product.product ?? "").toLowerCase().replace(/_/g, " ");
        const vLower = (product.vendor ?? "").toLowerCase().replace(/_/g, " ");
        if (!pLower && !vLower) continue;

        const matched = services.find(s => {
          const sLower = s.name.toLowerCase();
          return (pLower && sLower.includes(pLower)) || (vLower && sLower.includes(vLower));
        });
        if (!matched) continue;

        matchMap.set(scan.domain, {
          domain: scan.domain,
          customerId: null,
          leadCandidateId: null,
          matchedProduct: matched.name,
          matchedVersion: matched.version ?? null,
          confidence: 75,
        });
        break; // bu domain için bir product yetti
      }
    }
  }

  const matches = Array.from(matchMap.values());

  // Save matches to DB
  if (matches.length > 0) {
    await db.insert(cveDomainMatchesTable).values(
      matches.map(m => ({
        cveId: cve.cveId,
        domain: m.domain,
        customerId: m.customerId ?? undefined,
        leadCandidateId: m.leadCandidateId ?? undefined,
        matchedProduct: m.matchedProduct,
        matchedVersion: m.matchedVersion ?? undefined,
        confidence: m.confidence,
      }))
    ).onConflictDoNothing();
  }

  // Sector + city breakdown from lead_candidates table
  const sectorBreakdown: Record<string, number> = {};
  const cityBreakdown: Record<string, number> = {};

  if (matches.length > 0) {
    const { leadCandidatesTable: lct } = await import("@workspace/db");
    for (const m of matches) {
      if (!m.leadCandidateId) continue;
      const [lead] = await db.select({ sector: lct.sector, city: lct.city })
        .from(lct)
        .where(eq(lct.id, m.leadCandidateId));
      if (lead?.sector) sectorBreakdown[lead.sector] = (sectorBreakdown[lead.sector] ?? 0) + 1;
      if (lead?.city) cityBreakdown[lead.city] = (cityBreakdown[lead.city] ?? 0) + 1;
    }
  }

  const criticalThreshold = (cve.cisaKev || cve.exploitPublic) ? 60 : 75;
  const criticalAffected = matches.filter(m => m.confidence >= criticalThreshold).length;
  const topDomains = matches
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map(m => ({ domain: m.domain, matchedProduct: m.matchedProduct, confidence: m.confidence }));

  await db.update(cveTrackerTable).set({
    trAffectedDomains: matches.length,
    trCriticalDomains: criticalAffected,
    trSectorsAffected: sectorBreakdown,
    trTopCities: cityBreakdown,
    trScanCompletedAt: new Date(),
  }).where(eq(cveTrackerTable.cveId, cve.cveId));

  logger.info({ cveId: cve.cveId, totalAffected: matches.length, criticalAffected }, "Türkiye etki analizi tamamlandı");

  return { totalAffected: matches.length, criticalAffected, sectorBreakdown, cityBreakdown, topDomains };
}
