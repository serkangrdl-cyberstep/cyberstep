import { Router, type Request, type Response } from "express";
import { logger } from "../../lib/logger";
import { requireApiKey, trackUsage } from "./middleware";
import { getBenchmarkSnapshot, MIN_SECTOR_SAMPLE, type SectorStats } from "../../services/sectorBenchmark";
import { SECTOR_LABELS } from "../../lib/scoring/sectors";
import { SCORE_V2_VERSION } from "../../lib/scoring/scoreV2";

const router = Router();

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
}

function present(stats: SectorStats, generatedAt: string) {
  const n = stats.sampleSize;
  const d = stats.distribution;
  const atRisk = pct(d.D + d.F, n);
  return {
    sector: stats.slug,
    sectorLabel: stats.label,
    sampleSize: n,
    scoreVersion: SCORE_V2_VERSION,
    dataAsOf: generatedAt,
    scores: { mean: stats.mean, median: stats.median, p25: stats.p25, p75: stats.p75, p90: stats.p90 },
    gradeDistribution: d,
    gradeDistributionPct: { A: pct(d.A, n), B: pct(d.B, n), C: pct(d.C, n), D: pct(d.D, n), F: pct(d.F, n) },
    insight: stats.median >= 70
      ? `${stats.label} sektöründe medyan skor ${stats.median}; dış saldırı yüzeyi görece iyi yönetiliyor.`
      : stats.median >= 55
      ? `${stats.label} sektörü orta risk bölgesinde; domainlerin %${atRisk}'i D veya F notunda.`
      : `${stats.label} sektörü yüksek risk bölgesinde; domainlerin %${atRisk}'i D veya F notunda.`,
  };
}

// ─── GET /api/v1/benchmark/sectors ───────────────────────────────────────────
// Yeterli örneklemi olan sektörlerin listesi
router.get("/v1/benchmark/sectors", requireApiKey, async (req: Request, res: Response) => {
  const start = req.v1StartedAt ?? Date.now();
  try {
    const snap = await getBenchmarkSnapshot();
    await trackUsage(req.apiKey!.id, "/v1/benchmark", null, "sectors", 200, Date.now() - start);
    res.json({
      scoreVersion: SCORE_V2_VERSION,
      dataAsOf: snap.generatedAt,
      minSampleSize: MIN_SECTOR_SAMPLE,
      totalDomains: snap.all.sampleSize,
      sectors: Object.values(snap.sectors)
        .sort((a, b) => b.sampleSize - a.sampleSize)
        .map(s => ({ sector: s.slug, sectorLabel: s.label, sampleSize: s.sampleSize, median: s.median })),
    });
  } catch (err) {
    logger.error({ err }, "v1/benchmark/sectors error");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// ─── GET /api/v1/benchmark/:sector ───────────────────────────────────────────
router.get("/v1/benchmark/:sector", requireApiKey, async (req: Request, res: Response) => {
  const sector = String(req.params.sector).toLowerCase().trim();
  const start = req.v1StartedAt ?? Date.now();

  if (sector !== "all" && !SECTOR_LABELS[sector]) {
    res.status(400).json({ error: "Geçersiz sektör.", validSectors: ["all", ...Object.keys(SECTOR_LABELS)] });
    return;
  }

  try {
    const snap = await getBenchmarkSnapshot();
    const stats = sector === "all" ? snap.all : snap.sectors[sector];

    if (!stats || stats.sampleSize === 0) {
      await trackUsage(req.apiKey!.id, "/v1/benchmark", null, sector, 404, Date.now() - start);
      res.status(404).json({
        error: "Bu sektör için yeterli veri bulunmamaktadır.",
        sector,
        minSampleSize: MIN_SECTOR_SAMPLE,
      });
      return;
    }

    await trackUsage(req.apiKey!.id, "/v1/benchmark", null, sector, 200, Date.now() - start);
    res.json(present(stats, snap.generatedAt));
  } catch (err) {
    logger.error({ err, sector }, "v1/benchmark error");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

export default router;
