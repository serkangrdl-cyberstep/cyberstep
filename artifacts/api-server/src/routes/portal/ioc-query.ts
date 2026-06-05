/**
 * IOC Sorgu Merkezi — Müşteri Portal Rotaları
 * POST /api/portal/ioc/query
 * GET  /api/portal/ioc/query/:id
 * GET  /api/portal/ioc/history
 * GET  /api/portal/ioc/credits
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { iocQueriesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireCustomer } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { detectQueryType, getCachedResult, runIOCQuery, buildSourceSummary } from "../../services/iocQueryEngine";
import { useCredit, getCreditsBalance } from "../../services/iocCreditManager";

const router = Router();

// POST /api/portal/ioc/query — Yeni sorgu başlat
router.post("/query", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const customerId = (req.session as { customerId?: number }).customerId;
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { value } = req.body as { value?: string };
  if (!value?.trim()) {
    res.status(400).json({ error: "Sorgu değeri gerekli" });
    return;
  }

  const queryType = detectQueryType(value.trim());
  if (queryType === "unknown") {
    res.status(400).json({ error: "Desteklenmeyen sorgu tipi. IP, domain, hash veya URL girin." });
    return;
  }

  // 24 saatlik cache kontrolü — kredi tüketme
  const cached = await getCachedResult(queryType, value.trim());
  if (cached) {
    const [newQuery] = await db.insert(iocQueriesTable).values({
      customerId,
      queryType,
      queryValue:        value.trim(),
      status:            "completed",
      cacheHit:          true,
      creditsUsed:       0,
      shodanResult:      cached.shodanResult as Record<string, unknown>,
      virustotalResult:  cached.virustotalResult as Record<string, unknown>,
      abuseipdbResult:   cached.abuseipdbResult as Record<string, unknown>,
      greynoiseResult:   cached.greynoiseResult as Record<string, unknown>,
      threatfoxResult:   cached.threatfoxResult as Record<string, unknown>,
      urlhausResult:     cached.urlhausResult as Record<string, unknown>,
      malwarebazaarResult: cached.malwarebazaarResult as Record<string, unknown>,
      whoisResult:       cached.whoisResult as Record<string, unknown>,
      feodoResult:       cached.feodoResult as Record<string, unknown>,
      threatLevel:       cached.threatLevel,
      threatScore:       cached.threatScore,
      aiSummary:         cached.aiSummary,
      aiRecommendations: cached.aiRecommendations as Record<string, unknown>[],
      indicators:        cached.indicators as Record<string, unknown>[],
      completedAt:       new Date(),
    }).returning();

    res.json({
      queryId:      newQuery.id,
      cached:       true,
      cacheAge:     "24 saatten yeni sonuç",
      threatLevel:  cached.threatLevel,
      threatScore:  cached.threatScore,
      summary:      cached.aiSummary,
      indicators:   cached.indicators,
      recommendations: cached.aiRecommendations,
      sources:      buildSourceSummary(cached),
    });
    return;
  }

  // Kredi kontrolü
  const credit = await useCredit(customerId, 0);
  if (!credit.success) {
    res.status(402).json({
      error:       "Sorgu krediniz tükendi.",
      remaining:   0,
      purchaseUrl: `/hesabim/ioc-credits`,
    });
    return;
  }

  // Yeni sorgu kaydet
  const [query] = await db.insert(iocQueriesTable).values({
    customerId,
    queryType,
    queryValue:  value.trim(),
    status:      "pending",
    creditsUsed: 1,
  }).returning();

  // Arka planda çalıştır (fire-and-forget)
  setImmediate(() => void runIOCQuery(query.id, queryType, value.trim()));

  res.json({
    queryId:   query.id,
    status:    "processing",
    message:   "Sorgu başlatıldı. 10-30 saniye içinde tamamlanır.",
    remaining: credit.remaining,
  });
});

// GET /api/portal/ioc/query/:id — Sonuç getir (polling)
router.get("/query/:id", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const customerId = (req.session as { customerId?: number }).customerId;
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const queryId = parseInt(String(req.params["id"]));
  const [query] = await db.select().from(iocQueriesTable)
    .where(and(eq(iocQueriesTable.id, queryId), eq(iocQueriesTable.customerId, customerId)))
    .limit(1);

  if (!query) { res.status(404).json({ error: "Sorgu bulunamadı" }); return; }

  res.json({
    queryId:          query.id,
    queryType:        query.queryType,
    queryValue:       query.queryValue,
    status:           query.status,
    cached:           query.cacheHit,
    threatLevel:      query.threatLevel,
    threatScore:      query.threatScore,
    summary:          query.aiSummary,
    indicators:       query.indicators,
    recommendations:  query.aiRecommendations,
    sources:          buildSourceSummary(query),
    processingTimeMs: query.processingTimeMs,
    createdAt:        query.createdAt,
  });
});

// GET /api/portal/ioc/history — Sorgu geçmişi
router.get("/history", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const customerId = (req.session as { customerId?: number }).customerId;
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const page  = Math.max(1, parseInt(String(req.query["page"] || "1")));
  const limit = Math.min(50, parseInt(String(req.query["limit"] || "20")));

  const queries = await db.select({
    id:          iocQueriesTable.id,
    queryType:   iocQueriesTable.queryType,
    queryValue:  iocQueriesTable.queryValue,
    threatLevel: iocQueriesTable.threatLevel,
    threatScore: iocQueriesTable.threatScore,
    cached:      iocQueriesTable.cacheHit,
    status:      iocQueriesTable.status,
    createdAt:   iocQueriesTable.createdAt,
  }).from(iocQueriesTable)
    .where(eq(iocQueriesTable.customerId, customerId))
    .orderBy(desc(iocQueriesTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const credits = await getCreditsBalance(customerId);
  res.json({ queries, credits });
});

// GET /api/portal/ioc/credits — Kredi durumu
router.get("/credits", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const customerId = (req.session as { customerId?: number }).customerId;
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const credits = await getCreditsBalance(customerId);
  res.json({
    ...credits,
    packs: [
      { credits: 10,  price_tl: 50,  label: "10 Sorgu — 50 TL" },
      { credits: 50,  price_tl: 200, label: "50 Sorgu — 200 TL" },
      { credits: 100, price_tl: 350, label: "100 Sorgu — 350 TL" },
    ],
  });
});

export default router;
