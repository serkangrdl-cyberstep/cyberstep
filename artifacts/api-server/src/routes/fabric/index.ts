import { Router, text } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  fortinetIntegrationsTable,
  fabricEventsTable,
  fabricCorrelationsTable,
  fortimanagerBlockActionsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAdmin } from "../admin-panel/middleware";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { parseEvent, type NormalizedEvent } from "../../services/fabric-parser";
import { encryptSecret, generateToken } from "../../services/fabric-crypto";
import { fmTestConnection, fmBlockIp, fmDiscoverDevices } from "../../services/fabric-fortimanager";
import { decryptSecret } from "../../services/fabric-crypto";
import { correlateForIntegration } from "../../services/fabric-correlation";

const router = Router();

type Integration = typeof fortinetIntegrationsTable.$inferSelect;

async function persistEvents(integration: Integration, events: NormalizedEvent[], source: "webhook" | "syslog" | "demo"): Promise<number> {
  if (events.length === 0) return 0;
  const rows = events.slice(0, 500).map((e) => ({
    integrationId: integration.id,
    customerId: integration.customerId,
    source,
    rawFormat: e.rawFormat,
    eventType: e.eventType,
    severity: e.severity,
    action: e.action,
    srcIp: e.srcIp,
    dstIp: e.dstIp,
    dstPort: e.dstPort,
    attackName: e.attackName,
    message: e.message,
    deviceName: e.deviceName,
    deviceTime: e.deviceTime,
    raw: e.raw,
  }));
  await db.insert(fabricEventsTable).values(rows);
  await db.update(fortinetIntegrationsTable)
    .set({
      eventsReceived: (integration.eventsReceived ?? 0) + rows.length,
      lastEventAt: new Date(),
      status: integration.status === "pending" ? "connected" : integration.status,
      updatedAt: new Date(),
    })
    .where(eq(fortinetIntegrationsTable.id, integration.id));
  return rows.length;
}

// ─── PUBLIC INGESTION (always returns 200 to avoid leaking validity) ──────────

async function handleIngest(req: Request, res: Response, source: "webhook" | "syslog"): Promise<void> {
  const token = String(req.params["token"] ?? "");
  try {
    const [integration] = await db.select().from(fortinetIntegrationsTable).where(
      source === "webhook"
        ? eq(fortinetIntegrationsTable.webhookToken, token)
        : eq(fortinetIntegrationsTable.syslogToken, token),
    );
    if (!integration || integration.status === "disabled") {
      res.status(200).json({ ok: true });
      return;
    }
    const events = parseEvent(req.body, req.headers["content-type"]);
    const count = await persistEvents(integration, events, source);
    // Critical/high events trigger an immediate correlation (fire-and-forget);
    // everything else is picked up by the 15-min batch cron.
    if (events.some((e) => e.severity === "critical" || e.severity === "high")) {
      void correlateForIntegration({ ...integration, eventsReceived: (integration.eventsReceived ?? 0) + count })
        .catch((err) => logger.error({ err, integrationId: integration.id }, "Immediate fabric correlation failed"));
    }
    res.status(200).json({ ok: true, received: count });
  } catch (err) {
    logger.error({ err, source }, "Fabric ingest error");
    res.status(200).json({ ok: true });
  }
}

const rawText = text({ type: () => true, limit: "1mb" });
router.post("/fabric/webhook/:token", rawText, (req, res) => { void handleIngest(req, res, "webhook"); });
router.post("/fabric/syslog/:token", rawText, (req, res) => { void handleIngest(req, res, "syslog"); });

// Connectivity check used by the setup wizard / FortiGate test
router.post("/fabric/verify/:token", async (req: Request, res: Response) => {
  const token = String(req.params["token"] ?? "");
  const [integration] = await db.select({ id: fortinetIntegrationsTable.id }).from(fortinetIntegrationsTable)
    .where(sql`${fortinetIntegrationsTable.webhookToken} = ${token} OR ${fortinetIntegrationsTable.syslogToken} = ${token}`);
  res.status(200).json({ ok: true, valid: !!integration });
});

// ─── CUSTOMER PORTAL ──────────────────────────────────────────────────────────

async function getOrInit(customerId: number): Promise<Integration> {
  const [existing] = await db.select().from(fortinetIntegrationsTable)
    .where(eq(fortinetIntegrationsTable.customerId, customerId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(fortinetIntegrationsTable).values({
    customerId,
    webhookToken: generateToken("fgwh"),
    syslogToken: generateToken("fgsl"),
  }).returning();
  return created!;
}

function publicIntegration(i: Integration) {
  return {
    id: i.id,
    name: i.name,
    setupStep: i.setupStep,
    status: i.status,
    demoMode: i.demoMode,
    webhookToken: i.webhookToken,
    syslogToken: i.syslogToken,
    autoBlockEnabled: i.autoBlockEnabled,
    fmConfigured: !!i.fmUrl && !!i.fmUsername && !!i.fmPasswordEnc,
    fmUrl: i.fmUrl,
    fmUsername: i.fmUsername,
    fmAdom: i.fmAdom,
    fmBlockGroup: i.fmBlockGroup,
    fmStatus: i.fmStatus,
    fmLastError: i.fmLastError,
    alertEmail: i.alertEmail,
    fabricDevices: i.fabricDevices,
    eventsReceived: i.eventsReceived,
    correlationsCount: i.correlationsCount,
    blocksCount: i.blocksCount,
    lastEventAt: i.lastEventAt,
  };
}

router.get("/portal/fabric/status", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const integration = await getOrInit(customerId);
    res.json(publicIntegration(integration));
  } catch (err) {
    logger.error({ err }, "Failed to get fabric status");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const setupSchema = z.object({
  setupStep: z.number().int().min(1).max(5).optional(),
  alertEmail: z.string().email().optional().or(z.literal("")),
  autoBlockEnabled: z.boolean().optional(),
  demoMode: z.boolean().optional(),
});

router.post("/portal/fabric/setup", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  const parsed = setupSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }
  try {
    const integration = await getOrInit(customerId);
    const patch: Partial<Integration> = { updatedAt: new Date() };
    if (parsed.data.setupStep !== undefined) patch.setupStep = parsed.data.setupStep;
    if (parsed.data.alertEmail !== undefined) patch.alertEmail = parsed.data.alertEmail || null;
    if (parsed.data.autoBlockEnabled !== undefined) patch.autoBlockEnabled = parsed.data.autoBlockEnabled;
    if (parsed.data.demoMode !== undefined) patch.demoMode = parsed.data.demoMode;
    await db.update(fortinetIntegrationsTable).set(patch).where(eq(fortinetIntegrationsTable.id, integration.id));
    const [updated] = await db.select().from(fortinetIntegrationsTable).where(eq(fortinetIntegrationsTable.id, integration.id));
    res.json(publicIntegration(updated!));
  } catch (err) {
    logger.error({ err }, "Failed to update fabric setup");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/portal/fabric/regenerate-tokens", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const integration = await getOrInit(customerId);
    await db.update(fortinetIntegrationsTable)
      .set({ webhookToken: generateToken("fgwh"), syslogToken: generateToken("fgsl"), updatedAt: new Date() })
      .where(eq(fortinetIntegrationsTable.id, integration.id));
    const [updated] = await db.select().from(fortinetIntegrationsTable).where(eq(fortinetIntegrationsTable.id, integration.id));
    res.json(publicIntegration(updated!));
  } catch (err) {
    logger.error({ err }, "Failed to regenerate fabric tokens");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const fmSchema = z.object({
  fmUrl: z.string().url(),
  fmUsername: z.string().min(1),
  fmPassword: z.string().min(1),
  fmAdom: z.string().optional(),
  fmBlockGroup: z.string().optional(),
});

router.post("/portal/fabric/fortimanager", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  const parsed = fmSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz FortiManager bilgileri" }); return; }
  try {
    const integration = await getOrInit(customerId);
    const enc = encryptSecret(parsed.data.fmPassword);
    if (!enc) { res.status(500).json({ error: "Şifreleme anahtarı yapılandırılmamış, lütfen destek ile iletişime geçin" }); return; }
    // Test the connection before saving
    const test = await fmTestConnection({
      url: parsed.data.fmUrl, username: parsed.data.fmUsername, password: parsed.data.fmPassword,
      adom: parsed.data.fmAdom ?? "root", blockGroup: parsed.data.fmBlockGroup ?? "CyberStep-BlockList",
    });
    await db.update(fortinetIntegrationsTable).set({
      fmUrl: parsed.data.fmUrl,
      fmUsername: parsed.data.fmUsername,
      fmPasswordEnc: enc,
      fmAdom: parsed.data.fmAdom ?? "root",
      fmBlockGroup: parsed.data.fmBlockGroup ?? "CyberStep-BlockList",
      fmStatus: test.ok ? "ok" : "error",
      fmLastError: test.ok ? null : test.message,
      fmLastCheckAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(fortinetIntegrationsTable.id, integration.id));
    res.json({ ok: test.ok, message: test.message });
  } catch (err) {
    logger.error({ err }, "Failed to configure FortiManager");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/portal/fabric/fortimanager/test", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const integration = await getOrInit(customerId);
    const password = decryptSecret(integration.fmPasswordEnc);
    if (!integration.fmUrl || !integration.fmUsername || !password) {
      res.status(400).json({ ok: false, message: "FortiManager henüz yapılandırılmamış" }); return;
    }
    const test = await fmTestConnection({
      url: integration.fmUrl, username: integration.fmUsername, password,
      adom: integration.fmAdom ?? "root", blockGroup: integration.fmBlockGroup ?? "CyberStep-BlockList",
    });
    await db.update(fortinetIntegrationsTable)
      .set({ fmStatus: test.ok ? "ok" : "error", fmLastError: test.ok ? null : test.message, fmLastCheckAt: new Date() })
      .where(eq(fortinetIntegrationsTable.id, integration.id));
    res.json(test);
  } catch (err) {
    logger.error({ err }, "FortiManager test failed");
    res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

router.get("/portal/fabric/events", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  const limit = Math.min(Number(req.query["limit"]) || 50, 200);
  try {
    const rows = await db.select().from(fabricEventsTable)
      .where(eq(fabricEventsTable.customerId, customerId))
      .orderBy(desc(fabricEventsTable.createdAt)).limit(limit);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get fabric events");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/portal/fabric/correlations", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const rows = await db.select().from(fabricCorrelationsTable)
      .where(eq(fabricCorrelationsTable.customerId, customerId))
      .orderBy(desc(fabricCorrelationsTable.createdAt)).limit(100);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get fabric correlations");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/portal/fabric/blocks", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const rows = await db.select().from(fortimanagerBlockActionsTable)
      .where(eq(fortimanagerBlockActionsTable.customerId, customerId))
      .orderBy(desc(fortimanagerBlockActionsTable.createdAt)).limit(100);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get fabric blocks");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/portal/fabric/correlate", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const integration = await getOrInit(customerId);
    const id = await correlateForIntegration(integration);
    if (id === null) { res.json({ ok: true, created: false, message: "İşlenecek yeni olay yok" }); return; }
    res.json({ ok: true, created: true, correlationId: id });
  } catch (err) {
    logger.error({ err }, "Manual correlation failed");
    res.status(500).json({ error: "Korelasyon başarısız" });
  }
});

const manualBlockSchema = z.object({ ip: z.string().min(3), reason: z.string().optional() });

router.post("/portal/fabric/block", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  const parsed = manualBlockSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz IP" }); return; }
  try {
    const integration = await getOrInit(customerId);
    const password = decryptSecret(integration.fmPasswordEnc);
    if (!integration.fmUrl || !integration.fmUsername || !password) {
      res.status(400).json({ error: "FortiManager yapılandırılmamış" }); return;
    }
    const reason = parsed.data.reason ?? "Manuel engelleme";
    const [action] = await db.insert(fortimanagerBlockActionsTable).values({
      integrationId: integration.id, customerId, ip: parsed.data.ip, reason,
    }).returning();
    const r = await fmBlockIp({
      url: integration.fmUrl, username: integration.fmUsername, password,
      adom: integration.fmAdom ?? "root", blockGroup: integration.fmBlockGroup ?? "CyberStep-BlockList",
    }, parsed.data.ip, reason);
    if (action) {
      await db.update(fortimanagerBlockActionsTable)
        .set({ status: r.ok ? "success" : "error", message: r.message })
        .where(eq(fortimanagerBlockActionsTable.id, action.id));
    }
    if (r.ok) {
      await db.update(fortinetIntegrationsTable)
        .set({ blocksCount: (integration.blocksCount ?? 0) + 1 })
        .where(eq(fortinetIntegrationsTable.id, integration.id));
    }
    res.json(r);
  } catch (err) {
    logger.error({ err }, "Manual block failed");
    res.status(500).json({ error: "Engelleme başarısız" });
  }
});

router.post("/portal/fabric/discover-devices", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const integration = await getOrInit(customerId);
    const password = decryptSecret(integration.fmPasswordEnc);
    if (!integration.fmUrl || !integration.fmUsername || !password) {
      res.status(400).json({ error: "FortiManager yapılandırılmamış" }); return;
    }
    const devices = await fmDiscoverDevices({
      url: integration.fmUrl, username: integration.fmUsername, password,
      adom: integration.fmAdom ?? "root", blockGroup: integration.fmBlockGroup ?? "CyberStep-BlockList",
    });
    await db.update(fortinetIntegrationsTable)
      .set({ fabricDevices: devices, updatedAt: new Date() })
      .where(eq(fortinetIntegrationsTable.id, integration.id));
    res.json({ ok: true, devices });
  } catch (err) {
    logger.error({ err }, "Device discovery failed");
    res.status(500).json({ error: "Cihaz keşfi başarısız" });
  }
});

// Demo mode: synthesize a realistic attack burst and correlate it
router.post("/portal/fabric/demo", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  try {
    const integration = await getOrInit(customerId);
    const events = generateDemoEvents();
    await persistEvents(integration, events, "demo");
    await db.update(fortinetIntegrationsTable)
      .set({ demoMode: true, status: "connected", updatedAt: new Date() })
      .where(eq(fortinetIntegrationsTable.id, integration.id));
    const [fresh] = await db.select().from(fortinetIntegrationsTable).where(eq(fortinetIntegrationsTable.id, integration.id));
    const correlationId = await correlateForIntegration(fresh!);
    res.json({ ok: true, eventsGenerated: events.length, correlationId });
  } catch (err) {
    logger.error({ err }, "Demo generation failed");
    res.status(500).json({ error: "Demo oluşturulamadı" });
  }
});

// ─── ADMIN ──────────────────────────────────────────────────────────────────

router.get("/admin/fabric/summary", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [stats] = await db.select({
      total: sql<number>`count(*)::int`,
      connected: sql<number>`count(*) filter (where ${fortinetIntegrationsTable.status} = 'connected')::int`,
      autoBlock: sql<number>`count(*) filter (where ${fortinetIntegrationsTable.autoBlockEnabled} = true)::int`,
      totalEvents: sql<number>`coalesce(sum(${fortinetIntegrationsTable.eventsReceived}),0)::int`,
      totalCorrelations: sql<number>`coalesce(sum(${fortinetIntegrationsTable.correlationsCount}),0)::int`,
      totalBlocks: sql<number>`coalesce(sum(${fortinetIntegrationsTable.blocksCount}),0)::int`,
    }).from(fortinetIntegrationsTable);
    res.json(stats ?? {});
  } catch (err) {
    logger.error({ err }, "Failed to get fabric admin summary");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/admin/fabric/streams", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(fortinetIntegrationsTable).orderBy(desc(fortinetIntegrationsTable.updatedAt)).limit(200);
    res.json(rows.map(publicIntegration));
  } catch (err) {
    logger.error({ err }, "Failed to get fabric streams");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/admin/fabric/correlations", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(fabricCorrelationsTable).orderBy(desc(fabricCorrelationsTable.createdAt)).limit(200);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get admin correlations");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Global event stream across all integrations
router.get("/admin/fabric/events", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(fabricEventsTable).orderBy(desc(fabricEventsTable.createdAt)).limit(200);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get admin fabric events");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Demo trigger: injects a realistic attack burst into a chosen integration and
// runs the full immediate correlation path. Admin-only.
const demoTriggerSchema = z.object({ integrationId: z.number().int().positive().optional() });

router.post("/fabric/demo/trigger", requireAdmin, async (req: Request, res: Response) => {
  const parsed = demoTriggerSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }
  try {
    let integration: Integration | undefined;
    if (parsed.data.integrationId) {
      [integration] = await db.select().from(fortinetIntegrationsTable)
        .where(eq(fortinetIntegrationsTable.id, parsed.data.integrationId)).limit(1);
    } else {
      [integration] = await db.select().from(fortinetIntegrationsTable)
        .orderBy(desc(fortinetIntegrationsTable.updatedAt)).limit(1);
    }
    if (!integration) { res.status(404).json({ error: "Demo için entegrasyon bulunamadı" }); return; }
    const events = generateDemoEvents();
    await persistEvents(integration, events, "demo");
    await db.update(fortinetIntegrationsTable)
      .set({ demoMode: true, status: "connected", updatedAt: new Date() })
      .where(eq(fortinetIntegrationsTable.id, integration.id));
    const [fresh] = await db.select().from(fortinetIntegrationsTable).where(eq(fortinetIntegrationsTable.id, integration.id));
    const correlationId = await correlateForIntegration(fresh!);
    res.json({ ok: true, integrationId: integration.id, eventsGenerated: events.length, correlationId });
  } catch (err) {
    logger.error({ err }, "Admin demo trigger failed");
    res.status(500).json({ error: "Demo oluşturulamadı" });
  }
});

function generateDemoEvents(): NormalizedEvent[] {
  const attacker = `185.220.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
  const target = "10.0.0.12";
  const now = Date.now();
  const mk = (over: Partial<NormalizedEvent>, agoMin: number): NormalizedEvent => ({
    rawFormat: "fortilog", eventType: "unknown", severity: "info", action: null,
    srcIp: attacker, dstIp: target, dstPort: null, attackName: null, message: null,
    deviceName: "FortiGate-60F", deviceTime: new Date(now - agoMin * 60000), raw: { demo: true },
    ...over,
  });
  return [
    mk({ eventType: "ips", severity: "medium", action: "detected", dstPort: 3389, attackName: "RDP.Brute.Force", message: "Çok sayıda başarısız RDP oturum denemesi" }, 25),
    mk({ eventType: "ips", severity: "high", action: "detected", dstPort: 3389, attackName: "RDP.Brute.Force", message: "RDP kaba kuvvet eşiği aşıldı (120 deneme/dk)" }, 22),
    mk({ eventType: "auth", severity: "high", action: "success", dstPort: 3389, attackName: "Successful.Login", message: "Yönetici hesabı ile başarılı giriş" }, 18),
    mk({ eventType: "app-ctrl", severity: "high", action: "allowed", dstPort: 443, attackName: "Unknown.Encrypted.Tunnel", message: "Bilinmeyen şifreli dışa veri akışı" }, 12),
    mk({ eventType: "virus", severity: "critical", action: "blocked", dstPort: 445, attackName: "W32/Ransom.Generic", message: "Fidye yazılımı imzası tespit edildi ve engellendi" }, 6),
    mk({ eventType: "webfilter", severity: "high", action: "blocked", dstPort: 443, attackName: "Malicious.C2", message: "Komuta-kontrol sunucusuna bağlantı engellendi" }, 3),
  ];
}

export default router;
