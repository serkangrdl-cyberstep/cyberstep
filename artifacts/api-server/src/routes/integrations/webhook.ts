import { Router } from "express";
import { pool } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { encryptSecret, decryptSecret } from "../../services/fabric-crypto";
import { validateWebhookUrl, dispatchWebhook, type WebhookEvent } from "../../services/webhookDispatcher";

const router = Router();

const ALL_EVENTS: WebhookEvent[] = [
  "soc.case.opened", "soc.case.closed", "soc.case.critical",
  "soc.sla.breached", "scan.completed", "report.ready",
];

// ─── GET /api/integrations/webhook ───────────────────────────────────────────
router.get("/integrations/webhook", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT id, name, url, events, active, headers_json AS "headersJson", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM webhook_configs WHERE customer_id = $1 ORDER BY created_at DESC`,
      [customerId],
    );
    res.json({ webhooks: rows });
  } catch (err) {
    req.log.error({ err }, "GET /api/integrations/webhook error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/webhook ──────────────────────────────────────────
router.post("/integrations/webhook", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { name, url, secret, events, headers } = req.body as {
    name?: string; url: string; secret?: string;
    events?: WebhookEvent[]; headers?: Record<string, string>;
  };

  if (!url) { res.status(400).json({ error: "url zorunludur" }); return; }
  try { validateWebhookUrl(url); }
  catch (e) { res.status(400).json({ error: `Geçersiz URL: ${(e as Error).message}` }); return; }

  const selectedEvents = events?.length ? events : ALL_EVENTS;
  const secretEnc = secret ? encryptSecret(secret) : null;
  const headersJson = headers && Object.keys(headers).length ? JSON.stringify(headers) : null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO webhook_configs (customer_id, name, url, secret_enc, events, headers_json)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, url, events, active, created_at AS "createdAt"`,
      [customerId, name ?? "Webhook", url, secretEnc, selectedEvents, headersJson],
    );
    res.status(201).json({ webhook: rows[0] });
  } catch (err) {
    req.log.error({ err }, "POST /api/integrations/webhook error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── PUT /api/integrations/webhook/:id ───────────────────────────────────────
router.put("/integrations/webhook/:id", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const { name, url, secret, events, active, headers } = req.body as {
    name?: string; url?: string; secret?: string;
    events?: WebhookEvent[]; active?: boolean; headers?: Record<string, string>;
  };

  if (url) {
    try { validateWebhookUrl(url); }
    catch (e) { res.status(400).json({ error: `Geçersiz URL: ${(e as Error).message}` }); return; }
  }

  try {
    const secretEnc = secret ? encryptSecret(secret) : undefined;
    const headersJson = headers ? JSON.stringify(headers) : undefined;

    const { rowCount } = await pool.query(
      `UPDATE webhook_configs
       SET name        = COALESCE($1, name),
           url         = COALESCE($2, url),
           secret_enc  = CASE WHEN $3::TEXT IS NOT NULL THEN $3 ELSE secret_enc END,
           events      = COALESCE($4, events),
           active      = COALESCE($5, active),
           headers_json= COALESCE($6, headers_json),
           updated_at  = NOW()
       WHERE id = $7 AND customer_id = $8`,
      [name ?? null, url ?? null, secretEnc ?? null, events ?? null, active ?? null, headersJson ?? null, id, customerId],
    );
    if (!rowCount) { res.status(404).json({ error: "Bulunamadı" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PUT /api/integrations/webhook/:id error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── DELETE /api/integrations/webhook/:id ────────────────────────────────────
router.delete("/integrations/webhook/:id", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  try {
    await pool.query(`DELETE FROM webhook_configs WHERE id = $1 AND customer_id = $2`, [id, customerId]);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /api/integrations/webhook/:id error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/webhook/:id/test ─────────────────────────────────
router.post("/integrations/webhook/:id/test", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT url FROM webhook_configs WHERE id = $1 AND customer_id = $2`,
      [id, customerId],
    );
    if (!rows[0]) { res.status(404).json({ error: "Bulunamadı" }); return; }
    await dispatchWebhook(customerId, "soc.case.opened", {
      test: true, title: "CyberStep Test Webhook", caseNumber: "TEST-001", severity: "low",
    });
    res.json({ ok: true, message: "Test webhook gönderildi" });
  } catch (err) {
    req.log.error({ err }, "Webhook test error");
    res.status(500).json({ error: `Test başarısız: ${(err as Error).message}` });
  }
});

// ─── GET /api/integrations/webhook/deliveries ─────────────────────────────────
router.get("/integrations/webhook/deliveries", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT wd.id, wd.event_type AS "eventType", wd.status, wd.attempts,
              wd.response_code AS "responseCode", wd.delivered_at AS "deliveredAt",
              wd.created_at AS "createdAt", wc.name AS "webhookName", wc.url
       FROM webhook_deliveries wd
       JOIN webhook_configs wc ON wc.id = wd.webhook_id
       WHERE wd.customer_id = $1
       ORDER BY wd.created_at DESC LIMIT 50`,
      [customerId],
    );
    res.json({ deliveries: rows });
  } catch (err) {
    req.log.error({ err }, "GET /api/integrations/webhook/deliveries error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
