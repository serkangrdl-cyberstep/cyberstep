import { Router } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import { pool } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { encryptSecret, decryptSecret } from "../../services/fabric-crypto";
import {
  testServiceNowConnection,
  validateServiceNowUrl,
  generateAndStoreWebhookSecret,
  processServiceNowWebhook,
  retryWebhookError,
} from "../../services/serviceNowClient";

const router = Router();

// ─── GET /api/integrations/servicenow ─────────────────────────────────────────
router.get("/integrations/servicenow", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  try {
    const { rows } = await pool.query(
      `SELECT id, instance_url AS "instanceUrl", username,
              assignment_group AS "assignmentGroup", category,
              active, last_sync_at AS "lastSyncAt", last_sync_error AS "lastSyncError",
              last_webhook_at AS "lastWebhookAt",
              webhook_event_count AS "webhookEventCount",
              webhook_notify_all AS "webhookNotifyAll",
              webhook_notify_closed_only AS "webhookNotifyClosedOnly",
              created_at AS "createdAt"
       FROM servicenow_configs
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [customerId],
    );
    res.json({ config: rows[0] ?? null });
  } catch (err) {
    req.log.error({ err }, "GET /api/integrations/servicenow error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/servicenow ────────────────────────────────────────
router.post("/integrations/servicenow", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { instanceUrl, username, apiToken, assignmentGroup, category } = req.body as {
    instanceUrl: string; username: string; apiToken: string;
    assignmentGroup?: string; category?: string;
  };

  if (!instanceUrl || !username || !apiToken) {
    res.status(400).json({ error: "instanceUrl, username ve apiToken zorunludur" });
    return;
  }

  // Bağlantıyı test et
  const test = await testServiceNowConnection({
    instanceUrl, username, password: apiToken,
  });
  if (!test.ok) {
    res.status(400).json({ error: `Bağlantı testi başarısız: ${test.message}` });
    return;
  }

  try {
    const encrypted = encryptSecret(apiToken);
    if (!encrypted) { res.status(500).json({ error: "Token şifrelenemedi" }); return; }

    // Var olan config'i güncelle veya yeni oluştur
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO servicenow_configs
         (customer_id, instance_url, username, api_token_enc, assignment_group, category, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (customer_id) DO UPDATE
         SET instance_url = $2, username = $3, api_token_enc = $4,
             assignment_group = $5, category = $6, active = true, updated_at = NOW()
       RETURNING id`,
      [customerId, instanceUrl, username, encrypted, assignmentGroup ?? null, category ?? "Software"],
    );

    logger.info({ customerId, configId: rows[0]?.id }, "ServiceNow config kaydedildi");
    res.status(201).json({ ok: true, configId: rows[0]?.id });
  } catch (err) {
    req.log.error({ err }, "POST /api/integrations/servicenow error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── PUT /api/integrations/servicenow/:id ─────────────────────────────────────
router.put("/integrations/servicenow/:id", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const id = Number(req.params["id"]);
  const { instanceUrl, username, apiToken, assignmentGroup, category } = req.body as {
    instanceUrl?: string; username?: string; apiToken?: string;
    assignmentGroup?: string; category?: string;
  };

  try {
    // Validate instanceUrl even when no apiToken change is submitted
    if (instanceUrl) {
      try { validateServiceNowUrl(instanceUrl); }
      catch (e) { res.status(400).json({ error: `Geçersiz URL: ${(e as Error).message}` }); return; }
    }

    let tokenEnc: string | null = null;
    if (apiToken) {
      tokenEnc = encryptSecret(apiToken);
      if (!tokenEnc) { res.status(500).json({ error: "Token şifrelenemedi" }); return; }

      // Test new token
      if (instanceUrl || username) {
        const { rows: cur } = await pool.query<{ instance_url: string; username: string }>(
          `SELECT instance_url, username FROM servicenow_configs WHERE id = $1 AND customer_id = $2`,
          [id, customerId],
        );
        if (cur[0]) {
          const test = await testServiceNowConnection({
            instanceUrl: instanceUrl ?? cur[0].instance_url,
            username: username ?? cur[0].username,
            password: apiToken,
          });
          if (!test.ok) {
            res.status(400).json({ error: `Bağlantı testi başarısız: ${test.message}` });
            return;
          }
        }
      }
    }

    const { rowCount } = await pool.query(
      `UPDATE servicenow_configs
       SET instance_url = COALESCE($1, instance_url),
           username = COALESCE($2, username),
           api_token_enc = COALESCE($3, api_token_enc),
           assignment_group = COALESCE($4, assignment_group),
           category = COALESCE($5, category),
           updated_at = NOW()
       WHERE id = $6 AND customer_id = $7`,
      [instanceUrl ?? null, username ?? null, tokenEnc, assignmentGroup ?? null, category ?? null, id, customerId],
    );

    if (!rowCount) { res.status(404).json({ error: "Config bulunamadı" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PUT /api/integrations/servicenow/:id error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── DELETE /api/integrations/servicenow/:id ──────────────────────────────────
router.delete("/integrations/servicenow/:id", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const id = Number(req.params["id"]);
  try {
    await pool.query(
      `UPDATE servicenow_configs SET active = false, updated_at = NOW()
       WHERE id = $1 AND customer_id = $2`,
      [id, customerId],
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /api/integrations/servicenow/:id error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/servicenow/test ───────────────────────────────────
router.post("/integrations/servicenow/test", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { instanceUrl, username, apiToken } = req.body as {
    instanceUrl: string; username: string; apiToken: string;
  };

  if (!instanceUrl || !username || !apiToken) {
    res.status(400).json({ error: "Tüm alanlar zorunludur" });
    return;
  }

  const result = await testServiceNowConnection({ instanceUrl, username, password: apiToken });
  res.json(result);
});

// ─── GET /api/integrations/servicenow/incidents ───────────────────────────────
router.get("/integrations/servicenow/incidents", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  try {
    const { rows } = await pool.query(
      `SELECT sni.id, sni.sn_number AS "snNumber", sni.sn_state AS "snState",
              sni.soc_case_id AS "socCaseId",
              sni.last_synced_at AS "lastSyncedAt", sni.sync_error AS "syncError",
              sni.created_at AS "createdAt",
              sc.case_number AS "caseNumber", sc.title AS "caseTitle", sc.status AS "caseStatus",
              sc.severity,
              snc.instance_url AS "instanceUrl"
       FROM servicenow_incidents sni
       JOIN soc_cases sc ON sc.id = sni.soc_case_id
       JOIN servicenow_configs snc ON snc.id = sni.config_id
       WHERE sni.customer_id = $1
       ORDER BY sni.created_at DESC
       LIMIT 50`,
      [customerId],
    );
    res.json({ incidents: rows });
  } catch (err) {
    req.log.error({ err }, "GET /api/integrations/servicenow/incidents error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── PATCH /api/integrations/servicenow/:id/toggle ────────────────────────────
router.patch("/integrations/servicenow/:id/toggle", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const id = Number(req.params["id"]);
  try {
    const { rows } = await pool.query<{ active: boolean }>(
      `UPDATE servicenow_configs SET active = NOT active, updated_at = NOW()
       WHERE id = $1 AND customer_id = $2 RETURNING active`,
      [id, customerId],
    );
    if (!rows[0]) { res.status(404).json({ error: "Config bulunamadı" }); return; }
    res.json({ ok: true, active: rows[0].active });
  } catch (err) {
    req.log.error({ err }, "PATCH /api/integrations/servicenow/:id/toggle error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── GET /api/integrations/servicenow/webhook-info ────────────────────────────
// Returns the webhook endpoint URL and whether a secret has been configured.
router.get("/integrations/servicenow/webhook-info", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  try {
    const { rows } = await pool.query<{ has_secret: boolean }>(
      `SELECT (webhook_secret_enc IS NOT NULL) AS has_secret
       FROM servicenow_configs
       WHERE customer_id = $1
       LIMIT 1`,
      [customerId],
    );

    const baseUrl = process.env["REPLIT_DOMAINS"]
      ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
      : "http://localhost";

    res.json({
      webhookUrl: `${baseUrl}/api/integrations/servicenow/webhook`,
      hasSecret: rows[0]?.has_secret ?? false,
    });
  } catch (err) {
    req.log.error({ err }, "GET /api/integrations/servicenow/webhook-info error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/servicenow/check ──────────────────────────────────
// Tests the stored credentials for the current customer and updates sync status.
router.post("/integrations/servicenow/check", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  try {
    const { rows } = await pool.query<{
      id: number; instance_url: string; username: string; api_token_enc: string;
    }>(
      `SELECT id, instance_url, username, api_token_enc
       FROM servicenow_configs
       WHERE customer_id = $1 AND active = true
       LIMIT 1`,
      [customerId],
    );
    const row = rows[0];
    if (!row) {
      res.status(404).json({ ok: false, message: "ServiceNow entegrasyonu bulunamadı" });
      return;
    }

    const { decryptSecret } = await import("../../services/fabric-crypto");
    const password = decryptSecret(row.api_token_enc);
    if (!password) {
      res.status(500).json({ ok: false, message: "Kimlik bilgileri çözümlenemedi" });
      return;
    }

    const result = await testServiceNowConnection({
      instanceUrl: row.instance_url,
      username: row.username,
      password,
    });

    if (result.ok) {
      await pool.query(
        `UPDATE servicenow_configs SET last_sync_at = NOW(), last_sync_error = NULL WHERE id = $1`,
        [row.id],
      );
    } else {
      await pool.query(
        `UPDATE servicenow_configs SET last_sync_error = $1 WHERE id = $2`,
        [result.message.slice(0, 500), row.id],
      );
    }

    req.log.info({ customerId, ok: result.ok }, "ServiceNow bağlantı testi yapıldı");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "POST /api/integrations/servicenow/check error");
    res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

// ─── GET /api/integrations/servicenow/webhook-events ─────────────────────────
// Returns the last 30 webhook events (successful + failed) for this customer.
router.get("/integrations/servicenow/webhook-events", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  try {
    // Successful events from soc_activity_log
    const { rows: successRows } = await pool.query(
      `SELECT sal.id,
              sal.action_type AS "actionType",
              sal.description,
              sal.created_at AS "createdAt",
              sni.sn_number AS "incNumber",
              'ok' AS status,
              NULL AS "errorReason",
              NULL AS "errorDetail",
              NULL AS "retriedAt"
       FROM soc_activity_log sal
       JOIN soc_cases sc ON sc.id = sal.case_id
       LEFT JOIN servicenow_incidents sni
         ON sni.soc_case_id = sal.case_id
        AND sni.customer_id = $1
       WHERE sal.actor_name = 'ServiceNow'
         AND sc.customer_id = $1
       ORDER BY sal.created_at DESC
       LIMIT 20`,
      [customerId],
    );

    // Failed webhook attempts
    const { rows: errorRows } = await pool.query(
      `SELECT id,
              'webhook_error' AS "actionType",
              COALESCE(raw_body_preview, '') AS description,
              created_at AS "createdAt",
              sn_sys_id AS "incNumber",
              'error' AS status,
              error_reason AS "errorReason",
              error_detail AS "errorDetail",
              retried_at AS "retriedAt"
       FROM servicenow_webhook_errors
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [customerId],
    );

    // Merge and sort by createdAt desc, take top 30
    const allEvents = [...successRows, ...errorRows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);

    res.json({ events: allEvents });
  } catch (err) {
    req.log.error({ err }, "GET /api/integrations/servicenow/webhook-events error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── GET /api/integrations/servicenow/webhook-events/export ──────────────────
// Returns all webhook events as a CSV download (no row limit; optional date range via ?from=&to=).
router.get("/integrations/servicenow/webhook-events/export", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { from, to } = req.query as { from?: string; to?: string };
  const fromDate = from ? new Date(from) : null;
  const toDate   = to   ? new Date(to)   : null;

  if ((from && isNaN(fromDate!.getTime())) || (to && isNaN(toDate!.getTime()))) {
    res.status(400).json({ error: "Geçersiz tarih formatı. ISO 8601 kullanın (ör. 2024-01-01T00:00:00Z)" });
    return;
  }

  try {
    const dateFilter = (alias: string) => {
      const parts: string[] = [];
      if (fromDate) parts.push(`${alias} >= '${fromDate.toISOString()}'`);
      if (toDate)   parts.push(`${alias} <= '${toDate.toISOString()}'`);
      return parts.length ? `AND ${parts.join(" AND ")}` : "";
    };

    const { rows: successRows } = await pool.query(
      `SELECT sal.created_at AS "createdAt",
              COALESCE(sni.sn_number, '') AS "incNumber",
              sal.action_type AS "actionType",
              sal.description
       FROM soc_activity_log sal
       JOIN soc_cases sc ON sc.id = sal.case_id
       LEFT JOIN servicenow_incidents sni
         ON sni.soc_case_id = sal.case_id
        AND sni.customer_id = $1
       WHERE sal.actor_name = 'ServiceNow'
         AND sc.customer_id = $1
         ${dateFilter("sal.created_at")}
       ORDER BY sal.created_at DESC`,
      [customerId],
    );

    const { rows: errorRows } = await pool.query(
      `SELECT created_at AS "createdAt",
              COALESCE(sn_sys_id, '') AS "incNumber",
              'webhook_error' AS "actionType",
              COALESCE(error_reason, raw_body_preview, '') AS description
       FROM servicenow_webhook_errors
       WHERE customer_id = $1
         ${dateFilter("created_at")}
       ORDER BY created_at DESC`,
      [customerId],
    );

    const ACTION_TYPE_TR: Record<string, string> = {
      status_change: "Durum Degisikligi",
      note: "Yorum / Not",
      assignment: "Atama Degisikligi",
      webhook_error: "Hata",
    };

    const rows = [...successRows, ...errorRows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const csvEscape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const header = ["Tarih", "INC Numarasi", "Degisiklik Tipi", "Ozet"].map(csvEscape).join(",");
    const lines = rows.map(r => [
      csvEscape(new Date(r.createdAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })),
      csvEscape(r.incNumber),
      csvEscape(ACTION_TYPE_TR[r.actionType] ?? r.actionType),
      csvEscape(r.description),
    ].join(","));

    const csv = [header, ...lines].join("\r\n");

    const filename = `servicenow-webhook-olaylari-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv); // BOM for Excel Turkish charset compatibility
  } catch (err) {
    req.log.error({ err }, "GET /api/integrations/servicenow/webhook-events/export error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/servicenow/webhook-errors/:id/retry ───────────────
// Retries a failed webhook by force-syncing the incident from ServiceNow.
router.post("/integrations/servicenow/webhook-errors/:id/retry", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const errorId = Number(req.params["id"]);
  if (!errorId) { res.status(400).json({ error: "Geçersiz hata ID" }); return; }

  try {
    const result = await retryWebhookError(errorId, customerId);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err, errorId }, "POST /api/integrations/servicenow/webhook-errors/:id/retry error");
    res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

// ─── PATCH /api/integrations/servicenow/notification-prefs ───────────────────
// Lets the customer update their webhook notification preferences.
router.patch("/integrations/servicenow/notification-prefs", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { webhookNotifyAll, webhookNotifyClosedOnly } = req.body as {
    webhookNotifyAll?: boolean; webhookNotifyClosedOnly?: boolean;
  };

  if (typeof webhookNotifyAll !== "boolean" && typeof webhookNotifyClosedOnly !== "boolean") {
    res.status(400).json({ error: "webhookNotifyAll veya webhookNotifyClosedOnly gerekli" });
    return;
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE servicenow_configs
       SET webhook_notify_all = COALESCE($1, webhook_notify_all),
           webhook_notify_closed_only = COALESCE($2, webhook_notify_closed_only),
           updated_at = NOW()
       WHERE customer_id = $3`,
      [
        typeof webhookNotifyAll === "boolean" ? webhookNotifyAll : null,
        typeof webhookNotifyClosedOnly === "boolean" ? webhookNotifyClosedOnly : null,
        customerId,
      ],
    );
    if (!rowCount) { res.status(404).json({ error: "ServiceNow entegrasyonu bulunamadı" }); return; }
    req.log.info({ customerId, webhookNotifyAll, webhookNotifyClosedOnly }, "ServiceNow bildirim tercihleri güncellendi");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PATCH /api/integrations/servicenow/notification-prefs error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/servicenow/webhook-secret ─────────────────────────
// Generates (or rotates) the HMAC webhook secret. Returns plaintext ONCE.
router.post("/integrations/servicenow/webhook-secret", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  try {
    const secret = await generateAndStoreWebhookSecret(customerId);
    if (!secret) {
      res.status(400).json({ error: "ServiceNow entegrasyonu bulunamadı veya secret oluşturulamadı" });
      return;
    }
    // Return plaintext once — customer must copy this to ServiceNow immediately
    res.json({ ok: true, secret, note: "Bu secret yalnızca bir kez gösterilir. ServiceNow Outbound REST Message yapılandırmanıza kopyalayın." });
  } catch (err) {
    req.log.error({ err }, "POST /api/integrations/servicenow/webhook-secret error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/servicenow/webhook ────────────────────────────────
// Public endpoint — called by ServiceNow Business Rule / Outbound REST Message.
// No session auth; authentication is via HMAC-SHA256 (X-SN-Signature header).
// Raw body is required for signature verification; JSON parser is bypassed for
// this path in app.ts (skipJsonParsing).
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 120,                  // generous: ~2 req/sec per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla istek" },
});

router.post(
  "/integrations/servicenow/webhook",
  webhookRateLimiter,
  express.raw({ type: "*/*", limit: "64kb" }),
  async (req, res) => {
    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      res.status(400).json({ error: "Boş gövde" });
      return;
    }

    const signatureHeader = req.headers["x-sn-signature"] as string | undefined;

    try {
      const result = await processServiceNowWebhook(rawBody, signatureHeader);
      res.status(result.status).json({ ok: result.ok, message: result.message });
    } catch (err) {
      logger.error({ err }, "POST /api/integrations/servicenow/webhook unhandled error");
      res.status(500).json({ ok: false, message: "Sunucu hatası" });
    }
  },
);

export default router;
