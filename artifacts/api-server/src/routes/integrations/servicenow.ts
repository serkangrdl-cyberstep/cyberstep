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
