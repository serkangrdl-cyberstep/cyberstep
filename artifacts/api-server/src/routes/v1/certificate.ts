import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { domainScansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { requireApiKey, trackUsage } from "./middleware";
import { normalizeDomain, scoreScanV2 } from "../../lib/scoring/scoreV2Loader";

const RISK_EN = { "Düşük": "low", "Orta": "medium", "Yüksek": "high", "Kritik": "critical" } as const;

const router = Router();

// ─── GET /api/v1/score/:domain/certificate ────────────────────────────────────
// Badge / certification status — standard+ only
router.get("/v1/score/:domain/certificate", requireApiKey, async (req: Request, res: Response) => {
  const domain = normalizeDomain(String(req.params.domain));
  const start = req.v1StartedAt ?? Date.now();

  try {
    const [scan] = await db.select().from(domainScansTable)
      .where(eq(domainScansTable.domain, domain))
      .orderBy(desc(domainScansTable.createdAt))
      .limit(1);

    if (!scan) {
      const ms = Date.now() - start;
      await trackUsage(req.apiKey!.id, "/v1/score/certificate", domain, null, 404, ms);
      res.status(404).json({ error: "Domain bulunamadı veya henüz taranmamış.", domain });
      return;
    }

    const v2 = await scoreScanV2(scan);
    if (v2.insufficientData) {
      await trackUsage(req.apiKey!.id, "/v1/score/certificate", domain, null, 422, Date.now() - start);
      res.status(422).json({ error: "Domain için yeterli tarama verisi yok (çözümlenemedi).", domain, insufficientData: true });
      return;
    }
    const grade = v2.grade;
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.id, "/v1/score/certificate", domain, null, 200, ms);

    res.json({
      domain: scan.domain,
      score: v2.score,
      grade,
      risk: RISK_EN[v2.risk],
      scoreVersion: v2.version,
      coverage: v2.coverage,
      lastScanAt: scan.createdAt,
      badgeToken: scan.badgeToken ?? null,
      verificationUrl: scan.badgeToken
        ? `https://cyberstep.io/rozet/${scan.badgeToken}`
        : null,
      useCase: {
        tender: grade === "A" || grade === "B",
        insurance: true,
        supplier: grade !== "F",
        summary: grade === "A"
          ? "İhale ve tedarikçi tercihinde üstün konumda."
          : grade === "B"
          ? "Tedarikçi onayı için yeterli. İyileştirme önerilir."
          : "Siber güvenlik iyileştirmesi tamamlanmadan ihaleye girilmesi riskli.",
      },
    });
  } catch (err) {
    logger.error({ err, domain }, "v1/certificate error");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

export default router;
