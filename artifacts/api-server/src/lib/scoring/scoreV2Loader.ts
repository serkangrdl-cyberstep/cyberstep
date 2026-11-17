/**
 * Skor v2 için veritabanı katmanı: bir domainin en son taramasını ve
 * içindeki CVE'lerin KEV durumunu okuyup computeScoreV2'ye verir.
 */

import { db, domainScansTable, cveIntelligenceTable } from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import { computeScoreV2, cveIdsOf, type KevLookup, type ScoreV2Input, type ScoreV2Result } from "./scoreV2";

export type DomainScanRow = typeof domainScansTable.$inferSelect;

/** Bu süreden eski taramalar "bayat" kabul edilir ve yeniden taranmalıdır. */
export const SCAN_FRESH_DAYS = 7;

export function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.$/, "");
}

export function isScanFresh(scan: { createdAt: Date | null } | null | undefined, days = SCAN_FRESH_DAYS): boolean {
  if (!scan?.createdAt) return false;
  return Date.now() - new Date(scan.createdAt).getTime() < days * 24 * 60 * 60 * 1000;
}

/**
 * TPRM raporu için kullanılabilir tarama: yeterince yeni VE tam tarama olmalı.
 * Keşif hattının hafif taraması (HIBP, başlıklar, URLhaus, Safe Browsing, VT, AbuseIPDB yok)
 * geçici skor olarak gösterilebilir, ancak tedarikçi raporunun dayanağı sayılmaz.
 */
export function isScanCompleteAndFresh(scan: { createdAt: Date | null; referralSource?: string | null } | null | undefined): boolean {
  return isScanFresh(scan) && scan?.referralSource !== "discovery_pipeline";
}

export async function getLatestScan(domain: string): Promise<DomainScanRow | null> {
  const d = normalizeDomain(domain);
  const [scan] = await db.select().from(domainScansTable)
    .where(eq(domainScansTable.domain, d))
    .orderBy(desc(domainScansTable.createdAt))
    .limit(1);
  return scan ?? null;
}

export async function loadKevLookup(cveIds: string[]): Promise<KevLookup> {
  const map: KevLookup = new Map();
  if (cveIds.length === 0) return map;
  const rows = await db.select({
    cveId: cveIntelligenceTable.cveId,
    isKev: cveIntelligenceTable.isKev,
    ransomware: cveIntelligenceTable.kevRansomwareUse,
  }).from(cveIntelligenceTable)
    .where(inArray(cveIntelligenceTable.cveId, cveIds));
  for (const r of rows) {
    if (r.isKev) map.set(r.cveId, { ransomware: !!r.ransomware });
  }
  return map;
}

export function scanToScoreInput(scan: DomainScanRow): ScoreV2Input {
  return {
    referralSource: scan.referralSource,
    createdAt: scan.createdAt,
    spfPass: scan.spfPass,
    spfRecord: scan.spfRecord,
    dmarcPass: scan.dmarcPass,
    dmarcRecord: scan.dmarcRecord,
    dkimPass: scan.dkimPass,
    mxPass: scan.mxPass,
    sslPass: scan.sslPass,
    sslDaysUntilExpiry: scan.sslDaysUntilExpiry,
    // Saklanan değer 0-5 (mevcut başlık sayısı); skor modeli 0-100 bekler. Kontrol başarısızsa ölçülmedi sayılır.
    httpHeadersScore: scan.httpHeadersScore == null || (scan.httpHeadersDetails as { checkFailed?: boolean } | null)?.checkFailed
      ? null
      : Math.min(100, scan.httpHeadersScore * 20),
    xPoweredBy: (scan.httpHeadersDetails as { xPoweredBy?: string | null } | null)?.xPoweredBy ?? null,
    sslUnchecked: ((scan.uncheckedSources as string[] | null) ?? []).includes("ssl"),
    uncheckedSources: (scan.uncheckedSources as string[] | null) ?? [],
    cveSummary: scan.cveSummary,
    shodanOpenPorts: scan.shodanOpenPorts,
    shodanIsp: scan.shodanIsp,
    blacklisted: scan.blacklisted,
    blacklistCount: scan.blacklistCount,
    usomListed: scan.usomListed,
    urlhausListed: scan.urlhausListed,
    safeBrowsingFlagged: scan.safeBrowsingFlagged,
    virusTotalReputation: scan.virusTotalReputation,
    virusTotalMalicious: scan.virusTotalMalicious,
    abuseIpdbScore: scan.abuseIpdbScore,
    hibpBreachCount: scan.hibpBreachCount,
    feodoC2Ips: (scan.tprmExtra as { feodoC2Ips?: string[] } | null)?.feodoC2Ips ?? null,
    threatFoxIocCount: (scan.tprmExtra as { threatFoxIocCount?: number } | null)?.threatFoxIocCount ?? null,
    sslLabsGrade: (scan.tprmExtra as { sslLabsGrade?: string | null } | null)?.sslLabsGrade ?? null,
    danglingCnames: (scan.tprmExtra as { danglingCnames?: string[] } | null)?.danglingCnames ?? null,
  };
}

/** Tek bir tarama satırı için Skor v2. */
export async function scoreScanV2(scan: DomainScanRow): Promise<ScoreV2Result> {
  const input = scanToScoreInput(scan);
  const kev = await loadKevLookup(cveIdsOf(input));
  return computeScoreV2(input, kev);
}

/** Domainin en son taraması varsa Skor v2'sini döner; yoksa null. Yeni tarama başlatmaz. */
export async function scoreDomainV2(domain: string): Promise<{ scan: DomainScanRow; score: ScoreV2Result } | null> {
  const scan = await getLatestScan(domain);
  if (!scan) return null;
  return { scan, score: await scoreScanV2(scan) };
}

/**
 * Birden çok domain için son taramaları tek sorguda okur ve Skor v2 hesaplar
 * (KEV sorgusu da tek seferde). Taraması olmayan domainler sonuçta yer almaz.
 */
export async function scoreDomainsV2(domains: string[]): Promise<Map<string, { scan: DomainScanRow; score: ScoreV2Result }>> {
  const out = new Map<string, { scan: DomainScanRow; score: ScoreV2Result }>();
  const list = [...new Set(domains.map(normalizeDomain))].filter(Boolean);
  if (list.length === 0) return out;

  const rows = await db.selectDistinctOn([domainScansTable.domain]).from(domainScansTable)
    .where(inArray(domainScansTable.domain, list))
    .orderBy(domainScansTable.domain, desc(domainScansTable.createdAt));

  const inputs = rows.map(scanToScoreInput);
  const kev = await loadKevLookup([...new Set(inputs.flatMap(cveIdsOf))]);
  rows.forEach((scan, i) => out.set(scan.domain, { scan, score: computeScoreV2(inputs[i]!, kev) }));
  return out;
}
