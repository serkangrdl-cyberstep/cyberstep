/**
 * Platform Self-Monitoring
 *
 * - Uptime webhook handler (UptimeRobot / BetterStack)
 * - Gece maliyet kontrolü (Shodan, Claude daily cost)
 * - Cron pipeline sağlık kontrolü
 */

import { db } from "@workspace/db";
import { platformOutageLogTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { sendMail } from "./email";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const BASE_URL = process.env["REPLIT_DOMAINS"]
  ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
  : "http://localhost:80";

// ─── Admin bildirim yardımcısı ────────────────────────────────────────────────

async function notifyAdmin(subject: string, message: string): Promise<void> {
  const adminEmail = process.env["SMTP_USER"];
  if (!adminEmail) return;

  await sendMail({
    to: adminEmail,
    subject: `[CyberStep Monitoring] ${subject}`,
    html: `<pre style="font-family:monospace;background:#f1f5f9;padding:16px;border-radius:8px">${message}</pre>`,
  }).catch(err => logger.warn({ err }, "Platform monitor admin email failed"));
}

// ─── Telegram (ADMIN_TELEGRAM_BOT_TOKEN + ADMIN_TELEGRAM_CHAT_ID) ─────────────

async function sendAdminTelegram(message: string): Promise<void> {
  const token = process.env["ADMIN_TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["ADMIN_TELEGRAM_CHAT_ID"];
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch (err) {
    logger.warn({ err }, "Admin Telegram notify failed");
  }
}

async function alertAdmin(subject: string, message: string): Promise<void> {
  await sendAdminTelegram(message);
  await notifyAdmin(subject, message);
}

// ─── Uptime webhook (UptimeRobot / BetterStack) ───────────────────────────────

export async function handleUptimeAlert(params: {
  monitor: string;
  status: "down" | "up";
  reason?: string;
}): Promise<void> {
  const { monitor, status, reason } = params;

  if (status === "down") {
    await db.insert(platformOutageLogTable).values({
      monitor,
      status: "down",
      reason: reason ?? "Bilinmiyor",
      startedAt: new Date(),
    });

    await alertAdmin(
      `PLATFORM ÇÖKTÜ: ${monitor}`,
      `PLATFORM ÇÖKTÜ\nMonitor: ${monitor}\nSebep: ${reason ?? "Bilinmiyor"}\nZaman: ${new Date().toLocaleString("tr-TR")}`,
    );

    logger.error({ monitor, reason }, "Platform outage detected");
  }

  if (status === "up") {
    await db.update(platformOutageLogTable).set({
      resolvedAt: new Date(),
      status: "resolved",
    }).where(
      and(eq(platformOutageLogTable.monitor, monitor), isNull(platformOutageLogTable.resolvedAt))
    );

    await alertAdmin(
      `Platform tekrar çalışıyor: ${monitor}`,
      `Platform tekrar çalışıyor\nMonitor: ${monitor}\nZaman: ${new Date().toLocaleString("tr-TR")}`,
    );

    logger.info({ monitor }, "Platform outage resolved");
  }
}

// ─── Maliyet kontrolü (Her gece 23:30) ────────────────────────────────────────

export async function checkPlatformCosts(): Promise<void> {
  const alerts: string[] = [];

  // Shodan credit kontrolü
  const shodanKey = process.env["SHODAN_API_KEY"];
  if (shodanKey) {
    try {
      const res = await fetch(`https://api.shodan.io/api-info?key=${shodanKey}`);
      if (res.ok) {
        const data = await res.json() as { query_credits?: number };
        const credits = data.query_credits ?? 100;
        if (credits < 20) {
          alerts.push(`Shodan credit azalıyor: ${credits} kaldı`);
        }
      }
    } catch {
      // Shodan API erişilemez — sessizce geç
    }
  }

  // Cron pipeline sağlık kontrolü
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await pool.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM cron_job_runs
       WHERE job_name = 'lead_qualify'
         AND started_at::date = $1
         AND status = 'ok'`,
      [today],
    );
    const ran = Number(result.rows[0]?.cnt ?? 0);
    const hour = new Date().getHours();
    if (ran === 0 && hour >= 8) {
      alerts.push(`Gece pipeline ÇALIŞMADI: ${today}`);
    }
  } catch {
    // cron_job_runs erişilemez
  }

  // Claude günlük maliyet eşiği
  const threshold = parseFloat(process.env["CLAUDE_DAILY_COST_THRESHOLD"] ?? "5");
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await pool.query<{ total_cost: string }>(
      `SELECT COALESCE(SUM(cost_usd), 0) AS total_cost FROM soc_ai_costs WHERE recorded_date = $1`,
      [today],
    );
    const cost = Number(result.rows[0]?.total_cost ?? 0);
    if (cost > threshold) {
      alerts.push(`Claude günlük maliyet: $${cost.toFixed(2)} (limit: $${threshold})`);
    }
  } catch {
    // soc_ai_costs yok
  }

  if (alerts.length > 0) {
    const msg = alerts.map(a => `⚠️ ${a}`).join("\n");
    await alertAdmin("Maliyet / Kaynak Uyarısı", msg);
    logger.warn({ alerts }, "Platform cost alerts fired");
  } else {
    logger.info("Platform cost check: all clear");
  }
}

// ─── Public status verisi (status sayfası için) ───────────────────────────────

export async function getPlatformStatus(): Promise<{
  services: Array<{ name: string; status: string; lastCheck: string }>;
  uptimePct30d: number;
}> {
  const recentOutages = await db.select().from(platformOutageLogTable);
  const totalHours = 30 * 24;
  const downtimeHours = recentOutages
    .filter(o => o.status === "resolved" && o.resolvedAt !== null)
    .reduce((sum, o) => {
      const start = o.startedAt ? new Date(o.startedAt).getTime() : Date.now();
      const end   = o.resolvedAt ? new Date(o.resolvedAt).getTime() : start;
      return sum + (end - start) / 3_600_000;
    }, 0);

  const activeOutages = recentOutages.filter(o => o.status === "down");

  const services = [
    { name: "Web Platformu",          status: activeOutages.some(o => o.monitor.includes("web"))    ? "down" : "up" },
    { name: "Tarama Motoru",           status: activeOutages.some(o => o.monitor.includes("scan"))   ? "down" : "up" },
    { name: "Email Bildirimleri",      status: "up" },
    { name: "Veritabanı",              status: "up" },
  ].map(s => ({ ...s, lastCheck: new Date().toISOString() }));

  return {
    services,
    uptimePct30d: Math.max(0, Math.round((1 - downtimeHours / totalHours) * 1000) / 10),
  };
}
