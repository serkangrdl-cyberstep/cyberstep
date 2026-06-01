import { Router } from "express";
import { pool } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { encryptSecret, decryptSecret } from "../../services/fabric-crypto";
import { testServiceNowConnection, validateServiceNowUrl } from "../../services/serviceNowClient";

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

export default router;
