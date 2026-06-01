import { Router } from "express";
import { db, pool } from "@workspace/db";
import { observabilityIntegrationsTable, observabilityEventsTable } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { encryptSecret } from "../../services/fabric-crypto";
import {
  normalizeDatadogEvent,
  normalizeAzureEvent,
  normalizeCloudflareEvent,
  verifyAzureSignature,
  verifyCloudflareHeader,
  correlateWithSOC,
  correlateCloudflareWithSOC,
} from "../../services/observabilityCorrelation";
import { decryptSecret } from "../../services/fabric-crypto";
import { getMetrics, getContentType, observabilityEventsTotal } from "../../monitoring/prometheusMetrics";

const router = Router();

// ─── Prometheus scrape endpoint ───────────────────────────────────────────────

router.get("/metrics", async (_req, res) => {
  try {
    const metrics = await getMetrics();
    res.set("Content-Type", getContentType());
    res.send(metrics);
  } catch (err) {
    logger.error({ err }, "GET /api/metrics error");
    res.status(500).send("# metrics error");
  }
});

// ─── Inbound webhooks (public — no auth, token-gated) ─────────────────────────

interface IntegrationRow extends Record<string, unknown> {
  id: number; customer_id: number; provider: string; display_name: string | null;
  webhook_token: string; is_active: boolean; last_event_at: string | null; event_count: number;
  event_types: string[]; created_at: string;
}

async function getIntegrationByToken(token: string, provider: string) {
  const { rows } = await pool.query<IntegrationRow & { api_key_encrypted: string | null }>(
    `SELECT *, api_key_encrypted FROM observability_integrations
     WHERE webhook_token = $1 AND provider = $2 AND is_active = true
     LIMIT 1`,
    [token, provider]
  );
  return rows[0] ? {
    id: rows[0].id,
    customerId: rows[0].customer_id,
    provider: rows[0].provider,
    apiKeyEncrypted: rows[0].api_key_encrypted,
  } : null;
}

function generateToken(): string {
  const crypto = require("node:crypto") as typeof import("node:crypto");
  return crypto.randomBytes(32).toString("hex");
}

// POST /api/integrations/datadog/:token
router.post("/webhook/datadog/:token", async (req, res) => {
  const integration = await getIntegrationByToken(req.params["token"]!, "datadog").catch(() => null);
  res.status(200).json({ ok: true });
  if (!integration) return;

  const payload = req.body as Record<string, unknown>;
  const event = normalizeDatadogEvent(payload);

  try {
    const [obsEvent] = await db.insert(observabilityEventsTable).values({
      integrationId: integration.id,
      customerId: integration.customerId,
      provider: "datadog",
      eventType: event.eventType,
      severity: event.severity,
      title: event.title,
      description: event.description,
      affectedService: event.affectedService,
      affectedHost: event.affectedHost,
      rawPayload: payload,
    }).returning({ id: observabilityEventsTable.id });

    await pool.query(
      `UPDATE observability_integrations SET last_event_at = NOW(), event_count = event_count + 1 WHERE id = $1`,
      [integration.id]
    );

    observabilityEventsTotal.inc({ provider: "datadog", event_type: event.eventType, severity: event.severity });

    if (["critical", "high"].includes(event.severity) && obsEvent) {
      setImmediate(() => correlateWithSOC(integration.customerId, event, integration.id, obsEvent.id).catch(err => {
        logger.error({ err }, "Datadog correlateWithSOC error");
      }));
    }
  } catch (err) {
    logger.error({ err }, "POST /api/integrations/datadog/:token error");
  }
});

// POST /api/integrations/azure/:token
router.post("/webhook/azure/:token", async (req, res) => {
  const signature = req.headers["x-ms-notification-signature"];
  if (!verifyAzureSignature(req.body, signature)) {
    res.status(200).json({ ok: true });
    return;
  }

  const integration = await getIntegrationByToken(req.params["token"]!, "azure_monitor").catch(() => null);
  res.status(200).json({ ok: true });
  if (!integration) return;

  const payload = req.body as Record<string, unknown>;
  const event = normalizeAzureEvent(payload as Parameters<typeof normalizeAzureEvent>[0]);

  try {
    const [obsEvent] = await db.insert(observabilityEventsTable).values({
      integrationId: integration.id,
      customerId: integration.customerId,
      provider: "azure_monitor",
      eventType: event.eventType,
      severity: event.severity,
      title: event.title,
      description: event.description,
      affectedService: event.affectedService,
      affectedHost: event.affectedHost,
      sourceIp: event.sourceIp,
      rawPayload: payload,
    }).returning({ id: observabilityEventsTable.id });

    await pool.query(
      `UPDATE observability_integrations SET last_event_at = NOW(), event_count = event_count + 1 WHERE id = $1`,
      [integration.id]
    );

    observabilityEventsTotal.inc({ provider: "azure_monitor", event_type: event.eventType, severity: event.severity });

    if (["critical", "high"].includes(event.severity) && obsEvent) {
      setImmediate(() => correlateWithSOC(integration.customerId, event, integration.id, obsEvent.id).catch(err => {
        logger.error({ err }, "Azure correlateWithSOC error");
      }));
    }
  } catch (err) {
    logger.error({ err }, "POST /api/integrations/azure/:token error");
  }
});

// POST /api/webhook/cloudflare/:token
router.post("/webhook/cloudflare/:token", async (req, res) => {
  const integration = await getIntegrationByToken(req.params["token"]!, "cloudflare").catch(() => null);

  // Always respond 200 to Cloudflare (regardless of auth) to avoid retry storms
  res.status(200).json({ ok: true });
  if (!integration) return;

  // Verify CF-Webhook-Token header against stored shared secret (if configured)
  const storedSecret = decryptSecret(integration.apiKeyEncrypted);
  const cfAuthHeader = req.headers["cf-webhook-token"];
  if (!verifyCloudflareHeader(cfAuthHeader, storedSecret)) {
    logger.warn({ integrationId: integration.id }, "Cloudflare webhook: CF-Webhook-Token mismatch — dropping");
    return;
  }

  const payload = req.body as Record<string, unknown>;
  const event = normalizeCloudflareEvent(payload as Parameters<typeof normalizeCloudflareEvent>[0]);

  try {
    const [obsEvent] = await db.insert(observabilityEventsTable).values({
      integrationId: integration.id,
      customerId: integration.customerId,
      provider: "cloudflare",
      eventType: event.eventType,
      severity: event.severity,
      title: event.title,
      description: event.description,
      affectedService: event.affectedService,
      sourceIp: event.sourceIp,
      rawPayload: payload,
    }).returning({ id: observabilityEventsTable.id });

    await pool.query(
      `UPDATE observability_integrations SET last_event_at = NOW(), event_count = event_count + 1 WHERE id = $1`,
      [integration.id]
    );

    observabilityEventsTotal.inc({ provider: "cloudflare", event_type: event.eventType, severity: event.severity });

    if (["critical", "high"].includes(event.severity) && obsEvent) {
      setImmediate(() => correlateCloudflareWithSOC(integration.customerId, event, integration.id, obsEvent.id).catch(err => {
        logger.error({ err }, "Cloudflare correlateCloudflareWithSOC error");
      }));
    } else if (event.eventType === "bot.score" && obsEvent) {
      setImmediate(() => correlateCloudflareWithSOC(integration.customerId, event, integration.id, obsEvent.id).catch(err => {
        logger.error({ err }, "Cloudflare bot.score processing error");
      }));
    }
  } catch (err) {
    logger.error({ err }, "POST /api/webhook/cloudflare/:token error");
  }
});

// ─── Portal CRUD (müşteri kendi entegrasyonlarını yönetir) ────────────────────

// GET /api/portal/integrations/observability
router.get("/portal/integrations/observability", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT id, provider, display_name AS "displayName", webhook_token AS "webhookToken",
              is_active AS "isActive", last_event_at AS "lastEventAt", event_count AS "eventCount",
              event_types AS "eventTypes", created_at AS "createdAt"
       FROM observability_integrations
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    );
    res.json({ integrations: rows });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/integrations/observability error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/portal/integrations/observability
router.post("/portal/integrations/observability", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const { provider, displayName, eventTypes, apiKey, apiEndpoint, config } = req.body as {
    provider: string; displayName?: string; eventTypes?: string[];
    apiKey?: string; apiEndpoint?: string; config?: Record<string, unknown>;
  };

  if (!provider) { res.status(400).json({ error: "Provider zorunlu" }); return; }

  try {
    const webhookToken = generateToken();
    const apiKeyEncrypted = apiKey ? (encryptSecret(apiKey) ?? apiKey) : null;

    const [integration] = await db.insert(observabilityIntegrationsTable).values({
      customerId,
      provider,
      displayName: displayName || `${provider} Entegrasyonu`,
      webhookToken,
      apiKeyEncrypted,
      apiEndpoint: apiEndpoint || null,
      eventTypes: eventTypes ?? [],
      config: config ?? {},
      isActive: true,
    }).returning({
      id: observabilityIntegrationsTable.id,
      webhookToken: observabilityIntegrationsTable.webhookToken,
      provider: observabilityIntegrationsTable.provider,
    });

    res.status(201).json({ integration, message: "Entegrasyon oluşturuldu." });
  } catch (err) {
    req.log.error({ err }, "POST /api/portal/integrations/observability error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// PATCH /api/portal/integrations/observability/:id/toggle
router.patch("/portal/integrations/observability/:id/toggle", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);
  try {
    const { rows } = await pool.query<{ is_active: boolean }>(
      `UPDATE observability_integrations
       SET is_active = NOT is_active
       WHERE id = $1 AND customer_id = $2
       RETURNING is_active`,
      [id, customerId]
    );
    if (!rows[0]) { res.status(404).json({ error: "Bulunamadı" }); return; }
    res.json({ ok: true, isActive: rows[0].is_active });
  } catch (err) {
    req.log.error({ err }, "PATCH /api/portal/integrations/observability/:id/toggle error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// DELETE /api/portal/integrations/observability/:id
router.delete("/portal/integrations/observability/:id", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);
  try {
    await pool.query(
      `DELETE FROM observability_integrations WHERE id = $1 AND customer_id = $2`,
      [id, customerId]
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /api/portal/integrations/observability/:id error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/portal/integrations/observability/:id/test
router.post("/portal/integrations/observability/:id/test", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);

  try {
    const { rows } = await pool.query<{ id: number; provider: string }>(
      `SELECT id, provider FROM observability_integrations WHERE id = $1 AND customer_id = $2 LIMIT 1`,
      [id, customerId]
    );
    const integration = rows[0];
    if (!integration) { res.status(404).json({ error: "Bulunamadı" }); return; }

    await db.insert(observabilityEventsTable).values({
      integrationId: integration.id,
      customerId,
      provider: integration.provider,
      eventType: "security_alert",
      severity: "low",
      title: "Test Event — CyberStep Bağlantı Testi",
      description: "Bu bir test evidentidir. Entegrasyon başarıyla çalışıyor.",
      processed: true,
    });

    res.json({ ok: true, message: "Test eventi oluşturuldu." });
  } catch (err) {
    req.log.error({ err }, "POST /api/portal/integrations/observability/:id/test error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/portal/integrations/observability/events
router.get("/portal/integrations/observability/events", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT id, provider, event_type AS "eventType", severity, title,
              affected_service AS "affectedService", processed,
              correlated_soc_case_id AS "correlatedSocCaseId", received_at AS "receivedAt"
       FROM observability_events
       WHERE customer_id = $1
       ORDER BY received_at DESC
       LIMIT 50`,
      [customerId]
    );
    res.json({ events: rows });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/integrations/observability/events error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
