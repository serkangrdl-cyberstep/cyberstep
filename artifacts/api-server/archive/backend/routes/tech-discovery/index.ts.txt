import { Router } from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { techDiscoveryRequestsTable, domainScansTable, customerTechStackTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAdmin, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import type { PrefillData, SurveySection } from "@workspace/db";

const router = Router();

// ─── DB migration at startup ─────────────────────────────────────────────────
import { pool } from "@workspace/db";

export async function ensureTechDiscoveryTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS technology_discovery_requests (
      id                    SERIAL PRIMARY KEY,
      customer_id           INTEGER REFERENCES customers(id),
      token                 TEXT NOT NULL UNIQUE,
      email                 TEXT NOT NULL,
      contact_name          TEXT NOT NULL,
      company_name          TEXT NOT NULL,
      phone                 TEXT,
      sector                TEXT,
      nda_accepted_at       TIMESTAMPTZ,
      nda_ip                TEXT,
      nda_user_agent        TEXT,
      partner_sharing_consent BOOLEAN DEFAULT FALSE,
      survey_answers        JSONB DEFAULT '{}',
      survey_started_at     TIMESTAMPTZ,
      survey_completed_at   TIMESTAMPTZ,
      workshop_scheduled_at TIMESTAMPTZ,
      workshop_completed_at TIMESTAMPTZ,
      workshop_notes        TEXT,
      assigned_partner      TEXT,
      tech_register         JSONB,
      cmdb_created_at       TIMESTAMPTZ,
      risk_roadmap          TEXT,
      prefill_domain        TEXT,
      prefill_data          JSONB,
      status                TEXT NOT NULL DEFAULT 'pending_nda',
      admin_notes           TEXT,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  logger.info("technology_discovery_requests table ensured");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function buildPrefillData(domain: string): Promise<PrefillData> {
  const clean = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const [scan] = await db
    .select({
      wafProvider: domainScansTable.wafProvider,
      cdnProvider: domainScansTable.cdnProvider,
      sslIssuer: domainScansTable.sslIssuer,
      shadowItServices: domainScansTable.shadowItServices,
      mxRecords: domainScansTable.mxRecords,
    })
    .from(domainScansTable)
    .where(eq(domainScansTable.domain, clean))
    .orderBy(desc(domainScansTable.createdAt))
    .limit(1);

  if (!scan) return {};

  const mxHosts = (scan.mxRecords ?? []).map((r) => r.exchange.toLowerCase());
  let emailProvider: string | undefined;
  if (mxHosts.some((h) => h.includes("google") || h.includes("gmail"))) emailProvider = "Google Workspace";
  else if (mxHosts.some((h) => h.includes("microsoft") || h.includes("outlook") || h.includes("protection.outlook"))) emailProvider = "Microsoft 365";
  else if (mxHosts.some((h) => h.includes("mimecast"))) emailProvider = "Mimecast";
  else if (mxHosts.some((h) => h.includes("proofpoint"))) emailProvider = "Proofpoint";
  else if (mxHosts.length > 0) emailProvider = mxHosts[0];

  const techStack = await db
    .select({ vendor: customerTechStackTable.vendor, product: customerTechStackTable.product, category: customerTechStackTable.category })
    .from(customerTechStackTable)
    .where(eq(customerTechStackTable.domain, clean));

  return {
    emailProvider,
    wafProvider: scan.wafProvider ?? undefined,
    cdnProvider: scan.cdnProvider ?? undefined,
    sslIssuer: scan.sslIssuer ?? undefined,
    shadowItServices: (scan.shadowItServices ?? []).slice(0, 5).map((s) => ({ name: s.name, category: s.category })),
    mxRecords: mxHosts.slice(0, 3),
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/tech-discovery — start a new request
router.post("/tech-discovery", async (req: Request, res: Response) => {
  const { email, contactName, companyName, phone, sector, domain } = req.body as {
    email?: string; contactName?: string; companyName?: string;
    phone?: string; sector?: string; domain?: string;
  };

  if (!email || !contactName || !companyName) {
    res.status(400).json({ error: "E-posta, ad soyad ve şirket adı zorunlu" });
    return;
  }

  const token = randomUUID();
  const customerId = getCustomerId(req) ?? null;

  let prefillData: PrefillData | null = null;
  if (domain) {
    try { prefillData = await buildPrefillData(domain); } catch { /* skip */ }
  }

  try {
    const [row] = await db
      .insert(techDiscoveryRequestsTable)
      .values({
        token,
        customerId: customerId ?? undefined,
        email: email.toLowerCase().trim(),
        contactName: contactName.trim(),
        companyName: companyName.trim(),
        phone: phone?.trim(),
        sector: sector?.trim(),
        prefillDomain: domain?.trim(),
        prefillData: prefillData ?? undefined,
        status: "pending_nda",
      })
      .returning({ id: techDiscoveryRequestsTable.id, token: techDiscoveryRequestsTable.token });

    res.json({ id: row.id, token: row.token });
  } catch (err) {
    logger.error({ err }, "tech-discovery create failed");
    res.status(500).json({ error: "Kayıt oluşturulamadı" });
  }
});

// GET /api/tech-discovery/:token — get by token
router.get("/tech-discovery/:token", async (req: Request, res: Response) => {
  const { token } = req.params;
  const [row] = await db
    .select()
    .from(techDiscoveryRequestsTable)
    .where(eq(techDiscoveryRequestsTable.token, String(token)));
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(row);
});

// POST /api/tech-discovery/:token/accept-nda — accept NDA
router.post("/tech-discovery/:token/accept-nda", async (req: Request, res: Response) => {
  const { token } = req.params;
  const { partnerSharingConsent } = req.body as { partnerSharingConsent?: boolean };

  const [row] = await db
    .select({ id: techDiscoveryRequestsTable.id, status: techDiscoveryRequestsTable.status })
    .from(techDiscoveryRequestsTable)
    .where(eq(techDiscoveryRequestsTable.token, String(token)));
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  if (row.status !== "pending_nda") { res.status(409).json({ error: "NDA zaten kabul edildi" }); return; }

  await db
    .update(techDiscoveryRequestsTable)
    .set({
      ndaAcceptedAt: new Date(),
      ndaIp: req.ip ?? req.socket.remoteAddress ?? null,
      ndaUserAgent: req.headers["user-agent"] ?? null,
      partnerSharingConsent: partnerSharingConsent ?? false,
      status: "survey_in_progress",
      surveyStartedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(techDiscoveryRequestsTable.token, String(token)));

  res.json({ ok: true });
});

// PUT /api/tech-discovery/:token/survey/:section — save a section
router.put("/tech-discovery/:token/survey/:section", async (req: Request, res: Response) => {
  const { token, section } = req.params;
  const sectionData = req.body as SurveySection;

  const [row] = await db
    .select({ id: techDiscoveryRequestsTable.id, status: techDiscoveryRequestsTable.status, surveyAnswers: techDiscoveryRequestsTable.surveyAnswers })
    .from(techDiscoveryRequestsTable)
    .where(eq(techDiscoveryRequestsTable.token, String(token)));
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  if (row.status === "pending_nda") { res.status(403).json({ error: "NDA önce kabul edilmeli" }); return; }

  const current = (row.surveyAnswers as Record<string, SurveySection>) ?? {};
  current[String(section)] = { ...sectionData, completedAt: new Date().toISOString() };

  await db
    .update(techDiscoveryRequestsTable)
    .set({ surveyAnswers: current, updatedAt: new Date() })
    .where(eq(techDiscoveryRequestsTable.token, String(token)));

  res.json({ ok: true });
});

// POST /api/tech-discovery/:token/complete-survey — finalize survey
router.post("/tech-discovery/:token/complete-survey", async (req: Request, res: Response) => {
  const { token } = req.params;
  const [row] = await db
    .select({ id: techDiscoveryRequestsTable.id, status: techDiscoveryRequestsTable.status })
    .from(techDiscoveryRequestsTable)
    .where(eq(techDiscoveryRequestsTable.token, String(token)));
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }

  await db
    .update(techDiscoveryRequestsTable)
    .set({ surveyCompletedAt: new Date(), status: "survey_complete", updatedAt: new Date() })
    .where(eq(techDiscoveryRequestsTable.token, String(token)));

  res.json({ ok: true });
});

// GET /api/tech-discovery/my — customer's own requests
router.get("/tech-discovery/my", async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Giriş gerekli" }); return; }

  const rows = await db
    .select({
      id: techDiscoveryRequestsTable.id,
      token: techDiscoveryRequestsTable.token,
      companyName: techDiscoveryRequestsTable.companyName,
      status: techDiscoveryRequestsTable.status,
      ndaAcceptedAt: techDiscoveryRequestsTable.ndaAcceptedAt,
      surveyCompletedAt: techDiscoveryRequestsTable.surveyCompletedAt,
      workshopScheduledAt: techDiscoveryRequestsTable.workshopScheduledAt,
      cmdbCreatedAt: techDiscoveryRequestsTable.cmdbCreatedAt,
      createdAt: techDiscoveryRequestsTable.createdAt,
    })
    .from(techDiscoveryRequestsTable)
    .where(eq(techDiscoveryRequestsTable.customerId, customerId))
    .orderBy(desc(techDiscoveryRequestsTable.createdAt));

  res.json(rows);
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

// GET /api/admin/tech-discovery — list all
router.get("/admin/tech-discovery", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(techDiscoveryRequestsTable)
    .orderBy(desc(techDiscoveryRequestsTable.createdAt));
  res.json(rows);
});

// PUT /api/admin/tech-discovery/:id/assign — assign partner + set workshop date
router.put("/admin/tech-discovery/:id/assign", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const { assignedPartner, workshopScheduledAt, adminNotes } = req.body as {
    assignedPartner?: string; workshopScheduledAt?: string; adminNotes?: string;
  };

  await db
    .update(techDiscoveryRequestsTable)
    .set({
      assignedPartner: assignedPartner ?? undefined,
      workshopScheduledAt: workshopScheduledAt ? new Date(workshopScheduledAt) : undefined,
      adminNotes: adminNotes ?? undefined,
      status: workshopScheduledAt ? "workshop_scheduled" : undefined,
      updatedAt: new Date(),
    })
    .where(eq(techDiscoveryRequestsTable.id, id));

  res.json({ ok: true });
});

// PUT /api/admin/tech-discovery/:id/cmdb — create CMDB from admin input
router.put("/admin/tech-discovery/:id/cmdb", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const { techRegister, riskRoadmap, workshopNotes } = req.body as {
    techRegister?: unknown[]; riskRoadmap?: string; workshopNotes?: string;
  };

  await db
    .update(techDiscoveryRequestsTable)
    .set({
      techRegister: techRegister as never,
      riskRoadmap: riskRoadmap ?? undefined,
      workshopNotes: workshopNotes ?? undefined,
      cmdbCreatedAt: new Date(),
      workshopCompletedAt: new Date(),
      status: "cmdb_created",
      updatedAt: new Date(),
    })
    .where(eq(techDiscoveryRequestsTable.id, id));

  res.json({ ok: true });
});

export default router;
