/**
 * ServiceNow Table API istemcisi
 * SOC case ↔ ServiceNow INC çift yönlü senkronizasyonu
 */

import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { decryptSecret, encryptSecret } from "./fabric-crypto";

// ─── Priority / State Mapping ─────────────────────────────────────────────────

const PRIORITY_MAP: Record<string, number> = {
  critical: 1, high: 2, medium: 3, low: 4,
};

// ServiceNow incident state codes
// 1=New, 2=In Progress, 3=On Hold, 6=Resolved, 7=Closed
const RESOLVE_STATE = 6;
const CLOSE_STATE = 7;

function snBaseUrl(instanceUrl: string) {
  return instanceUrl.replace(/\/$/, "");
}

function snHeaders(username: string, password: string) {
  const encoded = Buffer.from(`${username}:${password}`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

interface SnConfig {
  instanceUrl: string;
  username: string;
  password: string;
  assignmentGroup?: string | null;
  category?: string | null;
}

interface SnIncidentResult {
  sysId: string;
  number: string;
  state: number;
}

// ─── Low-level API helpers ─────────────────────────────────────────────────────

async function snRequest<T>(
  method: "GET" | "POST" | "PATCH",
  url: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ServiceNow ${method} ${url} → HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testServiceNowConnection(cfg: SnConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const url = `${snBaseUrl(cfg.instanceUrl)}/api/now/table/incident?sysparm_limit=1&sysparm_fields=number`;
    await snRequest<unknown>("GET", url, snHeaders(cfg.username, cfg.password));
    return { ok: true, message: "Bağlantı başarılı" };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 200) };
  }
}

async function createSnIncident(cfg: SnConfig, fields: Record<string, unknown>): Promise<SnIncidentResult> {
  const url = `${snBaseUrl(cfg.instanceUrl)}/api/now/table/incident`;
  const res = await snRequest<{ result: { sys_id: string; number: string; state: string } }>(
    "POST", url, snHeaders(cfg.username, cfg.password), fields,
  );
  return {
    sysId: res.result.sys_id,
    number: res.result.number,
    state: parseInt(res.result.state, 10) || 1,
  };
}

async function updateSnIncident(cfg: SnConfig, sysId: string, fields: Record<string, unknown>): Promise<void> {
  const url = `${snBaseUrl(cfg.instanceUrl)}/api/now/table/incident/${sysId}`;
  await snRequest<unknown>("PATCH", url, snHeaders(cfg.username, cfg.password), fields);
}

async function getSnIncident(cfg: SnConfig, sysId: string): Promise<{ state: number; number: string } | null> {
  try {
    const url = `${snBaseUrl(cfg.instanceUrl)}/api/now/table/incident/${sysId}?sysparm_fields=sys_id,number,state,incident_state`;
    const res = await snRequest<{ result: { number: string; state: string } }>(
      "GET", url, snHeaders(cfg.username, cfg.password),
    );
    return { number: res.result.number, state: parseInt(res.result.state, 10) || 1 };
  } catch {
    return null;
  }
}

// ─── Config Loader ─────────────────────────────────────────────────────────────

async function loadConfig(customerId: number): Promise<(SnConfig & { id: number }) | null> {
  const { rows } = await pool.query<{
    id: number; instance_url: string; username: string; api_token_enc: string;
    assignment_group: string | null; category: string | null;
  }>(
    `SELECT id, instance_url, username, api_token_enc, assignment_group, category
     FROM servicenow_configs
     WHERE customer_id = $1 AND active = true
     LIMIT 1`,
    [customerId],
  );
  const row = rows[0];
  if (!row) return null;
  const password = decryptSecret(row.api_token_enc);
  if (!password) return null;
  return {
    id: row.id,
    instanceUrl: row.instance_url,
    username: row.username,
    password,
    assignmentGroup: row.assignment_group,
    category: row.category,
  };
}

// ─── High-level: Case → ServiceNow ────────────────────────────────────────────

interface CaseData {
  caseId: number;
  caseNumber: string;
  title: string;
  description: string;
  severity: string;
  category: string;
}

export async function openServiceNowIncident(customerId: number, socCaseId: number, caseData: CaseData): Promise<void> {
  const cfg = await loadConfig(customerId);
  if (!cfg) return; // Entegrasyon yapılandırılmamış

  // Zaten açık incident var mı?
  const { rows: existing } = await pool.query(
    `SELECT id FROM servicenow_incidents WHERE soc_case_id = $1 LIMIT 1`,
    [socCaseId],
  );
  if (existing.length > 0) return;

  const priority = PRIORITY_MAP[caseData.severity] ?? 3;
  const baseUrl = process.env["REPLIT_DOMAINS"]
    ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
    : "http://localhost";

  const fields: Record<string, unknown> = {
    short_description: `[CyberStep SOC ${caseData.caseNumber}] ${caseData.title}`,
    description: `${caseData.description}\n\nKategori: ${caseData.category}\nÖnem: ${caseData.severity}\nCyberStep: ${baseUrl}/hesabim/soc`,
    urgency: priority,
    priority,
    impact: priority,
    category: cfg.category || "Software",
    subcategory: "Security",
  };
  if (cfg.assignmentGroup) fields["assignment_group"] = cfg.assignmentGroup;

  try {
    const incident = await createSnIncident(cfg, fields);

    await pool.query(
      `INSERT INTO servicenow_incidents (customer_id, soc_case_id, config_id, sn_sys_id, sn_number, sn_state, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT DO NOTHING`,
      [customerId, socCaseId, cfg.id, incident.sysId, incident.number, incident.state],
    );

    await pool.query(
      `UPDATE servicenow_configs SET last_sync_at = NOW(), last_sync_error = NULL WHERE id = $1`,
      [cfg.id],
    );

    // SOC activity log
    await pool.query(
      `INSERT INTO soc_activity_log (case_id, actor_type, actor_name, action_type, description, created_at)
       VALUES ($1, 'ai', 'ServiceNow', 'note', $2, NOW())`,
      [socCaseId, `ServiceNow incident oluşturuldu: ${incident.number}`],
    );

    logger.info({ customerId, socCaseId, snNumber: incident.number }, "ServiceNow incident açıldı");
  } catch (err) {
    logger.error({ err, customerId, socCaseId }, "ServiceNow incident oluşturulamadı");
    await pool.query(
      `UPDATE servicenow_configs SET last_sync_error = $1 WHERE id = $2`,
      [String(err).slice(0, 500), cfg.id],
    );
  }
}

export async function resolveServiceNowIncident(
  customerId: number,
  socCaseId: number,
  resolution: string,
): Promise<void> {
  const cfg = await loadConfig(customerId);
  if (!cfg) return;

  const { rows } = await pool.query<{ id: number; sn_sys_id: string; sn_number: string }>(
    `SELECT id, sn_sys_id, sn_number FROM servicenow_incidents
     WHERE soc_case_id = $1 AND customer_id = $2
     LIMIT 1`,
    [socCaseId, customerId],
  );
  const incident = rows[0];
  if (!incident) return;

  try {
    await updateSnIncident(cfg, incident.sn_sys_id, {
      state: RESOLVE_STATE,
      close_code: "Solved (Permanently)",
      close_notes: resolution || "CyberStep SOC vakası kapatıldı.",
    });

    await pool.query(
      `UPDATE servicenow_incidents SET sn_state = $1, last_synced_at = NOW(), sync_error = NULL WHERE id = $2`,
      [RESOLVE_STATE, incident.id],
    );
    await pool.query(
      `UPDATE servicenow_configs SET last_sync_at = NOW(), last_sync_error = NULL WHERE id = $1`,
      [cfg.id],
    );

    logger.info({ customerId, socCaseId, snNumber: incident.sn_number }, "ServiceNow incident çözüldü");
  } catch (err) {
    logger.error({ err, customerId, socCaseId }, "ServiceNow incident resolve başarısız");
    await pool.query(
      `UPDATE servicenow_incidents SET sync_error = $1 WHERE id = $2`,
      [String(err).slice(0, 500), incident.id],
    );
  }
}

// ─── 15-Dakikalık Sync Cron ────────────────────────────────────────────────────

export async function syncServiceNowIncidents(): Promise<void> {
  try {
    // Açık SN incident'ları çek — SN'de elle kapatılanları CyberStep'te kapat
    const { rows } = await pool.query<{
      incident_id: number; sn_sys_id: string; sn_number: string;
      soc_case_id: number; customer_id: number; config_id: number;
      sn_current_state: number;
    }>(
      `SELECT sni.id AS incident_id, sni.sn_sys_id, sni.sn_number,
              sni.soc_case_id, sni.customer_id, sni.config_id,
              sni.sn_state AS sn_current_state
       FROM servicenow_incidents sni
       JOIN soc_cases sc ON sc.id = sni.soc_case_id
       JOIN servicenow_configs snc ON snc.id = sni.config_id AND snc.active = true
       WHERE sc.status NOT IN ('closed', 'false_positive')
         AND sni.sn_state NOT IN ($1, $2)
       LIMIT 50`,
      [RESOLVE_STATE, CLOSE_STATE],
    );

    for (const row of rows) {
      const cfg = await loadConfig(row.customer_id);
      if (!cfg) continue;

      try {
        const snData = await getSnIncident(cfg, row.sn_sys_id);
        if (!snData) continue;

        // ServiceNow'da kapandıysa CyberStep'te de kapat
        if (snData.state >= RESOLVE_STATE) {
          await pool.query(
            `UPDATE soc_cases SET status = 'closed', updated_at = NOW() WHERE id = $1`,
            [row.soc_case_id],
          );
          await pool.query(
            `UPDATE servicenow_incidents SET sn_state = $1, last_synced_at = NOW() WHERE id = $2`,
            [snData.state, row.incident_id],
          );
          logger.info({ socCaseId: row.soc_case_id, snNumber: snData.number }, "SN→CyberStep: case kapatıldı");
        } else {
          await pool.query(
            `UPDATE servicenow_incidents SET sn_state = $1, last_synced_at = NOW(), sync_error = NULL WHERE id = $2`,
            [snData.state, row.incident_id],
          );
        }

        await pool.query(
          `UPDATE servicenow_configs SET last_sync_at = NOW(), last_sync_error = NULL WHERE id = $1`,
          [cfg.id],
        );
      } catch (err) {
        logger.warn({ err, incidentId: row.incident_id }, "SN sync error for incident");
        await pool.query(
          `UPDATE servicenow_configs SET last_sync_error = $1 WHERE id = $2`,
          [String(err).slice(0, 500), row.config_id],
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "syncServiceNowIncidents error");
  }
}

// ─── DB tabloları oluştur ─────────────────────────────────────────────────────

export async function ensureServiceNowTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS servicenow_configs (
      id                SERIAL PRIMARY KEY,
      customer_id       INTEGER NOT NULL,
      instance_url      TEXT NOT NULL,
      username          TEXT NOT NULL,
      api_token_enc     TEXT NOT NULL,
      active            BOOLEAN NOT NULL DEFAULT true,
      assignment_group  TEXT,
      category          TEXT DEFAULT 'Software',
      last_sync_at      TIMESTAMPTZ,
      last_sync_error   TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS servicenow_incidents (
      id              SERIAL PRIMARY KEY,
      customer_id     INTEGER NOT NULL,
      soc_case_id     INTEGER NOT NULL,
      config_id       INTEGER NOT NULL,
      sn_sys_id       TEXT NOT NULL,
      sn_number       TEXT NOT NULL,
      sn_state        INTEGER NOT NULL DEFAULT 1,
      last_synced_at  TIMESTAMPTZ DEFAULT NOW(),
      sync_error      TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS sn_incidents_case_uq ON servicenow_incidents (soc_case_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS sn_incidents_customer_idx ON servicenow_incidents (customer_id)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS sn_configs_customer_uq ON servicenow_configs (customer_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS sn_configs_active_idx ON servicenow_configs (customer_id) WHERE active = true`);
  logger.info("ServiceNow tables ready");
}

