import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { workPackagesTable, partnersTable, assessmentsTable, domainScansTable } from "@workspace/db";
import { eq, desc, count, and, sql } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

function getSession(req: Request) {
  return req.session as unknown as Record<string, unknown>;
}

function requirePartner(req: Request, res: Response, next: () => void): void {
  const partnerId = getSession(req)["partnerId"] as number | undefined;
  if (!partnerId) { res.status(401).json({ error: "İş ortağı girişi gerekiyor" }); return; }
  next();
}

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// POST /api/work-packages (admin creates)
router.post("/work-packages", requireAdmin, async (req: Request, res: Response) => {
  const {
    assessmentId, domainScanId, title, description, category,
    priority, estimatedCost, commissionRate, companyName, domain, scoreBefore,
  } = req.body as {
    assessmentId?: number; domainScanId?: number; title?: string; description?: string;
    category?: string; priority?: string; estimatedCost?: number; commissionRate?: number;
    companyName?: string; domain?: string; scoreBefore?: number;
  };

  if (!title || !category) {
    res.status(400).json({ error: "Başlık ve kategori zorunludur" });
    return;
  }

  const [pkg] = await db.insert(workPackagesTable).values({
    assessmentId: assessmentId ?? null,
    domainScanId: domainScanId ?? null,
    title,
    description: description ?? null,
    category,
    priority: priority ?? "medium",
    estimatedCost: estimatedCost ?? null,
    commissionRate: commissionRate ?? 15,
    companyName: companyName ?? null,
    domain: domain ?? null,
    scoreBefore: scoreBefore ?? null,
    status: "open",
  }).returning();

  logger.info({ packageId: pkg.id, category, title }, "Work package created");
  res.status(201).json(pkg);
});

// GET /api/work-packages (admin list)
router.get("/work-packages", requireAdmin, async (req: Request, res: Response) => {
  const { status, partnerId: partnerIdStr, page: pageStr } = req.query as Record<string, string>;
  const page = Math.max(1, Number(pageStr ?? 1));
  const limit = 30;
  const offset = (page - 1) * limit;

  const [{ total }] = await db.select({ total: count() }).from(workPackagesTable);

  const rows = await db
    .select({
      pkg: workPackagesTable,
      partnerCompany: partnersTable.companyName,
      partnerEmail: partnersTable.email,
    })
    .from(workPackagesTable)
    .leftJoin(partnersTable, eq(workPackagesTable.partnerId, partnersTable.id))
    .orderBy(desc(workPackagesTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({
    rows: rows.map(r => ({ ...r.pkg, partnerCompany: r.partnerCompany, partnerEmail: r.partnerEmail })),
    total: Number(total),
    page,
    limit,
  });
});

// GET /api/work-packages/stats
router.get("/work-packages/stats", requireAdmin, async (req: Request, res: Response) => {
  const [{ total }] = await db.select({ total: count() }).from(workPackagesTable);
  const [{ open }] = await db.select({ open: count() }).from(workPackagesTable).where(eq(workPackagesTable.status, "open"));
  const [{ assigned }] = await db.select({ assigned: count() }).from(workPackagesTable).where(eq(workPackagesTable.status, "assigned"));
  const [{ completed }] = await db.select({ completed: count() }).from(workPackagesTable).where(eq(workPackagesTable.status, "completed"));
  const [{ verified }] = await db.select({ verified: count() }).from(workPackagesTable).where(eq(workPackagesTable.status, "verified"));

  res.json({
    total: Number(total),
    open: Number(open),
    assigned: Number(assigned),
    completed: Number(completed),
    verified: Number(verified),
  });
});

// GET /api/work-packages/:id
router.get("/work-packages/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const [row] = await db
    .select({ pkg: workPackagesTable, partnerCompany: partnersTable.companyName })
    .from(workPackagesTable)
    .leftJoin(partnersTable, eq(workPackagesTable.partnerId, partnersTable.id))
    .where(eq(workPackagesTable.id, id));

  if (!row) { res.status(404).json({ error: "İş paketi bulunamadı" }); return; }
  res.json({ ...row.pkg, partnerCompany: row.partnerCompany });
});

// PUT /api/work-packages/:id/assign
router.put("/work-packages/:id/assign", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const { partnerId } = req.body as { partnerId?: number };

  if (!partnerId) { res.status(400).json({ error: "partnerId zorunludur" }); return; }

  const [partner] = await db.select({ id: partnersTable.id, status: partnersTable.status })
    .from(partnersTable).where(eq(partnersTable.id, partnerId));

  if (!partner) { res.status(404).json({ error: "Partner bulunamadı" }); return; }
  if (partner.status !== "active") { res.status(400).json({ error: "Sadece aktif partnerler atanabilir" }); return; }

  const [updated] = await db.update(workPackagesTable).set({
    partnerId,
    status: "assigned",
    assignedAt: new Date(),
  }).where(eq(workPackagesTable.id, id)).returning();

  if (!updated) { res.status(404).json({ error: "İş paketi bulunamadı" }); return; }
  logger.info({ packageId: id, partnerId }, "Work package assigned");
  res.json(updated);
});

// PUT /api/work-packages/:id/unassign
router.put("/work-packages/:id/unassign", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const [updated] = await db.update(workPackagesTable).set({
    partnerId: null,
    status: "open",
    assignedAt: null,
  }).where(eq(workPackagesTable.id, id)).returning();

  if (!updated) { res.status(404).json({ error: "İş paketi bulunamadı" }); return; }
  res.json(updated);
});

// POST /api/work-packages/:id/verify (admin verifies partner completion)
router.post("/work-packages/:id/verify", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const { scoreAfter } = req.body as { scoreAfter?: number };

  const [pkg] = await db.select().from(workPackagesTable).where(eq(workPackagesTable.id, id));
  if (!pkg) { res.status(404).json({ error: "İş paketi bulunamadı" }); return; }
  if (pkg.status !== "completed") {
    res.status(400).json({ error: "Sadece 'completed' durumundaki paketler doğrulanabilir" });
    return;
  }

  const [updated] = await db.update(workPackagesTable).set({
    status: "verified",
    verifiedAt: new Date(),
    ...(scoreAfter !== undefined && { scoreAfter }),
  }).where(eq(workPackagesTable.id, id)).returning();

  if (pkg.partnerId) {
    const [{ cnt }] = await db.select({ cnt: count() }).from(workPackagesTable)
      .where(and(eq(workPackagesTable.partnerId, pkg.partnerId), eq(workPackagesTable.status, "verified")));
    await db.update(partnersTable).set({ totalProjectsCompleted: Number(cnt) })
      .where(eq(partnersTable.id, pkg.partnerId)).catch(() => {});
  }

  logger.info({ packageId: id, scoreAfter }, "Work package verified");
  res.json(updated);
});

// DELETE /api/work-packages/:id
router.delete("/work-packages/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  await db.delete(workPackagesTable).where(eq(workPackagesTable.id, id));
  res.json({ success: true });
});

// ─── PARTNER ROUTES ───────────────────────────────────────────────────────────

// GET /api/partner-portal/work-packages
router.get("/partner-portal/work-packages", requirePartner as any, async (req: Request, res: Response) => {
  const partnerId = getSession(req)["partnerId"] as number;

  const rows = await db.select().from(workPackagesTable)
    .where(eq(workPackagesTable.partnerId, partnerId))
    .orderBy(desc(workPackagesTable.createdAt));

  res.json(rows);
});

// POST /api/partner-portal/work-packages/:id/complete
router.post("/partner-portal/work-packages/:id/complete", requirePartner as any, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const partnerId = getSession(req)["partnerId"] as number;
  const { completionNote } = req.body as { completionNote?: string };

  const [pkg] = await db.select().from(workPackagesTable)
    .where(and(eq(workPackagesTable.id, id), eq(workPackagesTable.partnerId, partnerId)));

  if (!pkg) { res.status(404).json({ error: "İş paketi bulunamadı veya erişim izniniz yok" }); return; }
  if (!["assigned", "in_progress"].includes(pkg.status)) {
    res.status(400).json({ error: "Bu paket tamamlanacak durumda değil" });
    return;
  }

  const [updated] = await db.update(workPackagesTable).set({
    status: "completed",
    completedAt: new Date(),
    completionNote: completionNote ?? null,
  }).where(eq(workPackagesTable.id, id)).returning();

  logger.info({ packageId: id, partnerId }, "Work package marked complete by partner");
  res.json(updated);
});

// POST /api/partner-portal/work-packages/:id/start
router.post("/partner-portal/work-packages/:id/start", requirePartner as any, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const partnerId = getSession(req)["partnerId"] as number;

  const [pkg] = await db.select().from(workPackagesTable)
    .where(and(eq(workPackagesTable.id, id), eq(workPackagesTable.partnerId, partnerId)));

  if (!pkg) { res.status(404).json({ error: "İş paketi bulunamadı" }); return; }

  const [updated] = await db.update(workPackagesTable).set({ status: "in_progress" })
    .where(eq(workPackagesTable.id, id)).returning();

  res.json(updated);
});

// GET /api/partner-portal/referral-stats
router.get("/partner-portal/referral-stats", requirePartner as any, async (req: Request, res: Response) => {
  const partnerId = getSession(req)["partnerId"] as number;

  const [partner] = await db.select({ referralCode: partnersTable.referralCode })
    .from(partnersTable).where(eq(partnersTable.id, partnerId));

  if (!partner?.referralCode) {
    res.json({ referralCode: null, total: 0, completed: 0, reportReady: 0, assessments: [] });
    return;
  }

  const assessments = await db.select({
    id: assessmentsTable.id,
    companyName: assessmentsTable.companyName,
    sector: assessmentsTable.sector,
    status: assessmentsTable.status,
    riskLevel: assessmentsTable.riskLevel,
    scorePercent: sql<number | null>`CASE WHEN ${assessmentsTable.maxScore} > 0 THEN ROUND(${assessmentsTable.totalScore}::numeric / ${assessmentsTable.maxScore} * 100) ELSE NULL END`,
    createdAt: assessmentsTable.createdAt,
    completedAt: assessmentsTable.completedAt,
  })
    .from(assessmentsTable)
    .where(eq(assessmentsTable.referralCode, partner.referralCode))
    .orderBy(desc(assessmentsTable.createdAt));

  const total = assessments.length;
  const completed = assessments.filter(a => a.status !== "in_progress").length;
  const reportReady = assessments.filter(a => a.status === "report_ready").length;

  res.json({
    referralCode: partner.referralCode,
    total,
    completed,
    reportReady,
    assessments,
  });
});

export default router;
