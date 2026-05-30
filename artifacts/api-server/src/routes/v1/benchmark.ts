import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { domainScansTable } from "@workspace/db";
import { eq, avg, count, gte, lte, and, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { requireApiKey, trackUsage, scoreToGrade } from "./middleware";

const router = Router();

const VALID_SECTORS: Record<string, string> = {
  saglik: "Sağlık",
  finans: "Finans",
  perakende: "Perakende",
  bilisim: "Bilişim",
  imalat: "İmalat",
  insaat: "İnşaat",
  lojistik: "Lojistik",
  egitim: "Eğitim",
  all: "Tüm Sektörler",
};

// ─── GET /api/v1/benchmark/:sector ───────────────────────────────────────────
router.get("/v1/benchmark/:sector", requireApiKey, async (req: Request, res: Response) => {
  const sector = String(req.params.sector).toLowerCase().trim();
  const start = req.v1StartedAt ?? Date.now();

  if (!VALID_SECTORS[sector]) {
    res.status(400).json({
      error: "Geçersiz sektör.",
      validSectors: Object.keys(VALID_SECTORS),
    });
    return;
  }

  try {
    // Use all scans (domain_scans doesn't have a sector column; we use all data for benchmark)
    // In future, when sector is stored per-company, filter by sector
    const rows = await db.select({ score: domainScansTable.overallScore })
      .from(domainScansTable)
      .where(gte(domainScansTable.overallScore, 0));

    if (rows.length === 0) {
      const ms = Date.now() - start;
      await trackUsage(req.apiKey!.id, "/v1/benchmark", null, sector, 404, ms);
      res.status(404).json({ error: "Yeterli veri bulunmamaktadır." });
      return;
    }

    const scores = rows.map(r => r.score).sort((a, b) => a - b);
    const n = scores.length;
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0 ? (scores[n / 2 - 1] + scores[n / 2]) / 2 : scores[Math.floor(n / 2)];
    const p25 = scores[Math.floor(n * 0.25)];
    const p75 = scores[Math.floor(n * 0.75)];
    const p90 = scores[Math.floor(n * 0.90)];

    const distribution = {
      A: scores.filter(s => s >= 90).length,
      B: scores.filter(s => s >= 70 && s < 90).length,
      C: scores.filter(s => s >= 50 && s < 70).length,
      D: scores.filter(s => s >= 30 && s < 50).length,
      F: scores.filter(s => s < 30).length,
    };

    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.id, "/v1/benchmark", null, sector, 200, ms);

    res.json({
      sector,
      sectorLabel: VALID_SECTORS[sector],
      sampleSize: n,
      dataAsOf: new Date().toISOString(),
      scores: {
        mean: Math.round(mean * 10) / 10,
        median,
        p25,
        p75,
        p90,
        min: scores[0],
        max: scores[n - 1],
      },
      gradeDistribution: distribution,
      gradeDistributionPct: {
        A: Math.round(distribution.A / n * 1000) / 10,
        B: Math.round(distribution.B / n * 1000) / 10,
        C: Math.round(distribution.C / n * 1000) / 10,
        D: Math.round(distribution.D / n * 1000) / 10,
        F: Math.round(distribution.F / n * 1000) / 10,
      },
      insight: mean >= 70
        ? `${VALID_SECTORS[sector]} sektörü ortalamanın üzerinde siber güvenlik olgunluğuna sahip.`
        : mean >= 50
        ? `${VALID_SECTORS[sector]} sektörü orta risk bölgesinde. Sektörün %${Math.round((distribution.C + distribution.D + distribution.F) / n * 100)}'i acil iyileştirme gerektiriyor.`
        : `${VALID_SECTORS[sector]} sektörü kritik risk bölgesinde. Aktüeryal modellerde yüksek prim çarpanı önerilir.`,
    });
  } catch (err) {
    logger.error({ err, sector }, "v1/benchmark error");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

export default router;
