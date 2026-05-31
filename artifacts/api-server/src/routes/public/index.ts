import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { domainScansTable, cisoLeadsTable, insertCisoLeadSchema, pricingPlansTable, partnerLeadsTable, insertPartnerLeadSchema, servicePricesTable, jobApplicationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
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

// POST /api/public/partner-lead — ERP / insurance / threat-intel / score-api leads
const partnerLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla talep, lütfen daha sonra tekrar deneyin." },
  keyGenerator: (req) => req.ip ?? "unknown",
});

router.post("/public/partner-lead", partnerLeadLimiter, async (req: Request, res: Response) => {
  const parsed = insertPartnerLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz form verisi", details: parsed.error.issues });
    return;
  }

  try {
    const [lead] = await db.insert(partnerLeadsTable).values(parsed.data).returning({ id: partnerLeadsTable.id });
    logger.info({ leadId: lead?.id, leadType: parsed.data.leadType, company: parsed.data.company }, "New partner lead submitted");
    res.status(201).json({ ok: true, message: "Başvurunuz alındı" });
  } catch (err) {
    logger.error({ err }, "Failed to save partner lead");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/public/prices — all service prices (public, no auth)
router.get("/public/prices", async (_req, res: Response) => {
  try {
    const rows = await db.select().from(servicePricesTable);
    const map: Record<string, { label: string; amount: number; unit: string }> = {};
    for (const r of rows) map[r.slug] = { label: r.label, amount: parseFloat(r.amountTl), unit: r.unit };
    res.json(map);
  } catch (err) {
    logger.error({ err }, "Failed to fetch service prices");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/public/job-application — career applications
const FREE_EMAIL_DOMAINS = ["gmail.com","hotmail.com","yahoo.com","outlook.com","yandex.com","icloud.com","live.com","msn.com","me.com","aol.com","protonmail.com","mail.com","zoho.com"];
function isCorporateEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return !!domain && !FREE_EMAIL_DOMAINS.includes(domain);
}

const jobAppLimiter = rateLimit({ windowMs: 60*60*1000, limit: 3, standardHeaders: true, legacyHeaders: false, message: { error: "Çok fazla başvuru." }, keyGenerator: (req) => req.ip ?? "unknown" });

router.post("/public/job-application", jobAppLimiter, async (req: Request, res: Response) => {
  const { fullName, email, phone, cvFileName, cvFileData, position, message } = req.body as Record<string, string>;
  if (!fullName?.trim() || !email?.trim() || !phone?.trim()) {
    res.status(400).json({ error: "Ad soyad, e-posta ve telefon zorunludur." });
    return;
  }
  try {
    const corporate = isCorporateEmail(email);
    await db.insert(jobApplicationsTable).values({ fullName: fullName.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), cvFileName: cvFileName ?? null, cvFileData: cvFileData ?? null, position: position ?? null, message: message ?? null, isCorporateEmail: corporate });
    if (corporate) {
      const domain = email.split("@")[1]!;
      await db.execute(sql.raw(`INSERT INTO lead_gen_leads (domain, score, discovery_method, status, created_at) VALUES ('${domain}', 40, 'job_application', 'new', now()) ON CONFLICT (domain) DO NOTHING`));
    }
    logger.info({ email, corporate }, "New job application");
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to save job application");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
