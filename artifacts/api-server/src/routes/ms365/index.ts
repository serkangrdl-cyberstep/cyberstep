import { Router } from "express";
import { pool } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { encryptSecret, decryptSecret } from "../../services/fabric-crypto";
import {
  buildMs365AuthUrl,
  exchangeMs365Code,
  getMs365RedirectUri,
} from "../../services/ms365Graph";

const router = Router();

// ─── Ensure tables exist ───────────────────────────────────────────────────────

export async function ensureMs365Tables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ms365_integrations (
      id                 SERIAL PRIMARY KEY,
      customer_id        INTEGER NOT NULL,
      azure_tenant_id    VARCHAR(100) NOT NULL DEFAULT 'common',
      client_id          VARCHAR(100),
      access_token_enc   TEXT,
      refresh_token_enc  TEXT,
      token_expires_at   TIMESTAMPTZ,
      scopes             TEXT[] DEFAULT '{}',
      status             VARCHAR(20) DEFAULT 'active',
      last_sync_at       TIMESTAMPTZ,
      sync_error         TEXT,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      updated_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ms365_signin_logs (
      id                    SERIAL PRIMARY KEY,
      integration_id        INTEGER NOT NULL,
      customer_id           INTEGER NOT NULL,
      user_principal_name   VARCHAR(255),
      ip_address            VARCHAR(50),
      location              JSONB,
      risk_level            VARCHAR(20),
      risk_detail           TEXT,
      risk_state            VARCHAR(30),
      event_time            TIMESTAMPTZ,
      correlated_soc_case_id INTEGER,
      created_at            TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ms365_email_alerts (
      id                    SERIAL PRIMARY KEY,
      integration_id        INTEGER NOT NULL,
      customer_id           INTEGER NOT NULL,
      alert_id              VARCHAR(200),
      title                 VARCHAR(500),
      severity              VARCHAR(20),
      category              VARCHAR(100),
      description           TEXT,
      affected_user         VARCHAR(255),
      raw_payload           JSONB,
      correlated_soc_case_id INTEGER,
      created_at            TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ms365_signin_customer_idx ON ms365_signin_logs (customer_id, event_time DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ms365_signin_upn_idx ON ms365_signin_logs (customer_id, user_principal_name, event_time DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ms365_email_alert_id_idx ON ms365_email_alerts (integration_id, alert_id)`);
  logger.info("MS365 tables ready");
}

// ─── OAuth2 start — GET /api/ms365/auth ──────────────────────────────────────

router.get("/ms365/auth", requireCustomer, (req, res) => {
  const clientId = process.env["MICROSOFT_CLIENT_ID"];
  if (!clientId) {
    res.status(503).json({ error: "Microsoft 365 entegrasyonu henuz yapilandirilmamis. Lutfen yonetici ile iletisime gecin." });
    return;
  }

  try {
    const state = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const sess = req.session as { ms365_oauth_state?: string; ms365_customer_id?: number };
    sess.ms365_oauth_state = state;
    sess.ms365_customer_id = getCustomerId(req) ?? undefined;
    req.session.save(() => {
      const authUrl = buildMs365AuthUrl(state);
      res.redirect(authUrl);
    });
  } catch (err) {
    req.log.error({ err }, "GET /api/ms365/auth error");
    res.status(500).json({ error: "OAuth baslatilamadi" });
  }
});

// ─── OAuth2 callback — GET /api/ms365/callback ───────────────────────────────

router.get("/ms365/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query as Record<string, string>;

  if (error) {
    req.log.warn({ error, error_description }, "MS365 OAuth error from Microsoft");
    res.redirect("/?ms365_error=oauth_denied");
    return;
  }

  const sess = req.session as { ms365_oauth_state?: string; ms365_customer_id?: number };
  const expectedState = sess.ms365_oauth_state;
  const customerId = sess.ms365_customer_id;

  if (!expectedState || state !== expectedState || !customerId) {
    res.redirect("/hesabim/entegrasyonlar?ms365_error=invalid_state");
    return;
  }

  delete sess.ms365_oauth_state;
  delete sess.ms365_customer_id;

  try {
    const tokens = await exchangeMs365Code(code ?? "");
    if (!tokens) {
      res.redirect("/hesabim/entegrasyonlar?ms365_error=token_exchange");
      return;
    }

    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    const accessEnc = encryptSecret(tokens.accessToken) ?? tokens.accessToken;
    const refreshEnc = encryptSecret(tokens.refreshToken) ?? tokens.refreshToken;

    const existing = await pool.query(
      `SELECT id FROM ms365_integrations WHERE customer_id = $1 AND azure_tenant_id = $2 LIMIT 1`,
      [customerId, tokens.tenantId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE ms365_integrations
         SET access_token_enc = $1, refresh_token_enc = $2, token_expires_at = $3,
             status = 'active', sync_error = NULL, updated_at = NOW()
         WHERE customer_id = $4 AND azure_tenant_id = $5`,
        [accessEnc, refreshEnc, expiresAt, customerId, tokens.tenantId]
      );
    } else {
      await pool.query(
        `INSERT INTO ms365_integrations
           (customer_id, azure_tenant_id, access_token_enc, refresh_token_enc, token_expires_at,
            scopes, status)
         VALUES ($1,$2,$3,$4,$5,$6,'active')`,
        [
          customerId,
          tokens.tenantId,
          accessEnc,
          refreshEnc,
          expiresAt,
          ["AuditLog.Read.All", "SecurityEvents.Read.All", "MailboxSettings.Read"],
        ]
      );
    }

    req.log.info({ customerId, tenantId: tokens.tenantId }, "MS365 OAuth complete");
    res.redirect("/hesabim/entegrasyonlar?ms365_success=1");
  } catch (err) {
    req.log.error({ err }, "GET /api/ms365/callback error");
    res.redirect("/hesabim/entegrasyonlar?ms365_error=server");
  }
});

// ─── Portal: GET /api/portal/ms365/status ─────────────────────────────────────

router.get("/portal/ms365/status", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  try {
    const { rows } = await pool.query(
      `SELECT id, azure_tenant_id AS "azureTenantId", status, last_sync_at AS "lastSyncAt",
              sync_error AS "syncError", created_at AS "createdAt",
              scopes, token_expires_at AS "tokenExpiresAt"
       FROM ms365_integrations
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    );

    const signInCount = rows.length > 0
      ? (await pool.query<{ count: string }>(
          `SELECT COUNT(*) FROM ms365_signin_logs
           WHERE customer_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
          [customerId]
        )).rows[0]?.count ?? "0"
      : "0";

    res.json({ integrations: rows, recentSignInCount: parseInt(signInCount, 10) });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/ms365/status error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Portal: GET /api/portal/ms365/signin-logs ───────────────────────────────

router.get("/portal/ms365/signin-logs", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  try {
    const { rows } = await pool.query(
      `SELECT id, user_principal_name AS "userPrincipalName", ip_address AS "ipAddress",
              location, risk_level AS "riskLevel", risk_detail AS "riskDetail",
              event_time AS "eventTime", correlated_soc_case_id AS "correlatedSocCaseId",
              created_at AS "createdAt"
       FROM ms365_signin_logs
       WHERE customer_id = $1
       ORDER BY event_time DESC
       LIMIT 50`,
      [customerId]
    );
    res.json({ logs: rows });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/ms365/signin-logs error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Portal: DELETE /api/portal/ms365/:id — disconnect ───────────────────────

router.delete("/portal/ms365/:id", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const id = Number(req.params["id"]);
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM ms365_integrations WHERE id = $1 AND customer_id = $2`,
      [id, customerId]
    );
    if (!rowCount) { res.status(404).json({ error: "Bulunamadı" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /api/portal/ms365/:id error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
