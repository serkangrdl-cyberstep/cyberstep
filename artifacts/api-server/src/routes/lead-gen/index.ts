import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  leadScanQueueTable,
  contactEnrichmentLogTable,
  salesTeamTable,
  leadCampaignsTable,
} from "@workspace/db";
import { eq, desc, and, gte, isNull, count } from "drizzle-orm";
import { requireAdmin } from "../admin-panel/middleware";
import { logger } from "../../lib/logger";
import * as apolloService from "../../services/apolloService";
import * as hunterService from "../../services/hunterService";
import { scoreLeadWithAI } from "../../services/leadScoringService";

const router = Router();

// ─── Lead Scan Queue ──────────────────────────────────────────────────────────

router.get("/api/lead-gen/queue", requireAdmin, async (req: Request, res: Response) => {
  const { status, minScore } = req.query as Record<string, string>;
  let query = db.select().from(leadScanQueueTable).$dynamic();
  if (status) {
    query = query.where(eq(leadScanQueueTable.scanStatus, status));
  } else if (minScore) {
    const score = parseInt(minScore);
    if (!isNaN(score)) {
      query = query.where(gte(leadScanQueueTable.leadScore, score));
    }
  }
  const rows = await query.orderBy(desc(leadScanQueueTable.createdAt)).limit(200);
  res.json(rows);
});

router.get("/api/lead-gen/queue/stats", requireAdmin, async (req: Request, res: Response) => {
  const statuses = ["pending", "scanning", "scored", "contacted", "converted", "skipped"];
  const counts = await Promise.all(
    statuses.map(s =>
      db.select({ count: count() }).from(leadScanQueueTable)
        .where(eq(leadScanQueueTable.scanStatus, s))
    )
  );
  const result: Record<string, number> = {};
  statuses.forEach((s, i) => { result[s] = Number(counts[i]![0]?.count ?? 0); });
  res.json(result);
});

router.post("/api/lead-gen/queue", requireAdmin, async (req: Request, res: Response) => {
  const { domain, companyName, source } = req.body as Record<string, string>;
  if (!domain) return void res.status(400).json({ error: "domain zorunlu" });
  const [row] = await db.insert(leadScanQueueTable).values({
    domain, companyName, source: source ?? "manual", scanStatus: "pending",
  }).returning();
  res.json({ ok: true, id: row?.id });
});

router.post("/api/lead-gen/queue/:id/score", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  const [row] = await db.select().from(leadScanQueueTable).where(eq(leadScanQueueTable.id, id));
  if (!row) return void res.status(404).json({ error: "Bulunamadı" });

  res.json({ ok: true, message: "Puanlama başlatıldı" });

  setImmediate(async () => {
    try {
      await db.update(leadScanQueueTable)
        .set({ scanStatus: "scanning" })
        .where(eq(leadScanQueueTable.id, id));

      const scanData = row.domainScanData as Record<string, unknown> ?? { domain: row.domain };
      const scored = await scoreLeadWithAI(row.domain, row.companyName, scanData);

      await db.update(leadScanQueueTable).set({
        scanStatus: "scored",
        leadScore: scored.score,
        leadScoreFactors: scored.factors,
        scannedAt: new Date(),
      }).where(eq(leadScanQueueTable.id, id));
    } catch (err) {
      logger.error({ err, id }, "Lead scoring failed");
      await db.update(leadScanQueueTable)
        .set({ scanStatus: "skipped", skippedReason: "Puanlama başarısız" })
        .where(eq(leadScanQueueTable.id, id));
    }
  });
});

router.post("/api/lead-gen/queue/:id/enrich", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  const [row] = await db.select().from(leadScanQueueTable).where(eq(leadScanQueueTable.id, id));
  if (!row) return void res.status(404).json({ error: "Bulunamadı" });

  res.json({ ok: true, message: "Kontak zenginleştirme başlatıldı" });

  setImmediate(async () => {
    try {
      const apolloContacts = await apolloService.findDecisionMakers(row.domain);
      let allContacts: unknown[] = [...apolloContacts];

      if (apolloContacts.length === 0) {
        const hunterResult = await hunterService.domainSearch(row.domain);
        const filtered = hunterResult.emails
          .filter(e => e.confidence > 60)
          .slice(0, 5);
        allContacts = [...filtered];
      }

      await db.update(leadScanQueueTable).set({
        contacts: allContacts,
      }).where(eq(leadScanQueueTable.id, id));

      logger.info({ id, contactCount: allContacts.length }, "Lead enrichment completed");
    } catch (err) {
      logger.error({ err, id }, "Lead enrichment failed");
    }
  });
});

router.patch("/api/lead-gen/queue/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  const { scanStatus } = req.body as { scanStatus: string };
  await db.update(leadScanQueueTable).set({ scanStatus }).where(eq(leadScanQueueTable.id, id));
  res.json({ ok: true });
});

router.delete("/api/lead-gen/queue/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  await db.delete(leadScanQueueTable).where(eq(leadScanQueueTable.id, id));
  res.json({ ok: true });
});

// ─── Campaigns ────────────────────────────────────────────────────────────────

router.get("/api/lead-gen/campaigns", requireAdmin, async (req: Request, res: Response) => {
  const rows = await db.select().from(leadCampaignsTable).orderBy(desc(leadCampaignsTable.createdAt));
  res.json(rows);
});

router.post("/api/lead-gen/campaigns", requireAdmin, async (req: Request, res: Response) => {
  const { name, targetSectors, targetEmployeeMin, targetEmployeeMax, targetCities, sources, createdBy } = req.body as {
    name: string;
    targetSectors?: string[];
    targetEmployeeMin?: number;
    targetEmployeeMax?: number;
    targetCities?: string[];
    sources?: string[];
    createdBy?: string;
  };
  if (!name) return void res.status(400).json({ error: "name zorunlu" });
  const [row] = await db.insert(leadCampaignsTable).values({
    name, targetSectors, targetEmployeeMin, targetEmployeeMax,
    targetCities, sources, createdBy, status: "active",
  }).returning();
  res.json({ ok: true, id: row?.id });
});

router.patch("/api/lead-gen/campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  const updates = req.body as Record<string, unknown>;
  delete updates["id"]; delete updates["createdAt"];
  await db.update(leadCampaignsTable).set(updates as typeof updates).where(eq(leadCampaignsTable.id, id));
  res.json({ ok: true });
});

router.delete("/api/lead-gen/campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  await db.update(leadCampaignsTable).set({ status: "archived" }).where(eq(leadCampaignsTable.id, id));
  res.json({ ok: true });
});

// ─── Sales Team ────────────────────────────────────────────────────────────────

router.get("/api/lead-gen/sales-team", requireAdmin, async (req: Request, res: Response) => {
  const rows = await db.select().from(salesTeamTable).where(eq(salesTeamTable.isActive, true)).orderBy(salesTeamTable.name);
  res.json(rows);
});

router.post("/api/lead-gen/sales-team", requireAdmin, async (req: Request, res: Response) => {
  const { name, email, title, phone, monthlyTargetTl } = req.body as {
    name: string; email: string; title?: string; phone?: string; monthlyTargetTl?: string;
  };
  if (!name || !email) return void res.status(400).json({ error: "name ve email zorunlu" });
  const [row] = await db.insert(salesTeamTable).values({ name, email, title, phone, monthlyTargetTl }).returning();
  res.json({ ok: true, id: row?.id });
});

export default router;
