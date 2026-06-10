import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  domainScansTable,
  assessmentsTable,
  cveDomainMatchesTable,
} from "@workspace/db";
import { eq, desc, sql, and, isNotNull, count } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// ─── GET /api/admin-panel/exposure-score ─────────────────────────────────────
// Müşteri başına CTEM Maruziyet Skoru hesaplar
router.get("/admin-panel/exposure-score", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const customers = await db
      .select({
        id: customersTable.id,
        companyName: customersTable.companyName,
        email: customersTable.email,
        createdAt: customersTable.createdAt,
      })
      .from(customersTable)
      .orderBy(desc(customersTable.createdAt))
      .limit(200);

    const results = await Promise.all(
      customers.map(async (c) => {
        // 1. En son domain tarama skoru
        const [latestScan] = await db
          .select({
            overallScore: domainScansTable.overallScore,
            domain: domainScansTable.domain,
            createdAt: domainScansTable.createdAt,
            orphanedAssets: domainScansTable.orphanedAssets,
            hibpBreaches: domainScansTable.hibpBreachCount,
          })
          .from(domainScansTable)
          .where(sql`${domainScansTable.email} = ${c.email}`)
          .orderBy(desc(domainScansTable.createdAt))
          .limit(1);

        // 2. En son assessment
        const [latestAssessment] = await db
          .select({
            riskLevel: assessmentsTable.riskLevel,
            totalScore: assessmentsTable.totalScore,
            maxScore: assessmentsTable.maxScore,
            createdAt: assessmentsTable.createdAt,
          })
          .from(assessmentsTable)
          .where(
            and(
              eq(assessmentsTable.email, c.email),
              isNotNull(assessmentsTable.riskLevel),
            ),
          )
          .orderBy(desc(assessmentsTable.createdAt))
          .limit(1);

        // 3. CVE etki sayısı
        const [cveRow] = await db
          .select({ cnt: count() })
          .from(cveDomainMatchesTable)
          .where(
            latestScan?.domain
              ? eq(cveDomainMatchesTable.domain, latestScan.domain)
              : sql`1=0`,
          );
        const cveCount = Number(cveRow?.cnt ?? 0);

        // 4. Dark web sızıntı
        const hibpBreaches = latestScan?.hibpBreaches ?? 0;

        // ─── Skor Hesabı ───────────────────────────────────────────────────────
        // Domain skoru: 0-100 → katkısı 0-40 (ters çevrilmiş — yüksek skor = iyi)
        const domainRaw = latestScan?.overallScore ?? null;
        const domainContrib = domainRaw !== null ? Math.round((domainRaw / 100) * 40) : null;

        // Assessment riski: Kritik=5, Yüksek=20, Orta=60, Düşük=90 → 0-30
        const riskToContrib: Record<string, number> = {
          "Kritik": 3, "Yüksek": 10, "Orta": 20, "Düşük": 28,
        };
        const assessmentContrib = latestAssessment?.riskLevel
          ? (riskToContrib[latestAssessment.riskLevel] ?? 15)
          : null;

        // CVE etkisi: 0=20, 1-3=15, 4-10=8, >10=2
        const cveContrib =
          cveCount === 0 ? 20 :
          cveCount <= 3 ? 15 :
          cveCount <= 10 ? 8 : 2;

        // Dark web: 0 ihlal=10, 1-5=6, 6+=2
        const darkWebContrib =
          hibpBreaches === 0 ? 10 :
          hibpBreaches <= 5 ? 6 : 2;

        // Toplam (0-100): domainContrib + assessmentContrib + cveContrib + darkWebContrib
        // Eksik veri varsa mevcut katkılar normalize edilir
        const parts: number[] = [];
        if (domainContrib !== null) parts.push(domainContrib);
        if (assessmentContrib !== null) parts.push(assessmentContrib);
        parts.push(cveContrib);
        parts.push(darkWebContrib);

        // Mümkün maksimum (40+30+20+10)
        const possibleMax =
          (domainContrib !== null ? 40 : 0) +
          (assessmentContrib !== null ? 30 : 0) +
          20 +
          10;

        const rawScore = parts.reduce((a, b) => a + b, 0);
        const exposureScore = possibleMax > 0
          ? Math.round((rawScore / possibleMax) * 100)
          : null;

        // Risk seviyesi
        const riskBand =
          exposureScore === null ? "Bilinmiyor" :
          exposureScore >= 80 ? "Düşük Risk" :
          exposureScore >= 55 ? "Orta Risk" :
          exposureScore >= 30 ? "Yüksek Risk" : "Kritik Risk";

        return {
          customerId: c.id,
          companyName: c.companyName,
          email: c.email,
          exposureScore,
          riskBand,
          domain: latestScan?.domain ?? null,
          domainScore: domainRaw,
          assessmentRisk: latestAssessment?.riskLevel ?? null,
          cveCount,
          hibpBreaches,
          orphanedAssetCount: Array.isArray(latestScan?.orphanedAssets)
            ? latestScan.orphanedAssets.length
            : 0,
          lastDomainScan: latestScan?.createdAt ?? null,
          lastAssessment: latestAssessment?.createdAt ?? null,
        };
      }),
    );

    // En kötü skor önde
    results.sort((a, b) => {
      if (a.exposureScore === null) return 1;
      if (b.exposureScore === null) return -1;
      return a.exposureScore - b.exposureScore;
    });

    res.json({ customers: results, total: results.length });
  } catch (err) {
    logger.error({ err }, "exposure-score: hesaplama hatası");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
