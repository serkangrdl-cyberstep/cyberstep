import { db, socCasesTable, customersTable } from "@workspace/db";
import { eq, and, isNotNull, inArray, sql } from "drizzle-orm";
import { sendMail } from "../email";
import { logger } from "../../lib/logger";

const SOC_ADMIN_EMAIL = process.env["SOC_ADMIN_EMAIL"] ?? process.env["ADMIN_EMAIL"] ?? "info@cyberstep.com";
const TELEGRAM_TOKEN  = process.env["ADMIN_TELEGRAM_BOT_TOKEN"];
const TELEGRAM_CHAT   = process.env["ADMIN_TELEGRAM_CHAT_ID"];

const WARNING_THRESHOLD_PCT = 80;

async function notifyTelegram(message: string): Promise<void> {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message }),
    });
  } catch (err) {
    logger.warn({ err }, "sla_proactive_warning: Telegram bildirimi gönderilemedi");
  }
}

export async function runSlaProactiveWarning(): Promise<number> {
  logger.info("sla_proactive_warning: kontrol başladı");

  const openCases = await db
    .select()
    .from(socCasesTable)
    .where(
      and(
        inArray(socCasesTable.status, ["open", "investigating"]),
        isNotNull(socCasesTable.slaDeadline),
        eq(socCasesTable.slaBreached, false),
      ),
    );

  if (openCases.length === 0) {
    logger.info("sla_proactive_warning: aktif vaka yok");
    return 0;
  }

  const now = Date.now();
  type WarningCase = {
    caseNumber: string;
    title: string;
    severity: string;
    elapsed: number;
    remaining: number;
    minutesLeft: number;
  };
  const warnings: WarningCase[] = [];

  for (const c of openCases) {
    if (!c.slaDeadline) continue;

    const deadline = new Date(c.slaDeadline).getTime();
    const created  = new Date(c.createdAt).getTime();
    const total    = deadline - created;
    const elapsed  = now - created;

    if (total <= 0) continue;

    const elapsedPct   = (elapsed / total) * 100;
    const remainingMs  = deadline - now;
    const minutesLeft  = Math.round(remainingMs / 60000);

    if (elapsedPct >= WARNING_THRESHOLD_PCT && remainingMs > 0) {
      warnings.push({
        caseNumber: c.caseNumber,
        title:      c.title,
        severity:   c.severity,
        elapsed:    Math.round(elapsedPct),
        remaining:  Math.round(100 - elapsedPct),
        minutesLeft,
      });
    }
  }

  if (warnings.length === 0) {
    logger.info("sla_proactive_warning: SLA riski olan vaka yok");
    return 0;
  }

  logger.warn({ count: warnings.length }, "sla_proactive_warning: SLA riski olan vakalar bulundu");

  const sevEmoji: Record<string, string> = {
    critical: "🔴",
    high:     "🟠",
    medium:   "🟡",
    low:      "🟢",
  };

  const telegramLines = warnings.map(w =>
    `${sevEmoji[w.severity] ?? "⚪"} ${w.caseNumber} — ${w.title.slice(0, 50)}\n   %${w.elapsed} geçti, ${w.minutesLeft} dk kaldı`
  ).join("\n\n");

  await notifyTelegram(
    `⚠️ SLA Proaktif Uyarı — ${warnings.length} vaka kritik eşikte\n\n${telegramLines}`
  );

  const tableRows = warnings.map(w => `
    <tr style="border-bottom:1px solid #1E2D42">
      <td style="padding:10px 12px;color:#E8EDF5;font-family:monospace;font-size:13px">${w.caseNumber}</td>
      <td style="padding:10px 12px;color:#A8B8D0;font-size:13px">${w.title.slice(0, 60)}</td>
      <td style="padding:10px 12px;text-align:center">
        <span style="background:rgba(255,69,96,0.15);color:#FF4560;padding:2px 8px;border-radius:4px;font-size:12px">
          %${w.elapsed}
        </span>
      </td>
      <td style="padding:10px 12px;color:#FFB020;text-align:right;font-size:13px">${w.minutesLeft} dk</td>
    </tr>`).join("");

  try {
    await sendMail({
      to: SOC_ADMIN_EMAIL,
      subject: `SLA Proaktif Uyarı — ${warnings.length} vaka kritik eşikte`,
      html: `
<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span><span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span><span style="color:#7B8FAF;font-size:14px">.io — SOC</span>
  </div>
  <div style="background:rgba(255,176,32,0.08);border:1px solid #FFB020;border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="color:#FFB020;font-weight:bold;font-size:16px">SLA Proaktif Uyarı</div>
    <div style="color:#A8B8D0;font-size:13px;margin-top:4px">
      ${warnings.length} vaka SLA süresinin %${WARNING_THRESHOLD_PCT}'ini geçti — ihlal olmadan önce müdahale gerekiyor
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:rgba(0,200,255,0.05)">
        <th style="padding:10px 12px;text-align:left;color:#7B8FAF;font-size:13px">Vaka No</th>
        <th style="padding:10px 12px;text-align:left;color:#7B8FAF;font-size:13px">Başlık</th>
        <th style="padding:10px 12px;text-align:center;color:#7B8FAF;font-size:13px">Süre %</th>
        <th style="padding:10px 12px;text-align:right;color:#7B8FAF;font-size:13px">Kalan</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <p style="font-size:12px;color:#5A6A80;margin-top:24px">
    SOC panelinden vakaları kapatmak veya escalate etmek için /panel/soc adresine gidin.
  </p>
</div>`.trim(),
    });
  } catch (err) {
    logger.warn({ err }, "sla_proactive_warning: e-posta gönderilemedi");
  }

  return warnings.length;
}
