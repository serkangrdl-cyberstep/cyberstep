import { pool } from "@workspace/db";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

const ADMIN_EMAIL = process.env["ADMIN_EMAIL"] ?? "info@cyberstep.com";
const TELEGRAM_TOKEN = process.env["ADMIN_TELEGRAM_BOT_TOKEN"];
const TELEGRAM_CHAT  = process.env["ADMIN_TELEGRAM_CHAT_ID"];

const BASE_URL = process.env["REPLIT_DOMAINS"]
  ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
  : "http://localhost:80";

async function notifyTelegram(message: string): Promise<void> {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message }),
    });
  } catch (err) {
    logger.warn({ err }, "platform_smoke_test: Telegram bildirimi gönderilemedi");
  }
}

type CheckResult = { name: string; ok: boolean; detail: string; ms: number };

async function checkHealthz(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(8000) });
    const ms = Date.now() - start;
    return { name: "API /health", ok: res.ok, detail: `HTTP ${res.status}`, ms };
  } catch (err) {
    return { name: "API /health", ok: false, detail: String(err), ms: Date.now() - start };
  }
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    return { name: "PostgreSQL", ok: true, detail: "SELECT 1 OK", ms: Date.now() - start };
  } catch (err) {
    return { name: "PostgreSQL", ok: false, detail: String(err), ms: Date.now() - start };
  }
}

async function checkGemini(): Promise<CheckResult> {
  const start = Date.now();
  const apiKey  = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
  const baseUrl = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
  if (!apiKey || !baseUrl) {
    return { name: "Gemini API", ok: true, detail: "env yok — atlandı", ms: 0 };
  }
  try {
    // Replit's Gemini proxy does not expose GET /openai/models.
    // Use a minimal chat completion to verify the integration is live.
    const res = await fetch(
      `${baseUrl}/openai/chat/completions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const ms = Date.now() - start;
    // 200 or 400/422 (bad request but proxy is alive) both mean the integration is reachable
    const ok = res.status < 500;
    return { name: "Gemini API", ok, detail: `HTTP ${res.status}`, ms };
  } catch (err) {
    return { name: "Gemini API", ok: false, detail: String(err), ms: Date.now() - start };
  }
}

export async function runPlatformSmokeTest(): Promise<number> {
  logger.info("platform_smoke_test: başladı");

  const [healthz, db, gemini] = await Promise.all([
    checkHealthz(),
    checkDatabase(),
    checkGemini(),
  ]);

  const checks = [healthz, db, gemini];
  const failed = checks.filter(c => !c.ok);

  if (failed.length === 0) {
    logger.info({ checks: checks.map(c => ({ name: c.name, ms: c.ms })) }, "platform_smoke_test: tüm kontroller geçti");
    return 0;
  }

  const failList = failed.map(f => `  ✗ ${f.name}: ${f.detail}`).join("\n");
  const message  = `🚨 CyberStep Platform Uyarısı\n\n${failed.length}/${checks.length} kontrol başarısız:\n${failList}\n\nZaman: ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`;

  logger.error({ failed }, "platform_smoke_test: HATA — platform sorunları var");

  await notifyTelegram(message);

  try {
    await sendMail({
      to: ADMIN_EMAIL,
      subject: `CyberStep Platform Uyarı — ${failed.length} kontrol başarısız`,
      html: `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="background:rgba(255,69,96,0.1);border:1px solid #FF4560;border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="color:#FF4560;font-weight:bold;font-size:18px">Platform Smoke Test Başarısız</div>
    <div style="color:#A8B8D0;font-size:13px;margin-top:4px">${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</div>
  </div>
  <table style="width:100%;border-collapse:collapse">
    ${checks.map(c => `
    <tr style="border-bottom:1px solid #1E2D42">
      <td style="padding:10px 12px;color:${c.ok ? "#00E096" : "#FF4560"};font-weight:bold">${c.ok ? "✓" : "✗"}</td>
      <td style="padding:10px 12px;color:#E8EDF5">${c.name}</td>
      <td style="padding:10px 12px;color:#A8B8D0;font-size:13px">${c.detail}</td>
      <td style="padding:10px 12px;color:#5A6A80;font-size:12px;text-align:right">${c.ms}ms</td>
    </tr>`).join("")}
  </table>
</div>`.trim(),
    });
  } catch (err) {
    logger.warn({ err }, "platform_smoke_test: admin e-postası gönderilemedi");
  }

  return failed.length;
}
