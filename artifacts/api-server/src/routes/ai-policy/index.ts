import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  aiPolicyDocumentsTable,
  aiPolicySubscriptionsTable,
  customersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireCustomer, getCustomerId, requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { generatePolicyDocument, notifyPolicyUpdate } from "../../services/policy-generator";
import fs from "node:fs";
import path from "node:path";

const router = Router();

// ─── Subscription ─────────────────────────────────────────────────────────────

router.get("/api/ai-policy/subscription", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const [sub] = await db.select().from(aiPolicySubscriptionsTable).where(eq(aiPolicySubscriptionsTable.customerId, cid));
  res.json(sub ?? null);
});

router.post("/api/ai-policy/subscription", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const existing = await db.select().from(aiPolicySubscriptionsTable).where(eq(aiPolicySubscriptionsTable.customerId, cid));
  if (existing.length > 0) {
    res.status(409).json({ error: "Abonelik zaten mevcut" });
    return;
  }
  const { approvalEmail } = req.body as { approvalEmail?: string };
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, cid));
  const [sub] = await db.insert(aiPolicySubscriptionsTable).values({
    customerId: cid,
    status: "active",
    approvalEmail: approvalEmail ?? customer?.email ?? "",
    nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  }).returning();

  // Fire-and-forget initial policy generation
  (async () => {
    try {
      const doc = await generatePolicyDocument(cid, "initial");
      await notifyPolicyUpdate(cid, doc, "initial");
    } catch (err) {
      logger.error({ err, cid }, "Initial policy generation failed");
    }
  })();

  res.status(201).json(sub);
});

router.put("/api/ai-policy/subscription", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const { autoGenerate, requireApproval, approvalEmail, notifyOnUpdate } = req.body as Record<string, unknown>;
  const [sub] = await db.update(aiPolicySubscriptionsTable)
    .set({ autoGenerate: autoGenerate as boolean, requireApproval: requireApproval as boolean, approvalEmail: approvalEmail as string, notifyOnUpdate: notifyOnUpdate as boolean })
    .where(eq(aiPolicySubscriptionsTable.customerId, cid))
    .returning();
  res.json(sub);
});

// ─── Policy Documents ─────────────────────────────────────────────────────────

router.get("/api/ai-policy/current", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const [doc] = await db.select().from(aiPolicyDocumentsTable)
    .where(eq(aiPolicyDocumentsTable.customerId, cid))
    .orderBy(desc(aiPolicyDocumentsTable.createdAt))
    .limit(1);
  res.json(doc ?? null);
});

router.get("/api/ai-policy/versions", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const docs = await db.select({
    id: aiPolicyDocumentsTable.id,
    version: aiPolicyDocumentsTable.version,
    versionLabel: aiPolicyDocumentsTable.versionLabel,
    status: aiPolicyDocumentsTable.status,
    generatedAt: aiPolicyDocumentsTable.generatedAt,
    generationReason: aiPolicyDocumentsTable.generationReason,
    changesSummary: aiPolicyDocumentsTable.changesSummary,
    changedSections: aiPolicyDocumentsTable.changedSections,
    docxPath: aiPolicyDocumentsTable.docxPath,
    pdfPath: aiPolicyDocumentsTable.pdfPath,
    approvedAt: aiPolicyDocumentsTable.approvedAt,
    nextUpdateDate: aiPolicyDocumentsTable.nextUpdateDate,
    coveredToolIds: aiPolicyDocumentsTable.coveredToolIds,
  }).from(aiPolicyDocumentsTable)
    .where(eq(aiPolicyDocumentsTable.customerId, cid))
    .orderBy(desc(aiPolicyDocumentsTable.createdAt));
  res.json(docs);
});

router.get("/api/ai-policy/:id", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const docId = Number(req.params["id"]);
  const [doc] = await db.select().from(aiPolicyDocumentsTable)
    .where(eq(aiPolicyDocumentsTable.id, docId));
  if (!doc || doc.customerId !== cid) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(doc);
});

router.post("/api/ai-policy/:id/approve", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const docId = Number(req.params["id"]);
  const { approvedByEmail } = req.body as { approvedByEmail?: string };
  const [existing] = await db.select().from(aiPolicyDocumentsTable).where(eq(aiPolicyDocumentsTable.id, docId));
  if (!existing || existing.customerId !== cid) { res.status(404).json({ error: "Bulunamadı" }); return; }
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, cid));
  const [doc] = await db.update(aiPolicyDocumentsTable)
    .set({ status: "approved", approvedAt: new Date(), approvedByEmail: approvedByEmail ?? customer?.email ?? "" })
    .where(eq(aiPolicyDocumentsTable.id, docId))
    .returning();
  // Mark previous versions as superseded
  await db.update(aiPolicyDocumentsTable)
    .set({ status: "superseded" })
    .where(eq(aiPolicyDocumentsTable.customerId, cid));
  await db.update(aiPolicyDocumentsTable)
    .set({ status: "approved", approvedAt: doc?.approvedAt, approvedByEmail: doc?.approvedByEmail })
    .where(eq(aiPolicyDocumentsTable.id, docId));
  res.json(doc);
});

router.post("/api/ai-policy/generate", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const [sub] = await db.select().from(aiPolicySubscriptionsTable).where(eq(aiPolicySubscriptionsTable.customerId, cid));
  if (!sub) { res.status(403).json({ error: "Aktif abonelik gerekli" }); return; }
  res.json({ message: "Politika üretimi başlatıldı" });
  (async () => {
    try {
      const doc = await generatePolicyDocument(cid, "manual_request");
      await notifyPolicyUpdate(cid, doc, "manual_request");
    } catch (err) {
      logger.error({ err, cid }, "Manual policy generation failed");
    }
  })();
});

// ─── DOCX Download ────────────────────────────────────────────────────────────

router.get("/api/ai-policy/:id/docx", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const docId = Number(req.params["id"]);
  const [doc] = await db.select().from(aiPolicyDocumentsTable).where(eq(aiPolicyDocumentsTable.id, docId));
  if (!doc || doc.customerId !== cid) { res.status(404).json({ error: "Bulunamadı" }); return; }
  if (!doc.docxPath) { res.status(404).json({ error: "DOCX henüz hazır değil" }); return; }
  const filePath = path.join(process.cwd(), doc.docxPath.replace(/^\//, ""));
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Dosya bulunamadı" }); return; }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="AI_Politika_v${doc.version}.docx"`);
  fs.createReadStream(filePath).pipe(res);
});

// ─── Admin ─────────────────────────────────────────────────────────────────────

router.get("/api/admin/ai-policy/stats", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const subs = await db.select().from(aiPolicySubscriptionsTable);
  const docs = await db.select().from(aiPolicyDocumentsTable);
  res.json({
    totalSubscriptions: subs.length,
    activeSubscriptions: subs.filter(s => s.status === "active").length,
    totalDocuments: docs.length,
    approvedDocuments: docs.filter(d => d.status === "approved").length,
    draftDocuments: docs.filter(d => d.status === "draft").length,
  });
});

router.post("/api/admin/ai-policy/trigger-all", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  res.json({ message: "Çeyreklik güncelleme tetiklendi" });
  const { runQuarterlyPolicyUpdate } = await import("../../services/policy-generator");
  runQuarterlyPolicyUpdate().catch(err => logger.error({ err }, "Quarterly trigger failed"));
});

export default router;
