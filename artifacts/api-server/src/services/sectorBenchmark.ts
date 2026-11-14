/**
 * Sektör benchmark'ı — domain başına en son taramanın Skor v2'si üzerinden.
 * Sektör: lead_candidates.sector, yoksa domain_scans.sector (canonicalSector ile normalize).
 * Sonuç 1 saat önbellekte tutulur; 280K+ domainde sorgu birkaç saniye sürebilir.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { buildSnapshot, type BenchmarkSnapshot } from "../lib/scoring/benchmarkStats";

export { MIN_SECTOR_SAMPLE, percentileInSector, type BenchmarkSnapshot, type SectorStats } from "../lib/scoring/benchmarkStats";

const CACHE_TTL_MS = 60 * 60 * 1000;

let cache: { at: number; data: BenchmarkSnapshot } | null = null;
let inflight: Promise<BenchmarkSnapshot> | null = null;

async function loadSnapshot(): Promise<BenchmarkSnapshot> {
  const started = Date.now();
  const result = await db.execute(sql`
    SELECT DISTINCT ON (ds.domain)
      ds.score_v2 AS score,
      COALESCE(NULLIF(lc.sector, ''), NULLIF(ds.sector, '')) AS sector
    FROM domain_scans ds
    LEFT JOIN lead_candidates lc ON lc.domain = ds.domain
    WHERE ds.included_in_index = true
    ORDER BY ds.domain, ds.created_at DESC
  `);
  // DISTINCT ON son taramayı seçer; son taramanın skoru henüz yoksa (backfill bekliyor) atlanır.
  const rows = (result.rows as Array<{ score: number | null; sector: string | null }>)
    .filter((r): r is { score: number; sector: string | null } => typeof r.score === "number");
  const snap = buildSnapshot(rows);
  logger.info({ domains: rows.length, sectors: Object.keys(snap.sectors).length, ms: Date.now() - started }, "Sektör benchmark'ı hesaplandı");
  return snap;
}

export async function getBenchmarkSnapshot(): Promise<BenchmarkSnapshot> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (!inflight) {
    inflight = loadSnapshot()
      .then((data) => { cache = { at: Date.now(), data }; return data; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/**
 * Önbellekte varsa snapshot'ı döner; yoksa arka planda hesaplamayı başlatıp null döner.
 * Kullanıcı isteklerini soğuk başlangıçta bekletmemek için.
 */
export function peekBenchmarkSnapshot(): BenchmarkSnapshot | null {
  if (cache) {
    if (Date.now() - cache.at >= CACHE_TTL_MS) void getBenchmarkSnapshot().catch(() => {});
    return cache.data;
  }
  void getBenchmarkSnapshot().catch((err) => logger.warn({ err }, "Benchmark hesaplanamadı"));
  return null;
}

/** Testler ve backfill sonrası için önbelleği temizler. */
export function invalidateBenchmarkCache(): void {
  cache = null;
}
