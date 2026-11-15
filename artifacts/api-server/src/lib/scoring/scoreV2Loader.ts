/**
 * Skor v2 için veritabanı katmanı: bir domainin en son taramasını ve
 * içindeki CVE'lerin KEV durumunu okuyup computeScoreV2'ye verir.
 */

import { db, domainScansTable, cveIntelligenceTable } from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import { computeScoreV2, cveIdsOf, type KevLookup, type ScoreV2Input, type ScoreV2Result } from "./scoreV2";
import { sourceMeasured, type ScanSourceStatusMap } from "../scanSources";

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
  // Key'i olmayan / hata veren kaynaklar null'a çekilir → Skor v2 onları "ölçülmedi"
  // sayar. Böylece erişilemeyen bir kaynak tam puan (temiz) olarak hesaba girmez.
  // source_status kaydı olmayan eski taramalarda davranış değişmez.
  const src = scan.sourceStatus as ScanSourceStatusMap | null;
  const ok = (k: Parameters<typeof sourceMeasured>[1]) => sourceMeasured(src, k);
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
    httpHeadersScore: ok("http_headers") ? scan.httpHeadersScore : null,
    cveSummary: scan.cveSummary,
    shodanOpenPorts: ok("shodan") ? scan.shodanOpenPorts : null,
    shodanIsp: scan.shodanIsp,
    blacklisted: scan.blacklisted,
    blacklistCount: scan.blacklistCount,
    usomListed: scan.usomListed,
    urlhausListed: scan.urlhausListed,
    safeBrowsingFlagged: ok("safebrowsing") ? scan.safeBrowsingFlagged : null,
    virusTotalReputation: ok("virustotal") ? scan.virusTotalReputation : null,
    virusTotalMalicious: ok("virustotal") ? scan.virusTotalMalicious : null,
    abuseIpdbScore: ok("abuseipdb") ? scan.abuseIpdbScore : null,
    hibpBreachCount: ok("hibp") ? scan.hibpBreachCount : null,
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
