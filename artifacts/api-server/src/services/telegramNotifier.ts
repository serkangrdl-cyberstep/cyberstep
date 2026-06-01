/**
 * Telegram Bot Notifier
 * SOC alarmları → Telegram mesajı (Bot API)
 */

import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { encryptSecret, decryptSecret } from "./fabric-crypto";

const TG_BASE = "https://api.telegram.org";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TelegramEvent =
  | "soc.case.opened"
  | "soc.case.closed"
  | "soc.case.critical"
  | "soc.sla.breached"
  | "scan.completed";

// ─── API helper ───────────────────────────────────────────────────────────────

async function tgRequest<T>(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${TG_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json() as { ok: boolean; result?: T; description?: string };
    if (!json.ok) throw new Error(`Telegram API hatası: ${json.description ?? "bilinmiyor"}`);
    return json.result as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Format helpers ───────────────────────────────────────────────────────────

const SEV_EMOJI: Record<string, string> = {
  critical: "🔴", high: "🟠", medium: "🟡", low: "🟢",
};

export function formatSocCaseMessage(
  eventType: TelegramEvent,
  data: Record<string, unknown>,
): string {
  const sev = String(data["severity"] ?? "medium");
  const emoji = SEV_EMOJI[sev] ?? "⚪";
  const title = String(data["title"] ?? "SOC Vakası");
  const caseNumber = data["caseNumber"] ? `\`${data["caseNumber"]}\`` : "";

  switch (eventType) {
    case "soc.case.opened":
      return `${emoji} *Yeni SOC Vakası* ${caseNumber}\n*Başlık:* ${title}\n*Önem:* ${sev.toUpperCase()}\n*Zaman:* ${new Date().toLocaleString("tr-TR")}`;
    case "soc.case.critical":
      return `🚨 *KRİTİK SOC ALARMI* ${caseNumber}\n*Başlık:* ${title}\n*Hemen müdahale gerekiyor\\!*`;
    case "soc.case.closed":
      return `✅ *SOC Vakası Kapatıldı* ${caseNumber}\n*Başlık:* ${title}`;
    case "soc.sla.breached":
      return `⏰ *SLA İhlali* ${caseNumber}\n*Başlık:* ${title}\n*Yanıt süresi aşıldı\\!*`;
    case "scan.completed":
      return `🔍 *Tarama Tamamlandı*\n*Domain:* ${String(data["domain"] ?? "")}\n*Risk Skoru:* ${String(data["riskScore"] ?? "?")}`;
    default:
      return `📢 *CyberStep Bildirimi*\n${title}`;
  }
}

// ─── Main send function ───────────────────────────────────────────────────────

export async function sendTelegramAlert(
  customerId: number,
  eventType: TelegramEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const { rows } = await pool.query<{
    id: number; bot_token_enc: string; chat_id: string; events: string[];
  }>(
    `SELECT id, bot_token_enc, chat_id, events
     FROM telegram_configs
     WHERE customer_id = $1 AND active = true
     LIMIT 1`,
    [customerId],
  );
  const cfg = rows[0];
  if (!cfg) return;
  if (!cfg.events.includes(eventType) && !cfg.events.includes("*")) return;

  const token = decryptSecret(cfg.bot_token_enc);
  if (!token) return;

  const text = formatSocCaseMessage(eventType, data);

  try {
    await tgRequest(token, "sendMessage", {
      chat_id: cfg.chat_id,
      text,
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    });
    logger.info({ customerId, eventType }, "Telegram bildirimi gönderildi");
  } catch (err) {
    logger.warn({ err, customerId, eventType }, "Telegram gönderim hatası");
  }
}

// ─── Config test ─────────────────────────────────────────────────────────────

export async function testTelegramConfig(
  token: string,
  chatId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    await tgRequest(token, "sendMessage", {
      chat_id: chatId,
      text: "✅ *CyberStep* — Telegram entegrasyonu başarıyla test edildi\\!",
      parse_mode: "MarkdownV2",
    });
    return { ok: true, message: "Test mesajı gönderildi" };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

// ─── Get bot info ─────────────────────────────────────────────────────────────

export async function getTelegramBotInfo(
  token: string,
): Promise<{ ok: boolean; username?: string; message: string }> {
  try {
    const bot = await tgRequest<{ username: string }>(token, "getMe", {});
    return { ok: true, username: bot.username, message: `Bot: @${bot.username}` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

// ─── Startup migration ────────────────────────────────────────────────────────

export async function ensureTelegramTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_configs (
      id            SERIAL PRIMARY KEY,
      customer_id   INTEGER NOT NULL,
      bot_token_enc TEXT NOT NULL,
      chat_id       TEXT NOT NULL,
      active        BOOLEAN NOT NULL DEFAULT true,
      events        TEXT[] NOT NULL DEFAULT ARRAY['soc.case.opened','soc.case.closed','soc.case.critical','soc.sla.breached'],
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS telegram_configs_customer_uq ON telegram_configs (customer_id)`);
  logger.info("Telegram tables ready");
}
