import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { customerIntegrationsTable, integrationEventsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { testIntegration } from "../../services/integrations";
import { logger } from "../../lib/logger";
import { z } from "zod";

const router = Router();

const IntegrationTypes = ["jira", "forti_manager", "qradar", "forti_siem", "crowdstrike", "trend_micro"] as const;

const CreateIntegrationSchema = z.object({
  type: z.enum(IntegrationTypes),
  name: z.string().min(1).max(100),
  config: z.record(z.string(), z.string()),
  active: z.boolean().optional().default(true),
});

const UpdateIntegrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.string(), z.string()).optional(),
  active: z.boolean().optional(),
});

// GET /api/integrations
router.get("/integrations", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const rows = await db
    .select()
    .from(customerIntegrationsTable)
    .where(eq(customerIntegrationsTable.customerId, customerId))
    .orderBy(desc(customerIntegrationsTable.createdAt));

  const masked = rows.map(r => ({
    ...r,
    config: maskConfig(r.config as Record<string, string>),
  }));
  res.json(masked);
});

// GET /api/integrations/:id/events
router.get("/integrations/:id/events", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [integration] = await db.select().from(customerIntegrationsTable)
    .where(and(eq(customerIntegrationsTable.id, id), eq(customerIntegrationsTable.customerId, customerId)));
  if (!integration) { res.status(404).json({ error: "Entegrasyon bulunamadı" }); return; }

  const events = await db.select().from(integrationEventsTable)
    .where(eq(integrationEventsTable.integrationId, id))
    .orderBy(desc(integrationEventsTable.createdAt))
    .limit(50);
  res.json(events);
});

// POST /api/integrations — create
router.post("/integrations", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const parsed = CreateIntegrationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const [row] = await db.insert(customerIntegrationsTable).values({
    customerId,
    type: parsed.data.type,
    name: parsed.data.name,
    config: parsed.data.config,
    active: parsed.data.active,
  }).returning();
  if (!row) { res.status(500).json({ error: "Kayıt oluşturulamadı" }); return; }
  res.status(201).json({ ...row, config: maskConfig(row.config as Record<string, string>) });
});

// PATCH /api/integrations/:id — update
router.patch("/integrations/:id", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [existing] = await db.select().from(customerIntegrationsTable)
    .where(and(eq(customerIntegrationsTable.id, id), eq(customerIntegrationsTable.customerId, customerId)));
  if (!existing) { res.status(404).json({ error: "Entegrasyon bulunamadı" }); return; }

  const parsed = UpdateIntegrationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;
  if (parsed.data.config !== undefined) {
    const merged: Record<string, string> = { ...(existing.config as Record<string, string>) };
    for (const [k, v] of Object.entries(parsed.data.config)) {
      if (v !== "*****") merged[k] = v;
    }
    updates.config = merged;
  }

  const [updated] = await db.update(customerIntegrationsTable).set(updates)
    .where(eq(customerIntegrationsTable.id, id)).returning();
  if (!updated) { res.status(500).json({ error: "Güncelleme başarısız" }); return; }
  res.json({ ...updated, config: maskConfig(updated.config as Record<string, string>) });
});

// DELETE /api/integrations/:id
router.delete("/integrations/:id", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [existing] = await db.select().from(customerIntegrationsTable)
    .where(and(eq(customerIntegrationsTable.id, id), eq(customerIntegrationsTable.customerId, customerId)));
  if (!existing) { res.status(404).json({ error: "Entegrasyon bulunamadı" }); return; }

  await db.delete(customerIntegrationsTable).where(eq(customerIntegrationsTable.id, id));
  res.json({ ok: true });
});

// POST /api/integrations/:id/test — test saved integration
router.post("/integrations/:id/test", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [integration] = await db.select().from(customerIntegrationsTable)
    .where(and(eq(customerIntegrationsTable.id, id), eq(customerIntegrationsTable.customerId, customerId)));
  if (!integration) { res.status(404).json({ error: "Entegrasyon bulunamadı" }); return; }

  const result = await testIntegration(integration.type, integration.config as Record<string, string>);

  await db.insert(integrationEventsTable).values({
    integrationId: id,
    eventType: "connection_test",
    status: result.ok ? "success" : "error",
    summary: result.message,
    itemsPushed: 0,
    errorMessage: result.ok ? null : result.message,
  }).catch(() => null);

  await db.update(customerIntegrationsTable)
    .set({
      lastSyncAt: new Date(),
      lastSyncStatus: result.ok ? "success" : "error",
      lastSyncError: result.ok ? null : result.message,
    })
    .where(eq(customerIntegrationsTable.id, id));

  res.json(result);
});

// POST /api/integrations/test-config — test without saving
router.post("/integrations/test-config", requireCustomer, async (req: Request, res: Response) => {
  const schema = z.object({
    type: z.enum(IntegrationTypes),
    config: z.record(z.string(), z.string()),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }
  const result = await testIntegration(parsed.data.type, parsed.data.config);
  res.json(result);
});

// ─── Secret masking ───────────────────────────────────────────────────────────

const SECRET_KEYS = ["password", "apiToken", "clientSecret", "token", "secret", "passwd"];

function maskConfig(config: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    const isSecret = SECRET_KEYS.some(s => k.toLowerCase().includes(s.toLowerCase()));
    out[k] = isSecret && v ? "*****" : v;
  }
  return out;
}

// ─── Exported automation helper ───────────────────────────────────────────────

export async function pushToCustomerIntegrations(
  customerId: number | null | undefined,
  eventType: "findings" | "blocklist",
  payload: {
    findings?: Array<{ domain: string; severity: string; title: string; description: string; recommendation: string }>;
    blocklist?: string[];
  }
): Promise<void> {
  if (!customerId) return;
  try {
    const integrations = await db.select().from(customerIntegrationsTable)
      .where(and(eq(customerIntegrationsTable.customerId, customerId), eq(customerIntegrationsTable.active, true)));

    for (const integration of integrations) {
      const cfg = integration.config as Record<string, string>;
      let result: { ok: boolean; pushed?: number; created?: number; sent?: number; message: string } = { ok: false, message: "Bu entegrasyon türü bu olay için desteklenmiyor" };

      if (eventType === "findings" && payload.findings) {
        if (integration.type === "jira") {
          const { jiraBulkCreateFromFindings } = await import("../../services/integrations");
          const r = await jiraBulkCreateFromFindings(cfg as never, payload.findings);
          result = { ok: r.created > 0, created: r.created, message: `${r.created} ticket oluşturuldu, ${r.errors} hata` };
        } else if (integration.type === "qradar") {
          const { qradarSendEvents } = await import("../../services/integrations");
          const events = payload.findings.map(f => ({
            source: f.domain,
            severity: f.severity === "Kritik" ? 10 : f.severity === "Yüksek" ? 7 : 4,
            name: f.title,
            description: f.description,
          }));
          result = await qradarSendEvents(cfg as never, events);
        } else if (integration.type === "forti_siem") {
          const { fortiSIEMSendIncidents } = await import("../../services/integrations");
          const incidents = payload.findings.map(f => ({
            title: f.title, description: f.description, source: f.domain,
            severity: (f.severity === "Kritik" ? "1" : f.severity === "Yüksek" ? "2" : "3") as "1" | "2" | "3" | "4" | "5",
          }));
          result = await fortiSIEMSendIncidents(cfg as never, incidents);
        }
      }

      if (eventType === "blocklist" && payload.blocklist) {
        if (integration.type === "forti_manager") {
          const { fortiManagerPushBlocklist } = await import("../../services/integrations");
          result = await fortiManagerPushBlocklist(cfg as never, payload.blocklist);
        } else if (integration.type === "crowdstrike") {
          const { crowdStrikePushIOCs } = await import("../../services/integrations");
          const iocs = payload.blocklist.map(ip => ({
            type: "ipv4" as const, value: ip,
            severity: "high" as const,
            description: "CyberStep tehdit istihbaratı engel listesi",
          }));
          result = await crowdStrikePushIOCs(cfg as never, iocs);
        } else if (integration.type === "trend_micro") {
          const { trendMicroPushIOCs } = await import("../../services/integrations");
          const iocs = payload.blocklist.map(ip => ({
            type: "ip" as const, value: ip,
            description: "CyberStep tehdit istihbaratı engel listesi",
          }));
          result = await trendMicroPushIOCs(cfg as never, iocs);
        }
      }

      await db.insert(integrationEventsTable).values({
        integrationId: integration.id,
        eventType,
        status: result.ok ? "success" : "error",
        summary: result.message,
        itemsPushed: result.pushed ?? result.created ?? result.sent ?? 0,
        errorMessage: result.ok ? null : result.message,
      }).catch(() => null);

      await db.update(customerIntegrationsTable)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: result.ok ? "success" : "error",
          lastSyncError: result.ok ? null : result.message,
        })
        .where(eq(customerIntegrationsTable.id, integration.id))
        .catch(() => null);
    }
  } catch (err) {
    logger.warn({ err, customerId, eventType }, "Integration push failed");
  }
}

export default router;
