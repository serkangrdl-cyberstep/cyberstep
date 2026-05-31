/**
 * SOC API routes.
 *   /admin/soc/*   — operator console (requireAdmin)
 *   /portal/soc/*  — customer portal (requireCustomer, tenant-scoped by session)
 * Mirrors the fabric route conventions (direct JSON, Zod-validated inputs).
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  socCasesTable,
  socPlaybooksTable,
  socActivityLogTable,
  aiUsageLogTable,
  socIpWhitelistTable,
  fortimanagerBlockActionsTable,
  fortinetIntegrationsTable,
  fabricEventsTable,
  customersTable,
} from "@workspace/db";
import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAdmin } from "../admin-panel/middleware";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { getCase, updateCase, getCaseActivity, logSOCActivity, summarizeCases } from "../../services/soc/soc-cases";
import { escalateCase, cancelEscalationCheck } from "../../services/soc/soc-escalation";
import { executePlaybook } from "../../services/soc/soc-playbook";
import { triageAlert } from "../../services/soc/soc-triage";
import { generateWeeklySOCReport } from "../../services/soc/soc-report";
import { emitSOC } from "../../services/soc/soc-events";

const router = Router();

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const STATUSES = ["open", "investigating", "resolved", "closed", "false_positive"] as const;

// ─── shared stats ─────────────────────────────────────────────────────────────

async function dashboardStats(customerId: number | null) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where = customerId == null ? undefined : eq(socCasesTable.customerId, customerId);

  const cases = await db.select().from(socCasesTable)
    .where(where)
    .orderBy(desc(socCasesTable.createdAt))
    .limit(500);

  const stats = summarizeCases(cases);
  const last24h = cases.filter((c) => c.createdAt >= since24h).length;
  const active = cases.filter((c) => c.status === "open" || c.status === "investigating");

  return {
    ...stats,
    last24h,
    activeCases: active.slice(0, 25),
    recentCases: cases.slice(0, 25),
  };
}

// ════════════════════════════ ADMIN ════════════════════════════

router.get("/admin/soc/dashboard", requireAdmin, async (_req: Request, res: Response) => {
  try {
    res.json(await dashboardStats(null));
  } catch (err) {
    logger.error({ err }, "SOC admin dashboard failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const caseListSchema = z.object({
  status: z.enum(STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

router.get("/admin/soc/cases", requireAdmin, async (req: Request, res: Response) => {
  const parsed = caseListSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz sorgu" }); return; }
  try {
    const conds = [];
    if (parsed.data.status) conds.push(eq(socCasesTable.status, parsed.data.status));
    if (parsed.data.severity) conds.push(eq(socCasesTable.severity, parsed.data.severity));
    const cases = await db.select().from(socCasesTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(socCasesTable.createdAt))
      .limit(parsed.data.limit ?? 100);
    res.json({ cases });
  } catch (err) {
    logger.error({ err }, "SOC admin case list failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/admin/soc/cases/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  try {
    const socCase = await getCase(id);
    if (!socCase) { res.status(404).json({ error: "Vaka bulunamadı" }); return; }
    const activity = await getCaseActivity(id);
    res.json({ case: socCase, activity });
  } catch (err) {
    logger.error({ err }, "SOC admin case detail failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const caseUpdateSchema = z.object({
  status: z.enum(STATUSES).optional(),
  assignedTo: z.string().max(120).optional(),
  acknowledge: z.boolean().optional(),
});

router.patch("/admin/soc/cases/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const parsed = caseUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }
  try {
    const existing = await getCase(id);
    if (!existing) { res.status(404).json({ error: "Vaka bulunamadı" }); return; }
    const patch: Record<string, unknown> = {};
    if (parsed.data.status) {
      patch["status"] = parsed.data.status;
      if (parsed.data.status === "resolved") patch["resolvedAt"] = new Date();
    }
    if (parsed.data.assignedTo !== undefined) patch["assignedTo"] = parsed.data.assignedTo;
    if (parsed.data.acknowledge) {
      patch["acknowledgedAt"] = new Date();
      cancelEscalationCheck(id);
    }
    const updated = await updateCase(id, patch);
    await logSOCActivity({
      caseId: id, actorType: "analyst", actionType: "updated",
      description: `Vaka güncellendi: ${Object.keys(parsed.data).join(", ")}`,
      details: parsed.data,
    });
    emitSOC({ type: "case_updated", customerId: existing.customerId, caseId: id, data: { ...parsed.data } });
    res.json({ case: updated });
  } catch (err) {
    logger.error({ err }, "SOC admin case update failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const escalateSchema = z.object({ level: z.number().int().min(1).max(4), reason: z.string().min(1).max(500) });

router.post("/admin/soc/cases/:id/escalate", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const parsed = escalateSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }
  try {
    await escalateCase(id, parsed.data.level, parsed.data.reason);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "SOC escalate failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const closeSchema = z.object({ reason: z.string().min(1).max(500), falsePositive: z.boolean().optional() });

router.post("/admin/soc/cases/:id/close", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const parsed = closeSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }
  try {
    const existing = await getCase(id);
    if (!existing) { res.status(404).json({ error: "Vaka bulunamadı" }); return; }
    const updated = await updateCase(id, {
      status: parsed.data.falsePositive ? "false_positive" : "closed",
      closedAt: new Date(), closeReason: parsed.data.reason,
    });
    cancelEscalationCheck(id);
    await logSOCActivity({
      caseId: id, actorType: "analyst", actionType: "closed",
      description: `Vaka kapatıldı: ${parsed.data.reason}`,
    });
    emitSOC({ type: "case_closed", customerId: existing.customerId, caseId: id });
    res.json({ case: updated });
  } catch (err) {
    logger.error({ err }, "SOC close failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const noteSchema = z.object({ note: z.string().min(1).max(2000) });

router.post("/admin/soc/cases/:id/note", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const parsed = noteSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }
  try {
    const socCase = await getCase(id);
    if (!socCase) { res.status(404).json({ error: "Vaka bulunamadı" }); return; }
    await logSOCActivity({
      caseId: id, actorType: "analyst", actionType: "note", description: parsed.data.note,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "SOC note failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── playbooks ────────────────────────────────────────────────────────────────

router.get("/admin/soc/playbooks", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const playbooks = await db.select().from(socPlaybooksTable).orderBy(desc(socPlaybooksTable.createdAt));
    res.json({ playbooks });
  } catch (err) {
    logger.error({ err }, "SOC playbooks list failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const stepSchema = z.object({
  step: z.number().int(),
  type: z.enum(["action", "notify", "create_case", "enrich", "scan", "verify"]),
  action: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  channels: z.array(z.string()).optional(),
  priority: z.string().optional(),
  async: z.boolean().optional(),
  delay_minutes: z.number().optional(),
  on_true: z.string().optional(),
});

const playbookSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  triggerCategories: z.array(z.string()).default([]),
  triggerSeverity: z.array(z.string()).default([]),
  steps: z.array(stepSchema).default([]),
  autoExecute: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

router.post("/admin/soc/playbooks", requireAdmin, async (req: Request, res: Response) => {
  const parsed = playbookSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }
  try {
    const [created] = await db.insert(socPlaybooksTable).values(parsed.data).returning();
    res.json({ playbook: created });
  } catch (err) {
    logger.error({ err }, "SOC playbook create failed");
    res.status(500).json({ error: "Kayıt hatası (slug benzersiz olmalı)" });
  }
});

router.patch("/admin/soc/playbooks/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const parsed = playbookSchema.partial().safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }
  try {
    const [updated] = await db.update(socPlaybooksTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(socPlaybooksTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Playbook bulunamadı" }); return; }
    res.json({ playbook: updated });
  } catch (err) {
    logger.error({ err }, "SOC playbook update failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const testSchema = z.object({ caseId: z.number().int().positive() });

router.post("/admin/soc/playbooks/:id/test", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const parsed = testSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "caseId gerekli" }); return; }
  try {
    const socCase = await getCase(parsed.data.caseId);
    if (!socCase) { res.status(404).json({ error: "Vaka bulunamadı" }); return; }
    void executePlaybook(id, socCase.id, {
      customerId: socCase.customerId,
      ip: socCase.affectedAssets?.[0] ?? null,
      suspectIps: socCase.affectedAssets ?? [],
      channels: ["email"],
    }).catch((err) => logger.warn({ err }, "Playbook test failed"));
    res.json({ ok: true, message: "Playbook test çalıştırması başlatıldı" });
  } catch (err) {
    logger.error({ err }, "SOC playbook test failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── AI costs ─────────────────────────────────────────────────────────────────

router.get("/admin/soc/ai-costs", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [totals] = await db.select({
      total: sql<number>`coalesce(sum(${aiUsageLogTable.costUsd}), 0)`,
      calls: sql<number>`count(*)`,
      cached: sql<number>`coalesce(sum(case when ${aiUsageLogTable.cached} then 1 else 0 end), 0)`,
      inputTokens: sql<number>`coalesce(sum(${aiUsageLogTable.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${aiUsageLogTable.outputTokens}), 0)`,
    }).from(aiUsageLogTable).where(gte(aiUsageLogTable.createdAt, monthStart));

    const byModel = await db.select({
      model: aiUsageLogTable.model,
      total: sql<number>`coalesce(sum(${aiUsageLogTable.costUsd}), 0)`,
      calls: sql<number>`count(*)`,
    }).from(aiUsageLogTable).where(gte(aiUsageLogTable.createdAt, monthStart)).groupBy(aiUsageLogTable.model);

    const byCustomer = await db.select({
      customerId: aiUsageLogTable.customerId,
      total: sql<number>`coalesce(sum(${aiUsageLogTable.costUsd}), 0)`,
      calls: sql<number>`count(*)`,
    }).from(aiUsageLogTable).where(gte(aiUsageLogTable.createdAt, monthStart))
      .groupBy(aiUsageLogTable.customerId)
      .orderBy(desc(sql`sum(${aiUsageLogTable.costUsd})`))
      .limit(25);

    const dayOfMonth = new Date().getDate();
    const total = Number(totals?.total ?? 0);
    const projection = dayOfMonth > 0 ? (total / dayOfMonth) * 30 : total;

    res.json({
      month: { ...totals, total },
      byModel, byCustomer,
      projectionUsd: Number(projection.toFixed(4)),
    });
  } catch (err) {
    logger.error({ err }, "SOC ai-costs failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── demo trigger (e2e) ───────────────────────────────────────────────────────

const demoSchema = z.object({ customerId: z.number().int().positive() });

router.post("/admin/soc/demo/trigger", requireAdmin, async (req: Request, res: Response) => {
  const parsed = demoSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "customerId gerekli" }); return; }
  const customerId = parsed.data.customerId;
  try {
    const [integration] = await db.select().from(fortinetIntegrationsTable)
      .where(eq(fortinetIntegrationsTable.customerId, customerId)).limit(1);

    const attacker = `185.220.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
    const now = Date.now();
    const demoSpecs: Array<{ eventType: string; severity: "critical" | "high" | "medium" | "low" | "info"; action: string; dstPort: number; attackName: string; message: string; agoMin: number }> = [
      { eventType: "ips", severity: "high", action: "detected", dstPort: 3389, attackName: "RDP.Brute.Force", message: "RDP kaba kuvvet eşiği aşıldı (120 deneme/dk)", agoMin: 12 },
      { eventType: "virus", severity: "critical", action: "blocked", dstPort: 445, attackName: "W32/Ransom.Generic", message: "Fidye yazılımı imzası tespit edildi", agoMin: 6 },
      { eventType: "webfilter", severity: "high", action: "blocked", dstPort: 443, attackName: "Malicious.C2", message: "C2 sunucusuna bağlantı denemesi", agoMin: 3 },
    ];
    const demoRows = demoSpecs.map((e) => ({
      integrationId: integration?.id ?? 0,
      customerId,
      source: "demo" as const,
      rawFormat: "fortilog" as const,
      eventType: e.eventType,
      severity: e.severity,
      action: e.action,
      srcIp: attacker,
      dstIp: "10.0.0.12",
      dstPort: e.dstPort,
      attackName: e.attackName,
      message: e.message,
      deviceName: "FortiGate-60F",
      deviceTime: new Date(now - e.agoMin * 60000),
      raw: { demo: true },
    }));

    const inserted = await db.insert(fabricEventsTable).values(demoRows).returning();
    const critical = inserted.find((e) => e.severity === "critical") ?? inserted[0];
    if (!critical) { res.status(500).json({ error: "Demo olayı oluşturulamadı" }); return; }

    const result = await triageAlert(critical, customerId);
    res.json({ ok: true, eventsCreated: inserted.length, triage: result });
  } catch (err) {
    logger.error({ err }, "SOC demo trigger failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ════════════════════════════ CUSTOMER PORTAL ════════════════════════════

router.get("/portal/soc/dashboard", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const [customer] = await db.select({ socTier: customersTable.socTier, socEnabled: customersTable.socEnabled })
      .from(customersTable).where(eq(customersTable.id, customerId));
    const stats = await dashboardStats(customerId);
    res.json({ socTier: customer?.socTier ?? "none", socEnabled: customer?.socEnabled ?? false, ...stats });
  } catch (err) {
    logger.error({ err }, "SOC portal dashboard failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/portal/soc/cases", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const cases = await db.select().from(socCasesTable)
      .where(eq(socCasesTable.customerId, customerId))
      .orderBy(desc(socCasesTable.createdAt)).limit(100);
    res.json({ cases });
  } catch (err) {
    logger.error({ err }, "SOC portal cases failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/portal/soc/cases/:id", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  try {
    const socCase = await getCase(id);
    if (!socCase || socCase.customerId !== customerId) { res.status(404).json({ error: "Vaka bulunamadı" }); return; }
    const activity = await getCaseActivity(id);
    res.json({ case: socCase, activity });
  } catch (err) {
    logger.error({ err }, "SOC portal case detail failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/portal/soc/blocked-ips", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const blocks = await db.select().from(fortimanagerBlockActionsTable)
      .where(eq(fortimanagerBlockActionsTable.customerId, customerId))
      .orderBy(desc(fortimanagerBlockActionsTable.createdAt)).limit(100);
    res.json({ blocks });
  } catch (err) {
    logger.error({ err }, "SOC portal blocked-ips failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/portal/soc/reports/weekly", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const ok = await generateWeeklySOCReport(customerId);
    res.json({ ok, message: ok ? "Haftalık rapor e-postanıza gönderildi" : "Rapor gönderilemedi (e-posta adresi bulunamadı)" });
  } catch (err) {
    logger.error({ err }, "SOC portal weekly report failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── whitelist (customer-managed) ─────────────────────────────────────────────

router.get("/portal/soc/whitelist", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const items = await db.select().from(socIpWhitelistTable)
      .where(eq(socIpWhitelistTable.customerId, customerId))
      .orderBy(desc(socIpWhitelistTable.createdAt));
    res.json({ items });
  } catch (err) {
    logger.error({ err }, "SOC whitelist list failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const whitelistSchema = z.object({ ip: z.string().min(3).max(64), note: z.string().max(200).optional() });

router.post("/portal/soc/whitelist", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  const parsed = whitelistSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz IP" }); return; }
  try {
    const [created] = await db.insert(socIpWhitelistTable)
      .values({ customerId, ip: parsed.data.ip, note: parsed.data.note ?? null }).returning();
    res.json({ item: created });
  } catch (err) {
    logger.error({ err }, "SOC whitelist add failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.delete("/portal/soc/whitelist/:id", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  try {
    await db.delete(socIpWhitelistTable)
      .where(and(eq(socIpWhitelistTable.id, id), eq(socIpWhitelistTable.customerId, customerId)));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "SOC whitelist delete failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
