/**
 * Cron Sağlık Monitörü
 * checkCronHealth() — son 24 saatteki cron durumunu analiz eder,
 * beklenen ama çalışmamış / hata veren / yavaş job'ları tespit eder.
 */

import { pool } from "@workspace/db";

// ─── Beklenen job'lar ve maksimum bekleme süresi ──────────────────────────────
// thresholdMinutes: intervalMinutes * 1.5 (50% grace) kullanılır

interface ExpectedJob {
  name: string;
  intervalMinutes: number;
  label: string;
}

export const EXPECTED_JOBS: ExpectedJob[] = [
  // Yüksek frekans — her 5-15 dk
  { name: "dns_monitor",          intervalMinutes: 5,     label: "DNS Monitor" },
  { name: "soc_triage",           intervalMinutes: 5,     label: "SOC Triage" },
  { name: "isr_imap",             intervalMinutes: 5,     label: "ISR IMAP" },
  { name: "noc_poll",             intervalMinutes: 5,     label: "NOC Poll" },
  { name: "noc_availability",     intervalMinutes: 5,     label: "NOC Availability" },
  { name: "servicenow_sync",      intervalMinutes: 15,    label: "ServiceNow Sync" },
  { name: "noc_triage",           intervalMinutes: 15,    label: "NOC Triage" },
  { name: "hitl_expire",          intervalMinutes: 15,    label: "HITL Expire" },
  { name: "webhook_retry",        intervalMinutes: 10,    label: "Webhook Retry" },
  { name: "email_sequence",       intervalMinutes: 30,    label: "Email Sequence" },
  { name: "kvkk_deadline",        intervalMinutes: 30,    label: "KVKK 72h Deadline" },
  // Saatlik
  { name: "lead_qual",            intervalMinutes: 60,    label: "Lead Kalifikasyon" },
  { name: "scan_lead_drip",       intervalMinutes: 60,    label: "Scan Lead Drip" },
  { name: "certstream_proc",      intervalMinutes: 60,    label: "Certstream İşle" },
  { name: "servicenow_health",    intervalMinutes: 60,    label: "ServiceNow Sağlık" },
  { name: "verification_queue",   intervalMinutes: 60,    label: "Doğrulama Kuyruğu" },
  { name: "noc_baseline",         intervalMinutes: 60,    label: "NOC Baseline" },
  // 4-6 saatlik
  { name: "intel_feeds",          intervalMinutes: 360,   label: "Intel Feeds" },
  { name: "market_watcher",       intervalMinutes: 240,   label: "Market İzleme" },
  { name: "cve_feed_check",       intervalMinutes: 120,   label: "CVE Feed" },
  // Günlük
  { name: "subscription_renewal", intervalMinutes: 1440,  label: "Abonelik Yenileme" },
  { name: "crtsh",                intervalMinutes: 1440,  label: "crt.sh Tarama" },
  { name: "shodan",               intervalMinutes: 1440,  label: "Shodan Tarama" },
  { name: "daily_summary",        intervalMinutes: 1440,  label: "Günlük Özet" },
  { name: "health_score",         intervalMinutes: 1440,  label: "Sağlık Skoru" },
  { name: "dunning_check",        intervalMinutes: 1440,  label: "Dunning Kontrolü" },
  { name: "upsell_engine",        intervalMinutes: 1440,  label: "Upsell Motoru" },
  { name: "digest_rss_collect",   intervalMinutes: 1440,  label: "Digest RSS Topla" },
  { name: "digest_enrich",        intervalMinutes: 1440,  label: "Digest Zenginleştir" },
  { name: "usom_refresh",         intervalMinutes: 1440,  label: "USOM Güncelle" },
  { name: "vulncheck_kev",        intervalMinutes: 1440,  label: "VulnCheck KEV" },
  { name: "domain_rescan",        intervalMinutes: 1440,  label: "Domain Yeniden Tarama" },
  { name: "onboarding_d3d7",      intervalMinutes: 1440,  label: "Onboarding D+3/D+7" },
  { name: "growth_ssl_expiry",    intervalMinutes: 1440,  label: "SSL Expiry Alert" },
  // Haftalık
  { name: "haftalik_bulten",      intervalMinutes: 10080, label: "Haftalık Bülten" },
  { name: "weekly_db_backup",     intervalMinutes: 10080, label: "DB Yedek" },
  { name: "github_secrets_scan",  intervalMinutes: 10080, label: "GitHub Secrets Tarama" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CronHealthAlert {
  job_name: string;
  label: string;
  issue: "not_run" | "failed" | "slow";
  last_run: string | null;
  details: string;
}

export interface CronHealthResult {
  healthy: boolean;
  checked_at: string;
  summary: {
    total_jobs: number;
    successful: number;
    failed: number;
    missing: number;
    slow: number;
  };
  alerts: CronHealthAlert[];
  job_details: Array<{
    name: string;
    label: string;
    last_run: string | null;
    last_status: string | null;
    last_error: string | null;
    avg_duration_ms: number | null;
    total_runs: number;
    ok_runs: number;
    error_runs: number;
  }>;
}

// ─── Core function ────────────────────────────────────────────────────────────

export async function checkCronHealth(): Promise<CronHealthResult> {
  const now = new Date();

  // Son 31 günlük istatistikler
  const { rows: stats } = await pool.query<{
    job_name: string;
    last_run: string | null;
    last_status: string | null;
    last_error: string | null;
    avg_duration_ms: number | null;
    total_runs: number;
    ok_runs: number;
    error_runs: number;
  }>(`
    SELECT
      job_name,
      MAX(started_at)                                                          AS last_run,
      (ARRAY_AGG(status ORDER BY started_at DESC))[1]                          AS last_status,
      (ARRAY_AGG(error_message ORDER BY started_at DESC)
        FILTER (WHERE error_message IS NOT NULL))[1]                           AS last_error,
      ROUND(AVG(duration_ms) FILTER (WHERE status IN ('ok','error')))::int     AS avg_duration_ms,
      COUNT(*) FILTER (WHERE status != 'skipped')                              AS total_runs,
      COUNT(*) FILTER (WHERE status = 'ok')                                    AS ok_runs,
      COUNT(*) FILTER (WHERE status = 'error')                                 AS error_runs
    FROM cron_job_runs
    WHERE started_at > NOW() - INTERVAL '31 days'
    GROUP BY job_name
  `);

  const statsByName = new Map(stats.map((s) => [s.job_name, s]));

  const alerts: CronHealthAlert[] = [];
  let successfulCount = 0;
  let failedCount = 0;
  let missingCount = 0;
  let slowCount = 0;

  for (const expected of EXPECTED_JOBS) {
    const stat = statsByName.get(expected.name);
    const thresholdMs = expected.intervalMinutes * 60 * 1000 * 1.5;

    if (!stat || !stat.last_run) {
      // Hiç çalışmamış
      missingCount++;
      alerts.push({
        job_name: expected.name,
        label: expected.label,
        issue: "not_run",
        last_run: null,
        details: `Son ${expected.intervalMinutes > 60 ? Math.round(expected.intervalMinutes / 60) + " saatte" : expected.intervalMinutes + " dakikada"} hiç çalışmadı`,
      });
      continue;
    }

    const lastRunMs = new Date(stat.last_run).getTime();
    const ageMs = now.getTime() - lastRunMs;

    // Çalışmış ama çok eski
    if (ageMs > thresholdMs) {
      missingCount++;
      const agoH = Math.round(ageMs / 3600000);
      alerts.push({
        job_name: expected.name,
        label: expected.label,
        issue: "not_run",
        last_run: stat.last_run,
        details: `Son çalışma ${agoH} saat önce (beklenen: her ${expected.intervalMinutes} dk)`,
      });
      continue;
    }

    // Son çalışma hatalı
    if (stat.last_status === "error") {
      failedCount++;
      alerts.push({
        job_name: expected.name,
        label: expected.label,
        issue: "failed",
        last_run: stat.last_run,
        details: stat.last_error?.slice(0, 200) ?? "Bilinmeyen hata",
      });
      continue;
    }

    // Yavaş çalışıyor (avg > %50 interval)
    const slowThresholdMs = expected.intervalMinutes * 60 * 1000 * 0.5;
    if (stat.avg_duration_ms != null && stat.avg_duration_ms > slowThresholdMs) {
      slowCount++;
      alerts.push({
        job_name: expected.name,
        label: expected.label,
        issue: "slow",
        last_run: stat.last_run,
        details: `Ortalama süre ${Math.round(stat.avg_duration_ms / 1000)}s (interval'ın %${Math.round(stat.avg_duration_ms / (expected.intervalMinutes * 600))}u)`,
      });
      // Yavaş olsa da başarılı sayılır
      successfulCount++;
      continue;
    }

    successfulCount++;
  }

  // job_details: tüm expected job'ların detayları
  const jobDetails = EXPECTED_JOBS.map((exp) => {
    const s = statsByName.get(exp.name);
    return {
      name: exp.name,
      label: exp.label,
      last_run: s?.last_run ?? null,
      last_status: s?.last_status ?? null,
      last_error: s?.last_error ?? null,
      avg_duration_ms: s?.avg_duration_ms ?? null,
      total_runs: Number(s?.total_runs ?? 0),
      ok_runs: Number(s?.ok_runs ?? 0),
      error_runs: Number(s?.error_runs ?? 0),
    };
  });

  return {
    healthy: alerts.length === 0,
    checked_at: now.toISOString(),
    summary: {
      total_jobs: EXPECTED_JOBS.length,
      successful: successfulCount,
      failed: failedCount,
      missing: missingCount,
      slow: slowCount,
    },
    alerts,
    job_details: jobDetails,
  };
}
