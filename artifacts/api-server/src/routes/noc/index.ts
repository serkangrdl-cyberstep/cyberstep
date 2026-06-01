/**
 * NOC routes — data ingestion + customer portal + admin
 *
 * Passive NOC: CyberStep only listens. Never pushes config to customer.
 */

import { Router } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  nocIntegrationsTable,
  nocEventsTable,
  nocMetricsTable,
  nocCasesTable,
  nocAvailabilityTable,
  customersTable,
} from "@workspace/db";
import { requireCustomer, getCustomerId, requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import {
  getOrCreateNOCIntegration,
  ingestNOCEvent,
  encryptSecret,
} from "../../services/noc-service";

const router = Router();

// ─── Data Ingest (public endpoints with token auth) ──────────────────────────

// SNMP Trap receiver (FortiGate sends here)
router.post("/noc/snmp-trap/:token", async (req: import("express").Request, res: import("express").Response) => {
  const token = String(req.params.token);
  const result = await ingestNOCEvent(token, "snmp_trap", req.body as Record<string, unknown>);
  if (!result.ok) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  res.json({ ok: true, eventId: result.eventId });
});

// NetFlow receiver
router.post("/noc/netflow/:token", async (req: import("express").Request, res: import("express").Response) => {
  const token = String(req.params.token);
  const result = await ingestNOCEvent(token, "netflow", req.body as Record<string, unknown>);
  if (!result.ok) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  res.json({ ok: true, eventId: result.eventId });
});

// ─── Customer Portal ─────────────────────────────────────────────────────────

// GET /api/portal/noc/integration — get or create integration
router.get("/portal/noc/integration", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req) as number;
  const integration = await getOrCreateNOCIntegration(customerId);
  res.json(integration);
});

// GET /api/portal/noc/dashboard
router.get("/portal/noc/dashboard", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req) as number;

  const [integration] = await db.select()
    .from(nocIntegrationsTable)
    .where(eq(nocIntegrationsTable.customerId, customerId));

  if (!integration) {
    res.json({ hasIntegration: false });
    return;
  }

  // Active cases
  const activeCases = await db.select()
    .from(nocCasesTable)
    .where(
      and(
        eq(nocCasesTable.customerId, customerId),
        eq(nocCasesTable.status, "open"),
      ),
    )
    .orderBy(desc(nocCasesTable.createdAt))
    .limit(10);

  // Recent events (last 24h)
  const since24h = new Date(Date.now() - 86_400_000);
  const recentEvents = await db.select()
    .from(nocEventsTable)
    .where(
      and(
        eq(nocEventsTable.customerId, customerId),
        gte(nocEventsTable.occurredAt, since24h),
      ),
    )
    .orderBy(desc(nocEventsTable.occurredAt))
    .limit(20);

  // Latest metrics per interface
  const latestMetrics = await db.execute(sql`
    SELECT DISTINCT ON (device_ip, interface_name, metric_type)
      device_ip, interface_name, metric_type, value, unit, recorded_at
    FROM noc_metrics
    WHERE customer_id = ${customerId}
      AND recorded_at > now() - interval '1 hour'
    ORDER BY device_ip, interface_name, metric_type, recorded_at DESC
  `);

  // Uptime last 7 days
  const since7d = new Date(Date.now() - 7 * 86_400_000);
  const availRows = await db.select()
    .from(nocAvailabilityTable)
    .where(
      and(
        eq(nocAvailabilityTable.customerId, customerId),
        gte(nocAvailabilityTable.checkedAt, since7d),
      ),
    );

  const uptime7d = availRows.length > 0
    ? (availRows.filter((r) => r.isUp).length / availRows.length * 100).toFixed(2)
    : null;

  res.json({
    hasIntegration: true,
    integration: {
      nocTier: integration.nocTier,
      baselineLearning: integration.baselineLearning,
      baselineCompletedAt: integration.baselineCompletedAt,
      totalEvents: integration.totalEvents,
      totalAlerts: integration.totalAlerts,
      uptimeThisMonthPct: integration.uptimeThisMonthPct,
      availabilitySlaPct: integration.availabilitySlaPct,
      snmpToken: integration.snmpToken,
      netflowToken: integration.netflowToken,
      setupStep: integration.setupStep,
      monitoredDevices: integration.monitoredDevices,
      monitoredServices: integration.monitoredServices,
    },
    activeCases,
    recentEvents,
    latestMetrics: latestMetrics.rows,
    uptime7d,
  });
});

// GET /api/portal/noc/metrics — bandwidth charts
router.get("/portal/noc/metrics", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req) as number;
  const hours = Number(req.query.hours ?? 24);
  const since = new Date(Date.now() - hours * 3_600_000);

  const metrics = await db.select()
    .from(nocMetricsTable)
    .where(
      and(
        eq(nocMetricsTable.customerId, customerId),
        gte(nocMetricsTable.recordedAt, since),
      ),
    )
    .orderBy(nocMetricsTable.recordedAt);

  res.json(metrics);
});

// GET /api/portal/noc/cases
router.get("/portal/noc/cases", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req) as number;
  const cases = await db.select()
    .from(nocCasesTable)
    .where(eq(nocCasesTable.customerId, customerId))
    .orderBy(desc(nocCasesTable.createdAt))
    .limit(50);
  res.json(cases);
});

// GET /api/portal/noc/availability
router.get("/portal/noc/availability", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req) as number;
  const since = new Date(Date.now() - 24 * 3_600_000);

  const rows = await db.select()
    .from(nocAvailabilityTable)
    .where(
      and(
        eq(nocAvailabilityTable.customerId, customerId),
        gte(nocAvailabilityTable.checkedAt, since),
      ),
    )
    .orderBy(desc(nocAvailabilityTable.checkedAt));

  res.json(rows);
});

// ─── Onboarding / Setup ──────────────────────────────────────────────────────

// POST /api/portal/noc/setup/step — save setup step progress
router.post("/portal/noc/setup/step", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req) as number;
  const { step, data } = req.body as { step: number; data?: Record<string, unknown> };

  const [integration] = await db.select()
    .from(nocIntegrationsTable)
    .where(eq(nocIntegrationsTable.customerId, customerId));

  if (!integration) {
    res.status(404).json({ error: "NOC entegrasyonu bulunamadı" });
    return;
  }

  const patch: Partial<typeof nocIntegrationsTable.$inferInsert> = {
    setupStep: step,
    updatedAt: new Date(),
  };

  // Step 3: FortiGate API credentials
  if (step === 3 && data?.host && data?.token) {
    patch.fortigateHost = data.host as string;
    patch.fortigateTokenEncrypted = encryptSecret(data.token as string) ?? undefined;
    patch.fortigatePollingEnabled = true;
  }

  // Step 4: Monitored devices
  if (step === 4 && data?.devices) {
    patch.monitoredDevices = data.devices;
    patch.snmpTrapEnabled = true;
  }

  // Step 5: Monitored services
  if (step === 5 && data?.services) {
    patch.monitoredServices = data.services;
  }

  // Step 6: setup complete
  if (step === 6) {
    patch.setupCompletedAt = new Date();
  }

  await db.update(nocIntegrationsTable)
    .set(patch)
    .where(eq(nocIntegrationsTable.id, integration.id));

  res.json({ ok: true, step });
});

// POST /api/portal/noc/test/api — test FortiGate API connection
router.post("/portal/noc/test/api", requireCustomer, async (req, res) => {
  const { host, token } = req.body as { host: string; token: string };
  if (!host || !token) {
    res.status(400).json({ error: "host ve token gereklidir" });
    return;
  }

  try {
    const https = await import("https");
    const axios = (await import("axios")).default;
    const agent = new https.Agent({ rejectUnauthorized: false });
    const resp = await axios.get(`https://${host}/api/v2/monitor/system/status`, {
      headers: { Authorization: `Bearer ${token}` },
      httpsAgent: agent,
      timeout: 8_000,
    });
    const serial = resp.data?.results?.serial ?? "bilinmiyor";
    res.json({ ok: true, message: `Bağlantı başarılı (S/N: ${serial})` });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.json({ ok: false, message: `Bağlantı hatası: ${msg}` });
  }
});

// POST /api/portal/noc/test/snmp — manual SNMP test event
router.post("/portal/noc/test/snmp", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req) as number;
  const [integration] = await db.select()
    .from(nocIntegrationsTable)
    .where(eq(nocIntegrationsTable.customerId, customerId));

  if (!integration?.snmpToken) {
    res.status(404).json({ error: "NOC entegrasyonu bulunamadı" });
    return;
  }

  const result = await ingestNOCEvent(integration.snmpToken, "snmp_trap", {
    event_type: "test_trap",
    severity: "info",
    title: "NOC Test Olayı",
    description: "CyberStep NOC bağlantı testi başarıyla tamamlandı.",
    device_ip: "127.0.0.1",
    device_name: "Test Cihazı",
  });

  res.json({ ok: result.ok, message: "Test SNMP olayı oluşturuldu" });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

// GET /api/admin/noc/dashboard
router.get("/admin/noc/dashboard", requireAdmin, async (req, res) => {
  const [
    totalCustomers,
    openCases,
    allCases,
    learningCount,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(nocIntegrationsTable),
    db.select({ count: sql<number>`count(*)` })
      .from(nocCasesTable)
      .where(eq(nocCasesTable.status, "open")),
    db.select().from(nocCasesTable)
      .where(eq(nocCasesTable.status, "open"))
      .orderBy(nocCasesTable.priority, desc(nocCasesTable.createdAt))
      .limit(20),
    db.select({ count: sql<number>`count(*)` })
      .from(nocIntegrationsTable)
      .where(eq(nocIntegrationsTable.baselineLearning, true)),
  ]);

  const p1 = allCases.filter((c) => c.priority === 1).length;
  const p2 = allCases.filter((c) => c.priority === 2).length;
  const p3 = allCases.filter((c) => c.priority === 3).length;
  const p4 = allCases.filter((c) => c.priority === 4).length;

  res.json({
    totalCustomers: Number(totalCustomers[0]?.count ?? 0),
    openCases: Number(openCases[0]?.count ?? 0),
    learningCount: Number(learningCount[0]?.count ?? 0),
    caseSummary: { p1, p2, p3, p4 },
    activeCases: allCases,
  });
});

// GET /api/admin/noc/customers — all customer network status
router.get("/admin/noc/customers", requireAdmin, async (req, res) => {
  const integrations = await db.select({
    integration: nocIntegrationsTable,
    company: customersTable.companyName,
    email: customersTable.email,
  })
    .from(nocIntegrationsTable)
    .leftJoin(customersTable, eq(nocIntegrationsTable.customerId, customersTable.id))
    .orderBy(nocIntegrationsTable.createdAt);

  res.json(integrations);
});

// GET /api/admin/noc/cases
router.get("/admin/noc/cases", requireAdmin, async (req, res) => {
  const status = req.query.status as string | undefined;
  const cases = await db.select({
    case_: nocCasesTable,
    company: customersTable.companyName,
  })
    .from(nocCasesTable)
    .leftJoin(customersTable, eq(nocCasesTable.customerId, customersTable.id))
    .where(status ? eq(nocCasesTable.status, status) : undefined)
    .orderBy(nocCasesTable.priority, desc(nocCasesTable.createdAt))
    .limit(100);

  res.json(cases);
});

// PATCH /api/admin/noc/cases/:id — update case status
router.patch("/admin/noc/cases/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { status, rootCauseAnalysis } = req.body as { status?: string; rootCauseAnalysis?: string };

  const patch: Partial<typeof nocCasesTable.$inferInsert> = { updatedAt: new Date() };
  if (status) {
    patch.status = status;
    if (status === "resolved") patch.resolvedAt = new Date();
    if (status === "closed") patch.closedAt = new Date();
  }
  if (rootCauseAnalysis) patch.rootCauseAnalysis = rootCauseAnalysis;

  await db.update(nocCasesTable).set(patch).where(eq(nocCasesTable.id, id));
  res.json({ ok: true });
});

// GET /api/admin/noc/events — recent events stream
router.get("/admin/noc/events", requireAdmin, async (req, res) => {
  const since = req.query.since
    ? new Date(req.query.since as string)
    : new Date(Date.now() - 3_600_000);

  const events = await db.select()
    .from(nocEventsTable)
    .where(gte(nocEventsTable.occurredAt, since))
    .orderBy(desc(nocEventsTable.occurredAt))
    .limit(200);

  res.json(events);
});

// GET /api/admin/noc/correlations — SOC-NOC correlated cases
router.get("/admin/noc/correlations", requireAdmin, async (req, res) => {
  const correlated = await db.select()
    .from(nocCasesTable)
    .where(eq(nocCasesTable.isSecurityRelated, true))
    .orderBy(desc(nocCasesTable.createdAt))
    .limit(50);

  res.json(correlated);
});

export default router;
