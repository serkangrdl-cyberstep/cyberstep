/**
 * NetGSM SMS Notifier
 * SOC alarmları → Türkiye SMS (NetGSM XML API)
 */

import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { encryptSecret, decryptSecret } from "./fabric-crypto";

const NETGSM_API_URL = "https://api.netgsm.com.tr/sms/send/xml";

// ─── API helper ───────────────────────────────────────────────────────────────

async function sendNetgsmRequest(
  username: string,
  password: string,
  header: string,
  phones: string[],
  message: string,
): Promise<{ ok: boolean; message: string }> {
  const phoneXml = phones.map(p => `<no>${p.replace(/\D/g, "")}</no>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mainbody>
  <header>
    <usercode>${username}</usercode>
    <password>${password}</password>
    <msgheader>${header}</msgheader>
    <dil>TR</dil>
  </header>
  <body>
    <msg><![CDATA[${message.slice(0, 155)}]]></msg>
    ${phoneXml}
  </body>
</mainbody>`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(NETGSM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=UTF-8" },
      body: xml,
      signal: controller.signal,
    });
    const text = await res.text();
    // NetGSM returns: "00 <bulkid>" for success or error codes like "20", "30" etc.
    const code = text.trim().split(" ")[0];
    if (code === "00") return { ok: true, message: `SMS gönderildi (${phones.length} alıcı)` };
    return { ok: false, message: `NetGSM hata kodu: ${code}` };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Message formatters ───────────────────────────────────────────────────────

export type NetgsmEvent =
  | "soc.case.opened"
  | "soc.case.closed"
  | "soc.case.critical"
  | "soc.sla.breached";

export function formatSmsMessage(
  eventType: NetgsmEvent,
  data: Record<string, unknown>,
): string {
  const title = String(data["title"] ?? "SOC Vakası");
  const caseNum = data["caseNumber"] ? `[${data["caseNumber"]}] ` : "";
  const sev = String(data["severity"] ?? "medium").toUpperCase();

  switch (eventType) {
    case "soc.case.critical":
      return `CYBERSTEP KRITIK ${caseNum}${title} - Hemen mudahale gerekiyor`;
    case "soc.sla.breached":
      return `CYBERSTEP SLA IHLALI ${caseNum}${title} - Yanit suresi asildi`;
    case "soc.case.opened":
      return `CYBERSTEP SOC ${caseNum}${sev} - ${title}`;
    case "soc.case.closed":
      return `CYBERSTEP SOC Kapatildi ${caseNum}${title}`;
    default:
      return `CYBERSTEP ${caseNum}${title}`;
  }
}

// ─── Main send function ───────────────────────────────────────────────────────

export async function sendNetgsmAlert(
  customerId: number,
  eventType: NetgsmEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const { rows } = await pool.query<{
    id: number; username_enc: string; password_enc: string;
    header: string; phone_numbers: string[]; events: string[];
  }>(
    `SELECT id, username_enc, password_enc, header, phone_numbers, events
     FROM netgsm_configs
     WHERE customer_id = $1 AND active = true
     LIMIT 1`,
    [customerId],
  );
  const cfg = rows[0];
  if (!cfg) return;
  if (!cfg.events.includes(eventType) && !cfg.events.includes("*")) return;
  if (!cfg.phone_numbers?.length) return;

  const username = decryptSecret(cfg.username_enc);
  const password = decryptSecret(cfg.password_enc);
  if (!username || !password) return;

  const message = formatSmsMessage(eventType, data);

  try {
    const result = await sendNetgsmRequest(username, password, cfg.header, cfg.phone_numbers, message);
    if (result.ok) {
      logger.info({ customerId, eventType, count: cfg.phone_numbers.length }, "NetGSM SMS gönderildi");
    } else {
      logger.warn({ customerId, eventType, msg: result.message }, "NetGSM gönderim başarısız");
    }
  } catch (err) {
    logger.warn({ err, customerId, eventType }, "NetGSM SMS hatası");
  }
}

// ─── Config test ─────────────────────────────────────────────────────────────

export async function testNetgsmConfig(
  username: string,
  password: string,
  header: string,
  testPhone: string,
): Promise<{ ok: boolean; message: string }> {
  return sendNetgsmRequest(username, password, header, [testPhone], "CyberStep NetGSM entegrasyonu test mesaji");
}

// ─── Startup migration ────────────────────────────────────────────────────────

export async function ensureNetgsmTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netgsm_configs (
      id            SERIAL PRIMARY KEY,
      customer_id   INTEGER NOT NULL,
      username_enc  TEXT NOT NULL,
      password_enc  TEXT NOT NULL,
      header        TEXT NOT NULL DEFAULT 'CYBERSTEP',
      phone_numbers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      active        BOOLEAN NOT NULL DEFAULT true,
      events        TEXT[] NOT NULL DEFAULT ARRAY['soc.case.critical','soc.sla.breached'],
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS netgsm_configs_customer_uq ON netgsm_configs (customer_id)`);
  logger.info("NetGSM tables ready");
}
