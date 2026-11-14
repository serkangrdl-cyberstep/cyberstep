/**
 * Sektör benchmark'ının saf hesap kısmı (veritabanı erişimi yok — test edilebilir).
 */

import { canonicalSector, SECTOR_LABELS } from "./sectors";
import { scoreV2Grade, type ScoreV2Grade } from "./scoreV2";

/** Bir sektörün yayınlanması için gereken asgari domain sayısı. */
export const MIN_SECTOR_SAMPLE = 30;

export interface SectorStats {
  slug: string;
  label: string;
  sampleSize: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
  p90: number;
  distribution: Record<ScoreV2Grade, number>;
}

export interface BenchmarkSnapshot {
  generatedAt: string;
  all: SectorStats;
  sectors: Record<string, SectorStats>;
  /** Sıralı skorlar — yüzdelik hesabı için (dışarı verilmez). */
  sorted: Record<string, number[]>;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo));
}

export function buildStats(slug: string, label: string, sorted: number[]): SectorStats {
  const distribution: Record<ScoreV2Grade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const s of sorted) distribution[scoreV2Grade(s)]++;
  const mean = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
  return {
    slug, label,
    sampleSize: sorted.length,
    mean,
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
    distribution,
  };
}

/** Saf hesap: (skor, ham sektör) satırlarından snapshot üretir. */
export function buildSnapshot(rows: Array<{ score: number; sector: string | null }>): BenchmarkSnapshot {
  const buckets: Record<string, number[]> = { all: [] };
  for (const r of rows) {
    buckets["all"]!.push(r.score);
    const c = canonicalSector(r.sector);
    if (c) (buckets[c.slug] ??= []).push(r.score);
  }
  for (const k of Object.keys(buckets)) buckets[k]!.sort((a, b) => a - b);

  const sectors: Record<string, SectorStats> = {};
  for (const [slug, scores] of Object.entries(buckets)) {
    if (slug === "all" || scores.length < MIN_SECTOR_SAMPLE) continue;
    sectors[slug] = buildStats(slug, SECTOR_LABELS[slug] ?? slug, scores);
  }

  return {
    generatedAt: new Date().toISOString(),
    all: buildStats("all", "Tüm Sektörler", buckets["all"]!),
    sectors,
    sorted: buckets,
  };
}

/** Skorun sektör içindeki yüzdelik dilimi (0–100; yüksek = sektörün çoğundan iyi). */
export function percentileInSector(snap: BenchmarkSnapshot, slug: string, score: number): number | null {
  const sorted = snap.sectors[slug] ? snap.sorted[slug] : slug === "all" ? snap.sorted["all"] : undefined;
  if (!sorted || sorted.length === 0) return null;
  // score'dan düşük olanların oranı (+ eşitlerin yarısı)
  let below = 0, equal = 0;
  for (const s of sorted) { if (s < score) below++; else if (s === score) equal++; }
  return Math.round(((below + equal / 2) / sorted.length) * 100);
}
