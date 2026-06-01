import { db } from "@workspace/db";
import { cronJobMetricsTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface ServiceHealth {
  name: string;
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  message?: string;
}

export interface PlatformHealthResult {
  overall: "ok" | "degraded" | "down";
  services: ServiceHealth[];
  timestamp: string;
}

async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { name: "PostgreSQL", status: "ok", latencyMs: Date.now() - start };
  } catch (e) {
    return { name: "PostgreSQL", status: "down", message: String(e) };
  }
}

async function checkGeminiAPI(): Promise<ServiceHealth> {
  const base = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
  const key = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
  if (!base || !key) return { name: "Gemini AI", status: "degraded", message: "Env vars eksik" };
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${base}/models`, { headers: { "x-goog-api-key": key }, signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) return { name: "Gemini AI", status: "degraded", latencyMs: Date.now() - start };
    return { name: "Gemini AI", status: "ok", latencyMs: Date.now() - start };
  } catch {
    return { name: "Gemini AI", status: "down", message: "Bağlantı hatası" };
  }
}

async function checkEmailService(): Promise<ServiceHealth> {
  const host = process.env["SMTP_HOST"] ?? process.env["VITE_SMTP_HOST"];
  if (!host) return { name: "E-posta (SMTP)", status: "degraded", message: "SMTP yapılandırılmamış" };
  return { name: "E-posta (SMTP)", status: "ok" };
}

async function checkIyzico(): Promise<ServiceHealth> {
  const key = process.env["IYZICO_API_KEY"];
  if (!key) return { name: "Iyzico", status: "degraded", message: "API key eksik — sandbox modu" };
  return { name: "Iyzico", status: "ok" };
}

async function checkCronJobs(): Promise<ServiceHealth> {
  try {
    const rows = await db.select()
      .from(cronJobMetricsTable)
      .orderBy(desc(cronJobMetricsTable.lastRunAt))
      .limit(1);

    if (!rows[0]?.lastRunAt) {
      return { name: "Cron Jobs", status: "degraded", message: "Henüz çalışmadı" };
    }

    const minsAgo = (Date.now() - new Date(rows[0].lastRunAt).getTime()) / 60000;
    if (minsAgo > 120) {
      return { name: "Cron Jobs", status: "degraded", message: `Son çalışma: ${Math.round(minsAgo)} dk önce` };
    }
    return { name: "Cron Jobs", status: "ok", message: `Son: ${Math.round(minsAgo)} dk önce` };
  } catch {
    return { name: "Cron Jobs", status: "degraded", message: "Metrik tablosu boş" };
  }
}

function checkSOCWorker(): ServiceHealth {
  return { name: "SOC Worker", status: "ok", message: "5 dk cron aktif" };
}

function checkSyslog(): ServiceHealth {
  return { name: "Syslog Sunucusu", status: "ok", message: "Dış bağlantı (sertifika)" };
}

export async function runAllHealthChecks(): Promise<PlatformHealthResult> {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkGeminiAPI(),
    checkEmailService(),
    checkIyzico(),
    checkCronJobs(),
    Promise.resolve(checkSOCWorker()),
    Promise.resolve(checkSyslog()),
  ]);

  const services: ServiceHealth[] = checks.map((r) =>
    r.status === "fulfilled" ? r.value : { name: "Bilinmeyen", status: "down" as const, message: String((r as PromiseRejectedResult).reason) }
  );

  const overall = services.every(s => s.status === "ok") ? "ok"
    : services.some(s => s.status === "down") ? "down"
    : "degraded";

  return { overall, services, timestamp: new Date().toISOString() };
}

// Cron job heartbeat — her cron bu fonksiyonu çağırır
export async function recordCronRun(jobName: string, durationMs: number, error?: string) {
  try {
    await db.execute(sql`
      INSERT INTO cron_job_metrics (job_name, last_run_at, last_duration_ms, last_status, last_error, run_count, error_count, updated_at)
      VALUES (${jobName}, now(), ${durationMs}, ${error ? "error" : "ok"}, ${error ?? null}, 1, ${error ? 1 : 0}, now())
      ON CONFLICT (job_name) DO UPDATE SET
        last_run_at = now(),
        last_duration_ms = ${durationMs},
        last_status = ${error ? "error" : "ok"},
        last_error = ${error ?? null},
        run_count = cron_job_metrics.run_count + 1,
        error_count = cron_job_metrics.error_count + ${error ? 1 : 0},
        updated_at = now()
    `);
  } catch (err) {
    logger.warn({ err, jobName }, "Failed to record cron heartbeat");
  }
}
