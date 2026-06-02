/**
 * ServiceNow Table API istemcisi
 * SOC case ↔ ServiceNow INC çift yönlü senkronizasyonu
 */

import crypto from "node:crypto";
import { promises as dns } from "node:dns";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { decryptSecret, encryptSecret } from "./fabric-crypto";
import { sendSOCNotification } from "./soc/soc-notify";

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

// ─── SSRF Protection ──────────────────────────────────────────────────────────

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

// IP literal regex — blocks bare IPv4/IPv6 addresses as hostname
const IP_LITERAL = /^(\d{1,3}\.){3}\d{1,3}$|^\[.*\]$/;

export function validateServiceNowUrl(instanceUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(instanceUrl);
  } catch {
    throw new Error("Geçersiz URL formatı");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("ServiceNow URL'si HTTPS olmalıdır");
  }
  const host = parsed.hostname.toLowerCase();
  if (!host || host === "localhost") {
    throw new Error("Geçersiz hostname");
  }
  // Block bare IP literals — ServiceNow instances are always FQDNs
  if (IP_LITERAL.test(host)) {
    throw new Error("IP adresi kullanılamaz; ServiceNow instance FQDN kullanılmalıdır");
  }
  // Block private/internal addresses (for IP literals that slip through)
  for (const re of PRIVATE_RANGES) {
    if (re.test(host)) {
      throw new Error("Özel/dahili ağ adresine bağlantıya izin verilmez");
    }
  }
  // Hostname must contain at least one dot (FQDN sanity check)
  if (!host.includes(".")) {
    throw new Error("Geçersiz hostname — FQDN gereklidir (örn. dev12345.service-now.com)");
  }
}

// ─── Low-level API helpers ─────────────────────────────────────────────────────

function isRetriableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function snRequest<T>(
  method: "GET" | "POST" | "PATCH",
  url: string,
  headers: Record<string, string>,
  body?: unknown,
  maxRetries = 3,
): Promise<T> {
  let lastError: Error = new Error("Unknown error");
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
        const err = new Error(`ServiceNow ${method} → HTTP ${res.status}: ${text.slice(0, 200)}`);
        if (attempt < maxRetries && isRetriableStatus(res.status)) {
          lastError = err;
          const jitter = Math.random() * 500;
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt) + jitter));
          continue;
        }
        throw err;
      }
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timeout);
      // Network/abort errors are retriable
      if (attempt < maxRetries && (err as NodeJS.ErrnoException).code !== undefined) {
        lastError = err as Error;
        const jitter = Math.random() * 500;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt) + jitter));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

export async function testServiceNowConnection(cfg: SnConfig): Promise<{ ok: boolean; message: string }> {
  try {
    validateServiceNowUrl(cfg.instanceUrl);
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

// DNS-level SSRF guard: resolve hostname, reject if any IP is in a private range
async function resolveAndCheckPrivate(hostname: string): Promise<void> {
  let addrs: string[] = [];
  try {
    const v4 = await dns.resolve4(hostname).catch(() => [] as string[]);
    const v6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    addrs = [...v4, ...v6];
  } catch {
    return; // If DNS fails entirely, let fetch fail naturally
  }
  for (const addr of addrs) {
    if (addr === "::1" || /^127\./.test(addr)) {
      throw new Error("Güvenli olmayan hedef: loopback adresi");
    }
    for (const re of PRIVATE_RANGES) {
      if (re.test(addr)) {
        throw new Error(`Güvenli olmayan hedef: ${addr} dahili IP aralığına çözümleniyor`);
      }
    }
  }
}

// Validate URL before every outbound request (defense-in-depth), includes async DNS check
async function assertSafeUrlAsync(instanceUrl: string): Promise<void> {
  validateServiceNowUrl(instanceUrl); // sync checks first
  const { hostname } = new URL(instanceUrl);
  await resolveAndCheckPrivate(hostname);
}

async function loadConfig(customerId: number): Promise<(SnConfig & { id: number; retryWindowHours: number }) | null> {
  const { rows } = await pool.query<{
    id: number; instance_url: string; username: string; api_token_enc: string;
    assignment_group: string | null; category: string | null; retry_window_hours: number;
  }>(
    `SELECT id, instance_url, username, api_token_enc, assignment_group, category,
            COALESCE(retry_window_hours, 48) AS retry_window_hours
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
    retryWindowHours: row.retry_window_hours,
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

  await assertSafeUrlAsync(cfg.instanceUrl);

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

  await assertSafeUrlAsync(cfg.instanceUrl);

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

// ─── SN → CyberStep: journal entry ingestion (reverse sync) ───────────────────

interface SnJournalEntry { value: string; sys_created_on: string; sys_created_by: string }

async function pullSnJournalNotes(
  cfg: SnConfig & { id: number },
  incidentId: number,
  snSysId: string,
  socCaseId: number,
  customerId: number,
  cursorTs: string | null,
): Promise<void> {
  assertSafeUrlSync(cfg.instanceUrl);

  // Query sys_journal_field — work_notes for this incident, after cursor
  const since = cursorTs ?? "1970-01-01 00:00:00";
  const encodedSince = encodeURIComponent(since);
  const url =
    `${snBaseUrl(cfg.instanceUrl)}/api/now/table/sys_journal_field` +
    `?sysparm_query=element_id=${snSysId}^element=work_notes^sys_created_on>${encodedSince}` +
    `&sysparm_orderby=sys_created_on&sysparm_limit=20` +
    `&sysparm_fields=value,sys_created_on,sys_created_by`;

  let entries: SnJournalEntry[];
  try {
    const res = await snRequest<{ result: SnJournalEntry[] }>("GET", url, snHeaders(cfg.username, cfg.password));
    entries = res.result ?? [];
  } catch (err) {
    logger.warn({ err, incidentId, socCaseId }, "SN journal fetch error");
    return;
  }

  if (!entries.length) return;

  let latestTs = cursorTs;
  for (const entry of entries) {
    if (!entry.value?.trim()) continue;
    const note = `[ServiceNow] ${entry.sys_created_by}: ${entry.value.trim().slice(0, 2000)}`;
    try {
      await pool.query(
        `INSERT INTO soc_activity_log (case_id, actor_type, actor_name, action_type, description, created_at)
         VALUES ($1, 'ai', 'ServiceNow', 'note', $2, NOW())
         ON CONFLICT DO NOTHING`,
        [socCaseId, note],
      );
    } catch { /* ignore duplicate */ }
    if (!latestTs || entry.sys_created_on > latestTs) latestTs = entry.sys_created_on;
  }

  if (latestTs && latestTs !== cursorTs) {
    await pool.query(
      `UPDATE servicenow_incidents SET sn_journal_cursor = $1 WHERE id = $2`,
      [latestTs, incidentId],
    );
  }

  logger.info({ socCaseId, count: entries.length }, "SN→CyberStep: journal entries ingested");
}

// Sync-safe (non-DNS) URL assertion for use within snRequest-protected paths
function assertSafeUrlSync(instanceUrl: string): void {
  validateServiceNowUrl(instanceUrl);
}

// ─── Work Notes Sync (SOC not → SN work_notes) ────────────────────────────────

export async function addServiceNowWorkNote(
  customerId: number,
  socCaseId: number,
  note: string,
): Promise<void> {
  const cfg = await loadConfig(customerId);
  if (!cfg) return;

  await assertSafeUrlAsync(cfg.instanceUrl);

  const { rows } = await pool.query<{ sn_sys_id: string; id: number }>(
    `SELECT id, sn_sys_id FROM servicenow_incidents WHERE soc_case_id = $1 AND customer_id = $2 LIMIT 1`,
    [socCaseId, customerId],
  );
  const inc = rows[0];
  if (!inc) return; // No ServiceNow incident for this case

  try {
    await updateSnIncident(cfg, inc.sn_sys_id, {
      work_notes: `[CyberStep SOC] ${note.slice(0, 4000)}`,
    });
    await pool.query(
      `UPDATE servicenow_incidents SET last_synced_at = NOW(), sync_error = NULL WHERE id = $1`,
      [inc.id],
    );
    logger.info({ customerId, socCaseId }, "ServiceNow work_note eklendi");
  } catch (err) {
    logger.warn({ err, customerId, socCaseId }, "ServiceNow work_note eklenemedi");
    await pool.query(
      `UPDATE servicenow_incidents SET sync_error = $1 WHERE id = $2`,
      [String(err).slice(0, 500), inc.id],
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
      sn_current_state: number; sn_journal_cursor: string | null;
    }>(
      `SELECT sni.id AS incident_id, sni.sn_sys_id, sni.sn_number,
              sni.soc_case_id, sni.customer_id, sni.config_id,
              sni.sn_state AS sn_current_state,
              sni.sn_journal_cursor
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

      // Full async SSRF guard on every cron outbound request
      try { await assertSafeUrlAsync(cfg.instanceUrl); }
      catch (err) {
        logger.warn({ err, customerId: row.customer_id }, "ServiceNow config URL güvensiz, senkronizasyon atlanıyor");
        continue;
      }

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

        // Pull reverse journal entries (SN work_notes → SOC activity log)
        await pullSnJournalNotes(cfg, row.incident_id, row.sn_sys_id, row.soc_case_id, row.customer_id, row.sn_journal_cursor ?? null);

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

// ─── Webhook: Secret Generation & HMAC Verification ──────────────────────────

/**
 * Generate a new random webhook secret, encrypt + store it for the customer,
 * and return the plaintext once so the customer can configure ServiceNow.
 */
export async function generateAndStoreWebhookSecret(customerId: number): Promise<string | null> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM servicenow_configs WHERE customer_id = $1 LIMIT 1`,
    [customerId],
  );
  const row = rows[0];
  if (!row) return null;

  const plaintext = crypto.randomBytes(32).toString("hex"); // 64 hex chars
  const encrypted = encryptSecret(plaintext);
  if (!encrypted) {
    logger.error({ customerId }, "Webhook secret şifrelenemedi — ENCRYPTION_KEY eksik");
    return null;
  }

  await pool.query(
    `UPDATE servicenow_configs SET webhook_secret_enc = $1, updated_at = NOW() WHERE id = $2`,
    [encrypted, row.id],
  );
  logger.info({ customerId, configId: row.id }, "ServiceNow webhook secret oluşturuldu");
  return plaintext;
}

/**
 * Constant-time HMAC-SHA256 comparison.
 * Signature header format: "sha256=<hex>"
 */
function verifyWebhookHmac(secret: string, rawBody: Buffer, signatureHeader: string): boolean {
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const provided = signatureHeader.startsWith("sha256=")
      ? signatureHeader.slice(7)
      : signatureHeader;
    // Constant-time compare — both must be same byte length for timingSafeEqual
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(provided.length === expected.length ? provided : expected, "hex");
    if (provided.length !== expected.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Payload sent by ServiceNow Business Rule / Outbound REST Message.
 * sys_id is mandatory — it is the only globally-unique, tenant-safe identifier.
 * Using sn_number alone is unsafe in multi-tenant scenarios (numbers are not global).
 */
interface SnWebhookPayload {
  sys_id: string;
  state?: number | string;
  incident_state?: number | string;
  work_notes?: string;
  comments?: string;
  assigned_to?: string;
}

// ─── Webhook Error Logging ────────────────────────────────────────────────────

async function logWebhookError(opts: {
  configId?: number;
  customerId?: number;
  snSysId?: string;
  errorReason: string;
  errorDetail?: string;
  rawBodyPreview?: string;
  signaturePresent: boolean;
}): Promise<number | null> {
  try {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO servicenow_webhook_errors
         (config_id, customer_id, sn_sys_id, error_reason, error_detail, raw_body_preview, signature_present, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      [
        opts.configId ?? null,
        opts.customerId ?? null,
        opts.snSysId ?? null,
        opts.errorReason,
        opts.errorDetail?.slice(0, 500) ?? null,
        opts.rawBodyPreview?.slice(0, 300) ?? null,
        opts.signaturePresent,
      ],
    );
    return rows[0]?.id ?? null;
  } catch (err) {
    logger.warn({ err }, "ServiceNow: webhook error log yazılamadı");
    return null;
  }
}

/**
 * Main webhook handler — looks up the incident by sys_id (only), verifies HMAC
 * (mandatory — fails closed when secret not configured), then applies state,
 * work_notes, comments, and assigned_to changes to CyberStep DB.
 * Returns { ok, status, message }.
 */
export async function processServiceNowWebhook(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): Promise<{ ok: boolean; status: number; message: string }> {
  const rawBodyPreview = rawBody.toString("utf8").slice(0, 300);
  const signaturePresent = !!signatureHeader;

  // 1. Parse payload
  let payload: SnWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as SnWebhookPayload;
  } catch {
    await logWebhookError({
      errorReason: "JSON parse hatası",
      errorDetail: "Gövde geçerli JSON formatında değil",
      rawBodyPreview,
      signaturePresent,
    });
    return { ok: false, status: 400, message: "Geçersiz JSON gövdesi" };
  }

  // sys_id is the only safe lookup key — globally unique within a SN instance and
  // not guessable like a sequential incident number.
  const snSysId = typeof payload.sys_id === "string" ? payload.sys_id.trim() : "";
  if (!snSysId) {
    await logWebhookError({
      errorReason: "sys_id eksik",
      errorDetail: "Payload'da sys_id alanı bulunamadı veya boş",
      rawBodyPreview,
      signaturePresent,
    });
    return { ok: false, status: 400, message: "sys_id alanı zorunludur" };
  }

  // 2. Look up incident → config (scoped by sys_id only — no number fallback)
  const { rows } = await pool.query<{
    id: number; soc_case_id: number; customer_id: number; config_id: number;
    sn_sys_id: string; sn_number: string; sn_state: number;
    sn_journal_cursor: string | null; webhook_secret_enc: string | null;
    webhook_notify_all: boolean; webhook_notify_closed_only: boolean;
  }>(
    `SELECT sni.id, sni.soc_case_id, sni.customer_id, sni.config_id,
            sni.sn_sys_id, sni.sn_number, sni.sn_state, sni.sn_journal_cursor,
            snc.webhook_secret_enc,
            snc.webhook_notify_all, snc.webhook_notify_closed_only
     FROM servicenow_incidents sni
     JOIN servicenow_configs snc ON snc.id = sni.config_id
     WHERE sni.sn_sys_id = $1
     LIMIT 1`,
    [snSysId],
  );

  const incident = rows[0];
  if (!incident) {
    // Return 200 to avoid ServiceNow retry storms for unknown incidents.
    // Note: we cannot verify the signature here (no config found), so we return 200
    // to avoid revealing the existence/absence of the sys_id.
    logger.warn({ snSysId }, "ServiceNow webhook: bilinmeyen sys_id, yoksayıldı");
    return { ok: true, status: 200, message: "Bilinmeyen incident — yoksayıldı" };
  }

  // 3. HMAC verification — MANDATORY (fail closed)
  // If no secret is configured the endpoint refuses the request.
  // Customers must generate a secret before ServiceNow can push updates.
  if (!incident.webhook_secret_enc) {
    logger.warn({ configId: incident.config_id }, "ServiceNow webhook: secret yapılandırılmamış — 401 döndürülüyor");
    await logWebhookError({
      configId: incident.config_id,
      customerId: incident.customer_id,
      snSysId,
      errorReason: "Webhook secret yapılandırılmamış",
      errorDetail: "Müşteri portalından önce webhook secret oluşturun (HMAC doğrulaması zorunludur)",
      rawBodyPreview,
      signaturePresent,
    });
    return { ok: false, status: 401, message: "Webhook secret yapılandırılmamış. Müşteri portalından önce secret oluşturun." };
  }
  if (!signatureHeader) {
    logger.warn({ configId: incident.config_id }, "ServiceNow webhook: X-SN-Signature başlığı eksik");
    await logWebhookError({
      configId: incident.config_id,
      customerId: incident.customer_id,
      snSysId,
      errorReason: "İmza başlığı eksik",
      errorDetail: "X-SN-Signature HTTP başlığı gönderilmedi. ServiceNow Outbound REST Message yapılandırmasını kontrol edin.",
      rawBodyPreview,
      signaturePresent: false,
    });
    return { ok: false, status: 401, message: "X-SN-Signature başlığı zorunludur" };
  }
  const secret = decryptSecret(incident.webhook_secret_enc);
  if (!secret) {
    logger.error({ configId: incident.config_id }, "ServiceNow webhook: secret çözülemedi");
    await logWebhookError({
      configId: incident.config_id,
      customerId: incident.customer_id,
      snSysId,
      errorReason: "Sunucu hatası: secret çözülemedi",
      errorDetail: "ENCRYPTION_KEY değişkeninde sorun olabilir",
      rawBodyPreview,
      signaturePresent,
    });
    return { ok: false, status: 500, message: "Sunucu hatası" };
  }
  if (!verifyWebhookHmac(secret, rawBody, signatureHeader)) {
    logger.warn({ configId: incident.config_id }, "ServiceNow webhook: HMAC doğrulaması başarısız");
    await logWebhookError({
      configId: incident.config_id,
      customerId: incident.customer_id,
      snSysId,
      errorReason: "HMAC imza doğrulaması başarısız",
      errorDetail: "Gönderilen X-SN-Signature değeri beklenen ile uyuşmuyor. ServiceNow'daki webhook secret değerini kontrol edin.",
      rawBodyPreview,
      signaturePresent: true,
    });
    return { ok: false, status: 401, message: "İmza doğrulaması başarısız" };
  }

  // 4. Parse state
  const rawState = payload.incident_state ?? payload.state;
  const newState = rawState !== undefined ? parseInt(String(rawState), 10) : null;

  // 5. Handle state changes
  let stateChanged = false;
  if (newState !== null && !isNaN(newState) && newState !== incident.sn_state) {
    await pool.query(
      `UPDATE servicenow_incidents
       SET sn_state = $1, last_synced_at = NOW(), sync_error = NULL
       WHERE id = $2`,
      [newState, incident.id],
    );
    await pool.query(
      `UPDATE servicenow_configs SET last_sync_at = NOW(), last_sync_error = NULL WHERE id = $1`,
      [incident.config_id],
    );

    // Eğer SN resolved/closed olduysa SOC case'i de kapat
    if (newState >= RESOLVE_STATE) {
      await pool.query(
        `UPDATE soc_cases SET status = 'closed', updated_at = NOW() WHERE id = $1 AND status NOT IN ('closed', 'false_positive')`,
        [incident.soc_case_id],
      );
      await pool.query(
        `INSERT INTO soc_activity_log (case_id, actor_type, actor_name, action_type, description, created_at)
         VALUES ($1, 'ai', 'ServiceNow', 'status_change', $2, NOW())`,
        [incident.soc_case_id, `ServiceNow incident ${incident.sn_number} kapatıldı (state: ${newState}) — webhook ile senkronize edildi`],
      );
    } else {
      await pool.query(
        `INSERT INTO soc_activity_log (case_id, actor_type, actor_name, action_type, description, created_at)
         VALUES ($1, 'ai', 'ServiceNow', 'note', $2, NOW())`,
        [incident.soc_case_id, `ServiceNow incident ${incident.sn_number} durumu güncellendi: state ${incident.sn_state} → ${newState} (webhook)`],
      );
    }
    stateChanged = true;

    // Fire-and-forget: müşteriyi webhook durum değişikliğinden haberdar et
    // — bildirim tercihlerine göre filtre uygula
    const _notifyIncident = { ...incident };
    const _notifyNewState = newState;
    const _notifyResolved = newState >= RESOLVE_STATE;
    const _webhookNotifyAll = incident.webhook_notify_all;
    const _webhookNotifyClosedOnly = incident.webhook_notify_closed_only;

    // Müşteri bildirimleri kapatmışsa (webhookNotifyAll=false) gönderme
    // Sadece kapanma olaylarını iste (webhookNotifyClosedOnly=true) ve bu kapatma değilse gönderme
    const shouldNotify = _webhookNotifyAll && (!_webhookNotifyClosedOnly || _notifyResolved);

    if (shouldNotify) {
      setImmediate(() => {
        pool.query<{ case_number: string; severity: string }>(
          `SELECT case_number, severity FROM soc_cases WHERE id = $1 LIMIT 1`,
          [_notifyIncident.soc_case_id],
        ).then(({ rows }) => {
          const socCase = rows[0];
          const caseNumber = socCase?.case_number ?? String(_notifyIncident.soc_case_id);
          const severity = (["critical", "high", "medium", "low"].includes(socCase?.severity ?? "")
            ? socCase!.severity
            : "medium") as "critical" | "high" | "medium" | "low";

          const title = _notifyResolved
            ? `ServiceNow'da ${_notifyIncident.sn_number} kapandı — SOC vakanız da güncellendi`
            : `ServiceNow'da ${_notifyIncident.sn_number} durumu değişti (state: ${_notifyNewState})`;

          const narrative = _notifyResolved
            ? `ServiceNow incident ${_notifyIncident.sn_number} çözüme kavuşturuldu veya kapatıldı. SOC vakanız (${caseNumber}) otomatik olarak güncellendi.`
            : `ServiceNow incident ${_notifyIncident.sn_number} için durum değişikliği algılandı. SOC vakanız (${caseNumber}) buna göre senkronize edildi.`;

          return sendSOCNotification(
            _notifyIncident.customer_id,
            _notifyIncident.soc_case_id,
            { title, severity, narrative, caseNumber },
          );
        }).then((results) => {
          logger.info(
            { results, socCaseId: _notifyIncident.soc_case_id, snNumber: _notifyIncident.sn_number },
            "ServiceNow webhook: müşteri bildirimi gönderildi",
          );
          const successes = results.filter((r) => r.ok);
          const failures = results.filter((r) => !r.ok);
          const channelSummary = successes.map((r) => r.channel).join(", ") || "yok";
          const description = successes.length > 0
            ? `Bildirim e-postası gönderildi (kanal: ${channelSummary})`
            : `Bildirim gönderilemedi: ${failures.map((r) => r.message).join("; ")}`;
          return pool.query(
            `INSERT INTO soc_activity_log (case_id, actor_type, actor_name, action_type, description, created_at)
             VALUES ($1, 'system', 'CyberStep SOC', 'notification', $2, NOW())`,
            [_notifyIncident.soc_case_id, description],
          );
        }).catch((err: unknown) => {
          logger.error(
            { err, socCaseId: _notifyIncident.soc_case_id },
            "ServiceNow webhook: müşteri bildirimi gönderilemedi",
          );
        });
      });
    } else {
      logger.info(
        { socCaseId: _notifyIncident.soc_case_id, snNumber: _notifyIncident.sn_number, webhookNotifyAll: _webhookNotifyAll, webhookNotifyClosedOnly: _webhookNotifyClosedOnly, isResolved: _notifyResolved },
        "ServiceNow webhook: bildirim müşteri tercihi nedeniyle atlandı",
      );
    }
  }

  // 6. Ingest work_notes
  const workNote = payload.work_notes?.trim();
  if (workNote) {
    try {
      await pool.query(
        `INSERT INTO soc_activity_log (case_id, actor_type, actor_name, action_type, description, created_at)
         VALUES ($1, 'ai', 'ServiceNow', 'note', $2, NOW())
         ON CONFLICT DO NOTHING`,
        [incident.soc_case_id, `[ServiceNow work_note] ${workNote.slice(0, 2000)}`],
      );
    } catch { /* ignore duplicate */ }
  }

  // 7. Ingest public comments
  const comment = payload.comments?.trim();
  if (comment) {
    try {
      await pool.query(
        `INSERT INTO soc_activity_log (case_id, actor_type, actor_name, action_type, description, created_at)
         VALUES ($1, 'ai', 'ServiceNow', 'note', $2, NOW())
         ON CONFLICT DO NOTHING`,
        [incident.soc_case_id, `[ServiceNow yorum] ${comment.slice(0, 2000)}`],
      );
    } catch { /* ignore duplicate */ }
  }

  // 8. Handle assignment changes
  const assignedTo = payload.assigned_to?.trim();
  if (assignedTo) {
    // Update the SOC case assignee when ServiceNow assignment changes
    await pool.query(
      `UPDATE soc_cases SET assigned_to = $1, updated_at = NOW() WHERE id = $2`,
      [assignedTo, incident.soc_case_id],
    );
    await pool.query(
      `INSERT INTO soc_activity_log (case_id, actor_type, actor_name, action_type, description, created_at)
       VALUES ($1, 'ai', 'ServiceNow', 'assignment', $2, NOW())
       ON CONFLICT DO NOTHING`,
      [incident.soc_case_id, `ServiceNow'da atama değişti: ${incident.sn_number} → ${assignedTo} (webhook)`],
    );
  }

  // 9. Stamp last_webhook_at and increment webhook_event_count on the config
  await pool.query(
    `UPDATE servicenow_configs
     SET last_webhook_at = NOW(),
         webhook_event_count = webhook_event_count + 1,
         updated_at = NOW()
     WHERE id = $1`,
    [incident.config_id],
  );

  logger.info(
    { customerId: incident.customer_id, socCaseId: incident.soc_case_id, snNumber: incident.sn_number, newState, stateChanged, assignedTo: assignedTo ?? null },
    "ServiceNow webhook işlendi",
  );

  return { ok: true, status: 200, message: "Webhook işlendi" };
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
  // Reverse sync cursor for journal entry deduplication
  await pool.query(`ALTER TABLE servicenow_incidents ADD COLUMN IF NOT EXISTS sn_journal_cursor TEXT`);
  // Webhook secret for HMAC-SHA256 signature verification
  await pool.query(`ALTER TABLE servicenow_configs ADD COLUMN IF NOT EXISTS webhook_secret_enc TEXT`);
  // Connection health check alert timestamp (rate-limit to 1 alert/day per customer)
  await pool.query(`ALTER TABLE servicenow_configs ADD COLUMN IF NOT EXISTS conn_check_alerted_at TIMESTAMPTZ`);
  // Webhook activity tracking
  await pool.query(`ALTER TABLE servicenow_configs ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE servicenow_configs ADD COLUMN IF NOT EXISTS webhook_event_count INTEGER NOT NULL DEFAULT 0`);
  // Configurable retry window for pending SOC cases after connection restore (default 48h)
  await pool.query(`ALTER TABLE servicenow_configs ADD COLUMN IF NOT EXISTS retry_window_hours INTEGER NOT NULL DEFAULT 48`);
  // Customer notification preferences for webhook state-change emails
  await pool.query(`ALTER TABLE servicenow_configs ADD COLUMN IF NOT EXISTS webhook_notify_all BOOLEAN NOT NULL DEFAULT true`);
  await pool.query(`ALTER TABLE servicenow_configs ADD COLUMN IF NOT EXISTS webhook_notify_closed_only BOOLEAN NOT NULL DEFAULT false`);
  // Webhook error log — rejected webhook attempts (HMAC, parse, missing fields)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS servicenow_webhook_errors (
      id                SERIAL PRIMARY KEY,
      config_id         INTEGER,
      customer_id       INTEGER,
      sn_sys_id         TEXT,
      error_reason      TEXT NOT NULL,
      error_detail      TEXT,
      raw_body_preview  TEXT,
      signature_present BOOLEAN DEFAULT false,
      retried_at        TIMESTAMPTZ,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS sn_webhook_errors_customer_idx ON servicenow_webhook_errors (customer_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS sn_webhook_errors_created_idx ON servicenow_webhook_errors (created_at DESC)`);
  logger.info("ServiceNow tables ready");
}

// ─── Retry a failed webhook by force-syncing the incident ─────────────────────

/**
 * Retries a failed webhook error entry.
 * If the error has a sn_sys_id and we can find the config for the customer,
 * we force-pull the current state from ServiceNow and apply it.
 * Returns { ok, message }.
 */
export async function retryWebhookError(
  errorId: number,
  customerId: number,
): Promise<{ ok: boolean; message: string }> {
  const { rows: errRows } = await pool.query<{
    id: number; sn_sys_id: string | null; config_id: number | null; customer_id: number | null;
  }>(
    `SELECT id, sn_sys_id, config_id, customer_id
     FROM servicenow_webhook_errors
     WHERE id = $1`,
    [errorId],
  );
  const errRow = errRows[0];
  if (!errRow) return { ok: false, message: "Hata kaydı bulunamadı" };
  if (errRow.customer_id !== null && errRow.customer_id !== customerId) {
    return { ok: false, message: "Yetkisiz" };
  }

  if (!errRow.sn_sys_id) {
    return { ok: false, message: "Bu hata kaydında sys_id yok — ServiceNow'da payload'ı kontrol edin ve tekrar gönderin" };
  }

  // Find the incident in our DB
  const { rows: incRows } = await pool.query<{
    id: number; soc_case_id: number; sn_sys_id: string; sn_number: string; config_id: number;
  }>(
    `SELECT id, soc_case_id, sn_sys_id, sn_number, config_id
     FROM servicenow_incidents
     WHERE sn_sys_id = $1 AND customer_id = $2
     LIMIT 1`,
    [errRow.sn_sys_id, customerId],
  );
  const inc = incRows[0];
  if (!inc) {
    return { ok: false, message: "sys_id ile eşleşen incident bulunamadı — ServiceNow'dan tekrar göndermeniz gerekebilir" };
  }

  const cfg = await loadConfig(customerId);
  if (!cfg) return { ok: false, message: "ServiceNow yapılandırması bulunamadı" };

  try {
    await assertSafeUrlAsync(cfg.instanceUrl);
    const snData = await getSnIncident(cfg, inc.sn_sys_id);
    if (!snData) return { ok: false, message: "ServiceNow incident bilgisi alınamadı" };

    await pool.query(
      `UPDATE servicenow_incidents SET sn_state = $1, last_synced_at = NOW(), sync_error = NULL WHERE id = $2`,
      [snData.state, inc.id],
    );
    if (snData.state >= RESOLVE_STATE) {
      await pool.query(
        `UPDATE soc_cases SET status = 'closed', updated_at = NOW() WHERE id = $1 AND status NOT IN ('closed', 'false_positive')`,
        [inc.soc_case_id],
      );
    }
    await pool.query(
      `INSERT INTO soc_activity_log (case_id, actor_type, actor_name, action_type, description, created_at)
       VALUES ($1, 'ai', 'ServiceNow', 'note', $2, NOW())`,
      [inc.soc_case_id, `Manuel yeniden deneme: ${inc.sn_number} durumu ServiceNow'dan çekildi (state: ${snData.state})`],
    );
    // Mark the error as retried
    await pool.query(
      `UPDATE servicenow_webhook_errors SET retried_at = NOW() WHERE id = $1`,
      [errorId],
    );
    logger.info({ errorId, customerId, snNumber: inc.sn_number, newState: snData.state }, "ServiceNow webhook error retried");
    return { ok: true, message: `${inc.sn_number} başarıyla senkronize edildi (state: ${snData.state})` };
  } catch (err) {
    logger.error({ err, errorId, customerId }, "ServiceNow webhook retry başarısız");
    return { ok: false, message: `Yeniden deneme başarısız: ${String(err).slice(0, 200)}` };
  }
}

// ─── Retry pending SOC cases after connection restore ─────────────────────────

/**
 * Called when a ServiceNow connection is restored after a period of errors.
 * Finds SOC cases created within the last retryWindowHours that never got
 * a ServiceNow incident (because the connection was down), and retries them.
 * Each retry attempt is recorded in soc_activity_log.
 */
const RETRY_BATCH_SIZE = 20; // rows per cursor page — keeps memory bounded

async function retryPendingServiceNowCases(
  customerId: number,
  retryWindowHours: number,
  notify?: { customerEmail: string; customerName: string; instanceUrl: string },
): Promise<void> {
  try {
    let totalAttempted = 0;
    let totalSucceeded = 0;
    let batchCount = 0;
    // ID-based cursor: each case is visited exactly once regardless of success or failure.
    // openServiceNowIncident suppresses its own errors, so we cannot rely on NOT EXISTS
    // shrinking after each iteration — using a forward cursor guarantees termination.
    let lastId = 0;

    while (true) {
      const { rows: pending } = await pool.query<{
        id: number;
        case_number: string;
        title: string;
        description: string | null;
        severity: string;
        category: string;
      }>(
        `SELECT sc.id, sc.case_number, sc.title, sc.description, sc.severity, sc.category
         FROM soc_cases sc
         WHERE sc.customer_id = $1
           AND sc.id > $2
           AND sc.status NOT IN ('closed', 'false_positive')
           AND sc.created_at >= NOW() - ($4 * INTERVAL '1 hour')
           AND NOT EXISTS (
             SELECT 1 FROM servicenow_incidents sni WHERE sni.soc_case_id = sc.id
           )
         ORDER BY sc.id ASC
         LIMIT $3`,
        [customerId, lastId, RETRY_BATCH_SIZE, retryWindowHours],
      );

      if (!pending.length) break; // no more eligible cases ahead of the cursor

      batchCount++;
      logger.info(
        { customerId, batch: batchCount, count: pending.length, afterId: lastId },
        "ServiceNow retry: processing batch",
      );

      for (const sc of pending) {
        // Advance cursor first so a crash mid-batch doesn't revisit already-attempted cases
        lastId = sc.id;
        totalAttempted++;

        // Log the retry attempt before trying
        await pool.query(
          `INSERT INTO soc_activity_log (case_id, actor_type, actor_name, action_type, description, created_at)
           VALUES ($1, 'ai', 'ServiceNow', 'note', $2, NOW())`,
          [sc.id, `ServiceNow bağlantısı yeniden kuruldu — vaka ServiceNow'a otomatik olarak yeniden gönderiliyor`],
        );

        // openServiceNowIncident handles deduplication, SN API call, and success logging.
        // It suppresses errors internally; we detect success by checking the DB afterward.
        await openServiceNowIncident(customerId, sc.id, {
          caseId: sc.id,
          caseNumber: sc.case_number,
          title: sc.title,
          description: sc.description ?? "",
          severity: sc.severity,
          category: sc.category,
        });

        // Check if the incident was actually created (success detection)
        const { rows: check } = await pool.query(
          `SELECT 1 FROM servicenow_incidents WHERE soc_case_id = $1 LIMIT 1`,
          [sc.id],
        );
        if (check.length > 0) totalSucceeded++;
      }
    }

    logger.info(
      { customerId, totalAttempted, totalSucceeded, batchCount },
      "ServiceNow retry: drain complete",
    );

    // Notify the customer about the reconnection and transferred cases
    if (totalAttempted > 0 && notify?.customerEmail) {
      try {
        const { sendServiceNowReconnectSummaryEmail } = await import("./email");
        await sendServiceNowReconnectSummaryEmail({
          to: notify.customerEmail,
          customerName: notify.customerName,
          instanceUrl: notify.instanceUrl,
          totalSucceeded,
          totalAttempted,
        });
      } catch (emailErr) {
        logger.warn({ emailErr, customerId }, "ServiceNow retry: reconnect summary email gönderilemedi");
      }
    }
  } catch (err) {
    logger.error({ err, customerId }, "ServiceNow retry: bekleyen vaka gönderimi başarısız");
  }
}

// ─── Proactive Connection Health Check ────────────────────────────────────────

/**
 * Test all active ServiceNow configs and notify the customer by email
 * if the connection is broken. Alerts are rate-limited to once per day per
 * customer. Successful re-connections clear the alert timestamp and trigger
 * a retry of any SOC cases missed during the outage window (last 48 h).
 * Intended to be called from a daily cron (09:00 Istanbul).
 */
export async function checkServiceNowConnections(): Promise<void> {
  try {
    const { rows } = await pool.query<{
      id: number;
      customer_id: number;
      instance_url: string;
      username: string;
      api_token_enc: string;
      assignment_group: string | null;
      category: string | null;
      retry_window_hours: number;
      conn_check_alerted_at: string | null;
      last_sync_error: string | null;
      customer_email: string | null;
      customer_name: string | null;
    }>(`
      SELECT
        snc.id,
        snc.customer_id,
        snc.instance_url,
        snc.username,
        snc.api_token_enc,
        snc.assignment_group,
        snc.category,
        COALESCE(snc.retry_window_hours, 48) AS retry_window_hours,
        snc.conn_check_alerted_at,
        snc.last_sync_error,
        c.email  AS customer_email,
        c.full_name AS customer_name
      FROM servicenow_configs snc
      JOIN customers c ON c.id = snc.customer_id
      WHERE snc.active = true
    `);

    logger.info({ count: rows.length }, "ServiceNow connection health check starting");

    for (const row of rows) {
      try {
        const password = decryptSecret(row.api_token_enc);
        if (!password) {
          logger.warn({ configId: row.id }, "ServiceNow config: cannot decrypt token, skipping health check");
          continue;
        }

        const result = await testServiceNowConnection({
          instanceUrl: row.instance_url,
          username: row.username,
          password,
          assignmentGroup: row.assignment_group,
          category: row.category,
        });

        if (result.ok) {
          // Was there a prior error? If so, this is a re-connection — retry pending cases.
          const wasErrored = !!row.last_sync_error;

          // Connection healthy — clear any existing error + alert timestamp
          await pool.query(
            `UPDATE servicenow_configs
             SET last_sync_error = NULL, conn_check_alerted_at = NULL, last_sync_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [row.id],
          );
          logger.info({ configId: row.id, customerId: row.customer_id, wasErrored }, "ServiceNow connection healthy");

          // Re-connection detected: push SOC cases that were lost during the outage
          if (wasErrored) {
            logger.info({ configId: row.id, customerId: row.customer_id }, "ServiceNow bağlantısı yeniden kuruldu — bekleyen vakalar için retry tetikleniyor");
            const notifyPayload = row.customer_email
              ? { customerEmail: row.customer_email, customerName: row.customer_name ?? row.customer_email, instanceUrl: row.instance_url }
              : undefined;
            setImmediate(() => {
              retryPendingServiceNowCases(row.customer_id, row.retry_window_hours, notifyPayload).catch((err) =>
                logger.error({ err, customerId: row.customer_id }, "ServiceNow retry: beklenmedik hata"),
              );
            });
          }
        } else {
          // Connection broken — persist error
          await pool.query(
            `UPDATE servicenow_configs
             SET last_sync_error = $1, updated_at = NOW()
             WHERE id = $2`,
            [result.message.slice(0, 500), row.id],
          );

          // Only alert if no alert sent in the past 24 hours
          const alreadyAlerted = row.conn_check_alerted_at
            ? (Date.now() - new Date(row.conn_check_alerted_at).getTime()) < 24 * 60 * 60 * 1000
            : false;

          if (!alreadyAlerted && row.customer_email) {
            const { sendServiceNowConnectionAlertEmail } = await import("./email");
            await sendServiceNowConnectionAlertEmail({
              to: row.customer_email,
              customerName: row.customer_name ?? row.customer_email,
              instanceUrl: row.instance_url,
              errorMessage: result.message,
            });

            await pool.query(
              `UPDATE servicenow_configs SET conn_check_alerted_at = NOW() WHERE id = $1`,
              [row.id],
            );

            logger.warn(
              { configId: row.id, customerId: row.customer_id, error: result.message },
              "ServiceNow connection broken — customer alerted",
            );
          } else {
            logger.warn(
              { configId: row.id, customerId: row.customer_id, alreadyAlerted },
              "ServiceNow connection broken — alert suppressed (already sent today)",
            );
          }
        }
      } catch (err) {
        logger.error({ err, configId: row.id }, "ServiceNow health check failed for config");
      }
    }

    logger.info("ServiceNow connection health check complete");
  } catch (err) {
    logger.error({ err }, "checkServiceNowConnections: fatal error");
  }
}

