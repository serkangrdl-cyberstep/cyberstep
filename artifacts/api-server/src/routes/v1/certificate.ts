import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { domainScansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { requireApiKey, trackUsage, scoreToGrade, gradeToRisk } from "./middleware";

const router = Router();

// ─── GET /api/v1/score/:domain/certificate ────────────────────────────────────
// Badge / certification status — standard+ only
router.get("/v1/score/:domain/certificate", requireApiKey, async (req: Request, res: Response) => {
  const domain = String(req.params.domain).toLowerCase().trim();
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

    const grade = scoreToGrade(scan.overallScore);
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.id, "/v1/score/certificate", domain, null, 200, ms);

    res.json({
      domain: scan.domain,
      score: scan.overallScore,
      grade,
      risk: gradeToRisk(grade),
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
