import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { domainScansTable, cisoLeadsTable, insertCisoLeadSchema, pricingPlansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { logger } from "../../lib/logger";

const router = Router();

const publicScoreLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla istek, 1 dakika sonra tekrar deneyin." },
  keyGenerator: (req) => req.ip ?? "unknown",
});

function scoreToGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "F";
}

function scoreToRisk(score: number): string {
  if (score >= 80) return "good";
  if (score >= 60) return "medium";
  if (score >= 40) return "weak";
  return "critical";
}

// GET /api/public/domain-score/:domain
router.get("/public/domain-score/:domain", publicScoreLimiter, async (req: Request, res: Response) => {
  const rawParam = req.params["domain"];
  const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  if (!raw || raw.length > 253) {
    res.status(400).json({ error: "Geçersiz domain" });
    return;
  }

  const domain = raw.toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) {
    res.status(400).json({ error: "Geçersiz domain formatı" });
    return;
  }

  try {
    const [scan] = await db
      .select({
        id: domainScansTable.id,
        domain: domainScansTable.domain,
        overallScore: domainScansTable.overallScore,
        spfPass: domainScansTable.spfPass,
        dmarcPass: domainScansTable.dmarcPass,
        sslPass: domainScansTable.sslPass,
        blacklisted: domainScansTable.blacklisted,
        createdAt: domainScansTable.createdAt,
      })
      .from(domainScansTable)
      .where(eq(domainScansTable.domain, domain))
      .orderBy(desc(domainScansTable.createdAt))
      .limit(1);

    if (!scan) {
      res.json({ domain, status: "not_scanned" });
      return;
    }

    const score = scan.overallScore;
    res.json({
      domain: scan.domain,
      status: "scanned",
      score,
      grade: scoreToGrade(score),
      risk: scoreToRisk(score),
      lastScanAt: scan.createdAt,
      scanId: scan.id,
      summary: {
        spf: scan.spfPass,
        dmarc: scan.dmarcPass,
        ssl: scan.sslPass,
        blacklisted: scan.blacklisted,
      },
    });
  } catch (err) {
    logger.error({ err, domain }, "Public domain score lookup failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/public/pricing — aktif fiyatlandırma planları (no auth)
router.get("/public/pricing", async (_req: Request, res: Response) => {
  try {
    const plans = await db.select().from(pricingPlansTable)
      .where(eq(pricingPlansTable.isActive, true))
      .orderBy(pricingPlansTable.sortOrder);
    res.json(plans);
  } catch (err) {
    logger.error({ err }, "Public pricing fetch failed");
    res.json([]);
  }
});

// POST /api/public/ciso-lead — save vCISO inquiry
const cisoLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla talep gönderildi, lütfen daha sonra tekrar deneyin." },
  keyGenerator: (req) => req.ip ?? "unknown",
});

router.post("/public/ciso-lead", cisoLeadLimiter, async (req: Request, res: Response) => {
  const parsed = insertCisoLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz form verisi", details: parsed.error.issues });
    return;
  }

  try {
    const [lead] = await db.insert(cisoLeadsTable).values(parsed.data).returning({ id: cisoLeadsTable.id });
    logger.info({ leadId: lead?.id, company: parsed.data.company }, "New CISO lead submitted");
    res.status(201).json({ ok: true, message: "Talebiniz alındı" });
  } catch (err) {
    logger.error({ err }, "Failed to save CISO lead");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
