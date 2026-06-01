/**
 * Generic Webhook Dispatcher
 * HMAC-SHA256 imzalı outbound webhook — Zapier, Make, n8n, custom endpoint
 */

import { createHmac } from "node:crypto";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { encryptSecret, decryptSecret } from "./fabric-crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WebhookEvent =
  | "soc.case.opened"
  | "soc.case.closed"
  | "soc.case.critical"
  | "soc.sla.breached"
  | "scan.completed"
  | "report.ready";

export interface WebhookConfig {
  id: number;
  customerId: number;
  name: string;
  url: string;
  secret: string | null;
  events: WebhookEvent[];
  active: boolean;
  headers: Record<string, string>;
}

// ─── SSRF guard ───────────────────────────────────────────────────────────────

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fd/i,
];

export function validateWebhookUrl(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { throw new Error("Geçersiz URL formatı"); }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Webhook URL'si HTTP veya HTTPS olmalıdır");
  }
  const host = parsed.hostname.toLowerCase();
  if (!host || host === "localhost" || !host.includes(".")) {
    throw new Error("Geçersiz hostname");
  }
  for (const re of PRIVATE_RANGES) {
    if (re.test(host)) throw new Error("Özel/dahili ağ adresine webhook gönderilemez");
  }
}

// ─── HTTP delivery ────────────────────────────────────────────────────────────

async function deliverWebhook(
  cfg: WebhookConfig,
  eventType: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const body = JSON.stringify({ event: eventType, timestamp: new Date().toISOString(), ...payload });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "CyberStep-Webhook/1.0",
    "X-CyberStep-Event": eventType,
    ...cfg.headers,
  };

  if (cfg.secret) {
    const sig = createHmac("sha256", cfg.secret).update(body).digest("hex");
    headers["X-CyberStep-Signature"] = `sha256=${sig}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(cfg.url, { method: "POST", headers, body, signal: controller.signal });
    const resBody = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, body: resBody.slice(0, 500) };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function dispatchWebhook(
  customerId: number,
  eventType: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const { rows } = await pool.query<{
    id: number; url: string; secret_enc: string | null;
    events: string[]; headers_json: string | null; name: string;
  }>(
    `SELECT id, url, secret_enc, events, headers_json, name
     FROM webhook_configs
     WHERE customer_id = $1 AND active = true`,
    [customerId],
  );

  for (const row of rows) {
    if (!row.events.includes(eventType) && !row.events.includes("*")) continue;

    let secret: string | null = null;
    if (row.secret_enc) { secret = decryptSecret(row.secret_enc); }
    const headers = row.headers_json ? (JSON.parse(row.headers_json) as Record<string, string>) : {};

    const cfg: WebhookConfig = {
      id: row.id, customerId, name: row.name, url: row.url,
      secret, events: row.events as WebhookEvent[], active: true, headers,
    };

    // Deliver with retry
    let lastResult = { ok: false, status: 0, body: "" };
    let attempts = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      attempts++;
      try {
        validateWebhookUrl(cfg.url);
        lastResult = await deliverWebhook(cfg, eventType, payload);
        if (lastResult.ok) break;
      } catch (err) {
        lastResult = { ok: false, status: 0, body: String(err) };
      }
      if (!lastResult.ok && attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt) + Math.random() * 500));
      }
    }

    const status = lastResult.ok ? "delivered" : "failed";
    await pool.query(
      `INSERT INTO webhook_deliveries
         (webhook_id, customer_id, event_type, payload_json, status, attempts, response_code, response_body, delivered_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [row.id, customerId, eventType, JSON.stringify(payload), status, attempts, lastResult.status || null, lastResult.body],
    );

    if (lastResult.ok) {
      logger.info({ customerId, webhookId: row.id, eventType }, "Webhook delivered");
    } else {
      logger.warn({ customerId, webhookId: row.id, eventType, status: lastResult.status }, "Webhook delivery failed");
    }
  }
}

// ─── Retry failed deliveries cron ────────────────────────────────────────────

export async function retryFailedWebhooks(): Promise<void> {
  try {
    const { rows } = await pool.query<{
      id: number; webhook_id: number; customer_id: number; event_type: string;
      payload_json: string; attempts: number;
      wh_url: string; wh_secret_enc: string | null; wh_headers_json: string | null; wh_name: string;
    }>(
      `SELECT wd.id, wd.webhook_id, wd.customer_id, wd.event_type, wd.payload_json, wd.attempts,
              wc.url AS wh_url, wc.secret_enc AS wh_secret_enc, wc.headers_json AS wh_headers_json, wc.name AS wh_name
       FROM webhook_deliveries wd
       JOIN webhook_configs wc ON wc.id = wd.webhook_id AND wc.active = true
       WHERE wd.status = 'failed' AND wd.attempts < 5
         AND wd.created_at > NOW() - INTERVAL '24 hours'
       LIMIT 20`,
    );

    for (const row of rows) {
      const secret = row.wh_secret_enc ? decryptSecret(row.wh_secret_enc) : null;
      const headers = row.wh_headers_json ? JSON.parse(row.wh_headers_json) as Record<string, string> : {};
      const cfg: WebhookConfig = {
        id: row.webhook_id, customerId: row.customer_id, name: row.wh_name,
        url: row.wh_url, secret, events: [], active: true, headers,
      };
      try {
        validateWebhookUrl(cfg.url);
        const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
        const result = await deliverWebhook(cfg, row.event_type as WebhookEvent, payload);
        await pool.query(
          `UPDATE webhook_deliveries SET status=$1, attempts=$2, response_code=$3, response_body=$4, delivered_at=NOW() WHERE id=$5`,
          [result.ok ? "delivered" : "failed", row.attempts + 1, result.status || null, result.body, row.id],
        );
      } catch (err) {
        await pool.query(
          `UPDATE webhook_deliveries SET attempts=$1, response_body=$2 WHERE id=$3`,
          [row.attempts + 1, String(err).slice(0, 500), row.id],
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "retryFailedWebhooks error");
  }
}

// ─── Startup migration ────────────────────────────────────────────────────────

export async function ensureWebhookTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_configs (
      id           SERIAL PRIMARY KEY,
      customer_id  INTEGER NOT NULL,
      name         TEXT NOT NULL DEFAULT 'Webhook',
      url          TEXT NOT NULL,
      secret_enc   TEXT,
      events       TEXT[] NOT NULL DEFAULT ARRAY['soc.case.opened','soc.case.closed','soc.sla.breached'],
      active       BOOLEAN NOT NULL DEFAULT true,
      headers_json TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id            SERIAL PRIMARY KEY,
      webhook_id    INTEGER NOT NULL,
      customer_id   INTEGER NOT NULL,
      event_type    TEXT NOT NULL,
      payload_json  TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      attempts      INTEGER NOT NULL DEFAULT 0,
      response_code INTEGER,
      response_body TEXT,
      delivered_at  TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS webhook_configs_customer_idx ON webhook_configs (customer_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_idx ON webhook_deliveries (webhook_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS webhook_deliveries_status_idx ON webhook_deliveries (status) WHERE status = 'failed'`);
  logger.info("Webhook tables ready");
}
